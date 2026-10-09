import { Select } from "../../components/Select";
import { useState, type FormEvent } from "react";
import type { DemoConnection } from "../../data/demo-connections";
import {
  connectionFields,
  type IntegrationDefinition,
} from "./integration-catalog";

export function ConnectionForm({
  definition,
  connection,
  onSave,
  onDisconnect,
  pending,
  error,
}: {
  definition: IntegrationDefinition;
  connection?: DemoConnection;
  onSave: (values: Record<string, string>) => void;
  onDisconnect: () => void;
  pending: boolean;
  error: string | null;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    connection?.values ?? { destination: "slack" },
  );
  const [validation, setValidation] = useState<string | null>(null);
  const fields = connectionFields(definition, values.destination ?? "slack");
  function useExamples() {
    const examples: Record<string, string> = {
      name: "Customer support",
      endpoint:
        definition.kind === "ai"
          ? "http://127.0.0.1:11434"
          : definition.kind === "jira"
            ? "https://demo-team.atlassian.net"
            : "https://calls.example.com",
      speechModel: "Faster Whisper",
      analysisModel: "qwen3:4b-instruct",
      project: "SUPPORT",
      email: "support@example.com",
      channel: "C0123456789",
    };
    setValues({
      ...values,
      ...Object.fromEntries(
        fields.map((field) => [field.key, examples[field.key]]),
      ),
    });
    setValidation(null);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidation(null);
    const next = Object.fromEntries(
      fields.map((field) => [field.key, (values[field.key] ?? "").trim()]),
    );
    if (Object.values(next).some((value) => !value)) {
      setValidation("Complete all connection details.");
      return;
    }
    if (next.endpoint) {
      try {
        const endpoint = new URL(next.endpoint);
        const protocols =
          definition.kind === "ai" ? ["http:", "https:"] : ["https:"];
        if (
          !protocols.includes(endpoint.protocol) ||
          endpoint.username ||
          endpoint.password ||
          endpoint.search ||
          endpoint.hash
        )
          throw new Error();
      } catch {
        setValidation(
          definition.kind === "ai"
            ? "Enter an HTTP or HTTPS service URL without credentials, query parameters or fragments."
            : "Enter an HTTPS URL without credentials, query parameters or fragments.",
        );
        return;
      }
    }
    if (definition.kind === "notifications")
      next.destination = values.destination ?? "slack";
    onSave(next);
  }
  return (
    <form className="platform-form" onSubmit={submit}>
      <div className="connection-demo-note">
        Demo only. Use sample details. No credentials are needed, and no
        external service will be contacted.
      </div>
      <button
        type="button"
        className="button secondary"
        onClick={useExamples}
        disabled={pending}
      >
        Use example settings
      </button>
      {definition.kind === "notifications" && (
        <label>
          Send updates to
          <Select
            value={values.destination ?? "slack"}
            disabled={pending}
            onValueChange={(value) => {
              setValues({ destination: value });
              setValidation(null);
            }}
            aria-label="Send updates to"
            options={[
              { value: "slack", label: "Slack" },
              { value: "email", label: "Email" },
            ]}
          />
        </label>
      )}
      {fields.map((field) => (
        <label key={field.key}>
          {field.label}
          <input
            type={field.type ?? "text"}
            value={values[field.key] ?? ""}
            placeholder={field.placeholder}
            maxLength={300}
            required
            disabled={pending}
            onChange={(event) =>
              setValues({ ...values, [field.key]: event.target.value })
            }
          />
        </label>
      ))}
      {(validation || error) && (
        <p role="alert" className="field-error">
          {validation || error}
        </p>
      )}
      <div className="dialog-actions connection-form-actions">
        {connection && (
          <button
            type="button"
            className="button danger"
            disabled={pending}
            onClick={onDisconnect}
          >
            Disconnect
          </button>
        )}
        <button className="button" disabled={pending}>
          {pending ? "Saving…" : connection ? "Save changes" : "Connect demo"}
        </button>
      </div>
    </form>
  );
}
