import { apiMode } from "../../data/api";
import { useIdentity } from "../platform/identity";
import { Outcomes } from "../platform/Outcomes";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Clock3, Lightbulb } from "lucide-react";
import { format } from "date-fns";
import { WorkspaceView } from "../../components/WorkspaceView";
import { Badge, EmptyState, PageHeader, TextLink } from "../../components/ui";
import { useAdvance } from "../../data/queries";
import { issueMetrics } from "../../domain/analytics";
import type { Recommendation } from "../../domain/models";
import { ReviewDialog } from "./ReviewDialog";

export default function Decisions() {
  const user = useIdentity();
  const canReview =
    !apiMode || (user && ["ADMIN", "REVIEWER"].includes(user.role));
  const [params, setParams] = useSearchParams();
  const [review, setReview] = useState<Recommendation | null>(null);
  const advance = useAdvance();
  const filter = params.get("status") ?? "All proposals";
  return (
    <>
      <PageHeader
        eyebrow="HUMAN JUDGMENT. BETTER OUTCOMES."
        title="Decision center"
        description="Review the evidence, choose a direction, and keep your team accountable."
      />
      <WorkspaceView>
        {(data) => {
          const recs = data.recommendations.filter(
            (r) =>
              (!params.get("recommendation") ||
                r.id === params.get("recommendation")) &&
              (filter === "All proposals" ||
                (data.decisions.find((d) => d.recommendationId === r.id)
                  ?.status ?? "Pending review") === filter),
          );
          return (
            <>
              <div className="filter-toolbar standalone">
                <div className="segmented" aria-label="Filter recommendations">
                  {[
                    "All proposals",
                    "Pending review",
                    "Approved",
                    "In progress",
                    "Completed",
                    "Rejected",
                  ].map((status) => (
                    <button
                      key={status}
                      aria-pressed={filter === status}
                      onClick={() =>
                        setParams(status === "All proposals" ? {} : { status })
                      }
                    >
                      {status}
                    </button>
                  ))}
                </div>
                {params.has("recommendation") && (
                  <button
                    className="button ghost"
                    onClick={() => setParams({})}
                  >
                    Show all proposals
                  </button>
                )}
              </div>
              {advance.isError && (
                <p role="alert" className="notice error">
                  {advance.error.message}
                </p>
              )}
              <div className="decision-list">
                {recs.map((rec) => {
                  const decision = data.decisions.find(
                    (d) => d.recommendationId === rec.id,
                  );
                  const issue = data.issues.find((i) => i.id === rec.issueId)!;
                  const metrics = issueMetrics(data.conversations, rec.issueId);
                  return (
                    <article key={rec.id} className="panel decision-card">
                      <div className="decision-heading">
                        <span className="category-icon">
                          <Lightbulb size={21} />
                        </span>
                        <div>
                          <div className="decision-meta">
                            <span className="mono">{rec.id}</span>
                            <Badge tone={rec.priority}>
                              {rec.priority} priority
                            </Badge>
                            <Badge tone={decision?.status ?? "Pending review"}>
                              {decision?.status ?? "Pending review"}
                            </Badge>
                          </div>
                          <h2>{rec.title}</h2>
                          <p>{rec.description}</p>
                        </div>
                      </div>
                      <div className="decision-body">
                        <div>
                          <h3>Proposed action</h3>
                          <p>{rec.proposedAction}</p>
                          <h3>Expected outcome</h3>
                          <p>{rec.expectedOutcome}</p>
                        </div>
                        <aside className="evidence-box">
                          <span className="eyebrow">SUPPORTING EVIDENCE</span>
                          <strong>{metrics.count} affected calls</strong>
                          <p>{metrics.customers} customers · Last 7 days</p>
                          <TextLink to={`/issues/${issue.id}`}>
                            {issue.title}
                          </TextLink>
                          <span className="effort">
                            <Clock3 size={14} />
                            {rec.effort}
                          </span>
                        </aside>
                      </div>
                      {decision && (
                        <div className="decision-review">
                          <div className="split">
                            <h3>Human review</h3>
                            <span className="muted">
                              Owner: {decision.owner}
                            </span>
                          </div>
                          <p>{decision.rationale}</p>
                          <ol className="audit-trail">
                            {decision.history.map((event) => (
                              <li key={`${event.at}-${event.status}`}>
                                <Check size={13} />
                                <strong>{event.status}</strong>
                                <span>
                                  {event.actor} ·{" "}
                                  {format(new Date(event.at), "MMM d, HH:mm")}
                                </span>
                              </li>
                            ))}
                          </ol>
                          {decision.status === "Completed" && (
                            <>
                              {apiMode && decision.id ? (
                                <Outcomes id={decision.id} />
                              ) : (
                                <div className="notice">
                                  Action marked complete in this demo. Outcome
                                  measurement requires connected production
                                  data; no impact is claimed.
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      <div className="decision-footer">
                        <span className="muted">
                          {apiMode
                            ? "Local model recommendation · Human approval required"
                            : "Sample recommendation · Human approval required"}
                        </span>
                        {!canReview ? (
                          <span className="muted">Reviewer role required</span>
                        ) : !decision ? (
                          <button
                            className="button"
                            onClick={() => setReview(rec)}
                          >
                            Review proposal
                          </button>
                        ) : decision.status === "Approved" ||
                          decision.status === "In progress" ? (
                          <button
                            className="button"
                            disabled={advance.isPending}
                            onClick={() =>
                              advance.mutate({
                                id: rec.id,
                                version: decision.version,
                              })
                            }
                          >
                            {decision.status === "Approved"
                              ? "Start action"
                              : "Mark action complete"}
                          </button>
                        ) : (
                          <Badge tone={decision.status}>
                            {decision.status}
                          </Badge>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
              {!recs.length && (
                <EmptyState title="No proposals in this view">
                  Choose another status to see more recommendations.
                </EmptyState>
              )}
            </>
          );
        }}
      </WorkspaceView>
      {review && (
        <ReviewDialog
          key={review.id}
          recommendation={review}
          onClose={() => setReview(null)}
        />
      )}
    </>
  );
}
