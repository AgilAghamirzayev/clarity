import { apiMode } from "../../data/api";
import LiveSettings from "../platform/LiveSettings";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AudioLines,
  Database,
  GitPullRequest,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { Badge, PageHeader, Panel } from "../../components/ui";
import { Modal } from "../../components/Modal";
import { repository, workspaceKey } from "../../data/queries";

const integrations = [
  {
    name: "Contact center",
    detail:
      "Import call recordings and metadata through a backend ingestion service.",
    icon: AudioLines,
  },
  {
    name: "Transcription & AI",
    detail: "Connect STT, redaction and analysis workers through your backend.",
    icon: Database,
  },
  {
    name: "Jira",
    detail: "Create action items after an authorized human review.",
    icon: GitPullRequest,
  },
  {
    name: "Slack & email",
    detail: "Deliver alerts for critical issues and decision updates.",
    icon: MessageSquare,
  },
];
export default function Settings() {
  return apiMode ? <LiveSettings /> : <DemoSettings />;
}
function DemoSettings() {
  const [confirm, setConfirm] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const client = useQueryClient();
  const reset = useMutation({
    mutationFn: () => repository.reset(),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: workspaceKey });
      setConfirm(false);
      setResetComplete(true);
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="YOUR WORKSPACE"
        title="Workspace settings"
        description="Understand what is connected and manage your local demo."
      />
      <div className="settings-grid">
        <Panel title="Data & environment" description="Frontend foundation">
          <dl className="settings-details">
            <div>
              <dt>Workspace</dt>
              <dd>Customer Intelligence</dd>
            </div>
            <div>
              <dt>Environment</dt>
              <dd>
                <Badge tone="positive">Local demo</Badge>
              </dd>
            </div>
            <div>
              <dt>Data source</dt>
              <dd>Synthetic fixtures</dd>
            </div>
            <div>
              <dt>Snapshot date</dt>
              <dd>9 October 2026</dd>
            </div>
            <div>
              <dt>Decision storage</dt>
              <dd>This browser only</dd>
            </div>
            <div>
              <dt>Authentication</dt>
              <dd>Not connected</dd>
            </div>
          </dl>
          <div className="notice">
            <ShieldCheck size={18} />
            <span>
              Use fictional names in demo reviews. Browser storage is not
              suitable for real customer data or production audit records.
            </span>
          </div>
        </Panel>
        <Panel
          title="Reset demo workspace"
          description="Start the review workflow again"
        >
          <div className="panel-copy">
            <p>
              Remove the decisions saved in this browser. The sample
              conversations, issue groups, and recommendations will stay
              available.
            </p>
            <button
              className="button secondary"
              onClick={() => {
                setResetComplete(false);
                setConfirm(true);
              }}
            >
              <RotateCcw size={16} />
              Reset demo decisions
            </button>
            {resetComplete && (
              <p role="status" className="success-text">
                Demo decisions have been reset.
              </p>
            )}
          </div>
        </Panel>
      </div>
      <Panel
        title="Integration readiness"
        description="These connections need backend services and are not active in this preview."
      >
        <div className="integration-list">
          {integrations.map(({ name, detail, icon: Icon }) => (
            <div className="integration-row" key={name}>
              <span className="category-icon">
                <Icon size={20} />
              </span>
              <div>
                <h3>{name}</h3>
                <p>{detail}</p>
              </div>
              <Badge>Not connected</Badge>
            </div>
          ))}
        </div>
      </Panel>
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title="Reset demo decisions?"
        description="This removes only reviews and action history saved by this demo in your browser."
      >
        {reset.isError && (
          <p className="field-error" role="alert">
            {reset.error.message}
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="button secondary"
            onClick={() => setConfirm(false)}
          >
            Cancel
          </button>
          <button
            className="button danger"
            disabled={reset.isPending}
            onClick={() => reset.mutate()}
          >
            Reset decisions
          </button>
        </div>
      </Modal>
    </>
  );
}
