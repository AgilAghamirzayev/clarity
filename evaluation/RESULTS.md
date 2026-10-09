# Measured results: 9 October 2026

Clarity now preserves speaker labels and explicit role provenance, rejects agent-only issue evidence, and records per-stage attempts. The evaluation also exposed remaining failures. These results support a reproducible prototype demonstration, not a production accuracy claim or a predicted judging score.

The UI, demo labels and human approval boundaries were preserved. No external messages, deployment, push or publication occurred.

## Evidence and configuration

- Machine: Apple M4 Pro, 14 logical CPUs, 24 GiB physical RAM, macOS arm64. This was a normal development machine, not an isolated capacity-testing host.
- Analysis/PII: local `qwen3:4b-instruct`, digest beginning `0edcdef34593e`. Embeddings: `nomic-embed-text:latest`, digest beginning `0a109f422b47e`. Full digests, dependency versions, settings and hashes are in the JSON reports.
- Final analysis prompt: `call-analysis-v5-speakers`, skill version `5`, local profile version `0`, temperature `0`, maximum output tokens `1800`.
- Prompt-development data: four synthetic transcripts. Held-out data: six different synthetic transcripts, locked before the final prompt was evaluated. These are engineering-authored labels, not independently validated customer ground truth. No prompt tuning followed inspection of held-out outputs.
- Grouping: six development and six held-out labeled issue descriptions. The strict cosine-distance threshold remains `0.22`; production still compares against each cluster's first exemplar.
- Audio: two existing fictional stereo TTS recordings, already used during product development. They are not held-out audio. Model files and recording hashes are in the benchmark report.

The exact evaluated prompt bytes are retained in [skill-v5-evaluated.json](baselines/skill-v5-evaluated.json). The production JSON was subsequently formatted, so its byte hash differs, while parsed prompt content is identical. Inference-source hashes in the held-out report match the implementation used for that run. Later harness additions expose human-review sheets and audio acceptance checks; original measured outputs were retained.

## Text-only results

| Check                                   | Initial development, v4 | Final development, v5 | Held out, v5 |
| --------------------------------------- | ----------------------: | --------------------: | -----------: |
| Cases                                   |                       4 |                     4 |            6 |
| Structurally completed                  |                     4/4 |                   4/4 |          5/6 |
| Expected issues                         |                       2 |                     2 |            5 |
| Accepted emitted issues                 |                       3 |                     2 |            4 |
| Matched issue labels                    |                       2 |                     2 |            3 |
| Issue label precision                   |                   66.7% |                  100% |          75% |
| Issue label recall                      |                    100% |                  100% |          60% |
| Rubric-unsupported recommendation flags |                     1/3 |                   0/2 |          1/4 |
| Sensitive characters missed             |                   12/46 |                  0/46 |         0/40 |
| Non-sensitive characters masked         |                   0/493 |                 0/493 |        0/974 |

Each split has only one case containing labeled PII, with three sensitive spans. The zero-miss results do not establish broad privacy coverage. Text evaluation measures input masking, not complete privacy safety of every possible generated output. The development improvement includes a prompt refinement and an explicit-name masking fallback; it is not an isolated experiment attributing improvement to one change.

**Interpretation:** precision/recall above use a one-to-one lexical label matcher. The unsupported rate is a narrow rubric flag, which includes duplicates and citation/action-pattern failures. Neither is a claim of full semantic accuracy. Human semantic precision, recall and unsupported recommendation rate remain **pending**. Failed cases stay in the recall denominator. Rejected raw output is retained but is not counted as an emitted recommendation.

Held-out per-case latency, including input masking and analysis, ranged from 3.82 to 10.16 seconds. This excludes speech, queues and post-analysis masking. It must not be quoted as full recording latency.

Artifacts: [initial development](reports/text-development.json), [final development](reports/text-development-v5.json), [held-out per-case outputs](reports/text-heldout-v5.json), [unfilled review sheet](reports/semantic-review-pending.csv), [pending semantic status](reports/semantic-review-status.json).

## Representative failures

1. **Duplicate issue:** `holdout-upload` emitted two identical upload findings. The schema and citation checks passed. The label scorer counted the duplicate as an extra prediction and a rubric-unsupported recommendation. The first title also contained awkward generated text that structural validity did not prevent.
2. **Missed issue despite recognizing it:** `holdout-prompt-injection` returned no issue for an unclear refund-status message. Its summary recognized the confusion but described it as merely an informational gap. It did not print the injected marker and kept negative sentiment. This case demonstrates a missed issue; it does not prove the injection caused the miss or establish general injection resistance.
3. **Agent-only interpretation rejected:** `holdout-privacy` emitted an additional finding based solely on an agent's explanation of link validity. The new guard rejected the entire result with `AGENT_ONLY_EVIDENCE`. This preserves the evidence boundary but loses a valid customer finding in the same output. The text runner makes one attempt; Temporal may retry in production. A future recovery design must preserve valid findings without silently accepting unsupported ones.
4. **Attribution still needs review:** `holdout-unknown-role` retained `role=unknown` in the input, but its generated summary called the speakers customer and agent. The lexical issue checks did not flag this. Passing data with uncertainty is necessary, but does not guarantee the model respects it.
5. **Development privacy miss:** the initial run left the synthetic name “Mira Example” visible. The new explicit “My name is …” fallback masked it on the development rerun. Other names, languages, noisy audio and more ambiguous phrasing remain unproven.

