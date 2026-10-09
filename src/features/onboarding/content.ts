import {
  AudioLines,
  ChartNoAxesCombined,
  GitBranch,
  LayoutDashboard,
  Lightbulb,
  Settings2,
} from "lucide-react";

export const tourSteps = [
  {
    path: "/",
    title: "See the support picture",
    section: "Overview",
    icon: LayoutDashboard,
    description:
      "Start with call volume, customer sentiment and recurring issues. Change the period to see which conversations contribute to the totals.",
    task: "Compare the 7-day and 30-day views. Open an issue to trace a metric back to its evidence.",
  },
  {
    path: "/conversations",
    title: "Listen to the evidence",
    section: "Conversations",
    icon: AudioLines,
    description:
      "Every insight starts with a conversation. Open a call to read its transcript, inspect the analysis and follow the original evidence.",
    task: "Choose a sample call. In the live demo, play its recording or click a transcript timestamp to hear that moment.",
  },
  {
    path: "/issues",
    title: "Find recurring problems",
    section: "Issue intelligence",
    icon: GitBranch,
    description:
      "Related conversations are grouped into issues so you can spot patterns across customers, rather than reviewing each call in isolation.",
    task: "Open an issue and inspect its supporting conversations. Treat a suggested root cause as a hypothesis to investigate.",
  },
  {
    path: "/decisions",
    title: "Turn insights into reviewed actions",
    section: "Decision center",
    icon: Lightbulb,
    description:
      "Recommendations connect an issue to a proposed next step. Your team reviews the evidence, assigns an owner and records its decision.",
    task: "Open a proposal and inspect the review form. Saving a demo decision does not send Jira, Slack or CRM messages.",
  },
  {
    path: "/summary?period=30",
    title: "Understand what to improve",
    section: "Support summary",
    icon: ChartNoAxesCombined,
    description:
      "The support summary brings patterns together into advice for policies, product engineering and support operations.",
    task: "Read the 30-day analysis and follow an evidence link. Compare the advice with the actual customer conversation.",
  },
  {
    path: "/settings",
    title: "Explore connections and workspace details",
    section: "Workspace settings",
    icon: Settings2,
    description:
      "Check notifications, processing status and connection settings. Demo connection forms let you explore the setup without credentials.",
    task: "Try a connection with example settings. These demo connections are simulated and never contact external services.",
  },
];
