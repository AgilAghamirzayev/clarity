import { spotlightCount } from "./spotlight-steps";
import { Context, type Status } from "./context";
import { useState, useCallback, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { apiMode, guestMode } from "../../data/api";

const stepKey = "clarity:onboarding:spotlight-step:v2";
const storageKey = "clarity:onboarding:v1";
function initialStatus(): Status {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "touring" || saved === "dismissed" || saved === "completed")
      return saved;
  } catch {
    // The tour also works when browser storage is unavailable.
  }
  return guestMode || !apiMode ? "welcome" : "dismissed";
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [stepIndex, setStepIndex] = useState(() => {
    try {
      const value = Number(localStorage.getItem(stepKey));
      return Number.isInteger(value) && value >= 0 && value < spotlightCount
        ? value
        : 0;
    } catch {
      return 0;
    }
  });
  const goToStep = useCallback((index: number) => {
    const next = Math.max(0, Math.min(spotlightCount - 1, index));
    setStepIndex(next);
    try {
      localStorage.setItem(stepKey, String(next));
    } catch {
      /* This visit still retains progress. */
    }
  }, []);
  const [completionOpen, setCompletionOpen] = useState(false);
  const navigate = useNavigate();
  const save = useCallback((next: Status) => {
    setStatus(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* Keep this visit usable without storage. */
    }
  }, []);
  const dismiss = useCallback(() => save("dismissed"), [save]);
  const finish = useCallback(() => {
    save("completed");
    setCompletionOpen(true);
  }, [save]);
  return (
    <Context.Provider
      value={{
        status,
        stepIndex,
        goToStep,
        completionOpen,
        start: () => {
          goToStep(0);
          save("touring");
          setCompletionOpen(false);
          navigate("/");
        },
        dismiss,
        finish,
        closeCompletion: () => setCompletionOpen(false),
      }}
    >
      {children}
    </Context.Provider>
  );
}
