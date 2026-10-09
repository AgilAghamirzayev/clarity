# Real demo on a VPS

The default frontend uses the real API. Each visitor automatically receives a separate demo workspace without a password. Imported audio runs through local transcription, speaker separation, masking, analysis and clustering. Summary reports also use the local model. No transcript or analysis is substituted with fixture data.

Each guest also receives a prepared catalog of eight generated support recordings, their actual local transcripts, five issue groups, five AI recommendations and completed 7-, 30- and 90-day reports. These artifacts and audio files ship inside the API image, so the sample workspace appears automatically on a fresh VPS. Viewing the prepared catalog does not require waiting for the models to download. New uploads and refreshed analysis require the worker and models.

The recordings are fictional support scenarios, not private customer data. Their transcription, analysis, clustering and reports were produced by the real local pipeline. Three sample decision histories illustrate approval, work in progress and completion. They are labeled sample reviews and do not claim an actual business improvement. Metrics and outcome comparisons come from the sample call records. An administrator's real workspace is not seeded.

The first guest request copies the catalog into that visitor's tenant and its audio prefix. Later requests reuse it without resetting decisions or adding duplicates. Prepared calls and reports do not consume the visitor's five uploads or three report requests. Dates are set relative to the session's start so the charts remain useful on future deployments. Existing visitors receive the catalog on their next page reload. Set `DEMO_SEED_ENABLED=false` only when an intentionally empty demo is needed.

The public demo does not send Jira, Slack, CRM or email messages. Its connection forms remain explicitly simulated, as requested for the demo. Real Jira, Slack and CRM delivery requires an administrator, an allowlisted destination and a worker credential. Email delivery is not implemented. See [PLATFORM.md](PLATFORM.md) for adapter configuration.

## Server setup

Use a Linux VPS with Docker Engine and the Docker Compose plugin version 2.24 or newer. This stack uses CPU inference. Plan for 8 CPU cores, 16 GB RAM and at least 40 GB free disk as a starting configuration; these are planning estimates, not a measured production capacity guarantee. Processing is sequential and depends on the recording length and available CPU. The stack contains PostgreSQL, MinIO, Kafka, Temporal, Ollama, the API, worker, cleanup service and web proxy.

Point your domain's DNS A record (and AAAA only if IPv6 is configured) to the VPS. Allow inbound TCP 80 and 443 for Caddy's automatic HTTPS. Do not expose PostgreSQL, MinIO, Kafka, Temporal, Ollama or API ports publicly. The Compose file publishes only the web ports.

From the repository root on the VPS:

```sh
python3 scripts/setup-vps.py demo.example.com
docker compose --env-file .env.vps -f compose.vps.yml config --quiet
docker compose --env-file .env.vps -f compose.vps.yml build
docker compose --env-file .env.vps -f compose.vps.yml up -d
```

The setup command creates private random credentials in `.env.vps` with file mode 0600 and refuses to overwrite it. Keep that file on the server and out of Git. Replace `demo.example.com` with your domain. HTTPS cookies are enabled by default. Only use `COOKIE_SECURE=false` for local HTTP testing.

Build before starting so the worker, model initializer and cleanup service can reuse the local worker image. MinIO is compiled from its official `RELEASE.2025-07-23T15-54-02Z` source, with the commit checked in `infra/Minio.Dockerfile`. Its former Docker Hub and Quay images were unavailable during the Azure deployment. The source build preserves that version and includes its license.

The first start downloads the speech models and Qwen/Nomic weights into persistent volumes. These downloads can take several minutes and require outbound internet. Inference uses local files and the internal Ollama service. Subsequent starts reuse the weights. The UI shows whether the local worker and models are available; a loaded web page alone does not mean AI is ready.

```sh
docker compose --env-file .env.vps -f compose.vps.yml ps
docker compose --env-file .env.vps -f compose.vps.yml logs --tail=50 model-init ollama-init worker
```

Open your domain, go to Conversations, and choose **Analyze sample call**. It uploads a generated 22-second stereo recording through the same pipeline as your own files. Wait for **Ready to review**, open the conversation, play the audio, inspect its transcript and follow the issue evidence. Generate a Support summary after the call is completed. This is the post-deploy acceptance check.

