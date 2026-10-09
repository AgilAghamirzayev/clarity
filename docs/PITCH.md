# Clarity: current six-slide pitch

Current evidence: [SUBMISSION_EVIDENCE.md](SUBMISSION_EVIDENCE.md). The [editable deck](../deliverables/judge-pitch/Clarity-Judge-Pitch-Current.pptx) preserves the established design. This three-minute timing is a rehearsal plan, not a measured recording length.

## Slide 1: Clarity: from recurring complaints to a reviewed next step

Rubric: **User value: 25 points**. Time: **0:00-0:30**.

### Slide content

- Support + CX leads: digital-service companies with engineering owners
- Connect recordings, recurring complaints and the next investigation.
- Who owns the next step?
- Target-user hypothesis. Customer validation and time savings remain unmeasured.

### Spoken script

Clarity is for support and customer-experience leads at digital-service companies. When the same problem appears across recordings, they need to connect the evidence and agree what deserves investigation. Clarity brings related calls, a proposed next step and a recorded human decision into one workflow. That is the value we are testing. We have not yet validated customer demand or measured time savings.

### Speaker notes

The initial target user is a support or CX lead who needs an engineering owner for recurring reported problems. Customer interviews, demand and measured savings remain pending. Use the pilot sheets to validate this hypothesis.

Sources: docs/JUDGE_EVALUATION.md, docs/EVIDENCE_PLAN.md

## Slide 2: Automatic analysis, with explicit human decisions

Rubric: **Working prototype and meaningful AI contribution: 30 points**. Time: **0:30-1:00**.

### Slide content

- 01 Receive: connected source submits audio. Automatic intake.
- 02 Analyze: transcribe, mask, interpret and group. AI + validation.
- 03 Review: check evidence, owner and rationale. Human decision.
- 04 Compare: count issue calls before and after. Observational.
- Local by default. Configured compatible analysis providers and versioned company rules.

### Spoken script

Once a recording source is connected, ingestion and analysis run automatically. Speech models transcribe; patterns and a local model mask sensitive text; language models propose findings and actions; embeddings help group related issues. Code validates references and calculates counts. People decide what to approve. Company rules and compatible analysis providers are configurable, while the review requirement remains. This is an implemented workflow, with compatibility boundaries.

### Speaker notes

Automatic ingestion is an upload API plus a watched-folder connector, not a native connector for every call platform. External analysis needs a configured compatible endpoint and workspace opt-in. Speech, masking and embeddings remain local. Skill export contains prompts, schemas, workflow and read-only API contracts; it does not deploy an autonomous agent. Source wiring and operational intervention after failures can still be necessary.

Sources: docs/AUTOMATION_AI.md, worker/csi_worker/analysis.py, worker/csi_worker/agent_profile.py, worker/csi_worker/activities.py, server/src/main/java/az/csi/DecisionController.java

## Slide 3: A recommendation the reviewer can trace to the call

Rubric: **Working prototype and meaningful AI contribution: 30 points**. Time: **1:00-1:30**.

### Slide content

- 2 calls / 1 fictional customer
- Inspect decline logs. Verify any charge.
- Existing prototype image: Checkout payment failures and its supporting conversations.
- Prepared AI output with editorial titles and masking corrections. Seeded decisions are illustrative.

### Spoken script

Here is the prepared payment example: two calls from one fictional customer describe checkout failures. The recommendation is to inspect transaction logs and verify whether a charge occurred. The reviewer can return to the cited conversation before accepting that investigation. We do not claim the model found the root cause. These are synthetic recordings with stored model outputs, editorial titles and documented masking corrections. Seeded decisions are illustrative.

### Speaker notes

Use the existing issue screenshot as a prepared prototype capture, not a new run. Catalog payment issue ddab40f9-e736-4fdf-bbf5-af0759145421 has two linked calls sharing demo-customer-01. Prepared call outputs record call-analysis-v2; current worker uses call-analysis-v6-reviewed. Demo state remaps IDs and dates. Proposed outcome text is an aspiration, not observed impact. Start a separate fresh job during the main demo; this screenshot remains prepared evidence.

Sources: server/src/main/resources/demo/catalog.json, demo/labels.json, demo/corrections.json, server/src/main/java/az/csi/DemoCatalog.java, docs/DEMO_SCRIPT.md

