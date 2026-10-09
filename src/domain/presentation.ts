import type { Conversation } from "./models";

export const roleLabels: Record<string, string> = {
  ADMIN: "Administrator",
  DEMO: "Guest access",
  ANALYST: "Analyst",
  REVIEWER: "Reviewer",
  VIEWER: "Viewer",
};
export const statusLabels: Record<string, string> = {
  QUEUED: "Waiting to start",
  PROCESSING: "Analysis in progress",
  COMPLETED: "Ready to review",
  FAILED: "Needs attention",
  PENDING: "Waiting to send",
  RETRYING: "Trying delivery again",
  RETRY_QUEUED: "Retry scheduled",
  SENT: "Delivered",
  DELIVERED: "Delivered",
  SKIPPED: "Delivery not required",
  collecting: "Collecting observations",
  measured: "Observation period complete",
};
export const stageLabels: Record<string, string> = {
  import: "Recording received",
  transcription: "Transcribing and masking personal details",
  analysis: "Identifying topics and customer feedback",
  clustering: "Connecting findings to related issues",
  complete: "Transcript and insights available",
};
export const errorLabels: Record<string, string> = {
  TRANSCRIPTION_FAILED:
    "We could not transcribe this recording. Check the audio and try again.",
  ANALYSIS_FAILED:
    "Analysis could not finish. Try again when the local model is available.",
  CLUSTERING_FAILED:
    "We could not save the findings. Try processing this recording again.",
};
export const auditLabels: Record<string, string> = {
  "summary.requested": "Support summary requested",
  "summary.completed": "Support summary generated",
  "workspace.read": "Workspace viewed",
  "call.import": "Recording uploaded",
  "call.completed": "Recording analysis completed",
  "call.retry": "Recording processing restarted",
  "audio.read": "Recording played",
  "transcript.read": "Transcript viewed",
  "decision.Approved": "Recommendation approved",
  "decision.Rejected": "Recommendation rejected",
  "decision.In progress": "Action started",
  "decision.Completed": "Action completed",
  "user.create": "Team member added",
  "integration.configure": "Connection settings updated",
  "delivery.retry": "Delivery retry requested",
  "sample.presentation.updated": "Sample recording details updated",
};
export function readableKey(value: string) {
  return value
    .replace(/[_.-]+/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}
export function callReference(call: Pick<Conversation, "id" | "reference">) {
  return (
    call.reference ?? (/^[A-Z]+-\d+$/.test(call.id) ? call.id : "Conversation")
  );
}
export function callTitle(call: Pick<Conversation, "title" | "topic">) {
  return call.title || call.topic || "Customer support call";
}
export function languageLabel(code: string) {
  return (
    (
      {
        az: "Azerbaijani",
        en: "English",
        tr: "Turkish",
        ru: "Russian",
      } as Record<string, string>
    )[code] ?? code
  );
}
