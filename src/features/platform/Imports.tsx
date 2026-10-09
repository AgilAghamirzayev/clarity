import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, guestMode } from "../../data/api";
import { prepareRecordingUpload } from "../../domain/recordings";
import { RecordingUploadForm } from "./RecordingUploadForm";
import { useIdentity } from "./identity";
import { Modal } from "../../components/Modal";
import { AudioLines, CheckCircle2, Clock3, AlertCircle } from "lucide-react";
import {
  statusLabels,
  stageLabels,
  errorLabels,
} from "../../domain/presentation";
interface Job {
  id: string;
  reference: string;
  topic: string | null;
  metadata: {
    title?: string | null;
    agent?: string;
    department?: string;
    date?: string;
    sample?: boolean;
  };
  status: string;
  stage: string;
  error_code: string | null;
  attempts: number;
}
export function Imports() {
  const user = useIdentity();
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const client = useQueryClient();
  const jobs = useQuery({
    queryKey: ["imports"],
    queryFn: () => api<Job[]>("/calls"),
    refetchInterval: 5000,
  });
  const upload = useMutation({
    mutationFn: ({ body, key }: ReturnType<typeof prepareRecordingUpload>) =>
      api("/calls/import", {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body,
      }),
    onSuccess: () => {
      setOpen(false);
      setShowHistory(true);
      void client.invalidateQueries({ queryKey: ["imports"] });
    },
  });
  const completed =
    jobs.data
      ?.filter((job) => job.status === "COMPLETED")
      .map((job) => job.id)
      .join(",") ?? "";
  useEffect(() => {
    void client.invalidateQueries({ queryKey: ["workspace"] });
  }, [completed, client]);
  const sampleImport = useMutation({
    mutationFn: async () => {
      const response = await fetch("/samples/support-call.wav");
      if (!response.ok)
        throw new Error("The sample recording could not be loaded.");
      const form = new FormData();
      form.set("audio", await response.blob(), "support-call.wav");
      form.set(
        "metadata",
        new Blob(
          [
            JSON.stringify({
              title: "Card payment declined at checkout",
              sample: true,
              customerId: "sample-customer",
              agent: "Sample support agent",
              department: "Payments",
              recordedAt: new Date().toISOString(),
              language: "en",
              speakers: 2,
              customerChannel: 0,
            }),
          ],
          { type: "application/json" },
        ),
      );
      return api("/calls/import", {
        method: "POST",
        headers: { "Idempotency-Key": "live-demo-sample-v1" },
        body: form,
      });
    },
    onSuccess: () => {
      setShowHistory(true);
      void client.invalidateQueries({ queryKey: ["imports"] });
    },
  });
  const retry = useMutation({
    mutationFn: (id: string) => api(`/calls/${id}/retry`, { method: "POST" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["imports"] }),
  });
  const canImport = user && ["ADMIN", "ANALYST", "DEMO"].includes(user.role);
  return (
    <>
      <section className="panel imports-panel" aria-label="Recording imports">
        {jobs.isError && (
          <p role="alert" className="panel-copy">
            {jobs.error.message}
          </p>
        )}
        {sampleImport.isError && (
          <p role="alert" className="panel-copy field-error">
            {sampleImport.error.message}
          </p>
        )}
        {retry.isError && <p role="alert">{retry.error.message}</p>}
        <div className="import-summary">
          <span data-intent="success">
            <CheckCircle2 size={16} />{" "}
            <strong>
              {jobs.data?.filter((j) => j.status === "COMPLETED").length ?? 0}
            </strong>{" "}
            ready
          </span>
          <span data-intent="info">
            <Clock3 size={16} />{" "}
            <strong>
              {jobs.data?.filter((j) =>
                ["QUEUED", "PROCESSING"].includes(j.status),
              ).length ?? 0}
            </strong>{" "}
            processing
          </span>
          {!!jobs.data?.some((j) => j.status === "FAILED") && (
            <span data-intent="danger">
              <AlertCircle size={16} />{" "}
              {jobs.data.filter((j) => j.status === "FAILED").length} need
              attention
            </span>
          )}
          <button
            className="text-link"
            aria-expanded={showHistory}
            aria-controls="upload-history"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? "Hide upload history" : "View upload history"}
          </button>
          {guestMode && (
            <button
              className="button secondary"
              disabled={sampleImport.isPending}
              onClick={() => sampleImport.mutate()}
            >
              {sampleImport.isPending
                ? "Uploading sample…"
                : "Analyze sample call"}
            </button>
          )}
          {canImport && (
            <button
              className="button"
              data-tour="import-recording"
              onClick={() => {
                upload.reset();
                setOpen(true);
              }}
            >
              Import recording
            </button>
          )}
        </div>
        {jobs.isPending && (
          <p className="panel-copy" role="status">
            Loading recordings…
          </p>
        )}
        <div className="import-list" id="upload-history">
          {jobs.data
            ?.filter((job) => showHistory || job.status !== "COMPLETED")
            .map((job) => (
              <div className="import-row" key={job.id}>
                <span className="import-icon">
                  <AudioLines size={20} />
                </span>
                <div className="import-description">
                  <strong>
                    {job.metadata.title ||
                      job.topic ||
                      `${job.metadata.department || "Customer support"} call`}
                  </strong>
                  <small className="cell-secondary">
                    {job.reference} ·{" "}
                    {job.metadata.agent || "Agent not provided"}
                    {job.metadata.sample ? " · Sample" : ""}
                  </small>
                  <p>
                    {job.error_code
                      ? errorLabels[job.error_code] ||
                        "Processing could not finish. Please try again."
                      : stageLabels[job.stage] || "Preparing recording"}
                  </p>
                </div>
                <span
                  className={`processing-state ${job.status.toLowerCase()}`}
                >
                  {statusLabels[job.status] || "Processing"}
                </span>
                {job.status === "COMPLETED" ? (
                  <Link className="text-link" to={`/conversations/${job.id}`}>
                    View conversation
                  </Link>
                ) : job.status === "FAILED" && canImport ? (
                  <button
                    className="button secondary"
                    disabled={retry.isPending}
                    onClick={() => retry.mutate(job.id)}
                  >
                    Try again
                  </button>
                ) : null}
              </div>
            ))}
          {jobs.data?.length === 0 && (
            <p className="panel-copy">
              Upload your first recording to see its transcript, customer
              feedback and suggested actions.
            </p>
          )}
        </div>
      </section>
      <Modal
        open={open}
        onOpenChange={setOpen}
        className="recording-import-dialog"
        title={
          <>
            <span className="recording-heading-icon" aria-hidden="true">
              <AudioLines size={34} />
            </span>
            Import a recording
          </>
        }
        description="Upload your audio. Clarity detects the language, creates a transcript and finds the key topics automatically."
      >
        <RecordingUploadForm
          pending={upload.isPending}
          error={upload.isError ? upload.error.message : null}
          onUpload={(recording) => upload.mutate(recording)}
          onReset={() => upload.reset()}
        />
      </Modal>
    </>
  );
}
