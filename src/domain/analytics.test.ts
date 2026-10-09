import { describe, expect, it } from "vitest";
import {
  durationLabel,
  inPeriod,
  issueMetrics,
  volumeSeries,
} from "./analytics";
import { conversations } from "../data/fixtures";

describe("evidence metrics", () => {
  it("formats fractional timestamps as readable minutes and seconds", () => {
    expect(durationLabel(3.26)).toBe("0:03");
    expect(durationLabel(65.9)).toBe("1:05");
  });
  it("uses distinct customers rather than counting every mention", () => {
    const call = conversations.find((c) => c.issueId === "ISS-001")!;
    expect(
      issueMetrics([call, { ...call, id: "second-call" }], "ISS-001"),
    ).toMatchObject({ count: 2, customers: 1, growth: null });
  });
  it("partitions periods without double counting the boundary", () => {
    const calls = [{ ...conversations[0], date: "2026-10-02T23:59:59Z" }];
    expect(inPeriod(calls, 7)).toHaveLength(0);
    expect(inPeriod(calls, 7, new Date("2026-10-02T23:59:59Z"))).toHaveLength(
      1,
    );
  });
  it("keeps chart totals equal to filtered conversation totals", () => {
    expect(
      volumeSeries(conversations, 7).reduce((sum, day) => sum + day.calls, 0),
    ).toBe(inPeriod(conversations, 7).length);
  });
});
