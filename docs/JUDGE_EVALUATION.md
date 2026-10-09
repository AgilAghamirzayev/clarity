# Clarity: evidence against the judging rubric

Current entry point: [submission evidence](SUBMISSION_EVIDENCE.md). It separates the current implementation, new measured runs, earlier measurements, prepared demo artifacts and pending user research. This is an evidence map, not an official or self-assigned score.

## Value for the user: 25 points

Clarity is for a support or CX lead who must turn repeated recorded complaints into an investigation owned by engineering or operations. The reviewer can follow a finding to source speech, connect related calls, approve or reject an investigation, and record the owner and rationale.

The outcome to validate is less effort per correct support-to-engineering handoff. Customer demand, adoption, time savings and business impact remain unmeasured. [Pilot materials](../evaluation/pilot/README.md) include interview, reference-label and session sheets. Two reviewers will compare manual work, keyword-assisted review and Clarity on matched tasks.

## Prototype and use of AI: 30 points

The implemented flow is source ingestion, private audio storage, speech recognition, text masking, call analysis, issue grouping, recommendation review and an owned decision. [Current measurements](SUBMISSION_EVIDENCE.md) distinguish fresh inference from the eight prepared fictional catalog calls.

| Stage         | AI contribution                            | Code or human contribution                                               |
| ------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| Speech        | Local transcription and speaker embeddings | Channel metadata determines known roles; unknown roles remain explicit   |
| Masking       | Local entity detection                     | Patterns and span replacement; raw stored audio is not redacted          |
| Call analysis | Proposed observations and investigations   | Schema and evidence checks; invalid findings excluded individually       |
| Grouping      | Embeddings relate wording                  | Fixed first-exemplar distance rule, not a confidence score               |
| Review        | AI supplies a draft                        | Person checks evidence, approves or rejects, assigns owner and rationale |
| Outcome       | No causal inference                        | Code compares seven-day issue-call shares; people interpret context      |

Version 6 preserves valid findings when another finding fails, records rejection codes, combines conservative content duplicates, and replaces generated summaries with source excerpts when roles are unknown or findings are rejected. The conversation detail shows review notices. These controls do not prove semantic support. Paraphrased duplicates remain an observed limitation.

## Quality testing: 20 points

[Version 6 results](../evaluation/RESULTS_V6.md) cover eight new synthetic cases generated after the implementation and keyword baseline were frozen. The model matched 7 of 7 labeled issues with 8 predictions; the keyword baseline matched 3 of 7 with 3 predictions. AI lexical precision was 87.5% and recall 100%; baseline precision was 100% and recall 42.9%. Three of eight AI predictions triggered narrow rubric flags: one extra paraphrased issue and two action-pattern mismatches. These are not adjudicated hallucination rates.

The old version 5 results remain available unchanged. Different datasets prevent a controlled before/after accuracy claim. Human semantic review, representative noisy/mono audio, broad privacy recall and timed reviewer comparison remain pending. Automated tests cover evidence rejection, partial recovery, duplicate merging, source-role uncertainty, isolation, retries, calculations and browser workflows. Exact current results are in the canonical evidence summary.

## Feasibility: 15 points

The repository includes deployment instructions, recording-source ingestion, retries, replay protection, persistence and human approval boundaries. A candidate one-server pilot has a published **$302.40/month infrastructure subtotal**, including weekly backup, in [the cost scenario](../evaluation/COSTS.md). This is a budget quote, not a measured bill or proof that the server can sustain a target workload. Review labor, operations, tax and additional storage are excluded.

Next: benchmark the selected host, confirm recording access, collect the reviewer pilot and measure cost per successful audio hour. Local laptop throughput must not be assigned to the proposed cloud host. No production deployment or customer data agreement is claimed.

## Originality: 10 points

Feedback analytics, theme grouping and evidence links are established capabilities. [The competitor comparison](JUDGE_QA.md#comparison-with-existing-options) records overlap and unknowns. Clarity's proposed fit is local processing with configurable company instructions and a traceable support-to-engineering decision. Validate that fit with a team that values those constraints; feature presence alone does not establish preference or uniqueness.

## Submission boundary

Use the current pitch, canonical evidence and source package. The prepared catalog uses an older prompt and includes editorial titles and documented masking corrections. No paid infrastructure, external messages, official submission, push or publication is part of this work.
