import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { registerServiceWorker } from "./lib/pushClient.js";

// SW-ni erkən register edək (push gələndə hazır olsun)
registerServiceWorker().catch(() => {});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);