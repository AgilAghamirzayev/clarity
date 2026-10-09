import { guestMode } from "../../data/api";
import { Activity } from "lucide-react";
import { usePlatformStatus } from "./platform-status";

export function PlatformStatus() {
  const status = usePlatformStatus();
  const ready = status.data?.processing === "ready";
  return (
    <div
      className={`platform-status ${ready ? "ready" : "unavailable"}`}
      role="status"
    >
      <div className="platform-status-heading">
        <Activity size={18} aria-hidden="true" />
        <strong>
          {status.isPending
            ? "Checking local processing…"
            : ready
              ? "Local processing available"
              : "Local processing unavailable"}
        </strong>
        <span>
          {guestMode
            ? `${status.data?.maxFiles ?? 5} ${status.data?.sharedWorkspace ? "shared uploads" : "uploads"} · 25 MB · 5 minutes each`
            : "Private local models"}
        </span>
      </div>
      <details>
        <summary>Processing details</summary>
        <p>
          {ready
            ? "New uploads run through transcription, speaker separation, masking and analysis. Processing time depends on the recording and queue."
            : "The sample workspace stays available. New uploads remain queued until the worker and models are ready."}
          {guestMode
            ? status.data?.sharedWorkspace
              ? " This workspace is shared by everyone with the link. Uploads, audio and decisions are visible to all participants and update automatically. Recordings remain available across visits."
              : " Prepared samples do not use your upload allowance. Workspace access lasts 24 hours; deletion starts after 48 hours."
            : ""}
        </p>
      </details>
    </div>
  );
}
