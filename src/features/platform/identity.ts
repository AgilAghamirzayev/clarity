import { createContext, useContext } from "react";
export interface Identity {
  id: string;
  tenant: string;
  email: string;
  role: "ADMIN" | "ANALYST" | "REVIEWER" | "VIEWER" | "DEMO";
  expiresAt?: string;
}
export const demoIdentity: Identity = {
  id: "demo-reviewer",
  tenant: "demo",
  email: "demo@clarity.local",
  role: "REVIEWER",
};
export const IdentityContext = createContext<Identity | null>(null);
export const useIdentity = () => useContext(IdentityContext);
