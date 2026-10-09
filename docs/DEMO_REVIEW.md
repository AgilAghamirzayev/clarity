# Reviewing the Clarity demo

Clarity connects customer support recordings to recurring issues and reviewable recommendations. Its purpose is to help a team decide which policies, product problems and support processes deserve investigation.

## Start in the product

A first-time demo visitor sees a welcome dialog. **Start guided tour** opens an 18-step spotlight walkthrough over the actual application pages, taking about four minutes. The tour can be skipped, restarted from **Getting started**, or continued after reloading a page. Each step dims the surrounding page and focuses on a specific metric, control or evidence panel. Visitors learn how a recording becomes a transcript, an issue group and a recommendation for human review. Back, Next and Skip remain available, and Escape exits the tour. Audio can be played manually during its step. The walkthrough never uploads recordings, creates decisions or sends external messages automatically.

The permanent guide is at `/guide`. It explains the workflow and the distinction between real processing and illustrative demo data. The onboarding preference is versioned and stored in the visitor's browser. It is included in the normal frontend build and needs no separate deployment service.

## Suggested evaluation sequence

1. **Overview:** compare the 7-day and 30-day periods. Totals come from the selected conversations.
2. **Conversations:** open a sample recording. Play its audio, seek using transcript timestamps and inspect the call analysis. Upload an MP3, MP4, M4A, WAV or FLAC to test new processing in the live deployment.
3. **Issue intelligence:** inspect an issue group and open its supporting conversations.
4. **Decision center:** inspect a recommendation and its review form. A reviewer can record a decision and an owner. Guest demo reviews never enqueue external deliveries.
5. **Support summary:** inspect the prepared 30-day report, including policy, engineering and operational advice, then follow its evidence links.
6. **Workspace settings:** inspect processing status and notifications. Try the demo connection forms using example settings.

## What is real, and what is illustrative

- The live demo backend stores recordings and runs local speech-to-text, speaker separation, privacy masking, analysis, embeddings and issue grouping. New processing requires the worker and provisioned models to be available.
- Prepared demo voices and scenarios are fictional and generated. Their stored transcripts and findings were processed by local models. They are bundled with the server so new deployed workspaces can be populated immediately.
- Seeded decision history illustrates a team's review workflow. It is not evidence of actual business improvement.
- Jira, Slack, email and other connection forms in the guest demo simulate configuration. They do not authenticate with external providers or send messages. Authenticated backend integrations are configured separately.
- Recommendations are hypotheses for human review. Outcome comparisons do not establish causation, and recording duration is not a measure of complete handling time or customer satisfaction.
- The offline fixture mode is an interface preview. Its sample data and browser storage do not run the live model pipeline.

## Code entry points for technical review

- `src/features/onboarding/`: first-visit state, guided navigation, permanent guide and responsive styling.
- `server/src/main/java/az/csi/DemoCatalog.java`: isolated prepared demo data and tenant-owned audio copies.
- `server/src/main/java/az/csi/CallController.java`: import and authorized recording access.
- `worker/csi_worker/`: local processing pipeline.
- `tests/onboarding.spec.ts`: first visit, skip, restart, reload, responsive access and blocked-storage behavior.

See [Deployment](DEPLOYMENT.md) for Docker Compose setup and [Platform](PLATFORM.md) for backend behavior. Local validation does not imply a VPS has been deployed.
