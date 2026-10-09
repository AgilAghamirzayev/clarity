# Clarity: current submission evidence

Updated 9 October 2026, Asia/Baku. This is the canonical evidence entry point for the current implementation and deployed Azure demo. It separates measured results, prepared artifacts and pending studies. No official score, customer adoption or business savings is claimed.

## What the user gets

A support lead can connect recurring recorded complaints, inspect supporting speech and create a human-owned engineering or operations investigation. Local processing is the default. The proposed benefit is less effort per correct handoff; that benefit is not yet measured with users.

## Deployed product

**[Live Azure demo](https://clarity.eastus.cloudapp.azure.com)** · **[Google Slides presentation](https://docs.google.com/presentation/d/18koiUMdis-ebzjao5bb77KTcCEpVnfjmu0shbTRsMno/edit?usp=sharing)**.

The complete React, Spring Boot, Python, PostgreSQL/pgvector, MinIO, Kafka, Temporal, Ollama and Caddy stack runs on a 4-vCPU, 32-GiB Azure VM. Fresh speech and AI processing run on the server. The public demo needs no login.

The Azure acceptance run processed a new 22-second recording in **205.2 seconds**, producing nine transcript segments and one accepted issue. Transcription/masking took 30.5 seconds, analysis 172.6 seconds and clustering 0.7 seconds. A refreshed report covering nine calls completed in **241.7 seconds** with three recommendations. HTTPS, audio playback, guest isolation and CSRF rejection also passed. These are single-run measurements, not a load test. [Machine-readable evidence](../evaluation/reports/azure-acceptance-20261009.json), [deployment notes](AZURE_DEMO.md).

The software checks below are earlier local test snapshots. The Azure acceptance check is a separate deployment verification; it does not imply the complete test suite was rerun on the VM.

## Current software checks

| Check                    | Current result                    | Scope                                                                |
| ------------------------ | --------------------------------- | -------------------------------------------------------------------- |
| Frontend unit tests      | 9 passed                          | Domain and workspace behavior                                        |
| Worker tests             | 58 passed, 0 skipped              | Database and real local models enabled                               |
| API tests                | 27 passed, 0 skipped              | Database, migrations and access boundaries                           |
| Fixture browser suite    | 34 passed                         | Responsive layouts, accessibility, tour, navigation and review flows |
| Live guest browser suite | 3 passed                          | Fresh upload, playback, guest isolation and review notice            |
| Production build         | Passed                            | TypeScript and frontend build                                        |
| Python lint              | Passed                            | Worker and scripts                                                   |
| Frontend lint            | Passed with two existing warnings | Unused imports in an older presentation export helper                |

[Commands, snapshot and source hashes](../deliverables/judge-pitch/evidence/submission-checks.json). Earlier logs in the judge package predate these changes. The original tour-focus failure is documented in the review history; after the focus handoff change the complete 34-test fixture suite passed.

## Meaningful AI and measured limits

The local speech model transcribes; local masking combines patterns and a model; language analysis proposes findings; embeddings group related issues. Code handles validation, duplicate consolidation, counts and retries. People approve actions.

[Eight new synthetic text cases](../evaluation/RESULTS_V6.md): AI matched 7/7 labeled issues with 8 predictions (87.5% lexical precision, 100% recall); a fixed keyword baseline matched 3/7 with 3 predictions (100% precision, 42.9% recall). Three AI findings triggered narrow rubric flags, including an extra paraphrased issue. This demonstrates a limited recall/precision tradeoff, not human-confirmed accuracy or productivity. Same-author synthetic labels and a simple baseline limit generalization.

Fresh version 6 uploads traversed the API, queue, speech, masking, analysis and grouping. Checkout completed in **45.90 seconds**; appreciation completed in **17.49 seconds**, with no retries. Warm-up was **30.17 seconds**, reported separately. Two short, clean synthetic stereo calls are development data, not independent audio quality evidence or sustained capacity. [Raw benchmark](../evaluation/reports/audio-benchmark-v6.json), [read-only acceptance verification](../evaluation/reports/audio-verification-v6.json).

## Prepared versus fresh

The catalog's eight fictional recordings have stored older model outputs, editorial titles and documented masking corrections. Loading them is not fresh inference. Seeded decisions and guest integrations illustrate behavior. The [main demo](DEMO_SCRIPT.md) starts a new job, shows actual completion, inspects evidence and saves a human decision. The welcome dialog links directly to Conversations.

Version 6 retains valid findings when another finding fails validation. Unknown roles or rejected findings use source excerpts instead of a generated summary. Review notices make these limits visible; an empty accepted-issue list is not proof of no problem.

## Feasibility and next evidence

The deployed Azure VM was quoted at **$0.252/hour**, approximately **$6.05/day** for compute, plus disk and public IP. Its acceptance measurements are above. [Cost notes](../evaluation/COSTS.md) distinguish this real deployment from the earlier $302.40/month alternative-hosting scenario. Trial credit is temporary; cost per successful audio hour, human review, operations and sustained capacity remain unmeasured.

The [pilot kit](../evaluation/pilot/README.md) supplies empty interview, independent-label and task-timing sheets for manual, keyword-assisted and Clarity conditions. Human semantic adjudication, customer validation, measured reviewer savings, representative audio/privacy coverage and actual cost per audio hour remain pending.

## Originality and submission

[Competitor sources](JUDGE_QA.md#comparison-with-existing-options) establish overlap in themes, citations and workflows. Clarity's proposed fit is local processing with versioned company instructions and an owned support-to-engineering decision. Customer preference is unvalidated.

Use the [current six-slide pitch](../deliverables/judge-pitch/Clarity-Judge-Pitch-Current.pptx). Generate the complete source archive with `python3 scripts/package-submission.py`. It includes relevant untracked implementation and evaluation evidence, excludes runtime credentials and older decks, and contains a SHA-256 manifest. The live deployment is available above. Repository publication and the final hackathon submission are separate actions; a prepared draft is not a submission to the judges.
