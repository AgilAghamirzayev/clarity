# Clarity: likely judge questions

Answers reflect the current working tree reviewed on 9 October 2026. See the [rubric evidence map](JUDGE_EVALUATION.md) for implementation links and the [pilot plan](EVIDENCE_PLAN.md) for uncompleted experiments.

## Who is the first user, and what problem is solved?

A support or CX lead at a digital-service company who needs to turn recurring recorded complaints into an investigation owned by engineering or operations. Clarity connects source calls, a proposed next step and the human decision. This is a specific target-user hypothesis. We have not established demand, adoption or savings through customer research.

## How do you stop hallucinations?

We require structured output and valid source references, reject invalid evidence, constrain prompts and keep a human approval step. Summary checks also reject certain unsupported numeric targets. Version 6 rejects invalid findings individually, retains accepted findings and exposes a review notice. Unknown roles use source excerpts instead of a generated summary. Those controls do not prove a statement is supported merely because its citation exists. Reviewers must compare the claim with the transcript and check proposed causes against logs or policies. Human-adjudicated hallucination rate remains unmeasured. The [new synthetic comparison](../evaluation/RESULTS_V6.md) reports lexical proxies and narrow failure flags. [Validation code](../worker/csi_worker/analysis.py) and [injected failure tests](../worker/tests/test_analysis.py) establish structural behavior only.

## Does it ever say there is no problem?

Yes. Two prepared catalog calls contain no issues, including “Customer praises clear and helpful support.” That is a no-problem example, not calibrated uncertainty. The current service-enabled worker suite also exercises the local models; see [submission evidence](SUBMISSION_EVIDENCE.md). Failed transcription and invalid model output are failures with status/retry behavior, not successful analyses.

## What went wrong in development?

PII masking over-masked ordinary phrases, including “identify root cause.” Four reviewed substitutions repair the authored demo catalog, and targeted privacy regression tests cover generic words and segment boundaries. Those corrections do not establish broad privacy accuracy and are not applied to restore private content in user uploads. [Corrections](../demo/corrections.json), [tests](../worker/tests/test_privacy.py).

## What happens to private recordings?

Raw audio is stored privately and served through authorized access; the stored audio itself is not redacted. Transcripts are masked before persistence and analysis. Tenant isolation, roles and audit controls are implemented, but masking can miss identifiers and production privacy/compliance is not certified. Local inference is the default. An opted-in external analysis endpoint receives masked evidence and company instructions, which can still be sensitive. Data permission, retention and a representative PII evaluation are prerequisites to a customer pilot. [Privacy pipeline](../worker/csi_worker/privacy.py), [security](../server/src/main/java/az/csi/Security.java), [deployment](DEPLOYMENT.md).

## Can customers use any AI or change the rules?

They can choose local Ollama or deployment-configured endpoints implementing the supported compatible chat-completions and JSON-schema contract. Other providers need a gateway or adapter. Engineers/admins can version company context and analysis rules and export saved prompts, schemas and read-only tool contracts. New jobs snapshot the configuration. The controls do not permit rules to bypass structural validation or human approval. Subjective rule compliance still requires testing. This is not an autonomous agent marketplace, a trained proprietary foundation model or guaranteed compatibility with every provider. [Supported contract](AUTOMATION_AI.md).

## Is the full workflow automatic?

After source setup, intake through analysis and grouping runs without an operator uploading each recording. The included source API and watched-folder connector require a recorder/export integration. Failed jobs can require intervention. Summary refreshes are explicit jobs. Human approval remains required for external actions, and delivery adapters must be configured. “Most companies” is an intended applicability claim, not a tested compatibility result.

## What is custom about the product?

The custom work joins ingestion, versioned analysis instructions, evidence validation, clustering and a reviewed decision lifecycle. The skill package expresses the team's workflow knowledge through prompts, schemas and evidence APIs. It does not demonstrate a free-running agent executing those tools. Existing models perform speech, entity detection, language analysis and embeddings. We should demonstrate the workflow's usefulness before calling it a defensible moat.

