import {
  callReference,
  callTitle,
  languageLabel,
} from "../../domain/presentation";
import { useQuery } from "@tanstack/react-query";
import type { Conversation } from "../../domain/models";
import { api, apiMode } from "../../data/api";
import { useIdentity } from "../platform/identity";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, AudioLines, FileText, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { WorkspaceView } from "../../components/WorkspaceView";
import {
  Badge,
  LoadingState,
  ErrorState,
  EmptyState,
  PageHeader,
  Panel,
  TextLink,
} from "../../components/ui";
import { durationLabel } from "../../domain/analytics";

export default function ConversationDetail() {
  const { id } = useParams();
  const user = useIdentity();
  const detail = useQuery({
    queryKey: ["conversation-detail", id],
    enabled: apiMode && !!id,
    queryFn: async (): Promise<Conversation> => {
      const record = await api<{
        id: string;
        reference: string;
        metadata: Pick<
          Conversation,
          "customer" | "title" | "agent" | "department" | "date" | "sample"
        >;
        issueIds: string[];
        analysis: Pick<Conversation, "topic" | "summary" | "sentiment"> | null;
        transcript: {
          duration: number;
          language: string;
          segments: Conversation["transcript"];
        } | null;
      }>(`/calls/${id}`);
      if (!record.analysis || !record.transcript)
        throw new Error(
          "This recording is still being processed. Return to the import history to check its progress.",
        );
      return {
        ...record.metadata,
        ...record.analysis,
        id: record.id,
        reference: record.reference,
        issueId: record.issueIds[0] ?? null,
        issueIds: record.issueIds,
        duration: record.transcript.duration,
        language: record.transcript.language,
        transcript: record.transcript.segments,
      };
    },
  });
  return (
    <WorkspaceView>
      {(data) => {
        if (apiMode && detail.isPending) return <LoadingState />;
        if (apiMode && detail.isError)
          return (
            <ErrorState
              error={detail.error}
              retry={() => void detail.refetch()}
            />
          );
        const call = detail.data ?? data.conversations.find((c) => c.id === id);
        if (!call)
          return (
            <EmptyState title="Conversation not found">
              <Link to="/conversations">Back to conversations</Link>
            </EmptyState>
          );
        const issue = data.issues.find((i) => i.id === call.issueId);
        return (
          <>
            <Link className="back-link" to="/conversations">
              <ArrowLeft size={15} />
              All conversations
            </Link>
            <PageHeader
              eyebrow={`${callReference(call)}${call.sample ? " · SAMPLE RECORDING" : ""}`}
              title={callTitle(call)}
              description={`${call.customer} · ${call.agent} · ${format(new Date(call.date), "d MMM yyyy, HH:mm")}`}
              action={
                <Badge tone={call.sentiment}>{call.sentiment} sentiment</Badge>
              }
            />
            <div className="detail-grid">
              <Panel
                title="Conversation transcript"
                description={`${languageLabel(call.language)} · ${durationLabel(call.duration)} · ${call.sample ? "Generated sample audio" : apiMode ? "Local transcription" : "Synthetic sample"}`}
                action={<FileText size={18} />}
              >
                {apiMode ? (
                  user && ["ADMIN", "ANALYST"].includes(user.role) ? (
                    <audio
                      className="recording-player"
                      controls
                      preload="none"
                      src={`/api/v1/calls/${call.id}/audio`}
                      aria-label="Call recording"
                    />
                  ) : (
                    <p className="panel-copy">
                      Audio access requires the analyst role.
                    </p>
                  )
                ) : (
                  <div className="recording-placeholder">
                    <AudioLines size={25} />
                    <div>
                      <strong>Sample transcript</strong>
                      <p>
                        Audio playback will be available when a recording
                        provider is connected.
                      </p>
                    </div>
                  </div>
                )}
                <div className="transcript">
                  {call.transcript.map((segment, index) => (
                    <div
                      className={`transcript-segment ${segment.speaker.toLowerCase()}`}
                      key={index}
                    >
                      <span className="mono timestamp">
                        {durationLabel(segment.seconds)}
                      </span>
                      <div>
                        <strong>{segment.speaker}</strong>
                        <p>{segment.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
              <div className="stack">
                <Panel title="Summary">
                  <p className="panel-copy">{call.summary}</p>
                  <div className="metadata-list">
                    <div>
                      <span>Department</span>
                      <strong>{call.department}</strong>
                    </div>
                    <div>
                      <span>Sentiment</span>
                      <Badge tone={call.sentiment}>{call.sentiment}</Badge>
                    </div>
                    <div>
                      <span>Source</span>
                      <strong>
                        {call.sample
                          ? "Generated sample recording"
                          : apiMode
                            ? "Imported recording"
                            : "Synthetic fixture"}
                      </strong>
                    </div>
                  </div>
                </Panel>
                <Panel title="Related issue">
                  {issue ? (
                    <div className="panel-copy">
                      <Badge tone={issue.priority}>{issue.priority}</Badge>
                      <h3>{issue.title}</h3>
                      <p>{issue.description}</p>
                      <TextLink to={`/issues/${issue.id}`}>
                        Explore issue
                      </TextLink>
                    </div>
                  ) : (
                    <p className="panel-copy">
                      No issue identified in this sample conversation.
                    </p>
                  )}
                </Panel>
                <p className="quiet-note">
                  <ShieldCheck size={16} />
                  {apiMode
                    ? "Automated masking is applied. Verify accuracy before sharing."
                    : "No real personal data is used."}
                </p>
              </div>
            </div>
          </>
        );
      }}
    </WorkspaceView>
  );
}
