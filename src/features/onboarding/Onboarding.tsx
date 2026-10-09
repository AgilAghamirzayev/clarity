import {
  ArrowRight,
  AudioLines,
  CheckCheck,
  GitBranch,
  Lightbulb,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Modal } from "../../components/Modal";
import { apiMode, guestMode } from "../../data/api";
import { useOnboarding } from "./context";

export function WelcomeTour() {
  const tour = useOnboarding();
  return (
    <>
      <Modal
        open={tour.status === "welcome"}
        onOpenChange={(open) => {
          if (!open) tour.dismiss();
        }}
        title="Meet Clarity"
        description="Turn customer conversations into better support decisions."
        className="onboarding-welcome"
        onCloseAutoFocus={(event) => {
          if (tour.status === "touring") {
            event.preventDefault();
            document
              .querySelector<HTMLElement>(
                ".clarity-spotlight .driver-popover-title",
              )
              ?.focus();
          }
        }}
      >
        <div className="welcome-intro">
          <span className="welcome-mark">
            <AudioLines size={30} aria-hidden="true" />
          </span>
          <span className="tour-eyebrow">
            Customer intelligence · Interactive demo
          </span>
        </div>
        <p className="welcome-lead">
          Hear the problem.
          <br />
          Understand the pattern.
          <br />
          <span>Know what to review next.</span>
        </p>
        <div className="welcome-flow">
          {[
            { icon: AudioLines, title: "Listen", text: "Calls & transcripts" },
            {
              icon: GitBranch,
              title: "Understand",
              text: "Patterns & evidence",
            },
            { icon: Lightbulb, title: "Act", text: "Human-reviewed actions" },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title}>
              <Icon size={22} aria-hidden="true" />
              <strong>{title}</strong>
              <span>{text}</span>
            </div>
          ))}
        </div>
        <p className="welcome-context">
          {guestMode
            ? "Start with generated sample calls that have been processed by local speech and AI models. You can also upload a recording for real analysis."
            : apiMode
              ? "Explore your workspace from recordings to reviewed recommendations. Your existing role and permissions apply throughout."
              : "Explore a sample workspace with fictional conversations, recommendations and review history. This offline preview does not run AI models."}
        </p>
        <div className="welcome-actions">
          <Link
            className="button secondary"
            to="/conversations"
            onClick={tour.dismiss}
          >
            {guestMode ? "Try fresh analysis" : "Open conversations"}
          </Link>
          <button className="button" onClick={tour.start}>
            Start guided tour <ArrowRight size={17} aria-hidden="true" />
          </button>
          <button className="button secondary" onClick={tour.dismiss}>
            Explore on my own
          </button>
        </div>
        <div className="welcome-footnote">
          <span>18 focused steps · About 4 minutes</span>
          <Link to="/guide" onClick={tour.dismiss}>
            Read the demo guide
          </Link>
        </div>
      </Modal>
      <Modal
        open={tour.completionOpen}
        onOpenChange={(open) => {
          if (!open) tour.closeCompletion();
        }}
        title="Ready to explore"
        description="You have seen the path from a customer call to a reviewed action."
        className="onboarding-complete"
      >
        <div className="tour-complete-mark">
          <CheckCheck size={32} aria-hidden="true" />
        </div>
        <p className="welcome-context">
          Try it yourself: open a conversation, follow an issue to its evidence,
          then review the suggested action. You can restart this tour from
          Getting started at any time.
        </p>
        <div className="welcome-actions">
          <Link
            className="button"
            to="/conversations"
            onClick={tour.closeCompletion}
          >
            Explore conversations <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link
            className="button secondary"
            to="/guide"
            onClick={tour.closeCompletion}
          >
            Open demo guide
          </Link>
        </div>
      </Modal>
    </>
  );
}
