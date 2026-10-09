import {
  ArrowRight,
  AudioLines,
  CheckCircle2,
  Compass,
  Cpu,
  Layers,
  Play,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/ui";
import { apiMode, guestMode } from "../../data/api";
import { tourSteps } from "./content";
import { useOnboarding } from "./context";

export default function GettingStarted() {
  const tour = useOnboarding();
  return (
    <>
      <PageHeader
        title="Getting started"
        description="A clear path from customer feedback to your next decision."
      />
      <section className="guide-hero panel">
        <div>
          <span className="tour-eyebrow">
            <Compass size={16} aria-hidden="true" /> Your Clarity walkthrough
          </span>
          <h2>
            Better support starts
            <br />
            with understanding the call.
          </h2>
          <p>
            Clarity helps support teams turn recordings into searchable
            evidence, recurring issues and recommendations for policies,
            products and operations.
          </p>
          <button className="button" onClick={tour.start}>
            <Play size={17} aria-hidden="true" />{" "}
            {tour.status === "completed"
              ? "Restart guided tour"
              : "Start guided tour"}
          </button>
          <span className="guide-duration">
            18 focused steps · About 4 minutes · Skip anytime
          </span>
        </div>
        <div className="guide-pipeline" aria-label="How Clarity works">
          {[
            {
              icon: AudioLines,
              title: "Customer conversations",
              text: "Recordings and transcripts",
            },
            {
              icon: Layers,
              title: "Patterns with evidence",
              text: "Issue groups and AI recommendations",
            },
            {
              icon: CheckCircle2,
              title: "Decisions your team owns",
              text: "Human review and outcome comparison",
            },
          ].map(({ icon: Icon, title, text }, i) => (
            <div key={title}>
              <span>{i + 1}</span>
              <Icon size={22} aria-hidden="true" />
              <div>
                <strong>{title}</strong>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="guide-section" aria-labelledby="review-path">
        <div className="guide-section-heading">
          <h2 id="review-path">Explore the demo, step by step</h2>
          <p>
            Follow the guided tour or open any section directly. No action is
            required to advance.
          </p>
        </div>
        <div className="guide-step-grid">
          {tourSteps.map(
            ({ path, title, section, description, icon: Icon }, i) => (
              <Link className="panel guide-step-card" key={path} to={path}>
                <div className="guide-card-top">
                  <span className="guide-card-icon">
                    <Icon size={21} aria-hidden="true" />
                  </span>
                  <span>0{i + 1}</span>
                </div>
                <span className="guide-card-section">{section}</span>
                <h3>{title}</h3>
                <p>{description}</p>
                <span className="text-link">
                  Explore section <ArrowRight size={16} aria-hidden="true" />
                </span>
              </Link>
            ),
          )}
        </div>
      </section>
      <section className="panel guide-scope" aria-labelledby="demo-scope">
        <div className="guide-section-heading">
          <h2 id="demo-scope">What you are reviewing</h2>
          <p>Use these distinctions when evaluating the demo.</p>
        </div>
        <div className="guide-scope-grid">
          <div>
            <Cpu size={22} aria-hidden="true" />
            <h3>
              {apiMode ? "Real local processing" : "Offline interface preview"}
            </h3>
            <p>
              {apiMode
                ? "Uploaded recordings run through local transcription, speaker separation, privacy masking, AI analysis and issue grouping. Processing time depends on the server and recording."
                : "This preview uses fictional fixtures and browser storage. It does not transcribe recordings or run language models. The deployed live demo requires its backend and local model services."}
            </p>
          </div>
          <div>
            <AudioLines size={22} aria-hidden="true" />
            <h3>Prepared sample workspace</h3>
            <p>
              {guestMode
                ? "Sample voices and scenarios are generated, not real customer calls. Their transcripts and AI findings were produced by local models. Review history illustrates a team's decisions."
                : "Sample conversations and review history illustrate the workflow. They are examples, not verified customer outcomes."}
            </p>
          </div>
          <div>
            <Layers size={22} aria-hidden="true" />
            <h3>Connections and outcomes</h3>
            <p>
              Demo connections are simulated and do not send external messages.
              Recommendations are hypotheses. A before-and-after comparison does
              not prove that an action caused a business improvement.
            </p>
          </div>
        </div>
      </section>
      <section className="guide-next panel">
        <div>
          <h2>Try your own recording</h2>
          <p>
            {apiMode
              ? "Open Conversations and choose Import recording. MP3, MP4, M4A, WAV and FLAC are supported; MP4 files need an audio track."
              : "Open Conversations to explore the recording import interface. Use the live deployment to run transcription and AI analysis."}
          </p>
          {guestMode && (
            <p className="guide-limit">
              Live demo: 5 uploads, up to 25 MB and 5 minutes each. Prepared
              samples do not use this allowance.
            </p>
          )}
        </div>
        <Link className="button secondary" to="/conversations">
          Open conversations <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </>
  );
}
