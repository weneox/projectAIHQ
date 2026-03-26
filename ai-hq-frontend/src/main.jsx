import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import {
  isServiceWorkerEnabled,
  registerServiceWorker,
} from "./lib/pushClient.js";

if (isServiceWorkerEnabled()) {
  registerServiceWorker().catch(() => {});
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
