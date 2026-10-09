import { useEffect, type ReactNode, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiMode, ApiError } from "../../data/api";
import { LoadingState } from "../../components/ui";
import { IdentityContext, type Identity } from "./identity";
export function AuthGate({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => api<Identity>("/auth/me"),
    enabled: apiMode,
    retry: false,
  });
  const login = useMutation({
    mutationFn: (input: object) =>
      api<Identity>("/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (user) => {
      client.clear();
      client.setQueryData(["session"], user);
    },
  });
  const refetchSession = session.refetch;
  useEffect(() => {
    const expired = () => {
      client.clear();
      void refetchSession();
    };
    window.addEventListener("csi:unauthorized", expired);
    return () => window.removeEventListener("csi:unauthorized", expired);
  }, [client, refetchSession]);
  if (!apiMode) return children;
  if (session.isPending) return <LoadingState />;
  if (session.data)
    return (
      <IdentityContext.Provider value={session.data}>
        {children}
      </IdentityContext.Provider>
    );
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    login.mutate(Object.fromEntries(fields));
  };
  return (
    <main className="login-shell">
      <section className="panel login-card">
        <span className="eyebrow">CLARITY · LOCAL INTELLIGENCE</span>
        <h1>Sign in to your workspace</h1>
        <p>Recordings and AI processing stay on your infrastructure.</p>
        <form onSubmit={submit} className="platform-form">
          <label>
            Workspace
            <input
              name="tenant"
              required
              autoComplete="organization"
              defaultValue="local"
            />
          </label>
          <label>
            Email
            <input name="email" type="email" required autoComplete="username" />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          {login.isError && (
            <p role="alert" className="field-error">
              {login.error.message}
            </p>
          )}
          {session.error &&
            !(
              session.error instanceof ApiError && session.error.status === 401
            ) && (
              <p role="alert">
                The API is unavailable. Start the backend and retry.
              </p>
            )}
          <button className="button" disabled={login.isPending}>
            {login.isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
export function SignOut() {
  const client = useQueryClient();
  const logout = useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      client.clear();
      window.location.assign("/");
    },
  });
  return (
    <button
      className="button ghost"
      disabled={logout.isPending}
      onClick={() => logout.mutate()}
    >
      Sign out
    </button>
  );
}
