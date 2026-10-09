import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Inbox, RotateCcw } from "lucide-react";
import clsx from "clsx";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span
      className={clsx(
        "badge",
        `badge-${tone.toLowerCase().replaceAll(" ", "-")}`,
      )}
    >
      {children}
    </span>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("panel", className)}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function EmptyState({
  title = "No results found",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state" role="status">
      <Inbox size={28} />
      <h2>{title}</h2>
      <p>{children ?? "Try a different search or clear your filters."}</p>
    </div>
  );
}
export function LoadingState() {
  return (
    <div className="loading" role="status" aria-label="Loading workspace">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
      <span>Loading workspace…</span>
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <div className="empty-state" role="alert">
      <h2>We couldn’t load this view</h2>
      <p>{error.message}</p>
      <div className="button-row">
        <button className="button" onClick={retry}>
          <RotateCcw size={16} />
          Try again
        </button>
        <Link className="button secondary" to="/settings">
          Workspace settings
        </Link>
      </div>
    </div>
  );
}
export function TextLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <Link className="text-link" to={to}>
      {children}
      <ArrowUpRight size={15} />
    </Link>
  );
}
