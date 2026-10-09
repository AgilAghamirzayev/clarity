# Version 6 results: 9 October 2026

This report covers the implementation changes requested after the rubric review. Earlier [version 5 results](RESULTS.md) and raw reports are preserved. These runs use different cases, so they do not establish a controlled accuracy improvement over version 5.

## Implementation

- Findings are validated individually. Accepted findings survive another finding's schema, citation or agent-only failure. Rejected findings retain safe reason codes and positions, never raw rejected model text in production.
- Normalized identical descriptions, actions and expected outcomes are merged, even when titles differ. Supporting indices are combined within the schema limit and the higher priority is retained. This conservative rule does not solve all semantic duplicates.
- Unknown speaker roles or rejected findings trigger source excerpts instead of a generated summary. Review-required flags reach the conversation detail. No accepted issue is not treated as evidence of no problem.
- The welcome dialog hands focus to the tour instead of restoring it over the tour. A direct conversation entry avoids requiring the full tour.
- Versioned prompt and runtime provenance are `call-analysis-v6-reviewed`, skill `6`. The prompt explicitly includes confusing refund/status messages as reportable friction.

## New text set and keyword comparison

Implementation and keyword rules were frozen before eight new synthetic cases were authored. The freeze is in [v6-freeze.json](baselines/v6-freeze.json). Labels were written by the implementing agent and are not independent human truth. No prompt or prediction-rule tuning followed inspection of these outputs. An unused baseline import was removed for lint afterward; the exact evaluated baseline is preserved in [keyword-v1-evaluated.py](baselines/keyword-v1-evaluated.py).

| Measure                 | Local AI v6 | Fixed keyword baseline |
| ----------------------- | ----------: | ---------------------: |
| Completed cases         |         8/8 |                    8/8 |
| Expected labeled issues |           7 |                      7 |
| Emitted findings        |           8 |                      3 |
| Matched issues          |           7 |                      3 |
| Lexical issue precision |       87.5% |                   100% |
| Lexical issue recall    |        100% |                  42.9% |
| Narrow rubric flags     |         3/8 |                    0/3 |
| Human semantic quality  |     Pending |                Pending |
| Timed reviewer effort   |     Pending |                Pending |

[AI report](reports/text-heldout-v6.json), [baseline report](reports/keyword-heldout-v6.json), [case labels](cases/transcripts-v6.json), [unfilled human review sheet](reports/semantic-review-v6-pending.csv).

Both methods use the same reference-text cases and role metadata. The AI path includes local masking; the baseline reads the reference text directly and has no masking or ASR. This set has no labeled PII, so it cannot establish privacy quality. The baseline is deliberately simple and English-only; it is not a best-in-class competitor or a substitute for the customer's actual process.

The result demonstrates a tradeoff on this small set: AI matched more labeled problems, while the baseline emitted fewer extras. It does not establish that AI saves reviewer time or that its recommendations are semantically correct. These runs occurred on a development machine alongside other checks, so their timings are not capacity measurements.

## Failures retained

- The checkout paraphrase produced two related findings for one expected issue. Their descriptions/actions differ, so conservative deduplication retained both. Semantic duplicate resolution remains a review task.
- Duplicate-charge and refund-destination actions failed the predefined action-pattern matcher. These flags require human inspection; a regex mismatch is not proof of an unsupported recommendation. The scorer was not loosened after seeing the result.
- Several titles contain awkward evidence or sentiment fragments despite valid structure. Human editing remains useful.
- The earlier version 5 set exposed an input privacy miss, unknown-role attribution and all-or-nothing evidence rejection. Regression tests now prove partial recovery and summary-role behavior with controlled outputs. They do not prove all model errors have disappeared.

## Reproduce

Use new output paths to preserve reports:

```sh
PYTHONPATH=worker python3 scripts/run.py uv run --project worker python -m csi_worker.evaluation.run --cases evaluation/cases/transcripts-v6.json --split heldout --execute-models --output .runtime/text-v6-new.json
PYTHONPATH=worker uv run --project worker python -m csi_worker.evaluation.keyword_baseline --cases evaluation/cases/transcripts-v6.json --split heldout --output .runtime/keyword-v6-new.json
```

These examples are now exposed. Future tuning requires a new untouched evaluation set. Complete the human review sheet and [reviewer pilot](pilot/README.md) before reporting semantic accuracy or time savings. [Submission evidence](../docs/SUBMISSION_EVIDENCE.md) records current software and full-audio checks; [costs](COSTS.md) separates the hosting budget from unknown unit cost.
