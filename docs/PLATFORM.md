# Local customer intelligence platform

The existing React demo remains available with `VITE_DATA_MODE=demo`. The API mode uses a Java 21 / Spring Boot 3.5 backend, PostgreSQL with pgvector, MinIO, Kafka, Temporal and a Python worker. All speech and language inference runs locally.

## Start locally

Requirements: Docker, Java 21, Python 3.12, uv, Node 20.19+ and Ollama. The first setup downloads public packages and model weights. Inference does not need a cloud AI account. Before sending text, the worker checks Ollama model metadata and rejects cloud/remote aliases. For a dedicated Ollama installation, also disable its cloud feature in `~/.ollama/server.json`.

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

In separate terminals:

```sh
scripts/start-worker
npm run dev -- --host 127.0.0.1 --port 4173
```

Open `http://127.0.0.1:4173`. The initial tenant is `local`, email `admin@csi.local`, and password is the generated `BOOTSTRAP_PASSWORD` in `.env.local`. The setup file has mode 0600 and is ignored by Git. Setup never overwrites existing credentials. Remove bootstrap variables from the API environment after creating the first administrator. Use a password manager to distribute accounts.

The application uses ports 8086 (API), 5546 (PostgreSQL), 9100/9101 (MinIO), 19092 (Kafka), 17233 (Temporal), and 18233 (Temporal UI). All published Compose ports bind to loopback. Volumes are durable. `docker compose --env-file .env.local down` preserves them; deleting volumes deletes platform data.

## Processing contract

1. An analyst imports WAV, FLAC or MP3 audio with metadata and an `Idempotency-Key`. The API checks byte signatures and a 100 MB limit, pseudonymizes the customer reference, uploads a private object, and commits the call plus outbox event atomically. A failed database insert removes its uploaded object.
2. An outbox publisher sends only event/resource/tenant identifiers to Kafka. Unsent rows retry with capped backoff. Delivery is at least once.
3. A Kafka consumer starts a stable Temporal workflow for each call generation, then commits the Kafka offset. Replayed messages cannot start another workflow. Malformed events go to a dead-letter topic with source coordinates, not raw content.
4. Faster Whisper transcribes locally. Stereo channel metadata can identify customer and agent. Mono audio uses SpeechBrain ECAPA embeddings and agglomerative clustering; speaker identity is separate from role attribution. Short fragments remain unknown. Overlapping speech and incorrect speaker counts need manual review.
5. Pattern rules and the existing local Qwen model detect PII before any transcript persistence. Raw audio remains restricted to administrators and analysts. Temporary audio files are removed after processing. Automated redaction is not a guarantee that every identifier is recognized, especially in noisy or Azerbaijani speech.
6. Ollama produces schema-validated analysis. The prompt distinguishes customer problems from agent performance and never treats escalation as proven resolution. Every finding must cite existing segment indices. Long calls are processed in chunks. Output text is masked again.
7. Nomic produces 768-dimensional embeddings. A tenant-scoped PostgreSQL cosine search assigns a finding to an existing cluster below distance 0.22 or creates a new cluster. Model names partition embedding spaces. This threshold is an initial setting, not a calibrated confidence score.
8. The worker writes issue evidence, recommendations, notifications and completion atomically. An advisory lock serializes cluster creation per tenant. Replayed activities do not duplicate completed results.
9. A reviewer approves or rejects a recommendation. Execution transitions use a version check and a row lock. Completion opens seven-day before/after outcome measurement. Rates include denominators and remain unavailable without observations. Differences are observational, not causal savings.

Temporal retries each analysis stage up to three times. Successful transcript and analysis checkpoints are reused. Activity timeouts bound each attempt to 30 minutes and each stage to two hours. Final failure is visible in the import queue and can be retried as a new generation. Workflow history contains identifiers and sanitized error codes, never audio or transcript text. Transcription is limited to one hour per file. One local inference activity runs at a time to bound model memory use.

## Authentication and tenant isolation

Authentication uses BCrypt and PostgreSQL-backed server sessions. Session cookies are HttpOnly and SameSite=Strict. CSRF tokens are required for writes, including login/logout. `COOKIE_SECURE=false` is only for localhost HTTP; use true behind HTTPS. Login attempts are limited per tenant/email. Failed credentials do not reveal whether an account exists.

| Role     | Allowed operations                                                |
| -------- | ----------------------------------------------------------------- |
| VIEWER   | Masked calls, issues, recommendations, outcomes and notifications |
| ANALYST  | Viewer operations, import/retry and original audio access         |
| REVIEWER | Viewer operations, approve/reject and advance actions             |
| ADMIN    | All operations, user creation, integrations and audit access      |

