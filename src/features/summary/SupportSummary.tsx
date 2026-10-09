import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  RefreshCw,
  Sparkles,
  FileText,
  Code2,
  Headphones,
} from "lucide-react";
import { api, apiMode } from "../../data/api";
import { useIdentity } from "../platform/identity";
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
} from "../../components/ui";
import { loadSummary, type Summary, type Evidence, type Advice } from "./data";

const areas = [
  {
    key: "Policy",
    title: "Policy & communication",
    icon: FileText,
  },
  {
    key: "Product",
    title: "Product & engineering",
    icon: Code2,
  },
  {
    key: "Operations",
    title: "Support operations",
    icon: Headphones,
  },
] as const;
function rate(value: number | null) {
  return value == null ? "Not available" : `${value.toFixed(1)}%`;
}
function comparison(
  current: number | null,
  previous: number | null,
  suffix = "",
) {
  if (current == null || previous == null) return "No comparison available";
  const change = current - previous;
  return `${change > 0 ? "+" : ""}${change.toFixed(1)}${suffix} vs previous period`;
}
function EvidenceLinks({
  refs,
  evidence,
}: {
  refs: string[];
  evidence: Evidence[];
}) {
  return (
    <div className="summary-evidence" aria-label="Supporting conversations">
      {refs.map((ref) => {
        const call = evidence.find((c) => c.reference === ref);
        return call ? (
          <Link key={ref} to={`/conversations/${call.id}`} title={call.title}>
            {ref}
            <ArrowRight size={12} />
          </Link>
        ) : null;
      })}
    </div>
  );
}
function AdviceCard({
  advice,
  evidence,
}: {
  advice: Advice;
  evidence: Evidence[];
}) {
  return (
    <article className="summary-advice">
      <Badge tone={advice.priority}>{advice.priority} priority</Badge>
      <h3>{advice.title}</h3>
      <p className="summary-observation">{advice.observation}</p>
      <p className="summary-action">
        <strong>Next step: </strong>
        {advice.recommendation}
      </p>
      <details className="content-details">
        <summary>Validation & measurement</summary>
        <p>{advice.validation}</p>
        <div className="summary-measure">
          <strong>Measure progress</strong>
          <p>{advice.successMetric}</p>
        </div>
      </details>
      <EvidenceLinks refs={advice.evidenceRefs} evidence={evidence} />
    </article>
  );
}
export default function SupportSummary() {
  const user = useIdentity();
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const days = [7, 30, 90].includes(Number(params.get("period")))
    ? Number(params.get("period"))
    : 7;
  const samplesInUrl = params.get("samples") !== "false";
  const [sampleControl, setSampleControl] = useState({
    url: samplesInUrl,
    checked: samplesInUrl,
  });
  if (sampleControl.url !== samplesInUrl) {
    setSampleControl({ url: samplesInUrl, checked: samplesInUrl });
  }
  const includeSamples = sampleControl.checked;
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const key = ["support-summary", days, includeSamples];
  const query = useQuery({
    queryKey: key,
    queryFn: () => loadSummary(days, includeSamples),
    refetchInterval: (q) =>
      ["QUEUED", "PROCESSING"].includes(q.state.data?.status ?? "")
        ? 3000
        : false,
  });
  const generate = useMutation({
    mutationFn: () =>
      api<Summary>("/support-summary", {
        method: "POST",
        headers: { "Idempotency-Key": requestKey },
        body: JSON.stringify({ days, includeSamples }),
      }),
    onSuccess: (result) => {
      client.setQueryData(
        [
          "support-summary",
          result.snapshot.days,
          result.snapshot.includeSamples,
        ],
        result,
      );
      setRequestKey(crypto.randomUUID());
    },
  });
  function change(name: string, value: string) {
    if (name === "samples")
      setSampleControl({ url: samplesInUrl, checked: value === "true" });
    const next = new URLSearchParams(params);
    next.set(name, value);
    setParams(next);
    generate.reset();
    setRequestKey(crypto.randomUUID());
  }
  const summary = query.data;
  const busy =
    generate.isPending ||
    ["QUEUED", "PROCESSING"].includes(summary?.status ?? "");
  const canGenerate =
    apiMode && !!user && ["ADMIN", "ANALYST", "REVIEWER"].includes(user.role);
  return (
    <>
      <PageHeader
        title="Support summary"
        action={
          <label className="period-picker">
            <span>Period</span>
            <select
              aria-label="Summary period"
              value={days}
              disabled={generate.isPending}
              onChange={(e) => change("period", e.target.value)}
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </label>
        }
      />
      <div className="summary-toolbar">
        <label>
          <input
            type="checkbox"
            checked={includeSamples}
            disabled={generate.isPending}
            onChange={(e) => change("samples", String(e.target.checked))}
          />{" "}
          Include sample recordings
        </label>
        {canGenerate && (
          <button
            className="button"
            disabled={busy || !summary?.snapshot.current.calls}
            onClick={() => generate.mutate()}
          >
            <RefreshCw size={15} />
            {busy
              ? "Preparing summary…"
              : summary?.report
                ? "Refresh analysis"
                : summary?.status === "FAILED"
                  ? "Try analysis again"
                  : "Generate analysis"}
          </button>
        )}
      </div>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        summary && <SummaryContent summary={summary} busy={busy} />
      )}
      {generate.isError && (
        <p className="field-error" role="alert">
          {generate.error.message}
        </p>
      )}
    </>
  );
}
function SummaryContent({
  summary,
  busy,
}: {
  summary: Summary;
  busy: boolean;
}) {
  const { current, previous, evidence, issues, start, end } = summary.snapshot;
  const report = summary.report;
  const span = `${new Date(start).toLocaleDateString()} to ${new Date(end).toLocaleDateString()}`;
  return (
    <>
      {current.samples > 0 && (
        <div className="sample-notice">
          <strong>Includes {current.samples} sample recordings</strong>
          <span>Fictional calls, not real customer results.</span>
        </div>
      )}
      {!apiMode && (
        <p className="notice">
          Demo analysis uses illustrative advice. Connect the local backend to
          generate a report from your own recordings.
        </p>
      )}
      <p className="summary-scope">
        {span} · Compared with the previous {summary.snapshot.days} days
      </p>
      <div className="summary-metrics">
        <article className="panel" data-accent="blue">
          <span>Analyzed conversations</span>
          <strong>{current.calls}</strong>
          <small>
            {current.customers} distinct customers · {previous.calls} calls in
            prior period
          </small>
        </article>
        <article className="panel" data-accent="rose">
          <span>Negative sentiment</span>
          <strong>{rate(current.negativeRate)}</strong>
          <small>
            {current.negative} of {current.calls} calls
          </small>
          <small>
            {comparison(
              current.negativeRate,
              previous.negativeRate,
              " percentage points",
            )}
          </small>
        </article>
        <article className="panel" data-accent="amber">
          <span>Repeat callers</span>
          <strong>{rate(current.repeatRate)}</strong>
          <small>
            {current.repeatCustomers} of {current.customers} customers had
            multiple calls
          </small>
          <small>
            {comparison(
              current.repeatRate,
              previous.repeatRate,
              " percentage points",
            )}
          </small>
        </article>
        <article className="panel" data-accent="violet">
          <span>Average recording length</span>
          <strong>
            {current.averageDuration == null
              ? "Not available"
              : `${Math.floor(current.averageDuration / 60)}m ${Math.round(current.averageDuration % 60)}s`}
          </strong>
          <small>Recording length, excluding after-call work</small>
        </article>
      </div>
      {!current.calls ? (
        <section className="panel">
          <EmptyState title="There is not enough evidence yet">
            Choose another period, include samples, or{" "}
            <Link to="/conversations">import recordings</Link> to begin.
          </EmptyState>
        </section>
      ) : (
        <>
          <div className="summary-review-grid">
            <Panel title="Overall assessment" action={<Sparkles size={19} />}>
              <div className="panel-copy">
                {busy ? (
                  <div role="status" className="summary-working">
                    <span className="skeleton" />
                    Reviewing the calls and preparing evidence-backed advice.
                    You can leave this page and return later.
                  </div>
                ) : report ? (
                  <p className="summary-overview">{report.overview}</p>
                ) : (
                  <p>
                    {summary.status === "FAILED"
                      ? "The local analysis could not finish. Try again when the model is available."
                      : "Generate an analysis to turn these patterns into practical advice for your team."}
                  </p>
                )}
                {!!report?.strengths.length && (
                  <div className="summary-strengths">
                    <h3>What is working well</h3>
                    {report.strengths.map((s, i) => (
                      <div key={i}>
                        <strong>{s.title}</strong>
                        <p>{s.observation}</p>
                        <EvidenceLinks
                          refs={s.evidenceRefs}
                          evidence={evidence}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Panel>
            <Panel title="Top customer issues">
              <div className="summary-issues">
                {issues.length ? (
                  issues.map((issue) => (
                    <Link to={`/issues/${issue.id}`} key={issue.id}>
                      <div>
                        <strong>{issue.title}</strong>
                        <small>
                          {issue.category} · {issue.customers} customers
                        </small>
                      </div>
                      <span>
                        {issue.calls} calls <ArrowRight size={14} />
                      </span>
                    </Link>
                  ))
                ) : (
                  <p>No issue clusters were identified in these recordings.</p>
                )}
              </div>
            </Panel>
          </div>
          {report && (
            <div className="summary-areas">
              {areas.map(({ key, title, icon: Icon }) => (
                <Panel
                  key={key}
                  title={title}
                  className={`advice-area-${key.toLowerCase()}`}
                  action={<Icon size={19} />}
                >
                  {report.advice.filter((a) => a.area === key).length ? (
                    report.advice
                      .filter((a) => a.area === key)
                      .map((advice, i) => (
                        <AdviceCard
                          key={i}
                          advice={advice}
                          evidence={evidence}
                        />
                      ))
                  ) : (
                    <p className="panel-copy">
                      No specific change is supported by the available evidence
                      in this area.
                    </p>
                  )}
                </Panel>
              ))}
            </div>
          )}
        </>
      )}
      <details className="panel content-details summary-method-details">
        <summary>About this analysis</summary>
        <div className="summary-method">
          <div>
            <h2>Coverage</h2>
            <p>
              {current.calls} of {current.imported} imported calls in this
              period are complete; {current.failed} failed. Advice uses the
              latest {evidence.length} completed call summaries. Metrics cover
              all eligible calls. Snapshot: {new Date(end).toLocaleString()}.
            </p>
          </div>
          <div>
            <h2>What the metrics mean</h2>
            <p>
              Sentiment describes the recorded experience. Multiple calls can
              have different reasons. Neither metric establishes satisfaction,
              first-contact resolution or an individual agent’s performance.
            </p>
          </div>
          <div>
            <h2>Before changing policy or code</h2>
            <p>
              No policy documents, source code, SLA targets or resolution
              records were analyzed. Treat suggestions as investigation steps.
              Validate them with the relevant team and measure the result.
            </p>
          </div>
        </div>
      </details>
    </>
  );
}
