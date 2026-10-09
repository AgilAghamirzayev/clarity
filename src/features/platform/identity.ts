import { createContext, useContext } from "react";
export interface Identity {
  id: string;
  tenant: string;
  email: string;
  role: "ADMIN" | "ANALYST" | "REVIEWER" | "VIEWER";
}
export const IdentityContext = createContext<Identity | null>(null);
export const useIdentity = () => useContext(IdentityContext);
