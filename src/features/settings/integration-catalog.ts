import {
  AudioLines,
  Database,
  GitPullRequest,
  MessageSquare,
} from "lucide-react";

export type IntegrationKind = "contact" | "ai" | "jira" | "notifications";
export interface ConnectionField {
  key: string;
  label: string;
  type?: "url" | "email";
  placeholder: string;
}
export interface IntegrationDefinition {
  kind: IntegrationKind;
  name: string;
  detail: string;
  icon: typeof AudioLines;
  fields: ConnectionField[];
}
export const integrationCatalog: IntegrationDefinition[] = [
  {
    kind: "contact",
    name: "Contact center",
    detail:
      "Bring call recordings and conversation details into your workspace.",
    icon: AudioLines,
    fields: [
      {
        key: "name",
        label: "Contact center name",
        placeholder: "e.g. Customer support",
      },
      {
        key: "endpoint",
        label: "Recording service URL",
        type: "url",
        placeholder: "https://calls.example.com",
      },
    ],
  },
  {
    kind: "ai",
    name: "Transcription & AI",
    detail: "Use local models for transcription, privacy masking and analysis.",
    icon: Database,
    fields: [
      {
        key: "endpoint",
        label: "Local model service URL",
        type: "url",
        placeholder: "http://127.0.0.1:11434",
      },
      {
        key: "speechModel",
        label: "Speech model",
        placeholder: "e.g. Faster Whisper",
      },
      {
        key: "analysisModel",
        label: "Analysis model",
        placeholder: "e.g. qwen3:4b-instruct",
      },
    ],
  },
  {
    kind: "jira",
    name: "Jira",
    detail: "Send reviewed actions to the right Jira project.",
    icon: GitPullRequest,
    fields: [
      {
        key: "endpoint",
        label: "Jira site URL",
        type: "url",
        placeholder: "https://your-team.atlassian.net",
      },
      { key: "project", label: "Project key", placeholder: "e.g. SUPPORT" },
      {
        key: "email",
        label: "Service account email",
        type: "email",
        placeholder: "integrations@example.com",
      },
    ],
  },
  {
    kind: "notifications",
    name: "Slack & email",
    detail: "Choose where your team receives updates about reviewed actions.",
    icon: MessageSquare,
    fields: [],
  },
];
export function connectionFields(
  definition: IntegrationDefinition,
  channel: string,
) {
  if (definition.kind !== "notifications") return definition.fields;
  return channel === "email"
    ? [
        {
          key: "email",
          label: "Notification email",
          type: "email" as const,
          placeholder: "support@example.com",
        },
      ]
    : [
        {
          key: "channel",
          label: "Slack channel ID",
          placeholder: "e.g. C0123456789",
        },
      ];
}
