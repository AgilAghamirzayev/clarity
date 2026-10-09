import { useSearchParams, Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Search, SlidersHorizontal } from "lucide-react";
import { format } from "date-fns";
import { WorkspaceView } from "../../components/WorkspaceView";
import { DataTable } from "../../components/DataTable";
import { Badge, PageHeader } from "../../components/ui";
import { durationLabel } from "../../domain/analytics";
import type { Conversation } from "../../domain/models";

const columns: ColumnDef<Conversation>[] = [
  {
    accessorKey: "id",
    header: "Conversation",
    cell: ({ row }) => (
      <div>
        <Link className="table-link" to={`/conversations/${row.original.id}`}>
          {row.original.id}
        </Link>
        <small className="cell-secondary">{row.original.customer}</small>
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
      <PageHeader
        eyebrow="VOICE OF THE CUSTOMER"
        title="Conversations"
        description="Go beyond the numbers. Understand the conversation behind every insight."
      />
      <WorkspaceView>
        {(data) => {
          const calls = data.conversations.filter(
            (c) =>
              `${c.id} ${c.customer} ${c.topic} ${c.agent} ${c.summary}`
                .toLowerCase()
                .includes(query.toLowerCase()) &&
              (sentiment === "All sentiments" || c.sentiment === sentiment) &&
              (!params.get("issue") || c.issueId === params.get("issue")),
          );
          return (
            <section className="panel">
              <div className="filter-toolbar">
                <div className="search-field">
                  <Search size={18} />
                  <input
                    type="search"
                    aria-label="Search conversations"
                    placeholder="Search conversations, topics, or agents…"
                    value={query}
                    onChange={(e) => update("q", e.target.value)}
                  />
                </div>
                <label className="filter-select">
                  <SlidersHorizontal size={16} />
                  <select
                    aria-label="Filter by sentiment"
                    value={sentiment}
                    onChange={(e) => update("sentiment", e.target.value)}
                  >
                    {["All sentiments", "Positive", "Neutral", "Negative"].map(
                      (s) => (
                        <option key={s}>{s}</option>
                      ),
                    )}
                  </select>
                </label>
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
      <p className="quiet-note">
        All transcripts are synthetic examples. No customer recordings are
        stored in this preview.
      </p>
    </>
  );
}
