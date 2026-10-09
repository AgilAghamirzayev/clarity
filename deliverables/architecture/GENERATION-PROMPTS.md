# Clarity architecture image prompts

Generated with the built-in image_gen tool. Labels are English for presentation use. The images describe the reviewed implementation, not verified deployment or production readiness.

## System architecture

Use case: infographic-diagram.
Create a polished, technically accurate architecture image for the existing product "Clarity", suitable for an engineering system-design presentation. Landscape 16:10, highest practical resolution. English labels only, crisp and large. Cream #F7F7F2 canvas, deep forest #123E32 title and headers, green #267554 connections, mint #DCEBDD panels. Refined flat vector-like architecture drawing, subtle rounded cards, ample whitespace, meticulous alignment, thin orthogonal arrows with clear arrowheads. No 3D, no people, no decorative objects, no made-up vendor logos. No em dashes. Prioritize readable exact text and correct arrows.

Title: "Clarity"
Subtitle: "System architecture"
Small qualifier: "Implemented local / VPS topology"

Compose three horizontal bands, following this exact structure and graph. Keep shared components singular, not duplicated as independent services.

BAND 1, header "01  EXPERIENCE & INGESTION", left-to-right:
A card "React + TypeScript" with lines "Review workspace" and "REST polling".
B card "Caddy" with "VPS web / API edge".
C larger card "Spring Boot API" with "Java 21 · /api/v1" and "Sessions · CSRF · tenant scope".
Arrows A → B → C labeled "HTTPS / REST".
Below A and B a card "Recording source" with "Watched folder or source exporter" connects directly to C via arrow labeled "Token-scoped automatic upload".
Below C a slim card "Analysis profile" with "Company context · rules · model choice" joined to C. This is configuration, not a separate service.

BAND 2, header "02  EVENTS & DURABLE EXECUTION", left-to-right:
A card "PostgreSQL + pgvector" with "Application data · results · audit" and "Transactional outbox".
Next card "Kafka" with "csi.events" and tiny secondary "Metadata events, no audio".
Next card "Python dispatcher" with "Event → workflow".
Next card "Temporal" with "Durable execution · retries".
API above connects down to PostgreSQL labeled "Metadata + outbox".
PostgreSQL → Kafka labeled "Outbox publisher".
Kafka → dispatcher → Temporal.
Small card attached BELOW Temporal: "Temporal PostgreSQL" with "Workflow history". Temporal PostgreSQL is separate from application PostgreSQL.
Small slim branch off dispatcher: "csi.dead-letter" with "Invalid events".
Do not label Kafka an orchestrator. Do not put audio in Kafka.

BAND 3, header "03  PROCESSING & REVIEW", use two well-spaced rows:
Main row has card "MinIO" with "Private raw recordings", next to wide card "Python activity worker".
API connects to MinIO with a tidy perimeter route labeled "Audio upload".
Temporal connects to worker with arrow labeled "Task queue: csi-local".
MinIO → worker labeled "Read audio".
Within worker show a compact left-to-right pipeline:
"Transcribe + mask" → "Analyze + validate" → "Embed + group"
Below these three steps, one model line:
"Faster Whisper Small · SpeechBrain ECAPA · Qwen3 4B · Nomic Embed Text"
Worker connects back to application PostgreSQL with a clear arrow labeled "Persist masked results".
A secondary row shows "Human review" → "DeliveryWorkflow" → "Jira · Slack · CRM webhook".
Label arrow from Human review to DeliveryWorkflow: "Approved decision via outbox + Kafka + Temporal".
This row is an inset continuation of the shared event system, NOT a direct shortcut around it.
Under DeliveryWorkflow: "Configured adapters only".
Also a small note in the worker container: "SupportSummaryWorkflow: cited recommendations".