Business tables enforce PostgreSQL RLS against the transaction-local authenticated tenant. Requests never trust a client-supplied tenant header. The application database role cannot update or delete audit records. Migration credentials are separate from runtime credentials. The local bootstrap role can create the first tenant/user; production provisioning should be an operator-controlled operation.

## Integrations

Jira Cloud, Slack and generic CRM webhooks are implemented. Delivery is disabled until an administrator configures and enables an adapter. Set `INTEGRATION_ALLOWED_ORIGINS` on both API and worker to a comma-separated list of exact HTTPS origins. Private/link-local destinations and redirects are rejected. The sender pins a validated public IP while verifying TLS against the original hostname.

The settings response names the worker environment variable for the integration credential: `CSI_INTEGRATION_<uuid_with_underscores>_TOKEN`. Secrets are not accepted by the browser or returned in configuration responses. Restart the worker after supplying a credential.

- Slack: endpoint `https://slack.com/api/chat.postMessage`, bot token and channel ID. Uses `client_msg_id` for replay identity.
- Jira: endpoint is the site origin, with project key and service account email. The token is used with basic authentication. A stable delivery label is searched before issue creation to recover previous attempts.
- CRM: HTTPS endpoint receives JSON containing event ID, delivery ID, event type and the approved recommendation. `Idempotency-Key` is the delivery UUID. `X-CSI-Signature` is `sha256=` followed by the HMAC-SHA256 of the exact request body using the configured token. Receivers must validate the signature and atomically deduplicate the delivery ID.

Only human-approved actions generate external delivery events. No raw recording or raw transcript is sent. Retries are bounded to eight attempts over 24 hours. Delivery attempts and external IDs are persisted. After retries are exhausted, administrators can retry from the delivery history; the original delivery identity is retained. External exactly-once delivery cannot be guaranteed by Slack or Jira during ambiguous network failures or delayed search indexing. Inspect the delivery history before manually reissuing an action.

## API

All application endpoints start with `/api/v1` and require a session except `/auth/csrf` and `/auth/login`.

| Endpoint                                          | Purpose                                                |
| ------------------------------------------------- | ------------------------------------------------------ |
| GET /auth/csrf                                    | Obtain token and required header name                  |
| POST /auth/login                                  | JSON tenant, email and password                        |
| GET /auth/me, POST /auth/logout                   | Session identity and logout                            |
| GET /workspace                                    | React workspace projection, latest 500 completed calls |
| POST /calls/import                                | Multipart audio and JSON metadata                      |
| GET /calls, /calls/{id}                           | Import status and record                               |
| GET /calls/{id}/transcript, /analysis, /audio     | Masked text, analysis and protected audio              |
| POST /calls/{id}/retry                            | Retry a failed call                                    |
| GET /issues, /issues/{id}, /recommendations       | Evidence and proposals                                 |
| POST /recommendations/{id}/decisions              | Review with action, owner and rationale                |
| POST /recommendations/{id}/advance                | Move lifecycle with expected version                   |
| GET /decisions/{id}/outcomes                      | Seven-day before/after observation                     |
| GET /analytics/overview, /insights/trends         | Counts with distinct calls/customers                   |
| GET /notifications, POST /notifications/{id}/read | In-app notifications                                   |
| GET /integrations, PUT /integrations/{kind}       | Admin adapter configuration                            |
| POST /deliveries/{id}/retry                       | Retry an exhausted delivery with the same identity     |
| GET /deliveries, /audit                           | Admin delivery and append-only audit history           |
| POST /users                                       | Create a user in the current tenant                    |

Import metadata: optional `title` (up to 120 characters, without personal details), optional `sample` (marks generated or example audio), `customerId`, `agent`, `department`, ISO `recordedAt`, optional two-letter `language`, expected `speakers` (1-8), and stereo `customerChannel` (0 or 1). Use internal references for agent/customer inputs. The original customer reference is not stored. Files are never fetched from arbitrary URLs.

## Readable references and sample recordings

Each recording has a persistent `CALL-1001` style reference and a descriptive title. Private customer identifiers are shown as readable customer references. Database UUIDs remain internal routing keys; administrators can inspect them under technical details in the audit view. Import and delivery states use plain-language labels.

To populate realistic sample conversations on macOS with the installed Samantha and Daniel voices:

```sh
python3 scripts/run.py uv run --project worker python scripts/seed-sample-recordings.py
```

This imports seven generated stereo conversations through the real audio and AI pipeline. The scenarios cover sign-in codes, card delivery, transfer fees, card activation and loan repayment explanations. Every recording is marked as sample data; employee names are fictional. Stable import keys prevent duplicates on repeated runs. It creates no approval decisions and sends no partner messages. Existing records are preserved. Generated audio is cached under `.runtime/sample-recordings`.

## Verification