## Administrator access and real integrations

The same deployment serves the authenticated platform at `/admin/`. Sign in there with tenant `local`, the `BOOTSTRAP_EMAIL` from `.env.vps`, and its generated `BOOTSTRAP_PASSWORD`. Guest sessions are not administrator sessions. The public demo and the admin frontend share the server cookie, so use a separate browser profile when operating them simultaneously.

Configure real Jira, Slack or CRM delivery from the administrator's Workspace settings. Add exact allowed HTTPS origins to `INTEGRATION_ALLOWED_ORIGINS` in `.env.vps`. Save the integration, place the returned `CSI_INTEGRATION_..._TOKEN` variable and its secret value in a private `.env.integrations` file, and set that file's mode to 0600. The optional file is read only by the worker. Then recreate API and worker to apply origins and credentials:

```sh
docker compose --env-file .env.vps -f compose.vps.yml up -d --force-recreate api worker
```

Enable only the intended adapter after checking its destination. Public guest approvals never create external delivery events. Real administrator/reviewer approvals can, so test with your own non-production destination before using customer workflows. No provider credentials are included in this project.

## Modes

| Command                                         | Result                                                               |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `npm run dev` / `npm run build`                 | Real, login-free demo; requires the API with `DEMO_ENABLED=true`     |
| `npm run dev:api` / `npm run build:api`         | Authenticated platform for actual teams and integrations             |
| `npm run dev:fixture` / `npm run build:fixture` | Offline UI sample with browser-local files and simulated connections |

The live demo cannot be deployed as static files alone. Publish the complete Compose stack. The fixture build is the static-only alternative.

## Visitor isolation and limits

Guest sessions have a dedicated tenant and a DEMO role. They can import and play their own audio, inspect analysis, review proposals and request summaries. They cannot create users, access server audit, configure real adapters or trigger external deliveries. PostgreSQL RLS isolates their records from all other visitors and real workspaces. CSRF protection stays enabled.

Each demo workspace allows five recordings, at most 25 MB and five minutes per recording, three summary requests, and at most two manual retries per failed recording. New guest sessions are limited to ten per client IP in fifteen minutes. The API stores a salted address fingerprint, not a raw address. `DEMO_MAX_WORKSPACES` caps concurrent unexpired guest workspaces and defaults to 100.

Access expires after 24 hours. The cleanup service checks every five minutes and deletes the tenant's audio, transcripts, analytics and audit after a further 24-hour grace period. The grace period lets queued workflows finish before removal. Real workspaces have no demo expiry and are excluded. Do not use the public demo for long-term customer records.

Credentials and gateway headers are server-controlled. The API is internal to the Docker network; Caddy supplies the forwarded client address. Do not publish the API directly or add an untrusted proxy in front without configuring trusted proxy handling and reassessing rate limits.

## Updates, backup and recovery

Keep a tagged copy of the last working source and image set. Before updating, take a PostgreSQL backup and an object-storage backup together. Store backups outside this VPS with access controls and a retention policy. Demo deletion does not delete independently retained backups, so exclude temporary demo data from long-lived backups or expire those backups separately.

```sh
docker compose --env-file .env.vps -f compose.vps.yml build
docker compose --env-file .env.vps -f compose.vps.yml up -d
```

Flyway applies additive migrations at API startup. If an application update fails, restore the previous compatible image/source version and run `up -d`; do not automatically downgrade or erase the database. Schema-incompatible recovery requires the matching database and audio backup.

`docker compose down` preserves volumes. Do not add `--volumes` unless you intend to delete the database, recordings and downloaded models. Never use `down --volumes` as an update procedure.

If the UI says processing is unavailable, inspect worker/model-init/ollama-init logs. Failed imports can be retried from upload history. For initial download failures, fix outbound networking and rerun `up -d`. Do not replace failures with sample transcripts or mark unfinished imports complete.

### Company AI and automated recording sources

The Compose deployment accepts `CSI_AI_PROVIDERS` for approved analysis gateways. The worker reads referenced credentials from its private environment file. Use **Automation & AI** to configure a workspace and create upload-only source tokens. See [Automation and AI](AUTOMATION_AI.md) for the complete setup and watched-folder connector.
