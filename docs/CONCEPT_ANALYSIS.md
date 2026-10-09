# Concept analysis and frontend boundaries

## Source and confidence

The recovered conversation titled "Texniki sənədləşdirmə arxitekturası" describes Customer Intelligence AI Platform v1.0. Its accessible text covers product goals, ingestion, transcription, PII protection, issue discovery, recommendation scoring, decision management, storage, events, workflows, API routes and major UI views. The retrieval was truncated during the AI strategy section; embedded architecture diagrams and original design images were unavailable. This foundation does not claim to reproduce those missing artifacts.

The current request narrows delivery to a React app and reusable base structure. Infrastructure proposals in the source are preserved as future integration requirements rather than implemented in the browser.

## Product analysis

The central workflow is:

```text
Recording -> Transcript -> Redacted analysis -> Issue group
  -> Evidence-backed recommendation -> Human review -> Action -> Measured outcome
```

The key value is a traceable decision, not just a sentiment chart. A reviewer must be able to inspect the conversations behind an issue before approving a proposal. A detected correlation must remain a hypothesis until independently verified. Completion and impact measurement are separate states.

The frontend therefore separates five responsibilities:

| View               | User task                        | Implemented behavior                                             |
| ------------------ | -------------------------------- | ---------------------------------------------------------------- |
| Overview           | Decide what deserves attention   | Period metrics, chart, ranked issues and proposals               |
| Conversations      | Inspect source evidence          | Search, sentiment filter, sorting, pagination, transcript detail |
| Issue intelligence | Understand recurring problems    | Counts, unique customers, comparative trend and linked evidence  |
| Decision center    | Choose and track an action       | Approve/reject with rationale and owner, progress, history       |
| Workspace settings | Understand environment readiness | Explicit integration states and safe demo reset                  |

No calibrated confidence, financial savings or causal impact is invented. Calls and distinct customers are counted separately. A missing previous-period baseline is displayed explicitly instead of dividing by zero. Proposed outcomes are descriptions, not measured results.

## Design contract

- The overview prioritizes the highest-volume issue, then KPIs, volume and issue distribution, then recommendations.
- Primary actions navigate from a signal to evidence and from evidence to a human review.
- Use a neutral canvas, white surfaces, deep green actions, and limited semantic warning colors.
- Use consistent spacing, moderate corner radii, readable labels and subtle borders.
- Desktop has persistent navigation; mobile uses a focus-trapped dialog. Cards stack on small screens; wide tables scroll within their own container.
- Use semantic headings and actual links/buttons, visible keyboard focus, skip navigation, labeled fields and accessible errors.
- Charts have a textual summary and expandable data table. Color is always paired with text.
- Show loading, query failure, empty results, unknown routes, invalid detail IDs and persistence failures.
- Avoid fabricated live indicators, inactive action buttons, decorative charts with unrelated totals, and fake connected integrations.

## Architecture decisions

### Feature folders with shared primitives

Routes compose feature pages. Shared components own repeated layout and interaction patterns, while features own domain-specific presentation. The domain layer contains no React components. The repository interface is the seam between fixtures and future APIs.

### Libraries for repeated behavior

React Router owns URL state. TanStack Query owns asynchronous workspace state. TanStack Table owns row sorting and pagination. React Hook Form and Zod own form handling and validation. Radix owns dialog semantics and focus behavior. Recharts owns chart rendering. There is no global client store because current UI state fits local state and the URL.

TanStack Table v8 is selected explicitly to use its stable `useReactTable` API. Major upgrades should be intentional and tested rather than automatically changing the table contract.

### Demo persistence

Only human demo reviews are persisted. Fixtures remain immutable. The storage envelope is versioned and validated with Zod. Duplicate review attempts, invalid transitions and stale action versions are rejected. Browser storage does not support transactional concurrent writes across tabs, real access control or tamper-proof audit. These guarantees belong in the backend.

### Dates and language

The UI is English to match the current request. Fixtures have explicit ISO timestamps and a fixed 9 October 2026 reporting snapshot. Reporting windows use UTC boundaries; individual call and review timestamps are formatted in the browser's timezone. Production needs an explicit tenant reporting timezone and localization requirements, including Azerbaijani transcripts and interface copy.

## API integration map

The recovered document proposes these routes. They are integration targets, not live endpoints in this repository.

| Frontend need      | Proposed backend route                          |
| ------------------ | ----------------------------------------------- |
| Import a recording | `POST /api/v1/calls/import`                     |
| Browse calls       | `GET /api/v1/calls`                             |
| Call detail        | `GET /api/v1/calls/{id}`                        |
| Transcript         | `GET /api/v1/calls/{id}/transcript`             |
| Analysis           | `GET /api/v1/calls/{id}/analysis`               |
| Issue list/detail  | `GET /api/v1/issues`, `GET /api/v1/issues/{id}` |
| Trends             | `GET /api/v1/insights/trends`                   |
| Recommendations    | `GET /api/v1/recommendations`                   |
| Review             | `POST /api/v1/recommendations/{id}/decisions`   |
| Overview           | `GET /api/v1/analytics/overview`                |
| Outcomes           | `GET /api/v1/decisions/{id}/outcomes`           |

Action transition endpoints, role permissions, approval policy, real provider selection, recording retention, tenant isolation and outcome measurement windows still need confirmed contracts. The demo workflow is a frontend interaction example, not a replacement for those business decisions.

## Next implementation slices

1. Confirm missing document sections, design references, tenancy, roles and action transition contract.
2. Implement authenticated call and issue queries with pagination and tenant-bound validation.
3. Implement server-side review transactions, optimistic concurrency and durable audit history.
4. Connect object storage and background transcription, redaction and analysis workers.
5. Connect issue discovery and recommendation generation with traceable evidence.
6. Add approved external action integrations and independent outcome measurements.

The source suggests a modular Spring Boot core, separate AI workers, PostgreSQL and object storage, with Temporal/Kafka for durable asynchronous work. These components require backend work and are intentionally outside this frontend foundation.

## Documentation consulted

- [React: build an app from scratch](https://react.dev/learn/build-a-react-app-from-scratch), retrieved through Context7.
- [TanStack Query quick start](https://tanstack.com/query/latest/docs/framework/react/quick-start).
- [React Router declarative installation](https://reactrouter.com/start/declarative/installation).
- [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog).
- [React Hook Form Zod resolver](https://github.com/react-hook-form/resolvers#zod).
