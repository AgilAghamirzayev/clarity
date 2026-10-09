import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "@fontsource-variable/roboto/wght.css";
import "./styles.css";
import "./experience.css";
import "./features/onboarding/onboarding.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
