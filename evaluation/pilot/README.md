# Ready-to-run reviewer pilot

Status: no participants recruited or results collected. Use the adjacent CSV headers to collect actual observations. Do not fill missing outcomes with estimates.

1. Recruit two support reviewers and record consent and relevant experience in `interviews.csv`. Observe an actual recent support-to-engineering handoff before presenting Clarity. Ask what they would keep using instead and why.
2. Prepare three matched synthetic call sets A, B and C. Balance duration, language, issue count and difficulty. Have independent reviewers label source issues and acceptable investigations in `reference-labels.csv` before seeing generated outputs. Resolve disagreements and retain the original annotations. Do not use an AI model as a human reviewer.
3. Compare three conditions: manual listening/transcript and notes; transcript plus keyword tags; Clarity with evidence review. Reviewer 1 processes A manually, B with keywords, C with Clarity. Reviewer 2 processes B with Clarity, C manually, A with keywords. This is a small usability pilot, not full counterbalancing or a statistically powered study. Each person sees each call once.
4. Give the same task in every condition: identify the reported problem, cite supporting speech, propose an investigation, assign the appropriate team and explain whether it deserves action. Stop timing after the reviewer has checked and corrected the output. Record waiting separately. Save drafts locally; do not send tickets or messages.
5. Record each session in `sessions.csv`. Blind an independent assessor to condition when checking correctness and usefulness. Report raw counts, individual times and medians. Count missed and unsupported findings alongside time so faster incorrect work cannot look like a benefit.
6. Agree success thresholds with the team before collecting results. Suggested discussion points: fewer active review minutes with no loss of issue recall, fewer unsupported actions, and acceptable privacy recall. These are candidate criteria, not observed results.

The automated keyword baseline is a technical comparison only. It does not replace timed human work. Its rules are frozen in `worker/csi_worker/evaluation/keyword_baseline.py`; expected labels are never passed to its prediction function.

For customer recordings, first agree permission, access, retention and withdrawal. Keep customer identities and raw recordings out of this public package. The synthetic exercise requires no private customer data.
