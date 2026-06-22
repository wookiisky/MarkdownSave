import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { OptionsApp } from "./App";

const rootElement = document.getElementById("root");

if (rootElement !== null) {
  createRoot(rootElement).render(
    <StrictMode>
      <OptionsApp />
    </StrictMode>
  );
}
