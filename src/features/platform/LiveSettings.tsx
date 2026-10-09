import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../data/api";
import { useIdentity } from "./identity";
import { PageHeader, Panel } from "../../components/ui";
interface Integration {
  id: string;
  kind: string;
  enabled: boolean;
  config: {
    endpoint: string;
    channel?: string;
    project?: string;
    email?: string;
  };
}
interface Notification {
  id: string;
  title: string;
  resource: string;
  read_at: string | null;
}
interface Delivery {
  id: string;
  status: string;
  attempts: number;
  error_code: string | null;
  external_id: string | null;
}
interface Audit {
  action: string;
  actor: string;
  resource: string;
  created_at: string;
}
export default function LiveSettings() {
  const user = useIdentity();
  const admin = user?.role === "ADMIN";
  const client = useQueryClient();
  const [credential, setCredential] = useState("");
  const integrations = useQuery({
    queryKey: ["integrations"],
    queryFn: () => api<Integration[]>("/integrations"),
    enabled: admin,
  });
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<Notification[]>("/notifications"),
    refetchInterval: 10000,
  });
  const deliveries = useQuery({
    queryKey: ["deliveries"],
    queryFn: () => api<Delivery[]>("/deliveries"),
    enabled: admin,
    refetchInterval: 10000,
  });
  const audit = useQuery({
    queryKey: ["audit"],
    queryFn: () => api<Audit[]>("/audit"),
    enabled: admin,
  });
  const save = useMutation({
    mutationFn: ({
      kind,
      ...body
    }: {
      kind: string;
      enabled: boolean;
      endpoint: string;
      channel: string | null;
      project: string | null;
      email: string | null;
    }) =>
      api<{ credentialEnvironment: string }>(`/integrations/${kind}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: (result) => {
      setCredential(result.credentialEnvironment);
      void client.invalidateQueries({ queryKey: ["integrations"] });
    },
  });
  const retryDelivery = useMutation({
    mutationFn: (id: string) =>
      api(`/deliveries/${id}/retry`, { method: "POST" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["deliveries"] }),
  });
  const read = useMutation({
    mutationFn: (id: string) =>
      api(`/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const createUser = useMutation({
    mutationFn: (body: object) =>
      api("/users", { method: "POST", body: JSON.stringify(body) }),
  });
  function configure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    save.mutate({
      kind: String(f.get("kind")),
      enabled: f.get("enabled") === "on",
      endpoint: String(f.get("endpoint")),
      channel: String(f.get("channel") || "") || null,
      project: String(f.get("project") || "") || null,
      email: String(f.get("email") || "") || null,
    });
  }
  return (
    <>
      <PageHeader
        eyebrow="LOCAL PLATFORM"
        title="Workspace settings"
        description={`${user?.email} · ${user?.role} · PostgreSQL persistence and local model processing`}
      />
      <div className="settings-grid">
        <Panel title="Notifications">
          <div className="integration-list">
            {notifications.data?.map((n) => (
              <div className="integration-row" key={n.id}>
                <div>
                  <strong>{n.title}</strong>
                  <small className="cell-secondary">{n.resource}</small>
                </div>
                {!n.read_at && (
                  <button
                    className="button ghost"
                    disabled={read.isPending}
                    onClick={() => read.mutate(n.id)}
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))}
            {!notifications.data?.length && (
              <p className="panel-copy">No notifications yet.</p>
            )}
          </div>
        </Panel>
        <Panel title="Processing and privacy">
          <div className="panel-copy">
            <p>
              Whisper transcribes audio locally. Speaker embeddings identify
              voice groups; customer and agent roles require stereo channel
              metadata.
            </p>
            <p>
              Pattern matching and local entity detection mask personal details
              before analysis. Review accuracy before sharing results.
            </p>
            <p>
              Qwen generates structured analysis. Nomic embeddings group similar
              findings in PostgreSQL. Human approval is required for external
              actions.
            </p>
          </div>
        </Panel>
      </div>
      {admin && (
        <>
          <div className="settings-grid">
            <Panel
              title="Integration configuration"
              description="Jira, Slack and generic CRM webhooks"
            >
              <div className="panel-copy">
                {integrations.data?.map((i) => (
                  <p key={i.id}>
                    <strong>{i.kind}</strong>:{" "}
                    {i.enabled ? "Enabled" : "Disabled"} · {i.config.endpoint}
                  </p>
                ))}
                <form className="platform-form" onSubmit={configure}>
                  <label>
                    Integration
                    <select name="kind">
                      <option value="crm">CRM webhook</option>
                      <option value="jira">Jira Cloud</option>
                      <option value="slack">Slack</option>
                    </select>
                  </label>
                  <label>
                    HTTPS endpoint
                    <input
                      name="endpoint"
                      type="url"
                      required
                      placeholder="https://crm.example.com/events"
                    />
                  </label>
                  <label>
                    Slack channel
                    <input name="channel" />
                  </label>
                  <label>
                    Jira project key
                    <input name="project" />
                  </label>
                  <label>
                    Jira service account email
                    <input name="email" type="email" />
                  </label>
                  <label>
                    <span>
                      <input
                        style={{ width: "auto" }}
                        type="checkbox"
                        name="enabled"
                      />{" "}
                      Enable approved-action delivery
                    </span>
                  </label>
                  <p className="muted">
                    The endpoint origin must be in the server allowlist. Set the
                    returned credential variable in the worker environment.
                  </p>
                  {save.isError && (
                    <p role="alert" className="field-error">
                      {save.error.message}
                    </p>
                  )}
                  {credential && (
                    <p role="status" className="platform-code">
                      Saved. Credential variable: {credential}
                    </p>
                  )}
                  <button className="button" disabled={save.isPending}>
                    Save integration
                  </button>
                </form>
              </div>
            </Panel>
            <Panel
              title="Access management"
              description="Create users in this tenant"
            >
              <form
                className="platform-form panel-copy"
                onSubmit={(e) => {
                  e.preventDefault();
                  createUser.mutate(
                    Object.fromEntries(new FormData(e.currentTarget)),
                  );
                }}
              >
                <label>
                  Email
                  <input name="email" type="email" required />
                </label>
                <label>
                  Initial password
                  <input
                    name="password"
                    type="password"
                    minLength={16}
                    maxLength={72}
                    required
                    autoComplete="new-password"
                  />
                </label>
                <label>
                  Role
                  <select name="role">
                    {["VIEWER", "ANALYST", "REVIEWER", "ADMIN"].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
                {createUser.isError && (
                  <p role="alert" className="field-error">
                    {createUser.error.message}
                  </p>
                )}
                {createUser.isSuccess && <p role="status">User created.</p>}
                <button className="button" disabled={createUser.isPending}>
                  Create user
                </button>
              </form>
            </Panel>
          </div>
          <Panel title="Delivery history">
            <div className="integration-list">
              {deliveries.data?.map((d) => (
                <div className="integration-row" key={d.id}>
                  <div>
                    <strong>{d.status}</strong>
                    <small>
                      {d.attempts} attempts ·{" "}
                      {d.external_id || d.error_code || "Queued"}
                    </small>
                  </div>
                  <code>{d.id.slice(0, 8)}</code>
                  {d.status === "FAILED" && (
                    <button
                      className="button secondary"
                      disabled={retryDelivery.isPending}
                      onClick={() => retryDelivery.mutate(d.id)}
                    >
                      Retry delivery
                    </button>
                  )}
                </div>
              ))}
              {!deliveries.data?.length && (
                <p className="panel-copy">No external deliveries yet.</p>
              )}
            </div>
          </Panel>
          <Panel title="Server audit">
            <div className="import-list">
              {audit.data?.map((a, i) => (
                <div className="integration-row" key={i}>
                  <div>
                    <strong>{a.action}</strong>
                    <small className="cell-secondary">{a.resource}</small>
                  </div>
                  <time>{new Date(a.created_at).toLocaleString()}</time>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
      {[
        integrations.error,
        notifications.error,
        deliveries.error,
        audit.error,
        read.error,
        retryDelivery.error,
      ]
        .filter(Boolean)
        .map((e, i) => (
          <p role="alert" key={i}>
            {e?.message}
          </p>
        ))}
    </>
  );
}
