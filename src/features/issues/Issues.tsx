import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, GitBranch, Search } from "lucide-react";
import { WorkspaceView } from "../../components/WorkspaceView";
import { Badge, EmptyState, PageHeader } from "../../components/ui";
import { issueMetrics } from "../../domain/analytics";

export default function Issues() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  return (
    <>
      <PageHeader title="Issue intelligence" />
      <WorkspaceView>
        {(data) => {
          const issues = data.issues.filter((i) =>
            `${i.title} ${i.category}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          );
          return (
            <>
              <div className="filter-toolbar standalone">
                <div className="search-field">
                  <Search size={18} />
                  <input
                    aria-label="Search issues"
                    type="search"
                    value={query}
                    placeholder="Search issues or product areas…"
                    onChange={(e) =>
                      setParams(e.target.value ? { q: e.target.value } : {}, {
                        replace: true,
                      })
                    }
                  />
                </div>
                <span className="muted">
                  Last 7 days · {issues.length} issue groups
                </span>
              </div>
              <div className="issue-grid">
                {issues.map((issue) => {
                  const metrics = issueMetrics(data.conversations, issue.id);
                  return (
                    <article className="panel issue-card" key={issue.id}>
                      <div className="split">
                        <span className="category-icon">
                          <GitBranch size={19} />
                        </span>
                        <Badge tone={issue.priority}>{issue.priority}</Badge>
                      </div>
                      <span className="eyebrow">{issue.category}</span>
                      <h2>
                        <Link to={`/issues/${issue.id}`}>{issue.title}</Link>
                      </h2>
                      <p>{issue.description}</p>
                      <div className="issue-stats">
                        <div>
                          <strong>{metrics.count}</strong>
                          <span>Affected calls</span>
                        </div>
                        <div>
                          <strong>{metrics.customers}</strong>
                          <span>Unique customers</span>
                        </div>
                        <div>
                          <strong>
                            {metrics.growth === null
                              ? "New"
                              : `${metrics.growth > 0 ? "+" : ""}${metrics.growth}%`}
                          </strong>
                          <span>vs. previous 7 days</span>
                        </div>
                      </div>
                      <div className="issue-card-footer">
                        <span>{issue.owner}</span>
                        <Link
                          aria-label={`Explore ${issue.title}`}
                          to={`/issues/${issue.id}`}
                        >
                          <ArrowUpRight size={20} />
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
              {!issues.length && <EmptyState />}
            </>
          );
        }}
      </WorkspaceView>
    </>
  );
}