```sh
VITE_DATA_MODE=demo npm test
npm run build
npm run lint
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
scripts/mvn test
uv run --project worker pytest worker/tests
CSI_INTEGRATION_TESTS=true python3 scripts/run.py scripts/mvn test
CSI_INTEGRATION_TESTS=true PYTHONPATH=worker python3 scripts/run.py uv run --project worker pytest worker/tests/test_persistence.py
CSI_MODEL_TESTS=true PYTHONPATH=worker python3 scripts/run.py uv run --project worker pytest worker/tests/test_local_models.py
CSI_E2E_API=true PLAYWRIGHT_CHANNEL=chrome python3 scripts/run.py npm run test:e2e
python3 scripts/run.py uv run --project worker python scripts/smoke.py /path/to/synthetic.wav
```

Model and database tests explicitly skip without their activation environment variables. The normal unit suite is not evidence that local weights or partner credentials work. The demo and API browser suites use separate ports, avoiding an existing user's browser session. Tests use synthetic text and recordings. Partner adapters are tested through isolated contracts; actual Jira/Slack/CRM delivery requires the user's configured tenant credentials and an authorized test destination.

## Deployment boundaries

Compose is a local development topology, not a high-availability deployment. Production requires HTTPS, private service networks, broker and Temporal authentication, secrets management, backups with restore exercises, object encryption at rest, resource limits, model quality evaluation on consented representative data, and an organization-specific retention policy. The UI workspace projection is capped at 500 completed calls; aggregate API queries cover the tenant's full history. Do not infer full-history rates from a capped UI view.

The local model weights must be provisioned before starting an offline worker. Keep model paths available to the worker. Qwen is the default PII backend. For the alternative GLiNER backend, run `scripts/provision-models.py --include-gliner` through the worker environment and set `PII_BACKEND=gliner`. Its base encoder metadata/tokenizer are provisioned alongside its weights. Review licenses and pin model revisions for your deployment. No cloud AI provider is configured.

## Documentation used

Implementation was checked against [Spring Boot 3.5 documentation](https://docs.spring.io/spring-boot/3.5/), [Temporal Python SDK guidance](https://docs.temporal.io/develop/python), [Faster Whisper](https://github.com/SYSTRAN/faster-whisper), [SpeechBrain ECAPA](https://huggingface.co/speechbrain/spkrec-ecapa-voxceleb), and Ollama's [chat](https://docs.ollama.com/api/chat) and [embedding](https://docs.ollama.com/api/embed) contracts. Library syntax was also checked through Context7 and installed package source.

## Support performance summary

The **Support summary** page compares 7, 30 or 90 days with the immediately preceding period. It reports completed calls, distinct customers, sentiment distribution, customers with multiple calls, average recording length and leading issue clusters. Both periods use the recording timestamp with a start-exclusive/end-inclusive window. The sample-data control applies to metrics and evidence together. Rates are unavailable when their denominators are zero. Sentiment is not CSAT; multiple calls are not a resolution failure; recording length excludes after-call work.

`GET /api/v1/support-summary?days=7&includeSamples=false` reads the latest snapshot for that scope. If none exists, it returns current metrics with `NOT_GENERATED` status. `POST /api/v1/support-summary` accepts `{ "days": 7, "includeSamples": false }` plus an `Idempotency-Key` and CSRF token. Administrators, analysts and reviewers may generate; viewers may read. Reusing a request key with a different scope returns a conflict. Only one report per tenant/scope may be active; a different request key for an already-running scope receives a conflict. Stored snapshots are immutable; **Refresh analysis** captures newer calls and a new comparison window.

A report request and outbox event commit together. Kafka dispatches a stable Temporal workflow to the local worker. Generation retries up to three times within an hour; final failure can be retried from the page with a new request. Tenant RLS protects snapshots and reports. Workflow histories contain identifiers and sanitized errors. Snapshot creation uses a repeatable-read database transaction so evidence and metrics see the same database state.

The local model receives calculated aggregate metrics and the latest 40 eligible masked call summaries. The numerical overview is calculated directly from the snapshot; strengths cite positive call summaries. Every suggestion must cite references from that exact snapshot. Verification checklists and success measures are defined by category, so the model does not set service targets. The worker validates citations, masks generated text, stores the model/prompt version and records completion in the server audit. Metrics use all eligible calls; qualitative advice is limited to the visible evidence subset. Evidence links load the call directly, including records outside the workspace list limit. Sample recordings remain explicitly labeled.

Advice covers policy and communication, product and engineering, and support operations when the calls support it. Each suggestion includes an observation, proposed action, validation step, success measure and links to supporting calls. This feature does not inspect source code or policy documents, does not estimate CSAT, SLA compliance or first-contact resolution, and does not create external tickets or change policies automatically.

After importing the local samples, verify the complete generation path with:

```sh
python3 scripts/run.py uv run --project worker python scripts/smoke-summary.py
```
