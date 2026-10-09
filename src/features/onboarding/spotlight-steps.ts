import type { Workspace } from "../../domain/models";
import { apiMode } from "../../data/api";
import { inPeriod } from "../../domain/analytics";

export type SpotlightStep = {
  id: string;
  route: string;
  selector: string;
  chapter: string;
  title: string;
  description: string;
  takeaway: string;
  interactive?: boolean;
};
export const spotlightCount = 18;
export function buildSpotlightSteps(data?: Workspace): SpotlightStep[] {
  const calls = [...(data?.conversations ?? [])].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const call =
    inPeriod(calls, 7).find((c) => c.sample && c.issueId) ??
    inPeriod(calls, 7).find((c) => c.issueId) ??
    calls.find((c) => c.sample && c.issueId) ??
    calls.find((c) => c.issueId) ??
    calls[0];
  const issue =
    data?.issues.find((i) => i.id === call?.issueId) ?? data?.issues[0];
  const recommendation =
    data?.recommendations.find(
      (r) =>
        r.issueId === issue?.id &&
        !data.decisions.some((d) => d.recommendationId === r.id),
    ) ??
    data?.recommendations.find((r) => r.issueId === issue?.id) ??
    data?.recommendations.find(
      (r) => !data.decisions.some((d) => d.recommendationId === r.id),
    ) ??
    data?.recommendations[0];
  const callRoute = call
    ? `/conversations/${encodeURIComponent(call.id)}`
    : "/conversations";
  const issueRoute = issue
    ? `/issues/${encodeURIComponent(issue.id)}`
    : "/issues";
  const decisionRoute = recommendation
    ? `/decisions?recommendation=${encodeURIComponent(recommendation.id)}`
    : "/decisions";
  return [
    {
      id: "purpose",
      route: "/",
      selector: ".page-heading",
      chapter: "The big picture",
      title: "What is Clarity?",
      description:
        "Clarity helps support teams understand why customers contact them, spot recurring problems and decide what to improve. It connects each recommendation back to the conversations behind it.",
      takeaway:
        "The workflow: recording → transcript → issue → recommendation → human decision.",
    },
    {
      id: "metrics",
      route: "/",
      selector: ".stat-card:first-child",
      chapter: "The big picture",
      title: "Read the support signals",
      description:
        "These cards count analyzed conversations, recurring issue groups and positive sentiment for the selected period. Awaiting your review counts recommendations that still need a decision.",
      takeaway:
        "These are signals from the available calls, not a customer satisfaction score or a complete measure of team performance.",
    },
    {
      id: "period",
      route: "/",
      selector: ".period-picker",
      chapter: "The big picture",
      title: "Choose the time window",
      description:
        "Use this control to compare the last 7 or 30 days. The call totals, sentiment and trends update together, so you can inspect recent activity or a wider pattern.",
      takeaway:
        "A pattern in a small sample deserves investigation before you generalize it to all customers.",
    },
    {
      id: "trends",
      route: "/",
      selector: ".chart",
      chapter: "The big picture",
      title: "See when problems are happening",
      description:
        "The chart compares all calls with calls showing negative sentiment. A rise helps you choose where to investigate; it does not explain the cause on its own.",
      takeaway:
        "The chart also has a text data view for checking the underlying daily counts.",
    },
    {
      id: "import",
      route: "/conversations",
      selector: '[data-tour="import-recording"]',
      chapter: "From voice to evidence",
      title: "Bring a customer call into Clarity",
      description: apiMode
        ? "Connected recording systems send finished calls automatically through Automation & AI. This button also accepts MP3, MP4, M4A, WAV or FLAC for a manual import. Each incoming call starts the processing pipeline."
        : "This is where recordings enter the workflow. The offline preview demonstrates file import; real transcription and analysis require the live backend and local models.",
      takeaway:
        "The tour only explains this button. It will not upload a file or start a processing job for you.",
    },
    {
      id: "sentiment",
      route: "/conversations",
      selector: ".sentiment-filter",
      chapter: "From voice to evidence",
      title: "Narrow the calls you want to review",
      description:
        "Search for a topic, agent or conversation, then choose Positive, Neutral or Negative to narrow the list. All removes the sentiment filter.",
      takeaway:
        "Sentiment is a model estimate of the conversation's tone. Check the transcript before drawing conclusions.",
    },
    {
      id: "call-list",
      route: "/conversations",
      selector: ".conversation-panel tbody tr",
      chapter: "From voice to evidence",
      title: "Open the source, not just the score",
      description:
        "A conversation row connects its title, topic, sentiment, agent and date. Opening it reveals the transcript and analysis for that exact call.",
      takeaway:
        "Next, the tour opens an available conversation so you can see how evidence is presented.",
    },
    {
      id: "audio",
      route: callRoute,
      selector: ".recording-player, .recording-placeholder",
      chapter: "Inside a conversation",
      title: apiMode
        ? "Listen to the original recording"
        : "Understand the recording view",
      description: apiMode
        ? "Use the audio controls to hear the original call. Generated sample recordings make the live demo playable without using real customer audio."
        : "This offline preview includes an authored sample transcript. In the live deployment, an audio player here lets you listen to the original call.",
      takeaway: apiMode
        ? "You can press Play while this step is open. Audio never starts automatically."
        : "Audio availability and access depend on the deployment and your role.",
      interactive: true,
    },
    {
      id: "transcript",
      route: callRoute,
      selector: ".transcript-segment",
      chapter: "Inside a conversation",
      title: "Check who said what, and when",
      description:
        "Speaker labels and timestamps keep the conversation in context. In the live demo, timestamp buttons seek to that moment in the recording, so you can verify an extracted statement.",
      takeaway:
        "Transcription and speaker attribution can be imperfect. The recording remains the reference.",
    },
    {
      id: "call-summary",
      route: callRoute,
      selector: ".call-summary-panel",
      chapter: "Inside a conversation",
      title: "Read the call in context",
      description:
        "The summary condenses the conversation, while department, sentiment and source describe where it came from. A related issue links this call to a wider pattern.",
      takeaway:
        "A summary makes a call easier to review; it does not replace the customer's actual words.",
    },
    {
      id: "issues",
      route: "/issues",
      selector: ".issue-card",
      chapter: "From evidence to action",
      title: "Find problems that repeat",
      description:
        "Clarity groups related conversations into issue cards. Each card shows the topic, affected calls, unique customers and change against the previous period.",
      takeaway:
        "Several contacts about the same problem can suggest a policy, product or process issue worth investigating.",
    },
    {
      id: "evidence",
      route: issueRoute,
      selector: ".evidence-list article:first-child",
      chapter: "From evidence to action",
      title: "Trace an issue back to its evidence",
      description:
        "Supporting conversations show which calls contributed to this issue. Follow their links to compare the full transcript with the proposed root cause.",
      takeaway:
        "A root cause is a hypothesis until your team verifies it against operational evidence.",
    },
    {
      id: "proposal",
      route: decisionRoute,
      selector: ".decision-body",
      chapter: "From evidence to action",
      title: "Understand the proposed improvement",
      description:
        "Each recommendation describes a proposed action and its expected outcome. The supporting evidence links back to an issue and its affected conversations.",
      takeaway:
        "Example: repeated checkout failures may justify investigating payment errors, not automatically changing the payment system.",
    },
    {
      id: "review",
      route: decisionRoute,
      selector: ".decision-footer",
      chapter: "From evidence to action",
      title: "Your team makes the decision",
      description:
        "For an unreviewed proposal, Review proposal opens the approval or rejection form with an owner and rationale. Existing decisions show their current status or next available action.",
      takeaway:
        "Nothing is approved by taking this tour. Guest demo decisions never send external tasks or messages.",
    },
    {
      id: "summary-metrics",
      route: "/summary?period=30",
      selector: ".summary-metrics > .panel:first-child",
      chapter: "The overall support picture",
      title: "Evaluate the broader pattern",
      description:
        "The 30-day summary compares call volume, negative sentiment, repeat contacts and recording length with the previous period. The scope tells you which data is included.",
      takeaway:
        "Recording length excludes after-call work. Sample calls illustrate the analysis, not real customer results.",
    },
    {
      id: "advice",
      route: "/summary?period=30",
      selector: ".summary-areas > .panel:first-child .panel-heading",
      chapter: "The overall support picture",
      title: "Decide what to investigate next",
      description:
        "Advice is organized into policy and communication, product and engineering, and support operations. Each suggestion explains an observation, a next step and supporting conversations.",
      takeaway:
        "Expand Validation & measurement to see how a team could test the idea and measure a result.",
    },
    {
      id: "connections",
      route: "/settings",
      selector: ".integration-row",
      chapter: "Explore independently",
      title: "See where reviewed work can go",
      description:
        "These connection cards show the setup for recording sources, local AI and team tools. The demo forms use example settings and do not request real credentials.",
      takeaway:
        "Demo connections are simulated. Production integrations need their own authenticated backend configuration.",
    },
    {
      id: "restart",
      route: "/guide",
      selector: ".guide-hero .button",
      chapter: "Explore independently",
      title: "You now know the complete workflow",
      description:
        "Use Getting started whenever you need the tour or a feature explanation. Follow a sample call through its issue and recommendation, then inspect the support summary.",
      takeaway:
        "You can restart this walkthrough here. Your own exploration and decisions stay under your control.",
    },
  ];
}
