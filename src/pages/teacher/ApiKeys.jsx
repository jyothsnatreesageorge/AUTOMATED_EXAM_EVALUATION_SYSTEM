import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../admin/AdminDashboard.css";

const NAV_ITEMS = [
  { label: "Dashboard",        icon: "⊞", path: "/teacher" },
  { label: "Evaluation",       icon: "📋", path: "/evaluation" },
  { label: "View Results",     icon: "📊", path: "/view-mark" },
  { label: "Reference Answer", icon: "📖", path: "/reference-answer" },
  { label: "Revaluation",      icon: "🔄", path: "/revaluation" },
  { label: "My Classes",       icon: "🏫", path: "/courseclass" },
  { label: "API Keys",         icon: "🔑", path: "/api-keys", active: true },
];

const PROVIDERS = [
  {
    id:          "gemini",
    label:       "Google Gemini",
    icon:        "✨",
    description: "Gemini 2.5 Flash for multi-modal evaluation",
    placeholder: "AIzaSy…",
    docsUrl:     "https://aistudio.google.com/app/apikey",
  },
];

// ── thin API helper ──────────────────────────────────────────────────────────
const BASE = import.meta.env.VITE_API_URL ?? "";

const api = (path, opts = {}) => {
  const token = localStorage.getItem("token");
  return fetch(`${BASE}/api/keys${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
};

const ApiKeys = () => {
  const navigate  = useNavigate();
  const [teacher] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")) || null; }
    catch { return null; }
  });

  // keyStatus: { gemini: true/false } — from backend (never the real key)
  const [keyStatus,    setKeyStatus]    = useState({});
  const [inputVal,     setInputVal]     = useState({});   // what's typed right now
  const [visible,      setVisible]      = useState({});
  const [saving,       setSaving]       = useState({});
  const [saveResult,   setSaveResult]   = useState({});   // { ok, msg }
  const [deleting,     setDeleting]     = useState({});
  const [testing,      setTesting]      = useState({});
  const [testResult,   setTestResult]   = useState({});
  const [loadError,    setLoadError]    = useState(null);
  const [activeProvider, setActiveProvider] = useState(PROVIDERS[0].id);

  // ── Load which keys are configured (true/false only) ──
  const fetchStatus = useCallback(async () => {
    try {
      const res  = await api("/");
      if (!res.ok) throw new Error("Failed to load key status");
      const data = await res.json();
      setKeyStatus(data);   // e.g. { gemini: true }
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // ── Save key to backend → AWS Secrets Manager ──
  const handleSave = async (id) => {
    const key = inputVal[id]?.trim();
    if (!key) return;

    setSaving(prev  => ({ ...prev,  [id]: true  }));
    setSaveResult(prev => ({ ...prev, [id]: null }));

    try {
      const res  = await api("/", {
        method: "POST",
        body:   JSON.stringify({ key }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Save failed");

      setSaveResult(prev => ({ ...prev, [id]: { ok: true, msg: "Key saved to AWS ✓" } }));
      setInputVal(prev  => ({ ...prev, [id]: "" }));      // clear field after save
      await fetchStatus();                                  // refresh status badges
    } catch (err) {
      setSaveResult(prev => ({ ...prev, [id]: { ok: false, msg: err.message } }));
    } finally {
      setSaving(prev => ({ ...prev, [id]: false }));
      setTimeout(() => setSaveResult(prev => ({ ...prev, [id]: null })), 4000);
    }
  };

  // ── Delete key from backend → removes from AWS ──
  const handleDelete = async (id) => {
    if (!window.confirm("Remove this API key? This cannot be undone.")) return;

    setDeleting(prev => ({ ...prev, [id]: true }));
    try {
      const res  = await api("/", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Delete failed");
      await fetchStatus();
    } catch (err) {
      alert(`Failed to remove key: ${err.message}`);
    } finally {
      setDeleting(prev => ({ ...prev, [id]: false }));
    }
  };

  // ── Test key via backend ──
  const handleTest = async (id) => {
    setTesting(prev    => ({ ...prev, [id]: true  }));
    setTestResult(prev => ({ ...prev, [id]: null  }));

    try {
      const res  = await api("/test", { method: "POST" });
      const data = await res.json();
      setTestResult(prev => ({
        ...prev,
        [id]: { ok: data.ok, msg: data.message },
      }));
    } catch (err) {
      setTestResult(prev => ({
        ...prev,
        [id]: { ok: false, msg: "Test request failed" },
      }));
    } finally {
      setTesting(prev => ({ ...prev, [id]: false }));
      setTimeout(() => setTestResult(prev => ({ ...prev, [id]: null })), 6000);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    navigate("/", { replace: true });
  };

  const activeProv = PROVIDERS.find(p => p.id === activeProvider);

  return (
    <div className="container">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <h2 className="logo">SAGE</h2>

        <div className="user-info">
          <div className="avatar">{teacher?.name?.charAt(0)}</div>
          <div className="user-details">
            <h4>{teacher?.name}</h4>
            <p>Teacher</p>
          </div>
        </div>

        <ul className="sidebar-cards">
          {NAV_ITEMS.map(({ label, icon, path, active }) => (
            <li
              key={label}
              className={active ? "active" : ""}
              onClick={() => navigate(path)}
            >
              <span className="nav-icon">{icon}</span>
              {label}
            </li>
          ))}
        </ul>
      </aside>

      {/* ── Main ── */}
      <main className="main">
        <div className="logout-container">
          <button className="com-btn logout-btn-top" onClick={handleLogout}>
            ↩ Logout
          </button>
        </div>

        <h1 className="page-title">
          API <span>Key Settings</span>
        </h1>

        {/* ── info banner ── */}
        <div className="api-info-banner">
          <span className="api-info-icon">ℹ️</span>
          <p>
            Your API keys are encrypted and stored in <strong>AWS Secrets Manager</strong>.
            They are never exposed in the browser after saving. SAGE will automatically
            use the shared key pool first and fall back to your personal key when needed.
          </p>
        </div>

        {loadError && (
          <div className="api-test-result api-test-result--err" style={{ marginBottom: 16 }}>
            ⚠️ Could not load key status: {loadError}
          </div>
        )}

        {/* ── provider tab bar ── */}
        <div className="api-tab-bar">
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              className={`api-tab ${activeProvider === p.id ? "api-tab--active" : ""}`}
              onClick={() => setActiveProvider(p.id)}
            >
              <span>{p.icon}</span>
              {p.label}
              {keyStatus[p.id] && (
                <span className="api-tab-dot" title="Key saved" />
              )}
            </button>
          ))}
        </div>

        {/* ── active provider card ── */}
        {activeProv && (
          <div className="api-provider-card">

            {/* header */}
            <div className="api-card-header">
              <span className="api-card-icon">{activeProv.icon}</span>
              <div>
                <h2 className="api-card-title">{activeProv.label}</h2>
                <p className="api-card-desc">{activeProv.description}</p>
              </div>
              <a
                href={activeProv.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="api-docs-link"
              >
                Get API Key ↗
              </a>
            </div>

            {/* current status pill */}
            <div style={{ marginBottom: 16 }}>
              {keyStatus[activeProv.id] ? (
                <span className="api-status-pill api-status-pill--set">
                  🔒 Key stored in AWS — enter a new key below to replace it
                </span>
              ) : (
                <span className="api-status-pill api-status-pill--missing">
                  ⚠️ No personal key — SAGE will use shared pool only
                </span>
              )}
            </div>

            {/* key input row */}
            <div className="api-input-group">
              <label className="api-label" htmlFor={`key-${activeProv.id}`}>
                {keyStatus[activeProv.id] ? "Replace API Key" : "API Key"}
              </label>
              <div className="api-input-row">
                <input
                  id={`key-${activeProv.id}`}
                  className="api-input"
                  type={visible[activeProv.id] ? "text" : "password"}
                  value={inputVal[activeProv.id] || ""}
                  onChange={e => setInputVal(prev => ({ ...prev, [activeProv.id]: e.target.value }))}
                  placeholder={activeProv.placeholder}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  className="api-icon-btn"
                  title={visible[activeProv.id] ? "Hide" : "Show"}
                  onClick={() =>
                    setVisible(prev => ({ ...prev, [activeProv.id]: !prev[activeProv.id] }))
                  }
                >
                  {visible[activeProv.id] ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* save / test result feedback */}
            {saveResult[activeProv.id] && (
              <div
                className={`api-test-result ${
                  saveResult[activeProv.id].ok
                    ? "api-test-result--ok"
                    : "api-test-result--err"
                }`}
              >
                {saveResult[activeProv.id].msg}
              </div>
            )}

            {testResult[activeProv.id] && (
              <div
                className={`api-test-result ${
                  testResult[activeProv.id].ok
                    ? "api-test-result--ok"
                    : "api-test-result--err"
                }`}
              >
                {testResult[activeProv.id].msg}
              </div>
            )}

            {/* actions */}
            <div className="api-actions">
              {/* Test — only available when a key is already stored */}
              {keyStatus[activeProv.id] && (
                <button
                  className="com-btn api-btn-test"
                  disabled={testing[activeProv.id]}
                  onClick={() => handleTest(activeProv.id)}
                >
                  {testing[activeProv.id] ? "Testing…" : "🔌 Test Connection"}
                </button>
              )}

              {/* Save — only when something is typed */}
              <button
                className="com-btn api-btn-save"
                disabled={!inputVal[activeProv.id]?.trim() || saving[activeProv.id]}
                onClick={() => handleSave(activeProv.id)}
              >
                {saving[activeProv.id]
                  ? "Saving…"
                  : keyStatus[activeProv.id]
                    ? "🔄 Replace Key"
                    : "💾 Save Key"}
              </button>

              {/* Remove — only when a key is stored */}
              {keyStatus[activeProv.id] && (
                <button
                  className="com-btn api-btn-clear"
                  disabled={deleting[activeProv.id]}
                  onClick={() => handleDelete(activeProv.id)}
                >
                  {deleting[activeProv.id] ? "Removing…" : "🗑 Remove Key"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── configured providers overview ── */}
        <div className="api-overview">
          <h3 className="api-overview-title">Configured Providers</h3>
          <div className="api-overview-grid">
            {PROVIDERS.map(p => {
              const hasKey = !!keyStatus[p.id];
              return (
                <div
                  key={p.id}
                  className={`api-overview-item ${hasKey ? "api-overview-item--set" : "api-overview-item--missing"}`}
                  onClick={() => setActiveProvider(p.id)}
                >
                  <span className="api-overview-icon">{p.icon}</span>
                  <div className="api-overview-info">
                    <span className="api-overview-name">{p.label}</span>
                    <span className="api-overview-status">
                      {hasKey ? "✓ Stored in AWS" : "Not configured"}
                    </span>
                  </div>
                  <span className={`api-status-dot ${hasKey ? "api-status-dot--on" : "api-status-dot--off"}`} />
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ApiKeys;
