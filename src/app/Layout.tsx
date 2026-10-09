import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  ChartNoAxesCombined,
  ArrowUpRight,
  AudioLines,
  ChevronDown,
  GitBranch,
  LayoutDashboard,
  Lightbulb,
  Menu,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { roleLabels } from "../domain/presentation";
import { apiMode } from "../data/api";
import { SignOut } from "../features/platform/Auth";
import { useIdentity } from "../features/platform/identity";
import { Modal } from "../components/Modal";

const navigation = [
  { to: "/", title: "Overview", icon: LayoutDashboard },
  { to: "/summary", title: "Support summary", icon: ChartNoAxesCombined },
  { to: "/conversations", title: "Conversations", icon: AudioLines },
  { to: "/issues", title: "Issue intelligence", icon: GitBranch },
  { to: "/decisions", title: "Decision center", icon: Lightbulb },
  { to: "/settings", title: "Workspace settings", icon: Settings2 },
];
function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main navigation">
      {navigation.map(({ to, title, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          onClick={onNavigate}
          className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
        >
          <Icon size={18} />
          <span>{title}</span>
          {to === "/decisions" && <span className="nav-dot" />}
        </NavLink>
      ))}
    </nav>
  );
}
export function Layout() {
  const user = useIdentity();
  const [menu, setMenu] = useState(false);
  const [about, setAbout] = useState(false);
  const location = useLocation();
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    main.current?.focus();
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const section =
    navigation.find((n) => n.to !== "/" && location.pathname.startsWith(n.to))
      ?.title ?? "Overview";
  useEffect(() => {
    document.title = `${section} | Clarity`;
  }, [section]);
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <NavLink to="/" className="brand" aria-label="Clarity home">
          <span className="brand-icon">
            <Activity size={22} />
          </span>
          clarity<span className="brand-period">.</span>
        </NavLink>
        <div className="workspace-label">
          <span className="workspace-avatar">CI</span>
          <div>
            <strong>Customer Intelligence</strong>
            <small>{apiMode ? "Local AI workspace" : "Demo workspace"}</small>
          </div>
          <ChevronDown size={14} aria-hidden />
        </div>
        <div className="nav-section-label">WORKSPACE</div>
        <Navigation />
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <ShieldCheck size={19} />
            <strong>Every insight has a source.</strong>
            <p>Trace decisions back to the conversations that matter.</p>
            <button onClick={() => setAbout(true)}>
              How Clarity works <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="profile">
            <span className="avatar">
              {user ? user.email.slice(0, 2).toUpperCase() : "DR"}
            </span>
            <div>
              <strong>{user?.email ?? "Demo reviewer"}</strong>
              <small>{user ? roleLabels[user.role] : "Local preview"}</small>
            </div>
            <BadgeDot />
          </div>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>{section}</strong>
          </div>
          <div className="topbar-right">
            <span className="demo-label">
              <span />
              {apiMode ? "Local models" : "Demo data"}
            </span>
            {apiMode && <SignOut />}
            <span className="topbar-divider" />
            <span className="avatar small">
              {user ? user.email.slice(0, 2).toUpperCase() : "DR"}
            </span>
          </div>
        </header>
        <main ref={main} tabIndex={-1} id="main-content">
          <Outlet />
        </main>
        <footer className="footer">
          <span>Clarity · Customer Intelligence</span>
          <span>
            {apiMode
              ? "Local processing · Human review required"
              : "Synthetic sample data · Snapshot: 9 Oct 2026"}
          </span>
        </footer>
      </div>
      <Modal
        open={menu}
        onOpenChange={setMenu}
        title="Workspace navigation"
        description="Explore your customer intelligence workspace."
      >
        <Navigation onNavigate={() => setMenu(false)} />
      </Modal>
      <Modal
        open={about}
        onOpenChange={setAbout}
        title="From conversations to better decisions"
        description="The workflow behind this frontend foundation."
      >
        <ol className="workflow-list">
          <li>Collect and transcribe customer conversations.</li>
          <li>Remove sensitive information before analysis.</li>
          <li>Group recurring issues and identify evidence.</li>
          <li>Review recommendations with a human decision maker.</li>
          <li>Assign actions and measure outcomes.</li>
        </ol>
        <p className="notice">
          {apiMode
            ? "Recordings are processed by local models. Review transcript accuracy and evidence before acting."
            : "This preview uses synthetic conversations and sample recommendations. It does not transcribe audio or run AI models."}
        </p>
        <button className="button secondary" onClick={() => setAbout(false)}>
          <X size={16} />
          Got it
        </button>
      </Modal>
    </div>
  );
}
function BadgeDot() {
  return <span className="online-dot" aria-hidden="true" />;
}
