# Clarity architecture images

Reviewed against the local implementation on 9 October 2026. Generated with the built-in image_gen tool and visually checked for readable labels and correct processing order. This is an implementation map, not evidence of a live deployment, production readiness or measured AI accuracy.

## Presentation assets

- [System architecture](clarity-system-architecture.png): frontend, API, storage, Kafka, Temporal, worker and human-approved delivery.
- [AI processing pipeline](clarity-ai-pipeline.png): the three CallWorkflow activities and their models.
- [Generation and refinement prompts](GENERATION-PROMPTS.md).

Both diagrams preserve Clarity's cream and green palette and use English labels. Source ports labeled "From API" and "From Temporal" reference the named component elsewhere in the overview. The repeated "Application DB" card is the same PostgreSQL instance, not a second database.

## Exact flow

1. React uses REST requests and polls stored results. Caddy is the VPS web/API edge. A configured recording exporter can upload automatically; a source system still needs to be connected. Browser import is also available.
2. Spring Boot stores raw audio in MinIO. It writes recording metadata, a frozen analysis profile and an outbox event to application PostgreSQL. Object storage and the database are not one atomic transaction.
3. The API's outbox publisher sends metadata to Kafka topic `csi.events`. Audio and transcript text do not travel in these events.
4. The Python dispatcher starts the appropriate Temporal workflow. Stable workflow IDs prevent duplicate workflow starts. Invalid events go to `csi.dead-letter`. Kafka delivery is not claimed to be exactly once.
5. Temporal coordinates activities on task queue `csi-local` and stores workflow history in its own PostgreSQL. The dispatcher and activity worker share one Python service.
6. CallWorkflow runs `transcribe_call`, `analyze_call`, then `cluster_call`. Each main processing activity allows up to three attempts; exhausted processing invokes failure persistence. The separate failure-persistence activity has its own retry policy.
7. The worker stores masked transcripts, analysis, issue links and recommendations in application PostgreSQL. React reads them through the API.
8. A person reviews the evidence and approves or rejects a decision. Eligible approved decisions emit another outbox event, which uses the same Kafka and Temporal path to DeliveryWorkflow. Jira, Slack and a signed CRM webhook require configuration. Demo external actions are simulated.
9. SupportSummaryWorkflow is a separate refresh path for evidence-cited advice. Counts and before/after comparisons are deterministic. Outcome comparisons are observational.

## Models and controls

| Component | Current role | Important boundary |
| --- | --- | --- |
| Faster Whisper Small | Speech recognition with timestamps | Local weights, CPU INT8 configuration |
| SpeechBrain ECAPA | Speaker embeddings for mono diarization | Stereo channel metadata can supply roles; unknown roles remain unknown |
| Qwen3 4B Instruct via Ollama | Default local text analysis and local PII entity detection | AI output requires schema and evidence checks |
| GLiNER multi-v2.1 | Optional alternative PII detector | Not an additional mandatory pipeline stage |
| Nomic Embed Text via Ollama | 768-dimensional finding embeddings | Matching uses pgvector and a deterministic distance rule |
| OpenAI-compatible endpoint | Optional configured text-analysis provider | Requires explicit opt-in; receives masked text plus configured context and instructions |

The grouping rule compares to a fixed first exemplar with cosine distance below 0.22. It is not an accuracy score or a moving centroid. Engineers can configure company context, rules, model, language and generation settings; each processing job uses a frozen profile. Compatible text endpoints are supported, not every possible AI provider or model.

Raw audio remains private and unredacted in MinIO. PII detection can miss data. "Supported findings" means findings passed implemented structural and source-reference checks, not that every semantic claim is proven correct. AI proposes; people make the operational decision.

The overview shows logical responsibilities, not separate microservices for every card. The current worker configuration limits concurrent activities to one. Model weights are provisioned separately. No high-availability, capacity, running-cost or deployment claim is implied.

## Implementation evidence

| Claim | Source |
| --- | --- |
| VPS topology, Caddy and persistence services | [compose.vps.yml](../../compose.vps.yml), [Caddyfile](../../infra/Caddyfile) |
| REST polling | [queries.ts](../../src/data/queries.ts) |
| Upload, profile snapshot and outbox | [CallController.java](../../server/src/main/java/az/csi/CallController.java), [AudioStore.java](../../server/src/main/java/az/csi/AudioStore.java) |
| Kafka publishing | [OutboxPublisher.java](../../server/src/main/java/az/csi/OutboxPublisher.java) |
| Event dispatch, workflow IDs and queue | [main.py](../../worker/csi_worker/main.py) |
| Workflow order and retries | [workflows.py](../../worker/csi_worker/workflows.py) |
| Storage and processing activities | [activities.py](../../worker/csi_worker/activities.py) |
| Speech models and PII | [speech.py](../../worker/csi_worker/speech.py), [privacy.py](../../worker/csi_worker/privacy.py), [provision-models.py](../../scripts/provision-models.py) |
| Structured analysis, embeddings and checks | [analysis.py](../../worker/csi_worker/analysis.py) |
| Grouping policy | [grouping.py](../../worker/csi_worker/grouping.py) |
| Configurable profiles and provider boundary | [agent_profile.py](../../worker/csi_worker/agent_profile.py), [AnalysisProfiles.java](../../server/src/main/java/az/csi/AnalysisProfiles.java) |
| Summary workflow | [support_summary.py](../../worker/csi_worker/support_summary.py) |
| Human decisions and delivery events | [DecisionController.java](../../server/src/main/java/az/csi/DecisionController.java) |
| Automatic recording exporter | [ingest-recordings.py](../../scripts/ingest-recordings.py) |