## Slide 4: Measured quality and remaining failures

Rubric: **Quality testing, failures and comparison with the current approach: 20 points**. Time: **1:30-2:00**.

### Slide content

- 8 new synthetic text cases; 7 labeled issues
- AI: 87.5% lexical precision / 100% recall
- Keyword baseline: 100% precision / 42.9% recall
- AI: one extra paraphrased issue; 3/8 narrow rubric flags
- Human semantic review and time comparison remain pending.

### Spoken script

On eight new synthetic transcripts, AI matched all seven labeled issues with eight findings. A fixed keyword baseline matched three issues with three findings. That is better recall in this small test, with an extra paraphrased issue. Three AI findings triggered narrow rubric flags, including two action-wording checks. These are lexical measures, not human-confirmed accuracy. We retain the failures and have prepared an independent reviewer comparison.

### Speaker notes

Source and baseline were frozen before this new set was authored. Same-agent synthetic labels are not independent ground truth. No tuning followed inspection of outputs. One extra paraphrased issue and two action-pattern mismatches account for 3/8 flags. This is not a hallucination rate. Version 5 used a different set, so do not claim a controlled accuracy gain. The keyword baseline has no masking or ASR and is deliberately simple. See SUBMISSION_EVIDENCE.md for current software checks.

Sources: evaluation/RESULTS_V6.md, evaluation/reports/text-heldout-v6.json, evaluation/reports/keyword-heldout-v6.json, docs/SUBMISSION_EVIDENCE.md

## Slide 5: A pilot with measurable quality and operating cost

Rubric: **Feasibility, data requirements, running costs and next steps: 15 points**. Time: **2:00-2:30**.

### Slide content

- Data: permissioned recordings and independent reviewers
- Budget: $302.40/month server plus weekly backup
- Readiness: deployment guide; selected host not benchmarked
- Outcome: seven-day observational call-share comparison
- Budget excludes tax, labor, extras; unit cost remains pending.

### Spoken script

We have a concrete candidate budget: three hundred two dollars and forty cents monthly for a server and weekly backups, based on published pricing. That excludes taxes, review labor and extras. The selected host still needs benchmarking; laptop throughput cannot establish its cost per call. Our next step is a small reviewer pilot, followed by permissioned recordings. The outcome comparison remains observational, not proof of business impact.

### Speaker notes

DigitalOcean General Purpose Regular: 8 dedicated vCPUs, 32 GiB RAM, 100 GiB SSD, published $252/month, weekly backup 20% or $50.40. Price checked 9 October 2026. No server purchased or workload tested there. Storage included in plan is not double-counted. Added storage, tax, operations, review labor and optional external inference excluded. Never assign local M4 throughput to this host.

Sources: evaluation/COSTS.md, https://www.digitalocean.com/pricing/droplets, evaluation/pilot/README.md

## Slide 6: A focused proposition for a specific support team

Rubric: **Originality: 10 points**. Time: **2:30-3:00**.

### Slide content

- Established category: Enterpret / Dovetail / manual review
- Our proposed fit: local processing, configurable analysis and a reviewed engineering investigation.
- Next: one support team to test usefulness, quality and cost.
- Custom workflow, existing models. This positioning is a hypothesis, not a uniqueness claim.

### Spoken script

Feedback intelligence is an established category. Enterpret advertises themes, source citations and issue-tracker workflows. Dovetail offers feedback synthesis and customer intelligence. Our proposed fit is a support team that wants local processing and a traceable, human-owned engineering investigation. We still need evidence that this team prefers Clarity. The pilot tests that preference alongside correctness, review effort and operating cost.

### Speaker notes

Primary-source research reviewed 9 October 2026. Vendor feature descriptions establish overlap, not independently verified quality. Do not imply competitors lack human review, evidence links, customization or outcome tracking. No comparative procurement, price or usability test has been performed. Current custom work is ingestion, versioned prompts/skill contracts, validation, issue grouping and decision lifecycle, not a new foundation model.

Sources: docs/JUDGE_QA.md, https://helpcenter.enterpret.com/en/articles/12665465-enterpret-features-explained, https://dovetail.com/enterprise/
