import { z } from "zod";
import type { IntegrationKind } from "../features/settings/integration-catalog";

const connectionSchema = z.object({
  kind: z.enum(["contact", "ai", "jira", "notifications"]),
  values: z.record(z.string().max(300)),
  updatedAt: z.string().datetime(),
});
const savedSchema = z.object({
  version: z.literal(1),
  connections: z.array(connectionSchema),
});
export type DemoConnection = z.infer<typeof connectionSchema>;
const storageKey = "csi.demo.connections.v1";

export function readDemoConnections(): DemoConnection[] {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? savedSchema.parse(JSON.parse(raw)).connections : [];
  } catch {
    throw new Error(
      "Saved demo connections could not be read. Allow browser storage or reset demo connections below.",
    );
  }
}
export function saveDemoConnection(connection: DemoConnection) {
  const next = [
    ...readDemoConnections().filter((item) => item.kind !== connection.kind),
    connectionSchema.parse(connection),
  ];
  write(next);
}
export function disconnectDemoConnection(kind: IntegrationKind) {
  write(readDemoConnections().filter((connection) => connection.kind !== kind));
}
function write(connections: DemoConnection[]) {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ version: 1, connections }),
    );
  } catch {
    throw new Error(
      "Could not save your demo connection. Allow browser storage and try again.",
    );
  }
}
export function resetDemoConnections() {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    throw new Error("Browser storage is unavailable. Allow it and try again.");
  }
}
