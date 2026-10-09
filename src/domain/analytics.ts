import { apiMode } from "../data/api";
import { format, subDays } from "date-fns";
import { snapshotDate, type Conversation } from "./models";

export function hasIssue(call: Conversation, issueId: string) {
  return call.issueIds?.includes(issueId) ?? call.issueId === issueId;
}
function reportingDate() {
  return apiMode ? new Date() : snapshotDate;
}
export function inPeriod(
  calls: Conversation[],
  days: number,
  end = reportingDate(),
) {
  const start = subDays(end, days).getTime();
  return calls.filter(
    (call) =>
      new Date(call.date).getTime() > start &&
      new Date(call.date).getTime() <= end.getTime(),
  );
}
export function issueMetrics(calls: Conversation[], issueId: string, days = 7) {
  const current = inPeriod(calls, days).filter((c) => hasIssue(c, issueId));
  const previous = inPeriod(calls, days, subDays(reportingDate(), days)).filter(
    (c) => hasIssue(c, issueId),
  );
  return {
    count: current.length,
    customers: new Set(current.map((c) => c.customer)).size,
    previous: previous.length,
    growth: previous.length
      ? Math.round(((current.length - previous.length) / previous.length) * 100)
      : null,
  };
}
export function volumeSeries(calls: Conversation[], days: number) {
  return Array.from({ length: days }, (_, index) => {
    const date = subDays(reportingDate(), days - index - 1)
      .toISOString()
      .slice(0, 10);
    const day = calls.filter((c) => c.date.startsWith(date));
    return {
      date,
      label: format(new Date(`${date}T12:00:00Z`), "MMM d"),
      calls: day.length,
      complaints: day.filter((c) => c.sentiment === "Negative").length,
    };
  });
}
export function durationLabel(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