## Why use AI instead of search or a dashboard?

AI can interpret varied descriptions of the same service problem and propose a reviewable investigation from unstructured speech. Embeddings help relate differently worded findings. Search and dashboards remain useful baselines. Counts, rates, reference checks, authorization and decisions are deterministic or human tasks. The completed [synthetic keyword comparison](../evaluation/RESULTS_V6.md) shows higher AI label recall with an extra finding and rubric flags. Timed human review must still test whether that tradeoff is worthwhile.

## How much does it cost, and is it faster than manual review?

Neither has been measured on representative customer data. A [sourced pilot budget](../evaluation/COSTS.md) lists a $302.40/month server-and-weekly-backup subtotal, excluding labor, taxes and extras. It is not a measured unit cost. Local models avoid a required external inference bill but still consume compute and operations effort. Configured providers add their own usage charges. We will measure resource use, retries, retention and review minutes on ten representative calls and compare manual and assisted review on a labeled set. No measured cost per call, speedup or savings is supported yet. [Cost worksheet and comparison design](EVIDENCE_PLAN.md).

## Where will the data come from?

Today the catalog contains eight fictional recordings generated from authored scripts. Real recordings require a partner's permission, lawful access and suitable handling arrangements. A pilot also needs stable customer/case references, timestamps and independent labels. No access agreement or production data partnership is claimed. [Sample provenance](../demo/README.md).

## Is the demo live, and is Clarity deployed?

Prepared catalog outputs load immediately without inference. A fresh upload requires running services and models; judges can request a separate fresh run. The catalog's stored prompt version differs from the current worker. Seeded decisions and guest integrations are illustrative. Deployment instructions and historical local verification exist, but this review did not establish a public or production deployment. Existing screenshots are prepared prototype captures.

## Did the recommendation improve the business?

No business impact has been established. The current outcome view compares issue-linked call shares in seven-day windows before and after a recorded completion. It is observational and sensitive to traffic, case mix and coverage. A seeded Completed decision is not a completed customer intervention. Root causes and proposed benefits require operational evidence.

## Who competes with Clarity?

Established conversation-intelligence vendors and a team's existing call exports, transcripts and issue tracker are relevant alternatives. The comparison below shows why clustering, evidence links or custom prompts alone are not a defensible uniqueness claim.

## Comparison with existing options

Sources checked 9 October 2026. Vendor descriptions establish advertised capabilities, not independently verified quality. Unknown features must not be presented as absent.

| Option                                                                                          | Established overlap                                                                          | What Clarity should test                                                                                                            |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Manual transcripts and issue tracker                                                            | Source inspection, notes, ownership                                                          | Reviewer effort and correct handoffs with the same task and quality bar                                                             |
| Fixed keyword baseline                                                                          | Deterministic matching and source indices                                                    | Whether added AI recall justifies extra findings, compute and checking                                                              |
| [Enterpret](https://helpcenter.enterpret.com/en/articles/12665465-enterpret-features-explained) | Feedback themes, source citations, reusable rules, model selection and Jira/Linear workflows | Whether the team's deployment constraints and review process favor Clarity; competitor local deployment fit is not established here |
| [Dovetail](https://dovetail.com/enterprise/)                                                    | Feedback synthesis, sentiment, themes and customer intelligence                              | Evidence retrieval and support-to-engineering handoff on the team's actual recordings; no superiority claim from feature presence   |
| Clarity                                                                                         | Local processing by default, versioned instructions and recorded human decisions             | User preference, deployment fit, reviewer effort, semantic quality and cost remain to be validated                                  |

The proposed distinction is a team-controlled recording-to-investigation workflow for support leads who need local processing. It is a target-user hypothesis, not a claim that competitors lack evidence, customization or review.
