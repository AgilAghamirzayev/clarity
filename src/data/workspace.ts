import { z } from "zod";
import {
  decisionSchema,
  reviewSchema,
  type Decision,
  type ReviewInput,
  type Workspace,
} from "../domain/models";
import { conversations, issues, recommendations } from "./fixtures";

export interface WorkspaceRepository {
  getWorkspace(): Promise<Workspace>;
  review(input: ReviewInput): Promise<Decision>;
  advance(recommendationId: string, version: number): Promise<Decision>;
  reset(): Promise<void>;
}
export const storageKey = "csi.demo.decisions.v1";
const persistedSchema = z.object({
  version: z.literal(1),
  decisions: z.array(decisionSchema),
});
export function createDemoRepository(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
): WorkspaceRepository {
  const read = () => {
    const raw = storage.getItem(storageKey);
    if (!raw) return [];
    try {
      return persistedSchema.parse(JSON.parse(raw)).decisions;
    } catch {
      throw new Error(
        "Saved demo data could not be read. Reset the demo in Settings to restore the sample workspace.",
      );
    }
  };
  const save = (decisions: Decision[]) => {
    try {
      storage.setItem(storageKey, JSON.stringify({ version: 1, decisions }));
    } catch {
      throw new Error(
        "Your browser could not save this decision. Allow local storage and try again.",
      );
    }
  };
  return {
    async getWorkspace() {
      return { conversations, issues, recommendations, decisions: read() };
    },
    async review(value) {
      const input = reviewSchema.parse(value);
      if (!recommendations.some((r) => r.id === input.recommendationId))
        throw new Error("Recommendation not found.");
      const decisions = read();
      if (decisions.some((d) => d.recommendationId === input.recommendationId))
        throw new Error(
          "This recommendation has already been reviewed. Refresh to see the latest decision.",
        );
      const decision: Decision = {
        recommendationId: input.recommendationId,
        status: input.action,
        owner: input.owner,
        rationale: input.rationale,
        version: 1,
        history: [
          {
            status: input.action,
            at: new Date().toISOString(),
            actor: "Demo reviewer",
          },
        ],
      };
      save([...decisions, decision]);
      return decision;
    },
    async advance(id, version) {
      const decisions = read();
      const decision = decisions.find((d) => d.recommendationId === id);
      if (!decision || decision.version !== version)
        throw new Error("This decision has changed. Refresh and try again.");
      const status =
        decision.status === "Approved"
          ? "In progress"
          : decision.status === "In progress"
            ? "Completed"
            : null;
      if (!status)
        throw new Error("This decision cannot move to the next stage.");
      const next: Decision = {
        ...decision,
        status,
        version: version + 1,
        history: [
          ...decision.history,
          { status, at: new Date().toISOString(), actor: "Demo reviewer" },
        ],
      };
      save(decisions.map((d) => (d.recommendationId === id ? next : d)));
      return next;
    },
    async reset() {
      storage.removeItem(storageKey);
    },
  };
}
