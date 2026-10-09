export const recordingAccept = ".mp3,.mp4,.m4a,.wav,.flac";
export const maxRecordingBytes = 100 * 1024 * 1024;

export function recordingError(
  file: Pick<File, "name" | "size">,
): string | null {
  if (!/\.(mp3|mp4|m4a|wav|flac)$/i.test(file.name)) {
    return `${file.name}: choose an MP3, MP4, M4A, WAV or FLAC file.`;
  }
  if (!file.size) return `${file.name}: this file is empty.`;
  if (file.size > maxRecordingBytes) {
    return `${file.name}: the maximum file size is 100 MB.`;
  }
  return null;
}

export function prepareRecordingUpload(file: File, uploadedAt = new Date()) {
  const key = crypto.randomUUID();
  const body = new FormData();
  body.set("audio", file);
  body.set(
    "metadata",
    new Blob(
      [
        JSON.stringify({
          title: null,
          sample: false,
          // Unidentified callers must not be grouped as one recurring customer.
          customerId: `upload-${key}`,
          agent: "Not identified",
          department: "Customer support",
          recordedAt: uploadedAt.toISOString(),
          language: null,
          speakers: null,
          customerChannel: null,
        }),
      ],
      { type: "application/json" },
    ),
  );
  return { key, body };
}
