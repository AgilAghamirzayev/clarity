# Clarity: smallest next evidence experiments

The representative customer studies below remain proposed. A small synthetic AI-versus-keyword run is complete in [RESULTS_V6.md](../evaluation/RESULTS_V6.md), and a dated host budget is in [COSTS.md](../evaluation/COSTS.md). These do not replace the proposed studies. Numbers are initial sample sizes or planning choices, not results. Keep the current demo catalog separate from evaluation data: its authored scripts, editorial labels and corrections make it unsuitable as an independent quality benchmark.

## 1. Confirm the user and the current process

Observe one support lead handling a recent recurring issue and interview two additional support/CX leads at digital-service companies. Ask for the actual recording-to-engineering handoff, its owner, missing context, existing analytics and permission to access recordings. Capture anonymized task steps and direct feedback with consent. Deliver a problem statement with counterexamples and an adoption decision. Three conversations can disprove a poor assumption; they cannot establish market demand.

## 2. Measure quality and reviewer effort

Start with 20 permissioned calls from the intended environment. Include positive/no-problem calls, multiple issues, repeat contacts, overlap/noise and language variation actually present there. Report how calls were selected. Pseudonymize identities before exporting any evaluation material. Two reviewers independently label customer problems, source segments, sensitive spans and suggested investigations; reconcile disagreements and preserve the original ratings.

Freeze model, prompt, provider and clustering settings. Evaluate fresh outputs, retaining failures and abstentions. Keep corrected display titles separate from raw output. If rules are tuned on these calls, treat them as development data and collect an untouched holdout before reporting generalization.

| Measure             | Definition                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Issue precision     | Reviewer-supported predicted issues / all predicted issues; report raw counts and empty denominator.                                            |
| Issue recall        | Matched reference issues / all adjudicated reference issues, with a written matching rule.                                                      |
| Evidence support    | Recommendations whose cited text supports the observation / all recommendations. Separately report valid-index rate.                            |
| No-problem behavior | False issues on reference no-problem calls; also report missed problems so abstention cannot hide low recall.                                   |
| Privacy quality     | Sensitive spans missed / labeled sensitive spans, and ordinary spans wrongly masked. Report by entity type and segment boundary.                |
| ASR and speakers    | Word error rate against a reference transcript on a labeled subset; speaker attribution errors separately.                                      |
| Grouping            | Same-issue pairs placed together and different-issue pairs separated, adjudicated independently. Do not convert cosine distance into accuracy.  |
| Reviewer effort     | Active minutes and rework per accepted investigation, plus accepted/incorrect/missed counts. Do not count rejected work as a productivity gain. |

Compare manual listening/transcript review and note-taking against Clarity on the same recordings. Balance order across reviewers so each reviewer sees a given call in only one condition; a different reviewer evaluates that call in the other condition. Keep task instructions and completion criteria equal. Include the time spent verifying and correcting AI. Blind the final usefulness assessment to condition where feasible. Record tool setup time separately. Publish medians, individual results and limitations; this small pilot does not support a broad savings claim.

Add a small ablation: use transcripts plus keyword tags without model-generated findings, on the same evaluation set. Compare supported findings and total reviewer effort. This tests whether semantic AI adds value beyond transcription and deterministic search. Agree pilot acceptance thresholds with the team before inspecting results; do not choose thresholds afterward to make the result pass.

## 3. Cost measurement

Use ten representative recordings as a first instrumentation run. Report total audio hours, languages, durations, model versions, machine specification and concurrency. Record stage wall time, peak memory, compute utilization, storage bytes and retention, failures/retries, external provider input/output usage if used, and reviewer minutes. Use fresh runs; prepared outputs are not a throughput benchmark.

| Input                        | Unit                                                | Current measured value                     |
| ---------------------------- | --------------------------------------------------- | ------------------------------------------ |
| Processed audio              | Hours, including failed inputs separately           | Not measured                               |
| Local inference resource use | Compute hours and peak memory                       | Not measured                               |
| Fixed infrastructure         | Monthly host/database/queue/object-storage cost     | Candidate quote in COSTS.md; no purchase   |
| Retained data                | GB-month, including backups                         | Not measured                               |
| External inference           | Input/output usage, retries, contracted unit prices | Not measured; depends on selected provider |
| Review and operations        | Labor hours and agreed loaded rate                  | Not measured                               |

`Monthly operating cost = fixed infrastructure + variable compute + storage/backups + network + external inference + operations labor + review labor`.

Avoid double-counting compute already included in a fixed host. `Cost per processed audio hour = total cost for the period / successfully processed audio hours`, with failure volume and utilization reported alongside it. Show sensitivity to volume, retention, retries and reviewer effort. Local inference is not free; response token limits are not a spending cap. Obtain dated provider/hosting quotes after selecting the pilot configuration, not before.

## 4. Test integration and deployment feasibility

In staging, use one actual recorder/export source and one deployment-approved model endpoint. Replay an event twice, revoke the token, submit an invalid file, interrupt a job and change a saved profile. Verify no duplicate call, authorized access, visible failure/retry and profile provenance. Compare model outputs across the company's preferred configurations on the same labeled inputs. Existing mocked contracts do not establish real interoperability.

Measure a queue at the intended arrival rate and restore a backup. Complete data-access, retention and access-control review before a production pilot. No partner notification is required for these tests; downstream delivery can use a controlled test endpoint. Production security and operational readiness require separate verification.

## 5. Test the proposed distinction

Ask one target support team to move from a recurring complaint to an owned investigation using its current tools and Clarity. Use a checklist: source access, evidence retrieval, context/rules configuration, approved model fit, owner/rationale, auditability and integration effort. Compare the same checklist against a shortlisted competitor's documentation or an authorized trial. Record where Clarity loses as well as where it fits. No superiority or uniqueness claim is justified by feature presence alone.

## 6. Interpret outcomes responsibly

Wait for real action completion and complete seven-day windows; preserve sample sizes, case mix, ingestion coverage and model versions. Report issue-linked calls / all completed calls for both windows, with missing denominators shown as unavailable. This is observational. To evaluate causal impact later, design a suitable controlled study with the team. Do not equate call duration with handling time, negative sentiment with measured CSAT, or two calls from one customer with two affected customers.
