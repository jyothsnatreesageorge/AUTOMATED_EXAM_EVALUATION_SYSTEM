import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

// ─────────────────────────────────────────────────────────────────────────────
// Apply the saved theme to <html> SYNCHRONOUSLY before React mounts.
// This is the single line that makes the whole system work:
//   • Login.jsx writes  → localStorage key "sage-theme"  + data-theme on <html>
//   • This line reads   → localStorage key "sage-theme"  + sets data-theme on <html>
//   • Login.css uses    → [data-theme="light"] / [data-theme="dark"] selectors
// Without this, <html> has no data-theme on load so :root (dark) always wins.
// ─────────────────────────────────────────────────────────────────────────────
const savedTheme = localStorage.getItem("sage-theme") || "light";
document.documentElement.setAttribute("data-theme", savedTheme);

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);