import { ArrowRight, Building2, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Modal } from "../../components/Modal";
import { apiMode, guestMode } from "../../data/api";
import { roleLabels } from "../../domain/presentation";
import { useIdentity } from "./identity";

export function AccountPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const user = useIdentity();
  const isDemo = guestMode || !apiMode;
  const name = isDemo ? "Demo account" : user?.email || "Your account";
  const expiry = user?.expiresAt ? new Date(user.expiresAt) : null;
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Your account"
      description="Your profile and workspace access."
    >
      <div className="account-panel">
        <div className="account-identity">
          <span className="account-avatar" aria-hidden="true">
            {isDemo ? "DE" : user?.email.slice(0, 2).toUpperCase() || "CL"}
          </span>
          <div>
            <h3>{name}</h3>
            <span className="account-access">
              <ShieldCheck size={15} aria-hidden="true" />
              {isDemo ? "No sign-in required" : "Signed in"}
            </span>
          </div>
        </div>
        <div className="account-workspace">
          <Building2 size={22} aria-hidden="true" />
          <div>
            <span>Workspace</span>
            <strong>Customer Intelligence</strong>
          </div>
        </div>
        <dl className="account-facts">
          <div>
            <dt>Access</dt>
            <dd>
              {guestMode
                ? "Demo participant"
                : user
                  ? roleLabels[user.role]
                  : "Local preview"}
            </dd>
          </div>
          <div>
            <dt>Environment</dt>
            <dd>
              {guestMode ? "Live demo" : apiMode ? "Local AI" : "Demo preview"}
            </dd>
          </div>
          {guestMode && expiry && !Number.isNaN(expiry.getTime()) && (
            <div>
              <dt>Session expires</dt>
              <dd>
                <time dateTime={expiry.toISOString()}>
                  {new Intl.DateTimeFormat("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZoneName: "short",
                  }).format(expiry)}
                </time>
              </dd>
            </div>
          )}
        </dl>
        {isDemo && (
          <p className="account-note">
            {guestMode
              ? "Explore sample calls, upload recordings and review AI insights in your own demo workspace."
              : "Explore sample conversations and recommendations. Your demo decisions are saved in this browser."}
          </p>
        )}
        <Link
          className="button account-settings"
          to="/settings"
          onClick={() => onOpenChange(false)}
        >
          Workspace settings <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </Modal>
  );
}
