/**
 * Antigravity Shield — AI Proxy & Fleet Management Engine
 * Repository: https://github.com/antigravity-hub/Antigravity-Shield
 */
import React from "react";
import ReactDOM from "react-dom/client";
import App from './App';
import './i18n'; // Import i18n config
import "./App.css";

import { isTauri } from "./utils/env";
// Explicitly invoke Rust command to display window on launch
// Used in conjunction with visible:false to prevent startup white-screen flash
if (isTauri()) {
  import("@tauri-apps/api/core").then(({ invoke }) => {
    invoke("show_main_window").catch(console.error);
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />

  </React.StrictMode>,
);
