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

## Local infrastructure exception

The Docker daemon accepted new containers but did not complete their startup. Existing containers continued serving requests. Its root cause was not established. Docker was not restarted because other projects have running containers.

To complete real database testing without disrupting those projects, a separate `csi` database and `csi_owner`/`csi_app` roles were created inside this project's running `csi-temporal-db-1` PostgreSQL 17.11 container. pgvector 0.8.1 was built from its official release source. A temporary loopback forward serves that database on port 5547. The private `.env.local` contains the matching JDBC and worker connection URLs. Temporal's own databases are separate.

The temporary forward is `.runtime/pg-forward.py` and is running for the current preview. If this process stops, start it with `python3 .runtime/pg-forward.py`. This is a local validation workaround, not the deployment topology.

The repository's intended Compose topology has a dedicated PostgreSQL service on 5546. Its PostgreSQL 18.6 + pgvector image built successfully, but container startup in this Docker session is unverified. After Docker is healthy, use a fresh development database or an explicit backup/restore migration before switching the private connection URLs. Do not delete the existing volumes to resolve this issue.

## Operational boundaries

Partner credentials and approved destinations must be configured by the tenant administrator. Full production deployment, high availability, retention policy, model accuracy certification and the missing sections of the original source document are not claimed by these local tests. The optional GLiNER weights were not required for the tested default local Qwen PII backend.
