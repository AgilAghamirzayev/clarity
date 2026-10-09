import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AudioLines, Play, Trash2, Upload } from "lucide-react";
import { Modal } from "../../components/Modal";
import {
  listDemoRecordings,
  removeDemoRecording,
  saveDemoRecordings,
  type DemoRecording,
} from "../../data/demo-recordings";

import { recordingAccept } from "../../domain/recordings";

import { RecordingPlayer } from "./RecordingPlayer";

const recordingsKey = ["demo-recordings"];
export function DemoImports() {
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [playing, setPlaying] = useState<DemoRecording | null>(null);
  const [message, setMessage] = useState("");
  const recordings = useQuery({
    queryKey: recordingsKey,
    queryFn: listDemoRecordings,
    retry: false,
  });
  const upload = useMutation({
    mutationFn: saveDemoRecordings,
    onSuccess: async (count) => {
      setMessage(
        `${count} ${count === 1 ? "recording" : "recordings"} saved in this browser.`,
      );
      await client.invalidateQueries({ queryKey: recordingsKey });
    },
  });
  const remove = useMutation({
    mutationFn: removeDemoRecording,
    onSuccess: async () => {
      setMessage("Recording removed from this browser.");
      await client.invalidateQueries({ queryKey: recordingsKey });
    },
  });
  function add(files: File[]) {
    if (upload.isPending || !files.length) return;
    setMessage("");
    remove.reset();
    upload.mutate(files);
  }
  return (
    <section className="panel demo-imports" aria-label="Recording imports">
      <div
        className={`recording-dropzone${dragging ? " is-dragging" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          add(Array.from(event.dataTransfer.files));
        }}
      >
        <span className="import-icon">
          <Upload size={22} aria-hidden="true" />
        </span>
        <div className="recording-intro">
          <h2>Import calls</h2>
          <p>Choose recordings or drag them here.</p>
          <small id="recording-formats">
            MP3, MP4, M4A, WAV or FLAC · Up to 100 MB per file
          </small>
        </div>
        <input
          ref={input}
          className="sr-only"
          type="file"
          multiple
          accept={recordingAccept}
          aria-label="Choose recordings"
          aria-describedby="recording-formats recording-storage"
          tabIndex={-1}
          disabled={upload.isPending}
          onChange={(event) => {
            add(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <button
          className="button"
          data-tour="import-recording"
          disabled={upload.isPending}
          onClick={() => input.current?.click()}
        >
          <Upload size={16} aria-hidden="true" />
          {upload.isPending ? "Saving recordings…" : "Add recordings"}
        </button>
      </div>
      <p className="recording-note" id="recording-storage">
        Demo: files stay in this browser and can be played or removed below.
        Transcription and AI analysis require the connected platform.
      </p>
      <div className="recording-feedback" aria-live="polite">
        {(upload.isPending || message) && (
          <p role="status">
            {upload.isPending ? "Saving your recordings…" : message}
          </p>
        )}
      </div>
      {upload.isError && (
        <p className="recording-note field-error" role="alert">
          {upload.error.message}
        </p>
      )}
      {remove.isError && (
        <p className="recording-note field-error" role="alert">
          Could not remove this recording. Please try again.
        </p>
      )}
      {recordings.isError && (
        <div className="recording-note" role="alert">
          Saved recordings could not be loaded.{" "}
          <button
            className="text-link"
            onClick={() => void recordings.refetch()}
          >
            Try again
          </button>
        </div>
      )}
      {recordings.isPending && (
        <p className="recording-note" role="status">
          Loading saved recordings…
        </p>
      )}
      {!!recordings.data?.length && (
        <ul className="saved-recordings" aria-label="Saved recordings">
          {recordings.data.map((recording) => (
            <li className="import-row" key={recording.id}>
              <span className="import-icon">
                <AudioLines size={20} aria-hidden="true" />
              </span>
              <div className="import-description">
                <strong>{recording.file.name}</strong>
                <small className="cell-secondary">
                  {(recording.file.size / (1024 * 1024)).toFixed(2)} MB · Saved
                  locally · Not analyzed
                </small>
              </div>
              <div className="recording-actions">
                <button
                  className="button secondary"
                  aria-label={`Play ${recording.file.name}`}
                  onClick={() => setPlaying(recording)}
                >
                  <Play size={16} aria-hidden="true" /> Play
                </button>
                <button
                  className="icon-button"
                  aria-label={`Remove ${recording.file.name}`}
                  disabled={remove.isPending}
                  onClick={() => {
                    upload.reset();
                    remove.mutate(recording.id);
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={!!playing}
        onOpenChange={(open) => {
          if (!open) setPlaying(null);
        }}
        title={playing?.file.name ?? "Recording preview"}
        description="Local playback. This recording has not been transcribed or analyzed."
      >
        {playing && <RecordingPlayer key={playing.id} recording={playing} />}
      </Modal>
    </section>
  );
}
