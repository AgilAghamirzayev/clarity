# Clarity verification and evaluation

These tools evaluate the existing recording-to-recommendation workflow. They do not approve proposals, contact external integrations or change the UI. Read [RESULTS_V6.md](RESULTS_V6.md) for the current comparison and [RESULTS.md](RESULTS.md) for preserved version 5 measurements.

## What each layer proves

| Layer                    | Purpose                                                                                                  | What it does not prove                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Unit and database tests  | Contracts, roles, evidence bounds, tenant isolation, retries and metric arithmetic                       | Model accuracy or user value                                                  |
| Text model evaluation    | Local privacy and issue extraction on labeled synthetic transcripts                                      | ASR, speaker separation, queue behavior or full semantic truth                |
| Embedding evaluation     | First-exemplar grouping on labeled same/different issues                                                 | Real distribution coverage or end-to-end extraction quality                   |
| Full audio API benchmark | New upload, outbox, Kafka, Temporal, speech, masking, analysis, grouping and recommendation availability | Independent audio semantic accuracy, cold-start capacity or business outcomes |
| Human review and pilot   | Faithfulness and practical usefulness                                                                    | Pending until reviewers and real evidence are supplied                        |

The language model is not used as a judge. Expected labels are provisional engineering-authored synthetic labels. Narrow regex checks are deterministic and reproducible but can miss unsupported meaning or fail to recognize a valid paraphrase. A structurally valid citation is not proof of support.

## Reproduce

Run from the repository root. `scripts/run.py` reads the existing `.env.local` without printing credentials. Use Python 3.12 through the locked worker environment. Provision the local stack and models as described in [PLATFORM.md](../docs/PLATFORM.md). Do not put customer recordings in committed evaluation artifacts.

Cheap checks, no inference:

```sh
uv sync --project worker --locked
uv run --project worker ruff check --config worker/pyproject.toml worker scripts
uv run --project worker pytest worker/tests -q
PYTHONPATH=worker uv run --project worker python -m csi_worker.evaluation.validate
npm test
npm run build
```

Default worker tests explicitly skip model and PostgreSQL checks. A green default run is not evidence those checks passed. CI runs the database-enabled worker tests and corpus validation; real model evaluation remains opt-in and is not added to normal PR latency.

Database checks and additive migration validation:

```sh
CSI_INTEGRATION_TESTS=true python3 scripts/run.py scripts/mvn verify
CSI_INTEGRATION_TESTS=true python3 scripts/run.py uv run --project worker pytest worker/tests -q
```

Use a test database where possible. Tests create synthetic tenant rows. V7 adds tenant-isolated per-stage attempt measurements. Start the API with migrations before starting the updated worker. This task does not rewrite existing migrations.

Expensive local model checks:

```sh
CSI_MODEL_TESTS=true python3 scripts/run.py uv run --project worker pytest worker/tests/test_local_models.py -q
PYTHONPATH=worker python3 scripts/run.py uv run --project worker python -m csi_worker.evaluation.run --split development --execute-models --output .runtime/text-development-new.json
PYTHONPATH=worker python3 scripts/run.py uv run --project worker python -m csi_worker.evaluation.grouping --split development --execute-models --output .runtime/grouping-development-new.json
```

Freeze prompt, model, grouping policy and labels before evaluating the held-out split:

```sh
PYTHONPATH=worker python3 scripts/run.py uv run --project worker python -m csi_worker.evaluation.run --split heldout --execute-models --output .runtime/text-heldout-new.json
PYTHONPATH=worker python3 scripts/run.py uv run --project worker python -m csi_worker.evaluation.grouping --split heldout --execute-models --output .runtime/grouping-heldout-new.json
```

Each command requires a new output path. Reports retain failures instead of silently omitting them. The runner exits nonzero for execution failures/unavailable services; a zero exit does not mean semantic checks passed. Inspect `metrics`, per-case scores and raw synthetic outputs. Model outputs can vary even with temperature zero. Keep artifact and model hashes with every run. Do not retune on these held-out examples and then call a rerun independent; create a new locked split instead.

Fresh recording-to-recommendation smoke and sequential benchmark, with API and worker running:

```sh
PYTHONPATH=worker python3 scripts/run.py uv run --project worker python -m csi_worker.evaluation.audio --execute-local --repetitions 1 --output .runtime/audio-new.json
PYTHONPATH=worker python3 scripts/run.py uv run --project worker python -m csi_worker.evaluation.verify_audio --report .runtime/audio-new.json --output .runtime/audio-verification-new.json
```

The benchmark uses only the loopback API. It creates an isolated QA tenant, uploads existing fictional WAV files as new recordings and waits for real processing. The source token is revoked and the QA account disabled afterward. Records remain for inspection. No decisions are approved. `--repetitions` increases the sample count without inventing more distinct recordings. The initial short recording warms the path and is excluded from case throughput. It is not a controlled cold-start test.

`run --cases path.json` and `audio --cases path.json` accept labeled datasets using the committed formats. Transcript labels use joined original text offsets, zero-based supporting segment indices and expected issue IDs. Audio labels include the recording, reference text and expected issue IDs. `cases/audio-reference-labels.json` adds source-script turns and supporting reference indices. ASR changes segment boundaries: align audio evidence manually before computing semantic scores. Do not copy reference turn indices onto generated segments. The two demo audio cases were already used during development and are deliberately not marked held out.

