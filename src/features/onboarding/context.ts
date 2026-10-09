import { createContext, useContext } from "react";

export type Status = "welcome" | "touring" | "dismissed" | "completed";
type TourContext = {
  status: Status;
  stepIndex: number;
  goToStep: (index: number) => void;
  completionOpen: boolean;
  start: () => void;
  dismiss: () => void;
  finish: () => void;
  closeCompletion: () => void;
};
export const Context = createContext<TourContext | null>(null);

export function useOnboarding() {
  const context = useContext(Context);
  if (!context) throw new Error("Onboarding requires its provider");
  return context;
}
