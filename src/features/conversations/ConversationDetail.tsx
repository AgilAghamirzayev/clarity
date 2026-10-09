import { Link, useParams } from "react-router-dom";
import { ArrowLeft, AudioLines, FileText, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { WorkspaceView } from "../../components/WorkspaceView";
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  TextLink,
} from "../../components/ui";
import { durationLabel } from "../../domain/analytics";

export default function ConversationDetail() {
  const { id } = useParams();
  return (
    <WorkspaceView>
      {(data) => {
        const call = data.conversations.find((c) => c.id === id);
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
              eyebrow={call.id}
              title={call.topic}
              description={`${call.customer} · ${call.agent} · ${format(new Date(call.date), "d MMM yyyy, HH:mm")}`}
              action={
                <Badge tone={call.sentiment}>{call.sentiment} sentiment</Badge>
              }
            />
            <div className="detail-grid">
              <Panel
                title="Conversation transcript"
                description={`${call.language} · ${durationLabel(call.duration)} · Synthetic sample`}
                action={<FileText size={18} />}
              >
                <div className="recording-placeholder">
                  <AudioLines size={25} />
                  <div>
                    <strong>Sample transcript</strong>
                    <p>
                      Audio playback will be available when a recording provider
                      is connected.
                    </p>
                  </div>
                </div>
                <div className="transcript">
                  {call.transcript.map((segment) => (
                    <div
                      className={`transcript-segment ${segment.speaker.toLowerCase()}`}
                      key={segment.seconds}
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
                <Panel
                  title="Conversation summary"
                  description="Sample analysis"
                >
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
                      <strong>Synthetic fixture</strong>
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
                  No real personal data is used.
                </p>
              </div>
            </div>
          </>
        );
      }}
    </WorkspaceView>
  );
}
