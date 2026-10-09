import { Select } from "../../components/Select";
import { apiMode, guestMode } from "../../data/api";
import { useSearchParams } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  AudioLines,
  GitBranch,
  Lightbulb,
  Smile,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { WorkspaceView } from "../../components/WorkspaceView";
import { Badge, PageHeader, Panel, TextLink } from "../../components/ui";
import { inPeriod, issueMetrics, volumeSeries } from "../../domain/analytics";
import type { Workspace } from "../../domain/models";

export default function Overview() {
  const [params, setParams] = useSearchParams();
  const days = params.get("period") === "30" ? 30 : 7;
  return (
    <>
      <PageHeader
        title="Overview"
        description="Understand support quality. Find the next action that matters."
        action={
          <label className="period-picker">
            <span>Period</span>
            <Select
              aria-label="Overview period"
              value={String(days)}
              onValueChange={(value) => setParams({ period: value })}
              options={[
                { value: "7", label: "Last 7 days" },
                { value: "30", label: "Last 30 days" },
              ]}
            />
          </label>
        }
      />
      <WorkspaceView>
        {(data) => <OverviewContent data={data} days={days} />}
      </WorkspaceView>
    </>
  );
}
function OverviewContent({ data, days }: { data: Workspace; days: number }) {
  const calls = inPeriod(data.conversations, days);
  const positive = calls.filter((c) => c.sentiment === "Positive").length;
  const pending = data.recommendations.filter(
    (r) => !data.decisions.some((d) => d.recommendationId === r.id),
  );
  const ranked = data.issues
    .map((issue) => ({
      ...issue,
      ...issueMetrics(data.conversations, issue.id, days),
    }))
    .sort((a, b) => b.count - a.count);
  const series = volumeSeries(data.conversations, days);
  const totalIssues = new Set(
    calls.flatMap((c) => c.issueIds ?? [c.issueId]).filter(Boolean),
  ).size;
  return (
    <>
      {guestMode && (
        <div className="demo-context">
          <span className="demo-context-icon">
            <AudioLines size={20} aria-hidden="true" />
          </span>
          <div>
            <strong>Sample workspace</strong>
            <p>
              Generated recordings with real transcripts and local AI insights.
            </p>
          </div>
          <TextLink
            to={
              data.conversations[0]
                ? `/conversations/${data.conversations[0].id}`
                : "/conversations"
            }
          >
            Listen to a call
          </TextLink>
        </div>
      )}
      <div className="stats-grid">
        {[
          {
            label: "Conversations analyzed",
            intent: "info",
            value: calls.length,
            detail: "From the selected period",
            icon: AudioLines,
          },
          {
            label: "Active issue groups",
            intent: totalIssues > 0 ? "warning" : "neutral",
            value: totalIssues,
            detail: "Linked to source conversations",
            icon: GitBranch,
          },
          {
            label: "Awaiting your review",
            intent: pending.length > 0 ? "warning" : "neutral",
            value: pending.length,
            detail: "Across all recommendations",
            icon: Lightbulb,
          },
          {
            label: "Positive sentiment",
            intent: positive > 0 ? "success" : "neutral",
            value: `${calls.length ? Math.round((positive / calls.length) * 100) : 0}%`,
            detail: `${positive} positive conversations`,
            icon: Smile,
          },
        ].map(({ label, value, detail, intent, icon: Icon }) => (
          <section className="stat-card" data-intent={intent} key={label}>
            <div className="stat-label">
              {label}
              <Icon size={18} />
            </div>
            <div className="stat-value">{value}</div>
            <div className="stat-detail">{detail}</div>
          </section>
        ))}
      </div>
      <div
        className="insight-banner"
        data-intent={ranked[0] ? "warning" : "info"}
      >
        <div className="insight-icon">
          <Activity size={21} />
        </div>
        <div>
          <strong>
            {ranked[0]?.title ?? "Ready for your first recording"}
          </strong>
          <p>
            {ranked[0]
              ? `${ranked[0].count} conversations mention this issue in the selected period. Review the evidence before taking action.`
              : "Import a recording to start local analysis and build your evidence base."}
          </p>
        </div>
        {ranked[0] ? (
          <TextLink to={`/issues/${ranked[0].id}`}>Explore issue</TextLink>
        ) : (
          <TextLink to="/conversations">Import recording</TextLink>
        )}
      </div>
      <div className="overview-grid">
        <Panel
          title="Conversation trends"
          action={
            <div className="chart-legend">
              <span>
                <i />
                All calls
              </span>
              <span>
                <i className="negative" />
                Negative
              </span>
            </div>
          }
        >
          <div
            className="chart"
            role="img"
            aria-label={`${days}-day conversation volume chart. ${calls.length} total calls, ${calls.filter((c) => c.sentiment === "Negative").length} with negative sentiment.`}
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart
                data={series}
                margin={{ top: 20, right: 16, bottom: 0, left: -22 }}
              >
                <defs>
                  <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--color-info)"
                      stopOpacity={0.16}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--color-info)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 5"
                  vertical={false}
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  minTickGap={30}
                  dy={10}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    borderColor: "var(--border)",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="calls"
                  name="All calls"
                  stroke="var(--color-info)"
                  strokeWidth={2.5}
                  fill="url(#chartFill)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="complaints"
                  name="Negative sentiment"
                  stroke="var(--color-danger)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fill="transparent"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <details className="chart-data">
            <summary>View chart data</summary>
            <table>
              <caption>
                {apiMode
                  ? "Daily conversation counts"
                  : "Daily sample conversation counts"}
              </caption>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Calls</th>
                  <th>Negative</th>
                </tr>
              </thead>
              <tbody>
                {series.map((day) => (
                  <tr key={day.date}>
                    <td>{day.label}</td>
                    <td>{day.calls}</td>
                    <td>{day.complaints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Panel>
        <Panel
          title="Top issues"
          action={<TextLink to="/issues">View all</TextLink>}
        >
          <div className="issue-ranking">
            {ranked.map((issue, index) => (
              <div className="rank-item" key={issue.id}>
                <span className="rank-number">0{index + 1}</span>
                <div className="rank-content">
                  <TextLink to={`/issues/${issue.id}`}>{issue.title}</TextLink>
                  <div className="rank-meta">
                    <span>{issue.count} calls</span>
                    <span>
                      {issue.growth === null
                        ? "No prior baseline"
                        : `${issue.growth > 0 ? "+" : ""}${issue.growth}% vs prior period`}
                    </span>
                  </div>
                  <div className="rank-track">
                    <div
                      style={{
                        width: `${(issue.count / Math.max(ranked[0].count, 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel
        title="Recommended actions"
        action={<TextLink to="/decisions">Decision center</TextLink>}
      >
        <div className="recommendation-grid">
          {data.recommendations.map((rec) => (
            <article className="recommendation-summary" key={rec.id}>
              <div className="split">
                <Badge tone={rec.priority}>{rec.priority} priority</Badge>
              </div>
              <h3>{rec.title}</h3>
              <p>{rec.description}</p>
              <div className="recommendation-bottom">
                <span>
                  {data.decisions.find((d) => d.recommendationId === rec.id)
                    ?.status ?? "Pending review"}
                </span>
                <TextLink to={`/decisions?recommendation=${rec.id}`}>
                  View proposal <ArrowRight size={14} />
                </TextLink>
              </div>
            </article>
          ))}
        </div>
      </Panel>
      <div className="quiet-note">
        <ShieldIcon />{" "}
        {apiMode
          ? "Recommendations are model hypotheses."
          : "Recommendations are sample hypotheses."}{" "}
        Every decision stays with your team.
      </div>
    </>
  );
}
function ShieldIcon() {
  return <Lightbulb size={15} />;
}
