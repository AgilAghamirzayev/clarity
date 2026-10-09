# Clarity - Customer Intelligence

**A working customer-intelligence application, deployed on Microsoft Azure.** Clarity helps support and CX leads at digital-service companies turn recurring recorded complaints into evidence-linked investigations and human-owned decisions.

**[Open the live demo](https://clarity.eastus.cloudapp.azure.com)** · **[View the presentation](https://docs.google.com/presentation/d/18koiUMdis-ebzjao5bb77KTcCEpVnfjmu0shbTRsMno/edit?usp=sharing)** · [Deployment and operations](docs/AZURE_DEMO.md)

Support teams often review calls individually while recurring problems and follow-up ownership remain scattered. Clarity connects the original speech, recurring issue, proposed action and reviewer decision in one workspace. The intended benefit is a clearer support-to-engineering handoff. Customer adoption, reviewer time savings and business impact have not yet been measured.

Built by **DigiSolution** for **NeuroBridge.SI 2026**, AI Enterprise Solutions.

**Flow:** connected recording source → masked transcript → recurring issue group → evidence-linked recommendation → human-reviewed decision → observational outcome comparison.

## Judge quick start

- [Six-slide pitch, speaker notes and three-minute script](docs/PITCH.md) · [Editable deck](deliverables/judge-pitch/Clarity-Judge-Pitch-Current.pptx)
- [Two-minute demo script](docs/DEMO_SCRIPT.md) · [Workspace walkthrough](docs/DEMO_REVIEW.md)
- [Evaluation under the exact five rubric criteria](docs/JUDGE_EVALUATION.md)
- [Judge Q&A and primary-source competitor comparison](docs/JUDGE_QA.md)
- [Quality, manual-baseline and cost experiments still needed](docs/EVIDENCE_PLAN.md)

Current measured evidence and remaining gaps are summarized in [Submission evidence](docs/SUBMISSION_EVIDENCE.md).

## Live product on Azure

The public demo runs the complete application, including its backend, database, audio storage and AI processing. Visitors can inspect prepared evidence immediately and upload a recording for fresh inference. No account, local installation or paid AI API key is required to try it.

### Try it in a few minutes

1. Open [Clarity](https://clarity.eastus.cloudapp.azure.com) and choose **Try fresh analysis**.
2. In **Conversations**, choose **Analyze sample call**. This sends a new 22-second fictional recording through the real pipeline.
3. While it processes, inspect the eight prepared calls, recurring issue groups and human review histories.
4. When the upload shows **Ready to review**, open it, play the recording, inspect the transcript and follow its linked issue.
5. In **Support summary**, choose **Refresh analysis** to create a new report that includes the completed call.

On the Azure acceptance run, the fresh call completed in **205.2 seconds** and a report covering nine calls completed in **241.7 seconds**. These are individual CPU measurements, not a promised latency or concurrent-user capacity. Prepared records open immediately. Each visitor gets a separate temporary workspace with five uploads, a 25 MB/five-minute limit per file and a 24-hour session.

### What is deployed

| Component                        | Running on Azure                                                           | Purpose                                                                                  |
| -------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Web application                  | React/TypeScript demo and authenticated `/admin/` interface                | Review conversations, issues, recommendations, decisions and reports                     |
| HTTPS gateway                    | Caddy with a valid TLS certificate                                         | Serve the UI and route authenticated API requests                                        |
| Application API                  | Java 21 / Spring Boot                                                      | Guest workspaces, access control, uploads, evidence and decision state                   |
| Database                         | PostgreSQL with pgvector and Flyway migrations                             | Persist tenant-isolated records, vectors, sessions and audit history                     |
| Recording storage                | MinIO, official release built from source                                  | Keep audio in a private object store and authorize playback                              |
| Event processing                 | Kafka and Temporal                                                         | Dispatch durable jobs, checkpoint stages and retry failures                              |
| AI worker                        | Python worker                                                              | Transcription, masking, analysis, grouping and report generation                         |
| Speech and speaker models        | Faster Whisper small and SpeechBrain ECAPA                                 | Transcribe speech and separate speakers; stereo channel metadata supplies explicit roles |
| Language and embedding models    | Ollama with Qwen3 4B Instruct and Nomic Embed Text                         | Produce structured findings, detect sensitive text and group related issues              |
| Model initialization and cleanup | Dedicated initialization jobs and cleanup service                          | Provision persistent model files and expire temporary demo workspaces                    |
| Demo content                     | Eight fictional generated recordings, linked findings and prepared reports | Give judges an immediate, reproducible starting point                                    |

All components run on one **Azure East US VM with 4 vCPUs, 32 GiB RAM and a 128 GiB Standard SSD**. Inference runs on that VM. Database, storage, queue and model ports are internal; the web is exposed through HTTPS and SSH is restricted to the deployment address.

The verified compute quote is **$0.252/hour, approximately $6.05/day**, plus disk and public-IP charges. Azure trial credit funds the demo; it does not make the underlying infrastructure free. Cost per audio hour, sustained concurrency and a production recovery process remain unmeasured. [Deployment details](docs/AZURE_DEMO.md) · [Cost assumptions](evaluation/COSTS.md).

### Verified against the deployed service

- Valid HTTPS, a fresh login-free guest workspace and a ready AI worker.
- Eight prepared recordings, five issue groups and five recommendations in a new workspace.
- Fresh uploaded audio completed transcription/masking, analysis and clustering without a failed stage: nine transcript segments and one accepted issue.
- Recording playback from transcript timestamps worked without a media error.
- A refreshed report included all nine calls and produced three evidence-linked recommendations.
- A second visitor could not access the first visitor's prepared or freshly uploaded calls (HTTP 404). A request without a CSRF token was rejected (HTTP 403).

[Azure acceptance evidence](evaluation/reports/azure-acceptance-20261009.json) records the measurements. The interface and AI workflow are implemented and deployed; the fictional catalog and unvalidated business-impact claims remain explicitly separated.

## What AI contributes

Speech models transcribe recordings and help separate speakers. Patterns and a local entity model mask sensitive text. A language model proposes call findings and investigations with source references; embeddings help group related issues. Code validates references, manages retries and calculates counts and rates. People approve or reject actions and record the owner and rationale. A valid citation is not proof of a correct interpretation.

The React/TypeScript workspace uses a Java 21 / Spring Boot API and Python workers. Local inference is the default. Customers can configure supported analysis endpoints and version company instructions; this does not support every model or deploy an autonomous agent. Speech, masking and embeddings remain local. See [Automation & AI](docs/AUTOMATION_AI.md).

## Evidence and demo boundaries

The bundled catalog contains **8 fictional generated recordings, 5 issue groups, 5 recommendations and 3 prepared reports**. Stored model outputs load without fresh inference. Display titles include editorial labels, and four documented substitutions correct over-masked generic phrases in samples. Prepared call outputs record `call-analysis-v2`; the current worker uses `call-analysis-v6-reviewed`. Seeded decision histories illustrate states and do not establish impact. See [sample provenance](demo/README.md) and the [current catalog audit](deliverables/judge-pitch/evidence/catalog-audit.json).

Fresh uploads require running services and models. Guest integrations are simulated and send no partner messages. The separate offline fixture also simulates data. In the authenticated platform, external actions require human approval and configured adapters.

Current checks and measurements are recorded in [Submission evidence](docs/SUBMISSION_EVIDENCE.md). The new eight-case synthetic comparison matched 7/7 labeled issues with AI and 3/7 with the fixed keyword baseline; AI also produced one extra finding and three narrow rubric flags. These are lexical proxies, not human-reviewed accuracy. [Version 6 results](evaluation/RESULTS_V6.md) preserve failures and comparison limits. Human reviewer effort, representative audio/privacy quality and cost per processed audio hour remain unverified. Raw audio is not redacted. Before/after comparisons are observational, not causal.

New demo visitors can go directly to Conversations with **Try fresh analysis**, or take the optional 18-step welcome tour. **Getting started** (`/guide`) explains controls, evidence and the workflow; the tour can be skipped or restarted.

## Run the real demo

The default frontend opens an isolated guest workspace without login. The prepared catalog is available when the API has seeded the workspace. For fresh processing, open Conversations and choose **Analyze sample call** or upload a permissioned recording. A new job uses the running worker and local demo models; wait for completion before describing the output as fresh inference.

Start the local platform services below, enable `DEMO_ENABLED=true` in `.env.local`, then run:

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 4173
```

For a VPS, follow [the Docker Compose deployment guide](docs/DEPLOYMENT.md). It covers the complete stack, HTTPS, model downloads, guest isolation, retention and post-deploy verification. A static frontend alone cannot run the real demo.

The earlier offline UI remains available with `npm run dev:fixture` or `npm run build:fixture`. Its records and connections are simulated. Demo connection forms never request credentials or send partner messages; actual integrations belong to the authenticated platform.

## Run the authenticated platform

Follow [the platform guide](docs/PLATFORM.md) for initial setup, generated credentials, local model provisioning and service startup.

```sh
npm ci
python3 scripts/setup-local.py
docker compose --env-file .env.local up -d
uv sync --project worker --locked
uv run --project worker python scripts/provision-models.py
ollama pull qwen3:4b-instruct
ollama pull nomic-embed-text:latest
scripts/start-api
```

Start `scripts/start-worker` and `npm run dev:api -- --host 127.0.0.1 --port 4173` in separate terminals. Local credentials are generated in `.env.local`; they are never committed.

API mode is explicit: use `npm run dev:api` for development or `npm run build:api` for an authenticated build in `dist-api/`. This mode still requires a valid backend session and preserves role and tenant enforcement.

## Implemented

- PostgreSQL persistence with Flyway migrations, pgvector, tenant RLS and append-only server audit.
- Private MinIO audio storage, validated multipart imports, replay keys and authorized playback.
- Local Faster Whisper transcription, SpeechBrain speaker embeddings, diarization and explicit stereo role mapping.
- Pattern and local Qwen PII detection before transcript persistence, with an optional GLiNER backend.
- Structured Ollama analysis, validated evidence references, Nomic embeddings, online issue clustering and reviewable recommendations.
- Transactional outbox, Kafka dispatch, Temporal workflows, stage checkpoints, bounded retries and a failed-call retry flow.
- BCrypt authentication, database-backed sessions, CSRF, role enforcement and tenant-scoped user provisioning.
- Jira Cloud, Slack and signed generic CRM webhook adapters, delivery history and in-app notifications.
- Versioned decision transitions and observational seven-day outcome comparisons.
- Responsive React views for login, imports, conversations, issues, reviews, integrations, notifications and audit.

External adapters remain disabled until configured. No live partner messages are sent by the test suite. Model quality, speaker accuracy and PII recall need evaluation on representative, consented data. Human review is required before external action. Production operations and deployment boundaries are detailed in the platform guide.

## Structure

```text
src/
  app/              Providers, authentication gate, routes and layout
  components/       Shared accessible UI and query states
  domain/           Types, schemas and analytics calculations
  data/             HTTP and explicit demo repositories
  features/         Overview, calls, issues, decisions, settings and platform UI
server/
  src/main/java/    Spring API, security, storage and outbox publisher
  src/main/resources/db/migration/ PostgreSQL schema and RLS policies
  src/test/         API authorization and database isolation checks
worker/
  csi_worker/       Local models, privacy, clustering, Temporal and adapters
  tests/            Contracts, live database and opt-in local model tests
infra/              Container builds, HTTPS gateway and database initialization
scripts/            Setup, model provisioning, startup and real pipeline smoke
compose.yml         Local PostgreSQL, MinIO, Kafka and Temporal topology
compose.vps.yml     Complete Azure/VPS deployment, including web and local AI
docs/PLATFORM.md    Setup, contracts, security and operational boundaries
```

## Libraries

React Router, TanStack Query/Table, React Hook Form, Zod, Radix Dialog and Recharts handle repeated UI behavior. Spring Security, JDBC, Flyway and the AWS S3 SDK handle API infrastructure. Temporal, aiokafka, Pydantic, Faster Whisper, SpeechBrain, scikit-learn, httpx and Ollama handle processing and delivery. Exact dependency resolutions are in the npm and uv lockfiles and Maven POM.

## Verification

```sh
npm test
npm run lint
npm run build
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
scripts/mvn test
uv run --project worker pytest worker/tests
```

The platform guide includes commands for real PostgreSQL, local model, authenticated browser and complete audio-pipeline tests. Opt-in tests are explicitly skipped when their services are absent.

The original design images and the end of the source document were unavailable. [Concept analysis](docs/CONCEPT_ANALYSIS.md) records that source boundary. The interface preserves the existing restrained green visual direction. The current Azure deployment and its acceptance evidence are documented above.

## Automation and company AI

The **Automation & AI** page provides automatic ingestion setup, deployment-controlled model selection, versioned company context and rules, prompt previews and a saved agent-skill export. Local AI remains the default. See [Automation and AI](docs/AUTOMATION_AI.md) for the source API, watched-folder connector, provider configuration and supported contracts.

## Evaluation and reproducibility

[Core workflow evaluation](evaluation/README.md) documents synthetic labels, held-out checks, audio benchmarks, failure cases and the pending human pilot. [Measured results](evaluation/RESULTS.md) distinguish structural checks from semantic quality.

## Submission package

The [current evidence summary](docs/SUBMISSION_EVIDENCE.md) is the judging entry point. It links new measurements, historical evidence, failure examples, the reviewer pilot, competitor comparison and a sourced infrastructure budget. Build an archive with `python3 scripts/package-submission.py`; it includes relevant untracked source and evidence while excluding runtime data, credentials, dependencies and older decks. The package command itself does not publish code or submit the project to the judges.
