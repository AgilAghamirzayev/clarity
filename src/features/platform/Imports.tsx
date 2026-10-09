import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../data/api";
import { useIdentity } from "./identity";
import { Modal } from "../../components/Modal";
import { Panel } from "../../components/ui";
interface Job {
  id: string;
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
      setImportKey(crypto.randomUUID());
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
    const form = new FormData();
    form.set("audio", fields.get("audio")!);
    form.set(
      "metadata",
      new Blob(
        [
          JSON.stringify({
            customerId: fields.get("customerId"),
            agent: fields.get("agent"),
            department: fields.get("department"),
            recordedAt: new Date(
              String(fields.get("recordedAt")),
            ).toISOString(),
            language: fields.get("language") || null,
            speakers: fields.get("speakers")
              ? Number(fields.get("speakers"))
              : null,
            customerChannel:
              fields.get("channel") === ""
                ? null
                : Number(fields.get("channel")),
          }),
        ],
        { type: "application/json" },
      ),
    );
    upload.mutate(form);
  }
  const canImport = user && ["ADMIN", "ANALYST"].includes(user.role);
  return (
    <>
      <Panel
        title="Recording imports"
        description="Local transcription, speaker separation, privacy masking and analysis"
        action={
          canImport ? (
            <button className="button" onClick={() => setOpen(true)}>
              Import recording
            </button>
          ) : undefined
        }
      >
        {jobs.isError && (
          <p role="alert" className="panel-copy">
            {jobs.error.message}
          </p>
        )}
        {retry.isError && <p role="alert">{retry.error.message}</p>}
        <div className="import-list">
          {jobs.data?.slice(0, 20).map((job) => (
            <div className="integration-row" key={job.id}>
              <div>
                <strong>{job.id.slice(0, 8)}</strong>
                <small className="cell-secondary">
                  {job.stage} · {job.status}
                  {job.error_code ? ` · ${job.error_code}` : ""}
                </small>
              </div>
              {job.status === "COMPLETED" ? (
                <Link className="text-link" to={`/conversations/${job.id}`}>
                  Open
                </Link>
              ) : job.status === "FAILED" && canImport ? (
                <button
                  className="button secondary"
                  disabled={retry.isPending}
                  onClick={() => retry.mutate(job.id)}
                >
                  Retry
                </button>
              ) : (
                <span>Processing</span>
              )}
            </div>
          ))}
          {jobs.data?.length === 0 && (
            <p className="panel-copy">
              Import a WAV, FLAC or MP3 recording to start.
            </p>
          )}
        </div>
      </Panel>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Import a recording"
        description="Audio stays in your local object store. Use internal identifiers instead of personal names."
      >
        <form onSubmit={submit} className="platform-form">
          <label>
            Audio file (up to 100 MB)
            <input name="audio" type="file" accept=".wav,.flac,.mp3" required />
          </label>
          <label>
            Customer reference
            <input name="customerId" required maxLength={128} />
          </label>
          <label>
            Agent reference
            <input name="agent" required maxLength={80} />
          </label>
          <label>
            Department
            <input name="department" required maxLength={80} />
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
            <select name="language">
              <option value="">Detect automatically</option>
              <option value="az">Azerbaijani</option>
              <option value="en">English</option>
              <option value="tr">Turkish</option>
              <option value="ru">Russian</option>
            </select>
          </label>
          <label>
            Expected speakers (optional)
            <input name="speakers" type="number" min={1} max={8} />
          </label>
          <label>
            Customer channel (stereo only)
            <select name="channel">
              <option value="">Unknown, retain speaker labels</option>
              <option value="0">Left channel</option>
              <option value="1">Right channel</option>
            </select>
          </label>
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
