import type { Decision, Workspace } from "../domain/models";
import type { WorkspaceRepository } from "./workspace";

export const guestMode = import.meta.env.VITE_DATA_MODE === "live-demo";
export const apiMode = import.meta.env.VITE_DATA_MODE !== "demo";
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (options.method && options.method !== "GET") {
    const csrf = await fetch("/api/v1/auth/csrf", {
      credentials: "same-origin",
    }).then((r) => r.json());
    headers.set(csrf.headerName, csrf.token);
  }
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("csi:unauthorized"));
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      body.detail ||
        ({
          401: "Sign in to continue.",
          403: "Your role cannot perform this action.",
          409: "This record changed. Refresh and try again.",
          429: "Too many attempts. Try again later.",
        }[response.status] ??
          "Request failed. Please try again."),
    );
  }
  if (response.status === 204 || response.headers.get("content-length") === "0")
    return undefined as T;
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}
export const apiRepository: WorkspaceRepository = {
  getWorkspace: () => api<Workspace>("/workspace"),
  review: ({ recommendationId, ...input }) =>
    api<Decision>(`/recommendations/${recommendationId}/decisions`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  advance: (id, version) =>
    api<Decision>(`/recommendations/${id}/advance`, {
      method: "POST",
      body: JSON.stringify({ version }),
    }),
  reset: async () => {
    throw new Error("Demo reset is unavailable for real data.");
  },
};
