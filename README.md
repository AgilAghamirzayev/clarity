# Clarity - Customer Intelligence

A React and TypeScript application with a Java 21 / Spring Boot API and fully local AI workers. It turns recordings into masked transcripts, recurring issues, evidence-backed recommendations, reviewed actions and measured outcomes.

## Run the platform

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

Start `scripts/start-worker` and `npm run dev -- --host 127.0.0.1 --port 4173` in separate terminals. Local credentials are generated in `.env.local`; they are never committed.

For the self-contained synthetic demo:

```sh
npm ci
VITE_DATA_MODE=demo npm run dev
```

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
infra/              Local database image and role initialization
scripts/            Setup, model provisioning, startup and real pipeline smoke
compose.yml         Local PostgreSQL, MinIO, Kafka and Temporal topology
docs/PLATFORM.md    Setup, contracts, security and operational boundaries
```

## Libraries

React Router, TanStack Query/Table, React Hook Form, Zod, Radix Dialog and Recharts handle repeated UI behavior. Spring Security, JDBC, Flyway and the AWS S3 SDK handle API infrastructure. Temporal, aiokafka, Pydantic, Faster Whisper, SpeechBrain, scikit-learn, httpx and Ollama handle processing and delivery. Exact dependency resolutions are in the npm and uv lockfiles and Maven POM.

## Verification

```sh
VITE_DATA_MODE=demo npm test
npm run lint
npm run build
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
scripts/mvn test
uv run --project worker pytest worker/tests
```

The platform guide includes commands for real PostgreSQL, local model, authenticated browser and complete audio-pipeline tests. Opt-in tests are explicitly skipped when their services are absent.

The original design images and the end of the source document were unavailable. [Concept analysis](docs/CONCEPT_ANALYSIS.md) records that source boundary. The interface preserves the existing restrained green visual direction. No deployment or remote push is included.
