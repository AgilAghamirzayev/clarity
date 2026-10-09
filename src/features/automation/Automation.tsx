import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AudioLines,
  Workflow,
  ShieldCheck,
  BrainCircuit,
  GitBranch,
  UserCheck,
  Download,
  Eye,
  SlidersHorizontal,
} from "lucide-react";
import { api, apiMode, guestMode } from "../../data/api";
import { useIdentity } from "../platform/identity";
import {
  Badge,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
} from "../../components/ui";
import { Select } from "../../components/Select";
import { Modal } from "../../components/Modal";
import {
  configuration,
  saveProfile,
  previewProfile,
  exportSkill,
  type Configuration,
  type Profile,
  type Skill,
} from "./data";
import "./automation.css";

const stages = [
  {
    icon: AudioLines,
    title: "A call ends",
    text: "Your contact center or recording service finishes a recording.",
  },
  {
    icon: Workflow,
    title: "It arrives automatically",
    text: "Your connector sends audio and call metadata, with safe retries.",
  },
  {
    icon: ShieldCheck,
    title: "Prepare the evidence",
    text: "Local speech models transcribe, separate speakers and mask personal details.",
  },
  {
    icon: BrainCircuit,
    title: "Analyze with your AI",
    text: "Your selected model follows the company context and analysis rules.",
  },
  {
    icon: GitBranch,
    title: "Find the next action",
    text: "Related issues are grouped and recommendations are linked to evidence.",
  },
];
const templates = [
  {
    title: "Retail & commerce",
    context:
      "We support an online retailer. Customers contact us about checkout, delivery, returns and refunds.",
    rules:
      "Separate delivery delays from refund communication issues. Flag repeat contacts and unclear next steps. Cite the customer's words before recommending an investigation.",
  },
  {
    title: "Financial services",
    context: "We support customers using digital banking and payment services.",
    rules:
      "Prioritize reports of account access failures, payment failures and unclear charges. Never infer fraud or a regulatory breach from a call alone. Recommend a review by the relevant team with transcript evidence.",
  },
  {
    title: "Software & IT",
    context: "We support a software product used by business customers.",
    rules:
      "Distinguish account access, integration failures and usability questions. Capture any stated reproduction steps. Suggest engineering investigation only when supported by the conversation.",
  },
];
export default function Automation() {
  const query = useQuery({
    queryKey: ["analysis-profile"],
    queryFn: configuration,
  });
  return (
    <>
      <PageHeader
        title="Automation & AI"
        description="Connect your recordings. Bring your AI. Define how your company is understood."
      />
      <Panel
        title="From a finished call to a next step"
        description="Once a recording source is connected, each incoming call follows this flow automatically."
        className="automation-flow-panel"
      >
        <ol className="automation-flow">
          {stages.map(({ icon: Icon, title, text }, i) => (
            <li key={title}>
              <span className="automation-step-icon">
                <Icon size={21} aria-hidden="true" />
              </span>
              <small>0{i + 1}</small>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
        <div className="automation-review">
          <UserCheck size={21} aria-hidden="true" />
          <div>
            <strong>Your team controls what happens next</strong>
            <p>
              Analysis runs without an operator uploading each call. People
              review recommendations before actions reach connected business
              tools.
            </p>
          </div>
          <Link className="text-link" to="/decisions">
            Review actions
          </Link>
        </div>
      </Panel>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <ProfileEditor config={query.data} />
      )}
      <IngestionSetup />
    </>
  );
}
function ProfileEditor({ config }: { config: Configuration }) {
  const user = useIdentity();
  const canEdit = !apiMode || user?.role === "ADMIN" || user?.role === "DEMO";
  const [draft, setDraft] = useState<Profile>(config.profile);
  const [preview, setPreview] = useState<Skill | null>(null);
  const [saved, setSaved] = useState(false);
  const client = useQueryClient();
  const provider = config.providers.find((p) => p.id === draft.providerId);
  const update = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setSaved(false);
    setDraft((p) => ({ ...p, [key]: value }));
  };
  const save = useMutation({
    mutationFn: () => saveProfile(draft),
    onSuccess: (profile) => {
      setDraft(profile);
      setSaved(true);
      client.setQueryData(["analysis-profile"], { ...config, profile });
    },
  });
  const inspect = useMutation({
    mutationFn: () => previewProfile(draft),
    onSuccess: setPreview,
  });
  const download = useMutation({
    mutationFn: exportSkill,
    onSuccess: (bundle) => {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(bundle, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `clarity-agent-v${bundle.profile.version}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  });
  const changed = JSON.stringify(draft) !== JSON.stringify(config.profile);
  return (
    <section
      className="automation-configuration"
      aria-label="Analysis configuration"
    >
      <div className="automation-section-heading">
        <div>
          <h2>Make the analysis fit your company</h2>
          <p>
            One versioned configuration for new call analyses and refreshed
            support summaries.
          </p>
        </div>
        <Badge>Version {config.profile.version}</Badge>
      </div>
      {!apiMode && (
        <p className="notice">
          Offline preview: settings are saved in this browser. Live inference
          requires the backend and models.
        </p>
      )}
      {guestMode && (
        <p className="notice">
          These settings apply to new analyses in your demo workspace. Prepared
          reports keep their original results. Demo inference stays local.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="automation-config-grid">
          <Panel
            title="Your AI, your deployment"
            description="Choose based on your data policy, model quality and operating cost."
          >
            <fieldset
              className="platform-form panel-copy"
              disabled={!canEdit || save.isPending}
            >
              <label>
                Analysis provider
                <Select
                  aria-label="Analysis provider"
                  value={draft.providerId}
                  onValueChange={(v) => {
                    setDraft((p) => ({
                      ...p,
                      providerId: v,
                      externalAllowed: false,
                    }));
                    setSaved(false);
                  }}
                  options={config.providers.map((p) => ({
                    value: p.id,
                    label: `${p.label} · ${p.model}`,
                    disabled: !p.available,
                  }))}
                />
              </label>
              <div className="automation-provider">
                <BrainCircuit size={24} aria-hidden="true" />
                <div>
                  <strong>{provider?.label ?? "Provider unavailable"}</strong>
                  <p>
                    {provider?.external
                      ? "Masked transcripts and company instructions are sent to this approved external provider."
                      : "Inference uses your deployment's configured infrastructure."}
                  </p>
                </div>
              </div>
              {provider?.external && (
                <label className="automation-check">
                  <input
                    type="checkbox"
                    checked={draft.externalAllowed}
                    onChange={(e) =>
                      update("externalAllowed", e.target.checked)
                    }
                    required
                  />
                  Allow masked evidence and company instructions to be sent to
                  this provider
                </label>
              )}
              <label>
                Output language
                <Select
                  aria-label="Output language"
                  value={draft.language}
                  onValueChange={(v) =>
                    update("language", v as Profile["language"])
                  }
                  options={["English", "Azerbaijani", "Turkish", "Russian"].map(
                    (value) => ({ value, label: value }),
                  )}
                />
              </label>
              <div className="automation-field-pair">
                <label>
                  Output token limit
                  <input
                    type="number"
                    min={512}
                    max={4096}
                    step={1}
                    value={draft.maxOutputTokens}
                    onChange={(e) =>
                      update("maxOutputTokens", Number(e.target.value))
                    }
                    required
                  />
                </label>
                <label>
                  Temperature
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={draft.temperature}
                    onChange={(e) =>
                      update("temperature", Number(e.target.value))
                    }
                    required
                  />
                </label>
              </div>
              <p className="muted">
                The token limit caps each model response. Lower temperature
                makes outputs more consistent. These controls do not guarantee a
                monetary budget.
              </p>
              <details className="content-details">
                <summary>Connect a company model</summary>
                <p>
                  Administrators can register an OpenAI-compatible gateway,
                  including self-hosted inference or an approved cloud gateway.
                  The model must support structured JSON output. Provider
                  addresses and credentials stay in server configuration.
                </p>
                <p>
                  Speech processing, masking and embeddings remain local.
                  Choosing an analysis provider does not change them.
                </p>
              </details>
            </fieldset>
          </Panel>
          <Panel
            title="Company context & rules"
            description="Tell the model what matters in your environment."
          >
            <fieldset
              className="platform-form panel-copy"
              disabled={!canEdit || save.isPending}
            >
              <div className="automation-templates">
                <span>Start with an example</span>
                {templates.map((t) => (
                  <button
                    type="button"
                    className="automation-template"
                    key={t.title}
                    onClick={() => {
                      setDraft((p) => ({
                        ...p,
                        context: t.context,
                        rules: t.rules,
                      }));
                      setSaved(false);
                    }}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
              <label>
                Company context
                <textarea
                  aria-label="Company context"
                  rows={4}
                  maxLength={4000}
                  value={draft.context}
                  onChange={(e) => update("context", e.target.value)}
                  placeholder="What you do, who you support, and the terms your team uses."
                />
                <small>{draft.context.length}/4000 characters</small>
              </label>
              <label>
                Analysis rules
                <textarea
                  aria-label="Analysis rules"
                  rows={5}
                  maxLength={4000}
                  value={draft.rules}
                  onChange={(e) => update("rules", e.target.value)}
                  placeholder="Topics to prioritize, categories to distinguish, and how recommendations should be phrased."
                />
                <small>{draft.rules.length}/4000 characters</small>
              </label>
              <p className="muted">
                Preferences guide interpretation. Evidence validation, privacy
                masking and human review remain part of the workflow.
              </p>
            </fieldset>
          </Panel>
        </div>
        <div className="automation-save-bar">
          <div>
            <strong>
              {changed
                ? "Unsaved changes"
                : `Saved configuration · Version ${draft.version}`}
            </strong>
            <p>
              New jobs use the saved version. Existing calls keep the version
              they were analyzed with.
            </p>
          </div>
          <div className="button-row">
            {canEdit && (
              <button
                className="button secondary"
                type="button"
                disabled={inspect.isPending || save.isPending}
                onClick={() => inspect.mutate()}
              >
                <Eye size={16} />
                Preview instructions
              </button>
            )}
            <button
              className="button"
              disabled={!canEdit || !changed || save.isPending}
            >
              {save.isPending ? "Saving…" : "Save configuration"}
            </button>
          </div>
        </div>
        {saved && (
          <p role="status" className="notice">
            Analysis configuration saved.
          </p>
        )}
        {[save.error, inspect.error, download.error]
          .filter(Boolean)
          .map((e, i) => (
            <p key={i} role="alert" className="field-error">
              {e?.message}
            </p>
          ))}
      </form>
      <Panel
        title="Your agent skill"
        description="Export the saved instructions and Clarity's read-only evidence tool contracts."
        className="automation-skill"
      >
        <div className="panel-copy automation-skill-row">
          <SlidersHorizontal size={25} aria-hidden="true" />
          <div>
            <strong>A repeatable analysis contract</strong>
            <p>
              The same base instructions power the worker and this export. Your
              agent runner supplies authentication and tool execution;
              downloading the file does not deploy an agent.
            </p>
          </div>
          <button
            className="button secondary"
            disabled={download.isPending}
            onClick={() => download.mutate()}
          >
            <Download size={16} />
            Export saved skill
          </button>
        </div>
      </Panel>
      <Modal
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        title="Agent instructions"
        description="Preview of your current draft. This does not run a model or save changes."
        className="automation-preview"
      >
        <h3>Call analysis system prompt</h3>
        <pre className="automation-prompt">{preview?.systemPrompt}</pre>
        <details className="content-details">
          <summary>Support summary system prompt</summary>
          <pre className="automation-prompt">
            {preview?.summarySystemPrompt}
          </pre>
        </details>
        <h3>Evidence tools</h3>
        {preview?.tools.map((t) => (
          <p key={t.name}>
            <strong>{t.name}</strong>
            <br />
            {t.purpose}
            <br />
            <code>
              {t.method} {t.path}
            </code>
          </p>
        ))}
        <button className="button" onClick={() => setPreview(null)}>
          Close preview
        </button>
      </Modal>
    </section>
  );
}

type Source = {
  id: string;
  name: string;
  enabled: boolean;
  last_received_at: string | null;
};
function IngestionSetup() {
  const user = useIdentity();
  const admin = apiMode && user?.role === "ADMIN";
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const sources = useQuery({
    queryKey: ["ingestion-sources"],
    queryFn: () => api<Source[]>("/ingestion/sources"),
    enabled: admin,
  });
  const create = useMutation({
    mutationFn: () =>
      api<{ token: string }>("/ingestion/sources", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: (result) => {
      setToken(result.token);
      setName("");
      void client.invalidateQueries({ queryKey: ["ingestion-sources"] });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) =>
      api(`/ingestion/sources/${id}`, { method: "DELETE" }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["ingestion-sources"] }),
  });
  return (
    <Panel
      title="Connect a recording source"
      description="Use a contact center event, a CRM workflow or a recording service to send finished calls automatically."
      className="automation-ingestion"
    >
      <div className="panel-copy">
        <div className="automation-source-summary">
          <Workflow size={25} aria-hidden="true" />
          <div>
            <strong>One ingestion API, many environments</strong>
            <p>
              Your connector sends an audio file and metadata when a call ends.
              A watched-folder connector is also available for systems that
              export recordings. Clarity stores it and starts transcription,
              analysis and grouping automatically. Reuse the same event ID when
              retrying.
            </p>
          </div>
        </div>
        <ol className="automation-setup">
          <li>Create an upload-only source token.</li>
          <li>
            Configure your recorder's completion event or an integration worker
            to send the file.
          </li>
          <li>
            Check received calls in{" "}
            <Link to="/conversations">Conversations</Link>.
          </li>
        </ol>
        {admin ? (
          <>
            <form
              className="automation-source-form"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <label>
                Source name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  required
                  placeholder="e.g. Main contact center"
                />
              </label>
              <button className="button" disabled={create.isPending || !!token}>
                Create source token
              </button>
            </form>
            {sources.data?.map((s) => (
              <div className="integration-row" key={s.id}>
                <div>
                  <strong>{s.name}</strong>
                  <small className="cell-secondary">
                    {s.last_received_at
                      ? `Last recording received ${new Date(s.last_received_at).toLocaleString()}`
                      : "No recordings received yet"}
                  </small>
                </div>
                <Badge>{s.enabled ? "Enabled" : "Revoked"}</Badge>
                {s.enabled && (
                  <button
                    className="button secondary"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(s.id)}
                  >
                    Revoke token
                  </button>
                )}
              </div>
            ))}
          </>
        ) : (
          <p className="notice">
            A workspace administrator creates production source tokens.
            {(!apiMode || user?.role === "DEMO") &&
              " This demo explains the connection without creating a live external integration."}
          </p>
        )}
        <details className="content-details">
          <summary>Connection contract</summary>
          <p>
            <code>POST /api/v1/ingestion/recordings</code>
          </p>
          <p>
            Send <code>Authorization: Bearer &lt;source token&gt;</code> and{" "}
            <code>Idempotency-Key: &lt;source event ID&gt;</code>. The request
            is multipart: <code>audio</code> is the file and{" "}
            <code>metadata</code> is an application/json part.
          </p>
          <pre className="automation-prompt">
            {JSON.stringify(
              {
                title: "Customer support call",
                customerId: "customer-reference",
                agent: "Support team",
                department: "Customer support",
                recordedAt: "2026-10-09T10:00:00Z",
                language: "en",
                speakers: 2,
                sample: false,
              },
              null,
              2,
            )}
          </pre>
          <p>
            A 202 response means processing is queued. Replaying the event
            returns the same call. File limits and media validation apply.
            Tokens can only upload to their own workspace, and can be revoked
            here.
          </p>
        </details>
        {[sources.error, create.error, revoke.error]
          .filter(Boolean)
          .map((e, i) => (
            <p role="alert" className="field-error" key={i}>
              {e?.message}
            </p>
          ))}
      </div>
      <Modal
        open={!!token}
        onOpenChange={(open) => {
          if (!open) setToken(null);
        }}
        title="Source token created"
        description="Shown once. Store it in your recording connector's secret store."
      >
        <label className="platform-form">
          Upload-only token
          <textarea readOnly value={token ?? ""} rows={4} />
        </label>
        <p>
          The token is not saved in browser storage. Closing this dialog hides
          it permanently.
        </p>
        <button className="button" onClick={() => setToken(null)}>
          I have saved the token
        </button>
      </Modal>
    </Panel>
  );
}
