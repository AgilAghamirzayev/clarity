import { z } from "zod";

export type Sentiment = "Positive" | "Neutral" | "Negative";
export type Priority = "Critical" | "High" | "Medium";
export type DecisionStatus =
  "Pending review" | "Approved" | "Rejected" | "In progress" | "Completed";
export interface Segment {
  speaker: string;
  seconds: number;
  text: string;
}
export interface Conversation {
  id: string;
  reference?: string;
  title?: string | null;
  sample?: boolean;
  customer: string;
  agent: string;
  department: string;
  date: string;
  duration: number;
  sentiment: Sentiment;
  topic: string;
  issueId: string | null;
  issueIds?: string[];
  summary: string;
  reviewRequired?: boolean;
  roleUncertainty?: boolean;
  summaryMode?: "model" | "source-excerpts";
  rejectedFindings?: {
    chunkStart: number;
    findingIndex: number;
    code: string;
  }[];
  duplicatesMerged?: number;
  transcript: Segment[];
  language: string;
}
export interface Issue {
  id: string;
  title: string;
  category: string;
  priority: Priority;
  description: string;
  hypothesis: string;
  owner: string;
}
export interface Recommendation {
  id: string;
  issueId: string;
  title: string;
  description: string;
  proposedAction: string;
  expectedOutcome: string;
  priority: Priority;
  effort: string;
}
export const reviewSchema = z.object({
  recommendationId: z.string().min(1),
  action: z.enum(["Approved", "Rejected"]),
  owner: z
    .string()
    .trim()
    .min(2, "Enter an owner with at least 2 characters.")
    .max(80),
  rationale: z
    .string()
    .trim()
    .min(10, "Add at least 10 characters explaining your decision.")
    .max(1000),
});
export type ReviewInput = z.infer<typeof reviewSchema>;
export const decisionSchema = z.object({
  id: z.string().optional(),
  recommendationId: z.string(),
  status: z.enum(["Approved", "Rejected", "In progress", "Completed"]),
  owner: z.string().min(2).max(80),
  rationale: z.string().min(10).max(1000),
  version: z.number().int().positive(),
  history: z
    .array(
      z.object({
        status: z.string(),
        at: z.string().datetime(),
        actor: z.string(),
      }),
    )
    .min(1),
});
export type Decision = z.infer<typeof decisionSchema>;
export interface Workspace {
  projection?: { limit: number; totalCompleted: number };
  conversations: Conversation[];
  issues: Issue[];
  recommendations: Recommendation[];
  decisions: Decision[];
}
export const snapshotDate = new Date("2026-10-09T23:59:59Z");
