import { SpotlightTour } from "../features/onboarding/SpotlightTour";
import { Suspense, useEffect, useId, useRef, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { LoadingState } from "../components/ui";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  ChartNoAxesCombined,
  ArrowUpRight,
  AudioLines,
  Workflow,
  GitBranch,
  LayoutDashboard,
  Lightbulb,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  CircleHelp,
  ChevronsUpDown,
  Settings2,
} from "lucide-react";
import { roleLabels } from "../domain/presentation";
import { apiMode, guestMode } from "../data/api";
import { SignOut } from "../features/platform/Auth";
import { useIdentity } from "../features/platform/identity";
import { Modal } from "../components/Modal";
import { AccountPanel } from "../features/platform/AccountPanel";
import { OnboardingProvider } from "../features/onboarding/state";
import { WelcomeTour } from "../features/onboarding/Onboarding";
import { useOnboarding } from "../features/onboarding/context";

const navigation = [
  { to: "/", title: "Overview", icon: LayoutDashboard },
  { to: "/summary", title: "Support summary", icon: ChartNoAxesCombined },
  { to: "/conversations", title: "Conversations", icon: AudioLines },
  { to: "/issues", title: "Issue intelligence", icon: GitBranch },
  { to: "/decisions", title: "Decision center", icon: Lightbulb },
  { to: "/automation", title: "Automation & AI", icon: Workflow },
  { to: "/settings", title: "Workspace settings", icon: Settings2 },
];
function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const groupId = useId();
  const reducedMotion = useReducedMotion();
  return (
    <LayoutGroup id={groupId}>
      <nav aria-label="Main navigation">
        {navigation.map(({ to, title, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            aria-label={title}
            title={title}
            onClick={onNavigate}
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    className="nav-indicator"
                    layoutId={reducedMotion ? undefined : "active-navigation"}
                    transition={{ type: "spring", stiffness: 420, damping: 38 }}
                    aria-hidden="true"
                  />
                )}
                <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                <span className="nav-label">{title}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </LayoutGroup>
  );
}
export function Layout() {
  return (
    <OnboardingProvider>
      <WorkspaceLayout />
    </OnboardingProvider>
  );
}
function WorkspaceLayout() {
  const { status: onboardingStatus } = useOnboarding();
  const user = useIdentity();
  const reducedMotion = useReducedMotion();
  const [menu, setMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("clarity:sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });
  function toggleSidebar() {
    const collapsed = !sidebarCollapsed;
    setSidebarCollapsed(collapsed);
    try {
      localStorage.setItem("clarity:sidebar-collapsed", String(collapsed));
    } catch {
      // Navigation remains usable when browser storage is unavailable.
    }
  }
  const [account, setAccount] = useState(false);
  const location = useLocation();
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    if (onboardingStatus !== "touring") main.current?.focus();
    window.scrollTo(0, 0);
  }, [location.pathname, onboardingStatus]);
  const section =
    navigation.find((n) => n.to !== "/" && location.pathname.startsWith(n.to))
      ?.title ??
    (location.pathname === "/guide" ? "Getting started" : "Overview");
  useEffect(() => {
    document.title = `${section} | Clarity`;
  }, [section]);
  return (
    <div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside
        className="sidebar"
        id="desktop-sidebar"
        aria-label="Workspace sidebar"
      >
        <div className="sidebar-header">
          <NavLink to="/" className="brand" aria-label="Clarity home">
            <span className="brand-icon">
              <Activity size={22} />
            </span>
            <span className="brand-wordmark">
              clarity<span className="brand-period">.</span>
            </span>
          </NavLink>
          <button
            className={`icon-button sidebar-toggle${sidebarCollapsed ? " is-collapsed" : ""}`}
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!sidebarCollapsed}
            aria-controls="desktop-sidebar"
            onClick={toggleSidebar}
          >
            {sidebarCollapsed ? (
              <>
                <span
                  className="brand-icon sidebar-toggle-logo"
                  aria-hidden="true"
                >
                  <Activity size={22} />
                </span>
                <PanelLeftOpen
                  className="sidebar-toggle-open"
                  size={20}
                  aria-hidden="true"
                />
              </>
            ) : (
              <PanelLeftClose size={20} aria-hidden="true" />
            )}
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-avatar">CI</span>
          <div className="workspace-details">
            <strong>Customer Intelligence</strong>
            <small>
              {guestMode
                ? "Live demo workspace"
                : apiMode
                  ? "Local AI workspace"
                  : "Demo workspace"}
            </small>
          </div>
        </div>
        <Navigation />
        <div className="sidebar-bottom">
          <NavLink
            className="sidebar-help"
            to="/guide"
            aria-label="Getting started"
            title="Getting started"
          >
            <CircleHelp
              className="sidebar-help-icon"
              size={20}
              aria-hidden="true"
            />
            <span className="sidebar-help-label">Getting started</span>
            <ArrowUpRight
              className="sidebar-help-arrow"
              size={14}
              aria-hidden="true"
            />
          </NavLink>
          <button
            className="profile profile-button"
            aria-label="Open account"
            aria-haspopup="dialog"
            aria-expanded={account}
            title="Your account"
            onClick={() => setAccount(true)}
          >
            <span
              className="avatar"
              title={guestMode || !apiMode ? "Demo account" : user?.email}
            >
              {user ? user.email.slice(0, 2).toUpperCase() : "DR"}
            </span>
            <span className="profile-details">
              <strong>
                {guestMode || !apiMode ? "Demo account" : user?.email}
              </strong>
              <small>{user ? roleLabels[user.role] : "Local preview"}</small>
            </span>
            <ChevronsUpDown
              className="profile-chevron"
              size={16}
              aria-hidden="true"
            />
          </button>
        </div>
      </aside>
      <div className="app-body">
        <header
          className={`topbar${apiMode && !guestMode ? "" : " topbar-mobile-only"}`}
        >
          <div className="topbar-start">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={menu}
              aria-haspopup="dialog"
              onClick={() => setMenu(true)}
            >
              <Menu size={20} />
            </button>
            <NavLink to="/" className="mobile-brand" aria-label="Clarity home">
              clarity.
            </NavLink>
          </div>
          <div className="topbar-right">
            {apiMode && !guestMode && <SignOut />}
            <button
              className="icon-button mobile-account"
              aria-label="Open account"
              aria-haspopup="dialog"
              aria-expanded={account}
              onClick={() => setAccount(true)}
            >
              <span className="avatar" aria-hidden="true">
                {guestMode || !apiMode
                  ? "DE"
                  : user?.email.slice(0, 2).toUpperCase() || "CL"}
              </span>
            </button>
          </div>
        </header>
        <main ref={main} tabIndex={-1} id="main-content">
          <Suspense fallback={<LoadingState />}>
            <motion.div
              key={location.pathname}
              className="page-content"
              initial={reducedMotion ? false : { y: 8 }}
              animate={{ y: 0 }}
              transition={{
                duration: reducedMotion ? 0 : 0.24,
                ease: [0.2, 0, 0, 1],
              }}
            >
              <Outlet />
            </motion.div>
          </Suspense>
        </main>
        <footer className="footer">
          <span>Clarity · Customer Intelligence</span>
          <span>
            {guestMode
              ? "Generated sample calls · Real local AI analysis"
              : apiMode
                ? "Local processing · Human review required"
                : "Synthetic sample data · Snapshot: 9 Oct 2026"}
          </span>
        </footer>
      </div>
      <AccountPanel open={account} onOpenChange={setAccount} />
      <WelcomeTour />
      <SpotlightTour />
      <Modal
        open={menu}
        onOpenChange={setMenu}
        variant="navigation"
        title="Your workspace"
        description="Explore your customer intelligence workspace."
      >
        <Navigation onNavigate={() => setMenu(false)} />
        <NavLink
          className="nav-link"
          to="/guide"
          onClick={() => setMenu(false)}
        >
          <CircleHelp size={20} aria-hidden="true" /> Getting started
        </NavLink>
      </Modal>
    </div>
  );
}
