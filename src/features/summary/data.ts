import { api, apiMode } from "../../data/api";
import { repository } from "../../data/queries";
import { inPeriod } from "../../domain/analytics";
import { snapshotDate, type Conversation } from "../../domain/models";
import { callReference, callTitle } from "../../domain/presentation";

export interface Metrics {
  imported: number;
  failed: number;
  calls: number;
  customers: number;
  positive: number;
  neutral: number;
  negative: number;
  samples: number;
  issueCalls: number;
  averageDuration: number | null;
  repeatCustomers: number;
  negativeRate: number | null;
  issueRate: number | null;
  repeatRate: number | null;
}
export interface Evidence {
  id: string;
  reference: string;
  title: string;
  summary: string;
  sentiment: string;
  sample: boolean;
}
export interface Finding {
  title: string;
  observation: string;
  evidenceRefs: string[];
}
export interface Advice extends Finding {
  area: "Policy" | "Product" | "Operations";
  priority: "High" | "Medium" | "Low";
  recommendation: string;
  validation: string;
  successMetric: string;
}
export interface Summary {
  id?: string;
  status: "NOT_GENERATED" | "QUEUED" | "PROCESSING" | "FAILED" | "COMPLETED";
  snapshot: {
    days: number;
    includeSamples: boolean;
    start: string;
    end: string;
    previousStart: string;
    current: Metrics;
    previous: Metrics;
    evidence: Evidence[];
    issues: {
      id: string;
      title: string;
      category: string;
      calls: number;
      customers: number;
    }[];
  };
  report?: {
    overview: string;
    strengths: Finding[];
    advice: Advice[];
    model: string;
    promptVersion: string;
  } | null;
}
function metrics(calls: Conversation[]): Metrics {
  const customers = new Map<string, number>();
  for (const call of calls)
    customers.set(call.customer, (customers.get(call.customer) ?? 0) + 1);
  const negative = calls.filter((c) => c.sentiment === "Negative").length;
  const repeats = [...customers.values()].filter((count) => count > 1).length;
  const issueCalls = calls.filter(
    (c) => c.issueId || c.issueIds?.length,
  ).length;
  return {
    imported: calls.length,
    failed: 0,
    calls: calls.length,
    customers: customers.size,
    positive: calls.filter((c) => c.sentiment === "Positive").length,
    neutral: calls.filter((c) => c.sentiment === "Neutral").length,
    negative,
    samples: calls.length,
    issueCalls,
    repeatCustomers: repeats,
    averageDuration: calls.length
      ? calls.reduce((sum, c) => sum + c.duration, 0) / calls.length
      : null,
    negativeRate: calls.length ? (negative * 100) / calls.length : null,
    issueRate: calls.length ? (issueCalls * 100) / calls.length : null,
    repeatRate: customers.size ? (repeats * 100) / customers.size : null,
  };
}
export async function loadSummary(
  days: number,
  includeSamples: boolean,
): Promise<Summary> {
  if (apiMode)
    return api(
      `/support-summary?days=${days}&includeSamples=${includeSamples}`,
    );
  const data = await repository.getWorkspace();
  const start = new Date(snapshotDate.getTime() - days * 86400000);
  const calls = includeSamples
    ? inPeriod(data.conversations, days, snapshotDate)
    : [];
  const evidence = calls.slice(0, 40).map((call) => ({
    id: call.id,
    reference: callReference(call),
    title: callTitle(call),
    summary: call.summary,
    sentiment: call.sentiment,
    sample: true,
  }));
  const recipes = [
    {
      area: "Product" as const,
      issue: "ISS-001",
      title: "Investigate verification-code delivery",
      recommendation:
        "Trace delivery and expiry timestamps for the reported sign-in attempts before changing retry behavior.",
      validation:
        "Check provider delivery logs and reproduce delayed code arrival. No source code has been reviewed.",
      successMetric: "Expired-code contacts per sign-in attempt.",
    },
    {
      area: "Operations" as const,
      issue: "ISS-002",
      title: "Close the loop on delivery enquiries",
      recommendation:
        "Give each card-delivery enquiry a follow-up owner and communicate the next update time.",
      validation:
        "Review courier and support handoffs. Verify whether customers received the promised updates.",
      successMetric: "Repeat delivery enquiries per card order.",
    },
    {
      area: "Policy" as const,
      issue: "ISS-003",
      title: "Review how transfer fees are explained",
      recommendation:
        "Review the fee explanation shown before transfer confirmation and the corresponding support guidance.",
      validation:
        "Compare the documented fee policy with the customer-facing flow before proposing a policy change.",
      successMetric: "Fee-clarification contacts per completed transfer.",
    },
  ];
  const advice = recipes.flatMap((recipe) => {
    const supporting = calls.filter(
      (c) => c.issueId === recipe.issue && evidence.some((e) => e.id === c.id),
    );
    return supporting.length
      ? [
          {
            ...recipe,
            priority: "High" as const,
            observation: supporting[0].summary,
            evidenceRefs: supporting.slice(0, 3).map(callReference),
          },
        ]
      : [];
  });
  const positive = evidence.find((c) => c.sentiment === "Positive");
  return {
    status: calls.length ? "COMPLETED" : "NOT_GENERATED",
    snapshot: {
      days,
      includeSamples,
      start: start.toISOString(),
      end: snapshotDate.toISOString(),
      previousStart: new Date(start.getTime() - days * 86400000).toISOString(),
      current: metrics(calls),
      previous: metrics(
        includeSamples ? inPeriod(data.conversations, days, start) : [],
      ),
      evidence,
      issues: data.issues
        .map((issue) => {
          const affected = calls.filter((c) => c.issueId === issue.id);
          return {
            ...issue,
            calls: affected.length,
            customers: new Set(affected.map((c) => c.customer)).size,
          };
        })
        .filter((issue) => issue.calls > 0)
        .sort((a, b) => b.calls - a.calls),
    },
    report: calls.length
      ? {
          overview:
            "This illustrative review highlights sign-in friction, delivery follow-ups and fee explanations. Use the supporting calls to decide which policy, engineering and operational questions deserve investigation.",
          strengths: positive
            ? [
                {
                  title: "A smooth customer experience to preserve",
                  observation: positive.summary,
                  evidenceRefs: [positive.reference],
                },
              ]
            : [],
          advice,
          model: "Illustrative demo",
          promptVersion: "demo-v1",
        }
      : null,
  };
}
