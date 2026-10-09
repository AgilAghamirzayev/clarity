# Clarity current judge package

Updated 9 October 2026. Start with the canonical evidence summary; older reviewed decks and log snapshots are historical.

- [Current six-slide editable pitch](Clarity-Judge-Pitch-Current.pptx)
- [Slide content, notes and spoken script](../../docs/PITCH.md)
- [Fresh-processing demo and prepared fallback](../../docs/DEMO_SCRIPT.md)
- [Canonical submission evidence](../../docs/SUBMISSION_EVIDENCE.md)
- [Rubric evidence map](../../docs/JUDGE_EVALUATION.md)
- [Version 6 AI-versus-keyword comparison](../../evaluation/RESULTS_V6.md)
- [Reviewer pilot kit](../../evaluation/pilot/README.md)
- [Sourced infrastructure budget](../../evaluation/COSTS.md)
- [Competitor comparison](../../docs/JUDGE_QA.md#comparison-with-existing-options)

Remaining evidence gaps: customer validation, independently reviewed semantic quality, timed human comparison, representative audio/privacy coverage, actual deployment unit cost and demonstrated user preference. No official score, business savings or unique-market-position claim is made.

Build the source archive from the repository root with `python3 scripts/package-submission.py`. It includes relevant untracked files and current evidence, excludes runtime credentials and older decks, and adds hashes for every packaged file. It does not publish or submit anything.
