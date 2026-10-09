import { format, subDays } from "date-fns";
import { snapshotDate, type Conversation } from "./models";

export function inPeriod(
  calls: Conversation[],
  days: number,
  end = snapshotDate,
) {
  const start = subDays(end, days).getTime();
  return calls.filter(
    (call) =>
      new Date(call.date).getTime() > start &&
      new Date(call.date).getTime() <= end.getTime(),
  );
}
export function issueMetrics(calls: Conversation[], issueId: string, days = 7) {
  const current = inPeriod(calls, days).filter((c) => c.issueId === issueId);
  const previous = inPeriod(calls, days, subDays(snapshotDate, days)).filter(
    (c) => c.issueId === issueId,
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
    const date = subDays(snapshotDate, days - index - 1)
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
