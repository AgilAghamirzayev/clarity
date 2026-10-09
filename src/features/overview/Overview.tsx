import { apiMode } from "../../data/api";
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
    <WorkspaceView>
      {(data) => (
        <OverviewContent
          data={data}
          days={days}
          onPeriod={(value) => setParams({ period: value })}
        />
      )}
    </WorkspaceView>
  );
}
function OverviewContent({
  data,
  days,
  onPeriod,
}: {
  data: Workspace;
  days: number;
  onPeriod: (value: string) => void;
}) {
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
      <PageHeader
        eyebrow="THE BIG PICTURE"
        title="Listen closer. See the bigger picture."
        description="Turn customer conversations into your next best decision."
        action={
          <label className="period-picker">
            <span>Period</span>
            <select
              aria-label="Overview period"
              value={days}
              onChange={(e) => onPeriod(e.target.value)}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </label>
        }
      />
      <div className="insight-banner">
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
      <div className="stats-grid">
        {[
          {
            label: "Conversations analyzed",
            value: calls.length,
            detail: "From the selected period",
            icon: AudioLines,
          },
          {
            label: "Active issue groups",
            value: totalIssues,
            detail: "Linked to source conversations",
            icon: GitBranch,
          },
          {
            label: "Awaiting your review",
            value: pending.length,
            detail: "Across all recommendations",
            icon: Lightbulb,
          },
          {
            label: "Positive sentiment",
            value: `${calls.length ? Math.round((positive / calls.length) * 100) : 0}%`,
            detail: `${positive} positive conversations`,
            icon: Smile,
          },
        ].map(({ label, value, detail, icon: Icon }) => (
          <section className="stat-card" key={label}>
            <div className="stat-label">
              {label}
              <Icon size={18} />
            </div>
            <div className="stat-value">{value}</div>
            <div className="stat-detail">{detail}</div>
          </section>
        ))}
      </div>
      <div className="overview-grid">
        <Panel
          title="The voice of your customers"
          description="Conversation volume and negative sentiment"
          action={
            <div className="chart-legend">
              <span>
                <i />
                All calls
              </span>
              <span>
                <i className="mint" />
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
                    <stop offset="0%" stopColor="#176b58" stopOpacity={0.16} />
                    <stop offset="100%" stopColor="#176b58" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 5"
                  vertical={false}
                  stroke="#e9eeeb"
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64716b", fontSize: 11 }}
                  minTickGap={30}
                  dy={10}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64716b", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    borderColor: "#dce5df",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="calls"
                  name="All calls"
                  stroke="#176b58"
                  strokeWidth={2.5}
                  fill="url(#chartFill)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="complaints"
                  name="Negative sentiment"
                  stroke="#74a58c"
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
          title="What needs attention"
          description="Most reported issues"
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
        title="From insight to action"
        description="Evidence-backed recommendations, ready for a human review"
        action={<TextLink to="/decisions">Decision center</TextLink>}
      >
        <div className="recommendation-grid">
          {data.recommendations.map((rec) => (
            <article className="recommendation-summary" key={rec.id}>
              <div className="split">
                <Badge tone={rec.priority}>{rec.priority} priority</Badge>
                <span className="mono">{rec.id}</span>
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
