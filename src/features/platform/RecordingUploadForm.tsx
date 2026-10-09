import { useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUp,
  Check,
  Clock3,
  FileAudio,
  File,
} from "lucide-react";
import { guestMode } from "../../data/api";
import {
  prepareRecordingUpload,
  recordingAccept,
  recordingError,
} from "../../domain/recordings";
import "./recording-upload.css";

type RecordingUpload = ReturnType<typeof prepareRecordingUpload>;

export function RecordingUploadForm({
  pending,
  error,
  onUpload,
  onReset,
}: {
  pending: boolean;
  error: string | null;
  onUpload: (recording: RecordingUpload) => void;
  onReset: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const prepared = useRef<RecordingUpload | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  function choose(files: File[]) {
    if (pending || !files.length) return;
    onReset();
    prepared.current = null;
    const selected = files[0];
    const message =
      files.length > 1
        ? "Choose one recording at a time."
        : guestMode && selected.size > 25 * 1024 * 1024
          ? "Choose an audio file up to 25 MB."
          : recordingError(selected);
    setFileError(message);
    setFile(message ? null : selected);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!file) {
      setFileError("Choose an audio file to continue.");
      return;
    }
    // Reuse the same payload if the upload needs to be retried.
    prepared.current ??= prepareRecordingUpload(file);
    onUpload(prepared.current);
  }

  return (
    <form
      className="recording-upload-form"
      onSubmit={submit}
      aria-busy={pending}
    >
      <div className="recording-upload-field">
        <label htmlFor="recording-audio">
          Audio file (up to {guestMode ? "25" : "100"} MB)
        </label>
        <div
          className={`recording-upload-zone${dragging ? " is-dragging" : ""}${file ? " has-file" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            if (!pending) setDragging(true);
          }}
          onDragLeave={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            )
              setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            choose(Array.from(event.dataTransfer.files));
          }}
        >
          <div className="recording-upload-art" aria-hidden="true">
            <FileAudio size={56} strokeWidth={1.5} />
            <span>{file ? <Check size={20} /> : <ArrowUp size={20} />}</span>
          </div>
          <strong>
            {file
              ? "Your recording is ready"
              : "Drag and drop your audio file here"}
          </strong>
          <span className="recording-upload-or">
            {file ? "Choose another file to replace it" : "or"}
          </span>
          <input
            ref={input}
            id="recording-audio"
            name="audio"
            type="file"
            accept={recordingAccept}
            className="sr-only"
            tabIndex={-1}
            disabled={pending}
            aria-describedby="recording-upload-formats recording-upload-selection"
            onChange={(event) => {
              choose(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className="button recording-choose"
            disabled={pending}
            onClick={() => input.current?.click()}
          >
            <File size={20} aria-hidden="true" />
            {file ? "Change file" : "Choose File"}
          </button>
          <span
            className="recording-upload-selection"
            id="recording-upload-selection"
            role="status"
          >
            {file
              ? `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB`
              : "No file chosen"}
          </span>
        </div>
        <p id="recording-upload-formats" className="recording-upload-formats">
          MP3, MP4, M4A, WAV or FLAC. MP4 recordings must contain audio.
        </p>
      </div>
      <div className="recording-upload-note">
        <span aria-hidden="true">
          <Clock3 size={23} />
        </span>
        <p>
          The upload time is saved automatically. No call details to fill in.
        </p>
      </div>
      {(fileError || error) && (
        <p role="alert" className="field-error">
          {fileError || error}
        </p>
      )}
      <button className="button recording-upload-submit" disabled={pending}>
        {pending ? "Uploading…" : "Import and analyze"}
        <ArrowRight size={22} aria-hidden="true" />
      </button>
    </form>
  );
}