Footer, two lines, readable:
"Optional OpenAI-compatible analysis endpoint: explicit opt-in, masked text only."
"AI proposes. People decide. Outcome comparisons are observational."
Tiny legend: "Solid: implemented flow   Dashed: optional configuration"
Use a dashed outlined optional-endpoint card or footer indicator so optional cloud inference is never shown as required.
Human approval controls delivery, not whether recording analysis runs automatically.
Do not add Redis, Kubernetes, Elasticsearch, WebSockets, email, external auto-upload products, HA guarantees, or performance numbers.
All content must stay inside the canvas. Make this feel like a premium calm system design, not a marketing flowchart.

## AI pipeline

Use case: infographic-diagram.
Create an exceptionally clean technical system-design infographic for Clarity. Wide landscape 16:10, highest practical resolution, entirely English. Premium cream #F7F7F2, forest #123E32, muted green #267554, mint #DCEBDD. Flat crisp engineering diagram, large legible typography, restrained line icons, generous whitespace, aligned modular cards, clear orthogonal directional arrows. No 3D illustrations, no excessive gradients, no long dash punctuation.
Title "Clarity"
Subtitle "Inside the AI processing pipeline"
Small descriptor "CallWorkflow · Temporal task queue: csi-local"

Three equally sized vertical columns, numbered 01, 02, 03. Main flow reads left to right with clear arrows between the columns. The columns are the THREE actual Temporal activities, not six separate workflows. Use the exact activity labels:
01 "transcribe_call"
02 "analyze_call"
03 "cluster_call"

Above the columns, two small input chips:
"Private recording in MinIO" feeding column 01.
"Frozen analysis profile" feeding column 02, subtext "Company context · rules · model · language".
A slim Temporal control strip spans all three columns, text "Durable activity execution · up to 3 attempts per activity · persisted failure state".

Column 01 body, vertically ordered cards with down arrows:
"Speech to text" / "Faster Whisper Small" / "Local CPU INT8 · timestamps"
"Speaker separation" / "Stereo channels or SpeechBrain ECAPA" / "Unknown roles remain unknown"
"PII masking" / "Regex rules + local Qwen3 4B" / "Optional alternative: GLiNER multi-v2.1"
At base of column 01, a prominent mint capsule "Masked transcript".
Connector to column 02 MUST originate at Masked transcript.
Small caution beneath first column: "Raw audio remains private and unredacted."

Column 02 body, vertically ordered cards:
"Structured analysis" / "Qwen3 4B Instruct via Ollama" / "Summary · findings · evidence references"
"Schema + evidence checks" / "Valid segment references" / "Known agent-only evidence rejected"
"Mask generated text" / "Persist validated analysis"
At base of column 02, capsule "Supported findings".
Adjacent to the structured analysis card, a dashed inset clearly WITHIN column 02, label "Optional compatible endpoint" / "Explicit opt-in · masked text only".
Keep default path local. Do not show external endpoint receiving raw audio.

Column 03 body, vertically ordered cards:
"Embed findings" / "Nomic Embed Text via Ollama" / "768-dimensional vectors"
"Match or create issue" / "PostgreSQL + pgvector" / "Cosine distance < 0.22"
"Persist results" / "Issues · recommendations · source links"
At base of column 03, capsule "Ready for human review".
Small note beneath third column: "Grouping uses a fixed first exemplar."

Below the three columns, an elegant full-width output strip reads left to right:
"React review workspace" → "Human decision" → "Optional external delivery"
Beneath Human decision: "Approve or reject · owner · rationale".
Beneath Optional external delivery: "DeliveryWorkflow · Jira / Slack / CRM".
Make it explicit in small text "Automatic analysis; human approval before external action".

Bottom legend with three clearly separated keyed items:
"AI: speech, speaker embeddings, PII detection, analysis, text embeddings"
"Deterministic: validation, masking, vector matching, counts"
"Human: review and approval"
Tiny final note "Outcome comparisons are observational."
No fabricated accuracy, no guaranteed anonymization, no autonomous approvals, no claim that all models are interchangeable. Only the compatible text-analysis provider is optional. Preserve exact spelling of all model and product names. Make every word readable and every arrow unambiguous.