## Metric definitions

- **Issue label precision:** one-to-one matched expected issue IDs / emitted structurally accepted findings. Matching requires every labeled term group to match the title or description. Duplicate findings are extra predictions. This is a lexical proxy, not full semantic precision.
- **Issue label recall:** matched expected issue IDs / all expected issues in the selected cases, including failed cases. Infrastructure/model failures reduce end-to-end recall rather than disappearing from the denominator.
- **Rubric-unsupported recommendation rate:** emitted findings failing a unique issue match, labeled citation subset check, action-pattern check or forbidden-claim pattern / emitted findings. It is a narrow failure flag, not the true unsupported recommendation rate. It can flag a duplicate whose underlying action is otherwise reasonable.
- **Human semantic metrics:** null until all output rows are reviewed with evidence notes. Expected issue matching and support are entered by reviewers, not inferred by another model. Failed cases remain in the recall denominator.
- **Privacy misses:** sensitive labeled characters not covered by detected spans / sensitive characters. A span is missed if any of its characters is exposed. **Excessive masking:** detected non-sensitive characters / all labeled non-sensitive characters. The absence of misses on a few synthetic names is not a privacy guarantee. Audio privacy quality remains unscored until aligned annotations exist.
- **Incorrect merge rate:** differently labeled pairs assigned together / all differently labeled pairs. **Incorrect split rate:** same-labeled pairs assigned apart / all same-labeled pairs. Ten deterministic orders reuse the same examples and are not ten independent datasets. The production `centroid` column actually stores the first exemplar; it is not recomputed. The threshold remains a strict distance less than 0.22.
- **Warm-up:** elapsed first request/recording, reported separately. Model residency before a run is unknown.
- **Queue time:** first stage start minus database creation time. **Measured processing:** sum of persisted stage-attempt elapsed times, including failed attempts. Transcription includes decoding, diarization and input masking; analysis includes output masking. **End-to-end:** client upload start through terminal-status observation; includes upload, queue, inter-stage scheduling and polling. These clocks differ slightly and are not an exact partition.
- **Retries:** sum of maximum attempt number minus one per stage in the benchmark call. Failures and incomplete `RUNNING` measurements remain visible. **Throughput:** completed calls / measured sequential batch wall time, excluding warm-up. This is observed workload throughput, not a capacity promise.
- **Resources:** CPU model, logical CPUs and physical RAM; Python harness CPU/lifetime peak RSS; point samples of Ollama process RSS. These exclude service-wide peak RAM, GPU/unified-memory accounting, system energy and operational labor. No zero-cost inference claim is supported.
- **Masked transcript word error:** word edit distance from reference / reference words. It measures the post-masking transcript, not pure ASR; valid privacy masking can increase it. Current audio fixtures contain no labeled PII.

## Human semantic review

```sh
PYTHONPATH=worker uv run --project worker python -m csi_worker.evaluation.review template --report .runtime/text-heldout-new.json --output .runtime/review-new.csv
# A reviewer reads the source cases, masked evidence and outputs, then fills every row.
PYTHONPATH=worker uv run --project worker python -m csi_worker.evaluation.review score --report .runtime/text-heldout-new.json --reviews .runtime/review-new.csv --output .runtime/review-score-new.json
```

Keep `report_sha256` unchanged. Enter a reviewer ID, `review_status=reviewed`, notes, and `claim_supported=yes|no`. Findings also need `recommendation_supported=yes|no` and a `matched_expected_issue` ID, or blank for an extra issue. Flag invented causes, promises described as resolutions, attribution errors and unjustified code/policy changes. Partial reviews leave semantic metrics pending. Two independent reviewers and disagreement resolution are preferable to a single reviewer. The committed text and audio review sheets are unfilled. The same reviewer tool accepts a full-audio report with `analysis` outputs; inspect the retained transcript and `audio-reference-labels.json` before assigning support judgments.

Use [MANUAL_PILOT.md](MANUAL_PILOT.md) for the future manual-versus-assisted study. Consent, interviews and measured business outcomes remain pending.

## Explicit cost assumptions

Copy `cost-input.template.json` and supply every price and utilization input. A sourced infrastructure subtotal is in [COSTS.md](COSTS.md). Host-matched throughput, utilization and review rates remain unknown, so no measured currency cost per call is claimed.

```sh
PYTHONPATH=worker uv run --project worker python -m csi_worker.evaluation.cost path/to/filled-cost-input.json
```

Monthly cost is hourly server price times provisioned hours, plus storage and other supplied monthly costs. Expected volume is provisioned hours times utilization times measured calls/hour. Cost/call is monthly cost divided by expected volume. Provisioned idle time still costs money. Match the hardware and workload to the measurement and include electricity, amortization, backup and operations where applicable.

The [pilot kit](pilot/README.md) includes blank interview, label and timing sheets. [COSTS.md](COSTS.md) contains a dated infrastructure budget; measured unit cost remains pending.
