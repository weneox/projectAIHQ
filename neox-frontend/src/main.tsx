import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "@vuer-ai/react-helmet-async";

import App from "./App.tsx";
import "./index.css";
import "./i18n";

const rootEl = document.getElementById("root");

if (!rootEl) {
  throw new Error("Root element (#root) tapılmadı");
}

createRoot(rootEl).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
);
