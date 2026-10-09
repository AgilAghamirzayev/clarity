import { callReference, callTitle } from "../../domain/presentation";
import { apiMode } from "../../data/api";
import { PlatformStatus } from "../platform/PlatformStatus";
import { Imports } from "../platform/Imports";
import { DemoImports } from "./DemoImports";
import { useSearchParams, Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Search } from "lucide-react";
import { format } from "date-fns";
import { WorkspaceView } from "../../components/WorkspaceView";
import { DataTable } from "../../components/DataTable";
import { Badge, PageHeader } from "../../components/ui";
import { hasIssue, durationLabel } from "../../domain/analytics";
import type { Conversation } from "../../domain/models";

const columns: ColumnDef<Conversation>[] = [
  {
    accessorFn: (call) => callTitle(call),
    id: "conversation",
    header: "Conversation",
    cell: ({ row }) => (
      <div>
        <Link className="table-link" to={`/conversations/${row.original.id}`}>
          {callTitle(row.original)}
        </Link>
        <small className="cell-secondary">
          {callReference(row.original)} · {row.original.customer}
          {row.original.sample ? " · Sample" : ""}
        </small>
      </div>
    ),
  },
  {
    accessorKey: "topic",
    header: "Topic",
    cell: ({ row }) => (
      <div className="topic-cell">
        {row.original.topic}
        <small className="cell-secondary">{row.original.department}</small>
      </div>
    ),
  },
  {
    accessorKey: "sentiment",
    header: "Sentiment",
    cell: ({ row }) => (
      <Badge tone={row.original.sentiment}>{row.original.sentiment}</Badge>
    ),
  },
  { accessorKey: "agent", header: "Agent" },
  {
    accessorKey: "duration",
    header: "Duration",
    cell: ({ row }) => (
      <span className="mono">{durationLabel(row.original.duration)}</span>
    ),
  },
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => format(new Date(row.original.date), "MMM d, yyyy"),
  },
];
export default function Conversations() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const sentiment = params.get("sentiment") ?? "All sentiments";
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  return (
    <>
      <PageHeader title="Conversations" />
      {apiMode && <PlatformStatus />}
      {apiMode ? <Imports /> : <DemoImports />}
      <WorkspaceView>
        {(data) => {
          const calls = data.conversations.filter(
            (c) =>
              `${c.id} ${c.reference ?? ""} ${c.title ?? ""} ${c.customer} ${c.topic} ${c.agent} ${c.department} ${c.summary}`
                .toLowerCase()
                .includes(query.toLowerCase()) &&
              (sentiment === "All sentiments" || c.sentiment === sentiment) &&
              (!params.get("issue") || hasIssue(c, params.get("issue")!)),
          );
          return (
            <section className="panel conversation-panel">
              {params.get("issue") && (
                <div className="active-filter">
                  Showing conversations about{" "}
                  <strong>
                    {data.issues.find(
                      (issue) => issue.id === params.get("issue"),
                    )?.title ?? "the selected issue"}
                  </strong>
                  <button
                    className="text-link"
                    onClick={() => update("issue", "")}
                  >
                    Show all conversations
                  </button>
                </div>
              )}
              <div className="filter-toolbar">
                <div className="search-field">
                  <Search size={18} />
                  <input
                    type="search"
                    aria-label="Search conversations"
                    placeholder="Search conversations"
                    value={query}
                    onChange={(e) => update("q", e.target.value)}
                  />
                </div>
                <div
                  className="sentiment-filter"
                  role="group"
                  aria-label="Filter by sentiment"
                >
                  {["All sentiments", "Positive", "Neutral", "Negative"].map(
                    (s) => (
                      <button
                        key={s}
                        type="button"
                        className={`sentiment-choice sentiment-${s.toLowerCase().split(" ")[0]}`}
                        aria-pressed={sentiment === s}
                        onClick={() =>
                          update("sentiment", s === "All sentiments" ? "" : s)
                        }
                      >
                        <span className="sentiment-dot" aria-hidden="true" />
                        {s === "All sentiments" ? "All" : s}
                      </button>
                    ),
                  )}
                </div>
                {(query ||
                  sentiment !== "All sentiments" ||
                  params.has("issue")) && (
                  <button
                    className="button ghost"
                    onClick={() => setParams({})}
                  >
                    Clear filters
                  </button>
                )}
              </div>
              <DataTable
                data={calls}
                columns={columns}
                caption="Customer conversations"
              />
            </section>
          );
        }}
      </WorkspaceView>
    </>
  );
}
