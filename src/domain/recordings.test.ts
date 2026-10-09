import { expect, test } from "vitest";
import { maxRecordingBytes, recordingError } from "./recordings";

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
