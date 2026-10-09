import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { WorkspaceView } from "../../components/WorkspaceView";
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  TextLink,
} from "../../components/ui";
import { inPeriod, issueMetrics } from "../../domain/analytics";

export default function IssueDetail() {
  const { id } = useParams();
  return (
    <WorkspaceView>
      {(data) => {
        const issue = data.issues.find((i) => i.id === id);
        if (!issue)
          return (
            <EmptyState title="Issue not found">
              <Link to="/issues">Back to issues</Link>
            </EmptyState>
          );
        const metrics = issueMetrics(data.conversations, issue.id);
        const calls = inPeriod(data.conversations, 7).filter(
          (c) => c.issueId === issue.id,
        );
        const recs = data.recommendations.filter((r) => r.issueId === issue.id);
        return (
          <>
            <Link className="back-link" to="/issues">
              <ArrowLeft size={15} />
              All issues
            </Link>
            <PageHeader
              eyebrow={`${issue.id} · ${issue.category}`}
              title={issue.title}
              description={issue.description}
              action={
                <Badge tone={issue.priority}>{issue.priority} priority</Badge>
              }
            />
            <div className="detail-grid">
              <div className="stack">
                <Panel
                  title="Supporting conversations"
                  description={`${metrics.count} affected calls · ${metrics.customers} unique customers · Last 7 days`}
                  action={
                    <TextLink to={`/conversations?issue=${issue.id}`}>
                      View all history
                    </TextLink>
                  }
                >
                  <div className="evidence-list">
                    {calls.slice(0, 5).map((call) => (
                      <article key={call.id}>
                        <div className="split">
                          <TextLink to={`/conversations/${call.id}`}>
                            {call.id}
                          </TextLink>
                          <Badge tone={call.sentiment}>{call.sentiment}</Badge>
                        </div>
                        <blockquote>
                          “
                          {
                            call.transcript.find(
                              (s) => s.speaker === "Customer",
                            )?.text
                          }
                          ”
                        </blockquote>
                        <span className="muted">
                          {call.customer} · Synthetic example
                        </span>
                      </article>
                    ))}
                  </div>
                </Panel>
              </div>
              <div className="stack">
                <Panel
                  title="Root cause hypothesis"
                  description="Requires investigation"
                >
                  <p className="panel-copy">{issue.hypothesis}</p>
                  <div className="notice">
                    A correlation is not a confirmed cause. Validate this
                    hypothesis against operational data.
                  </div>
                </Panel>
                <Panel title="Recommended next steps">
                  <div className="panel-copy">
                    {recs.length ? (
                      recs.map((rec) => (
                        <div key={rec.id}>
                          <h3>{rec.title}</h3>
                          <p>{rec.proposedAction}</p>
                          <TextLink to={`/decisions?recommendation=${rec.id}`}>
                            Review recommendation
                          </TextLink>
                        </div>
                      ))
                    ) : (
                      <p>
                        No recommendation has been proposed for this issue yet.
                      </p>
                    )}
                  </div>
                </Panel>
              </div>
            </div>
          </>
        );
      }}
    </WorkspaceView>
  );
}