## Selected image refinements

### System architecture

Edit this Clarity system architecture infographic. Preserve its English text, palette, typography, layout and all cards except for these precise technical corrections:
1. REMOVE the entire long "Metadata + outbox" connection drawn from Temporal across the top of band 02 to application PostgreSQL. Temporal must NOT feed application metadata/outbox. In its place draw a SHORT downward arrow above the LEFT application PostgreSQL card from a small labeled source port "From API: metadata + outbox". This port represents the Spring Boot API in band 01. Do not add a long crossing line.
2. REMOVE the dangling "Audio upload" elbow that starts behind the band 03 heading. Above MinIO, instead use a clearly anchored source port "From API: audio upload" with a short downward arrow to MinIO. No dangling arrows.
3. The repeated database card at the right of band 03 is a reference to the SAME application database in band 02. Change its title to "Application DB" and its two subtitle lines to "Same PostgreSQL + pgvector" and "Masked results". Keep worker → database arrow "Persist masked results".
4. Change the connection label Caddy → Spring Boot API from "HTTPS / REST" to "HTTP / REST". Browser → Caddy remains "HTTPS / REST". Make both these browser request arrows bidirectional to show REST responses.
5. Add a small line in the Python activity worker container: "Dispatcher and activities share one Python service". Keep SupportSummaryWorkflow note legible. Expand container modestly if needed.
Everything else stays identical. Preserve Kafka → dispatcher → Temporal, Temporal → worker, Temporal ↔ its separate PostgreSQL, and MinIO → worker. Do not invent new services. Final image must be clean, readable, technically correct, with no em dash.

Edit the supplied architecture diagram. Preserve all existing cards, labels, lines, colors and layout. The only change is to anchor the dangling task-queue input above "Python activity worker": replace its label "Task queue: csi-local" with "From Temporal: csi-local". Keep its existing short leftward line and down arrow into the worker. Give this source label a small rounded outlined port treatment matching "From API: metadata + outbox" and "From API: audio upload". It is a labeled reference port to Temporal, so do not draw any new long connection.
All other text and shapes must remain unchanged, sharp and free of any artifacts. Especially preserve the full React + TypeScript, Caddy, and Spring Boot API cards at the top. No missing or garbled letters.

### AI pipeline

Edit this Clarity AI pipeline diagram, preserving ALL text, cards, visual style, size, and typography. Correct only connector routing and input positioning.
1. DELETE both thick horizontal arrows at the mid-height of the three columns (currently connecting Speaker separation to Schema checks and Schema checks to Match issue). These are wrong and must vanish.
2. DELETE both horizontal arrows between the three bottom output capsules. Outputs must not bypass the activity steps.
3. Draw exactly ONE thin orthogonal connector from the RIGHT EDGE of the "Masked transcript" capsule, running right into the narrow gutter between columns 01 and 02, then straight UP through that gutter, then RIGHT with an arrowhead ending at the LEFT EDGE of the "Structured analysis" card. It must not cross text or cards. This is the sole 01 to 02 connection.
4. Draw exactly ONE thin orthogonal connector from the RIGHT EDGE of the "Supported findings" capsule, running right into the narrow gutter between columns 02 and 03, then UP through that gutter, then RIGHT with arrowhead ending at the LEFT EDGE of the "Embed findings" card. This is the sole 02 to 03 connection.
5. Remove both short downward arrows from the two top input chips, since they currently point to the shared temporal-control strip. Instead label the chips "Input to 01: private MinIO recording" and "Input to 02: frozen analysis profile". Keep the profile subtitle "Company context · rules · model · language".
6. Keep every vertical arrow inside each activity exactly as it is. Keep the bottom review/approval/delivery flow.
Do not add any other connectors or remove any processing step. Maintain wide clear gutters for the upward connections. All labels must remain perfectly legible.
