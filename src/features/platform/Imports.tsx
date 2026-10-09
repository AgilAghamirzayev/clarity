import { Select } from "../../components/Select";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, guestMode } from "../../data/api";
import { recordingAccept, recordingError } from "../../domain/recordings";
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
  const [recordedAt] = useState(() =>
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16),
  );
  const [importKey, setImportKey] = useState(() => crypto.randomUUID());
  const [open, setOpen] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const client = useQueryClient();
  const jobs = useQuery({
    queryKey: ["imports"],
    queryFn: () => api<Job[]>("/calls"),
    refetchInterval: 5000,
  });
  const upload = useMutation({
    mutationFn: (body: FormData) =>
      api("/calls/import", {
        method: "POST",
        headers: { "Idempotency-Key": importKey },
        body,
      }),
    onSuccess: () => {
      setOpen(false);
      setShowHistory(true);
      setImportKey(crypto.randomUUID());
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
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const selectedFile = fields.get("audio") as File;
    const error =
      guestMode && selectedFile.size > 25 * 1024 * 1024
        ? "Live demo files must be at most 25 MB."
        : recordingError(selectedFile);
    setFileError(error);
    if (error) return;
    const form = new FormData();
    form.set("audio", fields.get("audio")!);
    form.set(
      "metadata",
      new Blob(
        [
          JSON.stringify({
            title:
              fields.get("title") ||
              selectedFile.name.replace(/\.[^.]+$/, "").slice(0, 120),
            sample: fields.get("sample") === "on",
            customerId: fields.get("customerId"),
            agent: fields.get("agent"),
            department: fields.get("department"),
            recordedAt: new Date(
              String(fields.get("recordedAt")),
            ).toISOString(),
            language:
              fields.get("language") === "auto"
                ? null
                : fields.get("language") || null,
            speakers: fields.get("speakers")
              ? Number(fields.get("speakers"))
              : null,
            customerChannel:
              !fields.get("channel") || fields.get("channel") === "auto"
                ? null
                : Number(fields.get("channel")),
          }),
        ],
        { type: "application/json" },
      ),
    );
    upload.mutate(form);
  }
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
              onClick={() => setOpen(true)}
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
        title="Import a recording"
        description="Add a recording and its call details. Transcription and analysis run locally."
      >
        <form onSubmit={submit} className="platform-form">
          <label>
            Audio file (up to {guestMode ? "25" : "100"} MB)
            <input name="audio" type="file" accept={recordingAccept} required />
            <small>
              MP3, MP4, M4A, WAV or FLAC. MP4 recordings must contain audio.
            </small>
          </label>
          <label>
            Conversation title
            <input
              name="title"
              maxLength={120}
              placeholder="e.g. Card delivery follow-up"
            />
            <small>
              A short description without personal details. Leave blank to use
              the detected topic.
            </small>
          </label>
          <label>
            Customer reference
            <input
              name="customerId"
              defaultValue={guestMode ? "demo-customer" : undefined}
              required
              maxLength={128}
              placeholder="e.g. CUST-1042"
            />
            <small>
              Use your internal customer reference. It is stored as a private
              identifier.
            </small>
          </label>
          <label>
            Support agent
            <input
              name="agent"
              defaultValue={guestMode ? "Not provided" : undefined}
              required
              maxLength={80}
              placeholder="e.g. Support advisor 12"
            />
          </label>
          <label>
            Department
            <input
              name="department"
              defaultValue={guestMode ? "Customer support" : undefined}
              required
              maxLength={80}
              placeholder="e.g. Cards and payments"
            />
          </label>
          <label>
            Recorded at
            <input
              type="datetime-local"
              name="recordedAt"
              required
              defaultValue={recordedAt}
            />
          </label>
          <label>
            Language
            <Select
              name="language"
              aria-label="Language"
              defaultValue="auto"
              options={[
                { value: "auto", label: "Detect automatically" },
                { value: "az", label: "Azerbaijani" },
                { value: "en", label: "English" },
                { value: "tr", label: "Turkish" },
                { value: "ru", label: "Russian" },
              ]}
            />
          </label>
          <label>
            Number of speakers (optional)
            <input
              name="speakers"
              type="number"
              min={1}
              max={8}
              placeholder="e.g. 2"
            />
          </label>
          <label>
            Customer audio channel (stereo recordings)
            <Select
              name="channel"
              aria-label="Customer audio channel (stereo recordings)"
              defaultValue="auto"
              options={[
                {
                  value: "auto",
                  label: "Detect speakers without assigning roles",
                },
                { value: "0", label: "Left channel" },
                { value: "1", label: "Right channel" },
              ]}
            />
          </label>
          <label className="checkbox-label">
            <input name="sample" type="checkbox" /> This is a sample recording
          </label>
          {fileError && (
            <p role="alert" className="field-error">
              {fileError}
            </p>
          )}
          {upload.isError && (
            <p role="alert" className="field-error">
              {upload.error.message}
            </p>
          )}
          <button className="button" disabled={upload.isPending}>
            {upload.isPending ? "Uploading…" : "Import and analyze"}
          </button>
        </form>
      </Modal>
    </>
  );
}
