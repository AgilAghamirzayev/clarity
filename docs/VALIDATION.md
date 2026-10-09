# Local validation - 9 October 2026

The six requested platform areas are implemented. Validation distinguishes real local inference and persistence from partner API contract tests.

## Verified locally

- React production build, TypeScript, Oxlint and Prettier.
- Seven frontend domain/repository tests and ten demo browser scenarios.
- Authenticated API browser scenario: sign-in, import form, integrations, audit, sign-out, 320 px and 1440 px layouts and axe accessibility checks.
- Eleven Java tests, including seven with real PostgreSQL: tenant RLS, cross-tenant reads, authentication, CSRF, RBAC, retry/outbox atomicity, measured outcome denominators and append-only audit permissions.
- Fourteen Python tests with real database and model tests enabled: identifier masking, segment-boundary masking, evidence validation, event contracts, SSRF rejection, signed CRM payloads, Jira replay recovery, persistent delivery retry, clustering replay isolation, local Qwen analysis, positive-call abstention, PII detection and embeddings.
- A real synthetic recording processed by Faster Whisper and SpeechBrain locally, with PII masking before persistence.
- Complete smoke through API import, MinIO, transactional outbox, Kafka, Temporal, local speech/PII/LLM/embedding stages, PostgreSQL issue/recommendation persistence, human review, completion, outcome query and authorized audio playback.
- Repeated import with the same idempotency key reused the original call.
- No partner message was sent. Jira/Slack/CRM transport contracts use isolated test doubles; actual tenant delivery remains credential-dependent.

The synthetic end-to-end call reports repeated payment failure. The local model returned negative customer sentiment, an issue supported by transcript indices, and an investigation recommendation. The outcome remains in its collection window and claims no business improvement.

## Local infrastructure

The standard Compose topology is running with a dedicated PostgreSQL 18.6 database, pgvector 0.8.1 and the application connection on port 5546. MinIO, Kafka and Temporal are also running. The API and local Python worker use this database.

The initialization script is copied into the database image instead of bind-mounted from macOS. A separate disposable database container verified fresh initialization of the application role and vector extension. Existing local sample data was restored into the dedicated database, including the audit permission restriction. The real database tests, authenticated browser scenario and full synthetic-audio pipeline passed again after this switch.

The temporary database forward used during diagnosis has been stopped. The earlier CSI validation database is retained as a local backup inside this project's Temporal database container; Temporal's own databases are separate. Other projects' containers were not restarted or changed.

## Readable workspace follow-up

The workspace now contains ten explicitly marked sample recordings, including seven generated customer/agent conversations imported through the local processing pipeline. The model classified the successful card activation as positive, the repayment explanation as neutral, and the reported service problems as negative. No external action was approved by the sample importer.

Visible call references, descriptive titles, customer aliases, processing states, role names and audit descriptions replace database keys in normal views. UUIDs remain available in administrator technical details. The authenticated browser check verifies that UUIDs do not appear in the conversation view, opens recording details, and checks layouts and accessibility at 320, 768, 1024 and 1440 pixels. The React build, formatting, lint, seven frontend tests, eleven Java tests and eleven browser scenarios passed after these changes.

## Support summary follow-up

The new summary endpoint passed five additional database tests covering reporting boundaries, sample exclusion, empty denominators, tenant isolation, request replay, role checks, CSRF and direct tenant-scoped evidence retrieval. Six Python tests cover citation validation, measured overview counts and protection against invented service targets. Local model regression tests also passed after disabling reasoning mode for structured PII detection.

The complete API/outbox/Kafka/Temporal/local-model path generated a summary of ten sample calls with three evidence-linked suggestions across policy, product and operations. The overview uses database calculations, and verification steps and measurement definitions come from explicit category guidance. Suggestions remain hypotheses requiring review; the model has not inspected policy documents or source code.

The authenticated summary browser scenario checks sample exclusion, evidence navigation, responsive layouts and accessibility at 320, 768, 1024 and 1440 pixels. The demo summary scenario also verifies period selection and empty states.

## Operational boundaries

Partner credentials and approved destinations must be configured by the tenant administrator. Full production deployment, high availability, retention policy, model accuracy certification and the missing sections of the original source document are not claimed by these local tests. The optional GLiNER weights were not required for the tested default local Qwen PII backend.
