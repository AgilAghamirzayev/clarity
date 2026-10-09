import { beforeEach, describe, expect, it } from "vitest";
import { createDemoRepository, storageKey } from "./workspace";

const entries = new Map<string, string>();
const storage = {
  getItem: (key: string) => entries.get(key) ?? null,
  setItem: (key: string, value: string) => {
    entries.set(key, value);
  },
  removeItem: (key: string) => {
    entries.delete(key);
  },
};
const input = {
  recommendationId: "REC-001",
  action: "Approved" as const,
  owner: "Digital team",
  rationale: "Investigate delivery delays using provider logs.",
};
beforeEach(() => entries.clear());
describe("demo decision lifecycle", () => {
  it("persists human review and rejects repeat approval", async () => {
    await createDemoRepository(storage).review(input);
    const repo = createDemoRepository(storage);
    expect((await repo.getWorkspace()).decisions[0].owner).toBe("Digital team");
    await expect(repo.review(input)).rejects.toThrow("already been reviewed");
  });
  it("checks versions, transitions and audit history", async () => {
    const repo = createDemoRepository(storage);
    await repo.review(input);
    await repo.advance("REC-001", 1);
    await expect(repo.advance("REC-001", 1)).rejects.toThrow("changed");
    const completed = await repo.advance("REC-001", 2);
    expect(completed.status).toBe("Completed");
    expect(completed.history.map((h) => h.status)).toEqual([
      "Approved",
      "In progress",
      "Completed",
    ]);
    await expect(repo.advance("REC-001", 3)).rejects.toThrow("cannot move");
  });
  it("does not execute rejected recommendations", async () => {
    const repo = createDemoRepository(storage);
    await repo.review({ ...input, action: "Rejected" });
    await expect(repo.advance("REC-001", 1)).rejects.toThrow("cannot move");
  });
  it("rejects malformed input and corrupt saved data with a recovery path", async () => {
    const repo = createDemoRepository(storage);
    await expect(
      repo.review({ ...input, rationale: "short" }),
    ).rejects.toThrow();
    storage.setItem(storageKey, "{bad json");
    await expect(repo.getWorkspace()).rejects.toThrow("Reset the demo");
    await repo.reset();
    expect((await repo.getWorkspace()).decisions).toEqual([]);
  });
});
