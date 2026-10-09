import { expect, test } from "vitest";
import {
  maxRecordingBytes,
  recordingError,
  prepareRecordingUpload,
} from "./recordings";

test("recording limits reject empty, oversized and unsupported files", () => {
  expect(
    recordingError({ name: "call.MP4", size: maxRecordingBytes }),
  ).toBeNull();
  expect(
    recordingError({ name: "call.mp3", size: maxRecordingBytes + 1 }),
  ).toContain("100 MB");
  expect(recordingError({ name: "call.mp4", size: 0 })).toContain("empty");
  expect(recordingError({ name: "call.mp3.exe", size: 1024 })).toContain(
    "choose an MP3",
  );
});

test("audio-only imports use the upload time and leave AI fields unset", async () => {
  const file = new File(["audio"], "private-customer-name.wav", {
    type: "audio/wav",
  });
  const now = new Date("2026-10-09T16:00:00.000Z");
  const upload = prepareRecordingUpload(file, now);
  const metadata = JSON.parse(
    await (upload.body.get("metadata") as Blob).text(),
  );
  expect(metadata).toMatchObject({
    title: null,
    sample: false,
    recordedAt: now.toISOString(),
    language: null,
    speakers: null,
    customerChannel: null,
    agent: "Not identified",
  });
  expect(JSON.stringify(metadata)).not.toContain("private-customer-name");
  expect(await (upload.body.get("audio") as File).text()).toBe("audio");
});

test("unidentified recordings get separate customer references", async () => {
  const file = new File(["audio"], "call.wav");
  const first = prepareRecordingUpload(file);
  const second = prepareRecordingUpload(file);
  const metadata = async (upload: typeof first) =>
    JSON.parse(await (upload.body.get("metadata") as Blob).text());
  expect(first.key).not.toBe(second.key);
  expect((await metadata(first)).customerId).not.toBe(
    (await metadata(second)).customerId,
  );
});
