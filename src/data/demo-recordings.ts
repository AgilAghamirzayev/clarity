import { recordingError } from "../domain/recordings";
import { createStore, del, entries, setMany } from "idb-keyval";

export interface DemoRecording {
  id: string;
  file: File;
  addedAt: string;
}
const store = createStore("clarity-demo-recordings", "recordings");

export async function listDemoRecordings(): Promise<DemoRecording[]> {
  const saved = await entries<string, DemoRecording>(store);
  return saved
    .map(([, value]) => value)
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}
export async function saveDemoRecordings(files: File[]): Promise<number> {
  if (!files.length) throw new Error("Choose at least one recording.");
  for (const file of files) {
    const error = recordingError(file);
    if (error) throw new Error(error);
  }
  const recordings: [string, DemoRecording][] = files.map((file) => {
    const id = crypto.randomUUID();
    return [id, { id, file, addedAt: new Date().toISOString() }];
  });
  try {
    await setMany(recordings, store);
  } catch {
    throw new Error(
      "Could not save recordings in this browser. Free up storage or allow browser storage, then try again.",
    );
  }
  return files.length;
}
export const removeDemoRecording = (id: string) => del(id, store);
