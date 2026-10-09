import { lazy } from "react";
import { MotionConfig } from "motion/react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { AuthGate } from "../features/platform/Auth";
import { Layout } from "./Layout";
const SupportSummary = lazy(() => import("../features/summary/SupportSummary"));
const Overview = lazy(() => import("../features/overview/Overview"));
const Conversations = lazy(
  () => import("../features/conversations/Conversations"),
);
const ConversationDetail = lazy(
  () => import("../features/conversations/ConversationDetail"),
);
const Issues = lazy(() => import("../features/issues/Issues"));
const IssueDetail = lazy(() => import("../features/issues/IssueDetail"));
const Decisions = lazy(() => import("../features/decisions/Decisions"));
const Automation = lazy(() => import("../features/automation/Automation"));
const Settings = lazy(() => import("../features/settings/Settings"));
const GettingStarted = lazy(
  () => import("../features/onboarding/GettingStarted"),
);
const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: false } },
});
export default function App() {
  return (
    <ErrorBoundary
      fallback={
        <div className="empty-state">
          <h1>Something went wrong</h1>
          <p>Reload the workspace to try again.</p>
          <button className="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      }
    >
      <MotionConfig reducedMotion="user">
        <QueryClientProvider client={client}>
          <AuthGate>
            <BrowserRouter basename={import.meta.env.BASE_URL}>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<Overview />} />
                  <Route path="summary" element={<SupportSummary />} />
                  <Route path="conversations" element={<Conversations />} />
                  <Route
                    path="conversations/:id"
                    element={<ConversationDetail />}
                  />
                  <Route path="issues" element={<Issues />} />
                  <Route path="issues/:id" element={<IssueDetail />} />
                  <Route path="decisions" element={<Decisions />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="automation" element={<Automation />} />
                  <Route path="guide" element={<GettingStarted />} />
                  <Route
                    path="*"
                    element={
                      <div className="empty-state">
                        <h1>Page not found</h1>
                        <p>This view does not exist in the workspace.</p>
                        <Link to="/" className="button">
                          Back to overview
                        </Link>
                      </div>
                    }
                  />
                </Route>
              </Routes>
            </BrowserRouter>
          </AuthGate>
        </QueryClientProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}