Do not use these observed held-out failures for tuning and then describe the same set as unseen. Preserve this report and create a new independent set for subsequent validation.

## Grouping

At `distance < 0.22`, both splits had **0 false merges among 12 differently labeled pairs** and **0 false splits among 3 same-labeled pairs**. Results were unchanged across ten seeded input orders. Those orders reuse six examples, so they are not 150 independent observations.

The development threshold sweep showed a false split at `0.15` and no measured improvement over the existing threshold at the other tested values. No threshold or clustering behavior was tuned. The held-out examples are simple and do not cover nuanced variants of the same symptom, multiple root causes or large cluster histories. PostgreSQL tenant isolation and persistence are tested separately; this evaluation simulates the same first-exemplar rule with actual local embeddings.

Artifacts: [development distances and sweep](reports/grouping-development.json), [held-out pairs and assignments](reports/grouping-heldout.json).

## Full audio benchmark and smoke

A fresh isolated tenant received new uploads through the bearer-token ingestion API. The source was revoked and the QA account disabled afterward. No decisions or external deliveries were created.

| Recording            | Audio duration |  Queue | Sum of stage attempts | Client end-to-end | Retries |
| -------------------- | -------------: | -----: | --------------------: | ----------------: | ------: |
| Checkout declined    |        46.92 s | 1.86 s |               44.18 s |           48.18 s |       0 |
| Support appreciation |        36.05 s | 1.88 s |               14.73 s |           17.41 s |       0 |

The short warm-up recording took **27.80 seconds**, excluded from the table and throughput. Model residency before the run was unknown. The two-case batch took **65.69 seconds**, an observed sequential rate of **109.61 calls/hour** for this small mix. This is not a sustained-load result, maximum capacity or a VPS sizing guarantee.

Both calls completed without processing failures or retries. The checkout call linked to two recommendations, including an existing group created during warm-up. The positive call had no extracted issues or recommendations. Speaker role fields were preserved. The original benchmark's `recommendations` field counted only newly created recommendations; the read-only smoke verification separately checks all linked recommendations. New benchmark runs use the corrected linked count.

Masked transcript word error was **1/151 words** for checkout and **0/106 words** for appreciation. Clean synthetic stereo speech is easier than real contact-center audio. This does not test mono diarization accuracy. Audio semantic metrics remain pending because reference turns have not been aligned and adjudicated against ASR segments.

The report records Ollama-associated process RSS snapshots and a roughly 50 MiB Python benchmark-process lifetime peak RSS. These do not measure service-wide peak memory, GPU/unified-memory usage or energy. Physical RAM was 24 GiB. No infrastructure prices were supplied, so currency cost estimates remain **unavailable**. The explicit-input calculator is ready; local inference is not assumed free.

Artifacts: [benchmark with stage times, hashes and resources](reports/audio-benchmark.json), [recording-to-recommendation verification](reports/audio-smoke-verification.json), [unfilled audio review sheet](reports/audio-semantic-review-pending.csv).

## Verification status

| Check                                              | Status      | Scope                                                                                         |
| -------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| Backend tests with PostgreSQL                      | Passed      | 27 tests; migrations and access boundaries                                                    |
| Worker tests with PostgreSQL and real local models | Passed      | 51 tests, 0 skipped                                                                           |
| Frontend unit tests                                | Passed      | 9 tests                                                                                       |
| Production frontend build                          | Passed      | TypeScript and Vite                                                                           |
| Python lint and corpus validation                  | Passed      | No inference needed                                                                           |
| Speaker-guard mutation check                       | Passed      | Inverting the guard caused the intended test to fail; original code restored and tests passed |
| Held-out model evaluation                          | Mixed       | 5/6 completed; one evidence rejection and semantic/rubric failures retained                   |
| Full audio smoke                                   | Passed      | Two measured calls plus separate warm-up                                                      |
| Browser suite                                      | Not rerun   | No UI changes in this task                                                                    |
| Human semantic adjudication                        | Pending     | Unfilled review sheet                                                                         |
| Independent held-out audio study                   | Unavailable | Existing demo audio is development data                                                       |
| Consented user interviews and business outcomes    | Pending     | No such evidence supplied                                                                     |
| Infrastructure cost in currency                    | Unavailable | Prices and utilization assumptions not supplied                                               |

Commands and definitions: [evaluation guide](README.md). The next concrete pilot is two consenting support reviewers completing a counterbalanced manual-versus-assisted task on the synthetic calls, then independently reviewing evidence and recommendations. Use [the pilot template](MANUAL_PILOT.md). A real-recording study begins only after a consented source and data-handling agreement are supplied.
