# Clarity - Customer Intelligence

A React and TypeScript frontend foundation for turning customer conversations into evidence-backed business decisions. Built from the recovered Customer Intelligence AI Platform concept and technical document.

## Run locally

Requires Node.js 20.19+ (Node 22.13+ recommended) and npm.

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open the local address printed by Vite. No API keys or backend services are needed.

```sh
npm run build          # TypeScript checks and production bundle
npm run preview        # Serve the production build locally
npm run lint           # Oxlint checks
npm test               # Domain and repository tests
npx playwright install chromium
npm run test:e2e       # Browser flows and accessibility checks
npm run format:check   # Formatting verification
```

If Chromium cannot be downloaded, use an installed Google Chrome in an isolated test profile:

```sh
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

## What works

- Overview with 7-day / 30-day metrics and an accessible volume chart.
- Searchable, sortable, paginated conversation explorer with URL-based filters.
- Conversation detail with synthetic transcript, summary, and linked issue.
- Issue groups with distinct customer counts, period comparisons, evidence and root cause hypotheses.
- Recommendation review with validated owner and rationale fields.
- Approval or rejection, action progress, completion and local review history.
- Browser-persisted demo decisions, a confirmed reset flow, and corrupt-storage recovery.
- Responsive navigation, lazy-loaded pages, error boundaries, loading and empty states.
- Settings showing the readiness of future integrations.

## Third-party libraries

| Concern             | Library                      | Responsibility                                        |
| ------------------- | ---------------------------- | ----------------------------------------------------- |
| Rendering and types | React + TypeScript           | Components and typed contracts                        |
| Build               | Vite                         | Development server, code splitting, production assets |
| Routing             | React Router                 | Nested layouts, detail routes, URL filters            |
| Data fetching       | TanStack Query               | Async state, caching, mutations, invalidation         |
| Tables              | TanStack Table v8            | Sorting, pagination, row models                       |
| Forms               | React Hook Form              | Field registration, errors, submission                |
| Validation          | Zod + resolvers              | Form and persisted-data schemas                       |
| Dialogs             | Radix Dialog                 | Focus trapping, Escape, dialog semantics              |
| Charts              | Recharts                     | Responsive SVG data visualization                     |
| Icons               | Lucide                       | Consistent interface icons                            |
| Dates               | date-fns                     | Date arithmetic and formatting                        |
| Class names         | clsx                         | Conditional component styles                          |
| Error boundary      | react-error-boundary         | Top-level render recovery                             |
| Tests               | Vitest, Playwright, axe-core | Domain behavior and browser verification              |
| Quality             | Oxlint, Prettier             | Linting and formatting                                |

## Structure

```text
src/
  app/              Application providers, routes, persistent layout
  components/       Shared panels, badges, dialogs, table and query states
  domain/           Domain types, schemas and analytics calculations
  data/             Synthetic fixtures, repository contract and query hooks
  features/
    overview/       Period KPIs and volume visualization
    conversations/  Searchable list and transcript detail
    issues/         Issue discovery views and linked evidence
    decisions/      Review form, action lifecycle and audit display
    settings/       Integration readiness and demo reset
  styles.css        Semantic tokens, shared patterns and responsive rules
tests/              Browser acceptance tests
docs/               Concept analysis and integration plan
```

## Demo boundary

This is a frontend foundation, not the complete production AI platform. The 126 conversations, four issues, and three recommendations are synthetic. All analytics derive from these fixtures, anchored to 9 October 2026. The chart and period cards share the same data. Pending review is an all-time count and is labeled accordingly.

Reviews are stored under `csi.demo.decisions.v1` in this browser. Use fictional names only. Local history is editable by the browser user, is not a production audit log, and does not provide authenticated approval or atomic cross-tab concurrency. Completing an action does not imply a measured business outcome.

Audio ingestion/playback, speech-to-text, diarization, PII redaction, inference, clustering, backend persistence, authentication, tenant isolation, notifications and external integrations are not implemented. No external task creation or message sending occurs.

The original design images were not available to inspect. The interface uses an original restrained green/neutral visual direction under the provisional product name Clarity. See [concept analysis](docs/CONCEPT_ANALYSIS.md) for source limitations and the proposed backend boundary.

## Connect a backend

Implement `WorkspaceRepository` in `src/data/workspace.ts` with an HTTP adapter, then replace the demo adapter in `src/data/queries.ts`. Keep response validation at this boundary. Production list APIs should use server pagination, filtering and sorting instead of loading the full demo workspace. Split the aggregate workspace query into feature queries as endpoints become available.

Enforce authorization, version checks, tenant isolation and audit writes on the server. Keep STT/LLM credentials in backend configuration, never in `VITE_*` variables. Use authenticated recording access rather than accepting arbitrary recording URLs in the browser.

For SPA hosting, serve `index.html` for non-asset routes such as `/issues/ISS-001`. `dist/` is generated by `npm run build`. The dev server is local by default; no deployment has been configured.
