import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PopupApp } from "./App";

const rootElement = document.getElementById("root");

if (rootElement !== null) {
  createRoot(rootElement).render(
    <StrictMode>
      <PopupApp />
    </StrictMode>
  );
}
