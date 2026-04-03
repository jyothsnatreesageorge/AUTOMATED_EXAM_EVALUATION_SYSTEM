import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../admin/AdminDashboard.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const BATCH_SIZE = 10;

const NAV_ITEMS = [
  { label: "Dashboard",        icon: "⊞", path: "/teacher" },
  { label: "Evaluation",       icon: "📋", path: "/evaluation", active: true },
  { label: "View Results",     icon: "📊", path: "/view-mark" },
  { label: "Reference Answer", icon: "📖", path: "/reference-answer" },
  { label: "Revaluation",      icon: "🔄", path: "/revaluation" },
  { label: "My Classes",       icon: "🏫", path: "/courseclass" },
];

/* ── Uploading modal (shown only during batch upload) ── */
const UploadingModal = ({ batchProgress }) => (
  <div className="eval-overlay">
    <div className="eval-modal">
      <div className="eval-spinner">
        <div className="eval-ring" />
        <div className="eval-ring eval-ring--2" />
        <div className="eval-ring eval-ring--3" />
        <span className="eval-icon">📋</span>
      </div>
      <h3 className="eval-title">Uploading scripts…</h3>
      <p className="eval-subtitle">Sending files to server in batches</p>
      {batchProgress && (
        <p className="eval-subtitle" style={{ fontWeight: 500 }}>
          Batch {batchProgress.current} of {batchProgress.total}
        </p>
      )}
    </div>
  </div>
);

/* ── Main component ── */
const UploadScripts = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [teacher,       setTeacher]       = useState(null);
  const [files,         setFiles]         = useState([]);
  const [phase,         setPhase]         = useState("idle"); // idle | uploading | done | error
  const [batchProgress, setBatchProgress] = useState(null);   // { current, total }
  const [errorMsg,      setErrorMsg]      = useState("");
  const [dragOver,      setDragOver]      = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  const fileInputRef   = useRef(null);
  const folderInputRef = useRef(null);

  const exam = location.state?.exam ?? null;

  /* ── Load teacher from localStorage ── */
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("user") || "null");
    if (stored) setTeacher(stored);
  }, []);

  /* ── Guard: must have an active exam ── */
  useEffect(() => {
    if (!exam) { navigate("/evaluation", { replace: true }); return; }
    if (exam.status !== "Active") {
      alert("Exam must be Active before uploading scripts.");
      navigate("/upload-materials", { state: { exam }, replace: true });
    }
  }, [exam, navigate]);

  /* ── Reset state when exam changes (new session) ── */
  useEffect(() => {
    setPhase("idle");
    setFiles([]);
    setBatchProgress(null);
    setErrorMsg("");
    setUploadedCount(0);
  }, [exam?._id]);

  /* ── File helpers ── */
  const addFiles = (incoming) => {
    const valid = Array.from(incoming).filter(
      (f) => f.type === "application/pdf" || f.type.startsWith("image/")
    );
    if (!valid.length) { alert("Only PDF and image files are accepted."); return; }
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => f.webkitRelativePath || f.name));
      return [...prev, ...valid.filter((f) => !seen.has(f.webkitRelativePath || f.name))];
    });
  };

  const removeFile = (target) =>
    setFiles((prev) =>
      prev.filter(
        (f) => (f.webkitRelativePath || f.name) !== (target.webkitRelativePath || target.name)
      )
    );

  const formatSize = (b) =>
    b < 1024
      ? `${b} B`
      : b < 1_048_576
      ? `${(b / 1024).toFixed(1)} KB`
      : `${(b / 1_048_576).toFixed(1)} MB`;

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!files.length) { alert("Please upload at least one answer script ❌"); return; }
    if (!exam)         { alert("Exam details missing ❌"); return; }

    setPhase("uploading");
    setErrorMsg("");

    try {
      /* Step 1: Upload in batches */
      const fileArr = Array.from(files);
      const batches = [];
      for (let i = 0; i < fileArr.length; i += BATCH_SIZE)
        batches.push(fileArr.slice(i, i + BATCH_SIZE));

      const collectedKeys = [];

      for (let i = 0; i < batches.length; i++) {
        setBatchProgress({ current: i + 1, total: batches.length });

        const fd = new FormData();
        fd.append("course",   exam.course);
        fd.append("examType", exam.examType);
        fd.append("classId",  exam.classId);
        fd.append("examId",   exam._id);
        fd.append("evalType", exam.evalType || "");
        batches[i].forEach((f) =>
          fd.append("answer_scripts", f, f.webkitRelativePath || f.name)
        );

        const res = await fetch(`${API_BASE}/api/uploadscript/answer-scripts`, {
          method: "POST",
          body: fd,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Batch ${i + 1} upload failed ❌`);
        }

        const data = await res.json();
        collectedKeys.push(...(data.uploaded || data.uploadedFiles || []));
      }

      setUploadedCount(collectedKeys.length);
      setBatchProgress(null);

      /* Step 2: Trigger evaluation — fire and forget, no await, no polling */
      fetch(`${API_BASE}/api/evaluation/run`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId:    exam.classId,
          course:     exam.course,
          examType:   exam.examType,
          evalType:   exam.evalType,
          scriptKeys: collectedKeys,
        }),
      }).catch((e) => console.warn("Eval trigger error (non-fatal):", e));

      /* Step 3: Immediately show success — backend evaluates independently */
      setPhase("done");

    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
      setBatchProgress(null);
      setPhase("error");
    }
  };

  const isUploading = phase === "uploading";
  const isDone      = phase === "done";
  const isError     = phase === "error";

  /* ── JSX ── */
  return (
    <div className="container">

      {/* Uploading modal — only shown during active batch upload */}
      {isUploading && (
        <UploadingModal batchProgress={batchProgress} />
      )}

      {/* Sidebar */}
      <aside className="sidebar">
        <h2 className="logo">SAGE</h2>
        <div className="user-info">
          <div className="avatar">
            {teacher?.name ? teacher.name.charAt(0).toUpperCase() : "T"}
          </div>
          <div className="user-details">
            <h4>{teacher?.name || "Teacher"}</h4>
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
              <span className="nav-icon">{icon}</span>{label}
            </li>
          ))}
        </ul>
      </aside>

      {/* Main */}
      <main className="main">

        {/* ── Success screen ── */}
        {isDone ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "70vh",
              gap: 16,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 64 }}>✅</div>
            <h2 style={{ fontSize: 24, fontWeight: 700 }}>
              Scripts Uploaded Successfully!
            </h2>

            {/* Background evaluation notice */}
            <div
              style={{
                background: "var(--color-background-secondary)",
                border: "1px solid var(--color-border-primary)",
                borderRadius: 12,
                padding: "16px 24px",
                maxWidth: 440,
              }}
            >
              <p style={{ margin: 0, fontSize: 15, color: "var(--color-text-primary)" }}>
                ⚙️ <strong>Evaluation is running in the background.</strong>
              </p>
              <p
                style={{
                  margin: "8px 0 0",
                  color: "var(--color-text-secondary)",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                {uploadedCount} script{uploadedCount !== 1 ? "s" : ""} queued for{" "}
                <strong>{exam?.course}</strong>. Check results in a few minutes
                — you can safely leave this page.
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button
                className="com-btn primary-btn"
                onClick={() => navigate("/view-mark")}
              >
                📊 View Results
              </button>
              <button
                className="com-btn view-btn"
                onClick={() => navigate("/evaluation")}
              >
                ← Back to Evaluation
              </button>
            </div>
          </div>

        ) : isError ? (
          /* ── Error screen ── */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "70vh",
              gap: 16,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 64 }}>❌</div>
            <h2 style={{ fontSize: 24, fontWeight: 700 }}>Upload Failed</h2>
            <p
              style={{
                color: "var(--color-text-danger)",
                maxWidth: 400,
                fontSize: 14,
              }}
            >
              {errorMsg}
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button
                className="com-btn primary-btn"
                onClick={() => {
                  setPhase("idle");
                  setFiles([]);
                }}
              >
                ↩ Try Again
              </button>
              <button
                className="com-btn view-btn"
                onClick={() => navigate("/evaluation")}
              >
                ← Back to Evaluation
              </button>
            </div>
          </div>

        ) : (
          /* ── Upload screen ── */
          <div>
            <div className="logout-container">
              <button
                className="com-btn logout-btn-top"
                onClick={() => navigate("/evaluation")}
              >
                ↩ Back
              </button>
            </div>

            <h1 className="page-title">
              Upload <span>Answer Scripts</span>
            </h1>

            {/* Exam banner */}
            {exam && (
              <div className="us-exam-banner">
                <span className="us-banner-icon">📋</span>
                <div className="us-banner-info">
                  <span className="us-banner-course">{exam.course}</span>
                  <span className="us-banner-meta">
                    {exam.classId} · {exam.examType} · <code>{exam._id}</code>
                  </span>
                </div>
                <span className="us-banner-tag">Answer Scripts Only</span>
              </div>
            )}

            {/* Drop zone */}
            <div
              className={`us-dropzone ${dragOver ? "drag-over" : ""}`}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                addFiles(e.dataTransfer.files);
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                style={{ display: "none" }}
                onChange={(e) => addFiles(e.target.files)}
              />
              <input
                ref={folderInputRef}
                type="file"
                webkitdirectory="true"
                directory=""
                multiple
                style={{ display: "none" }}
                onChange={(e) => addFiles(e.target.files)}
              />

              <span className="us-drop-icon">📄</span>
              <p className="us-drop-title">Drop answer scripts or folders here</p>
              <p className="us-drop-sub">
                PDF and images accepted · large batches sent in groups of {BATCH_SIZE}
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginTop: 12,
                  justifyContent: "center",
                }}
              >
                <button
                  className="com-btn primary-btn"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                >
                  📄 Select PDFs
                </button>
                <button
                  className="com-btn primary-btn"
                  onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}
                >
                  📁 Select Folder
                </button>
              </div>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="us-file-list">
                {files.map((f) => {
                  const name = f.webkitRelativePath || f.name;
                  return (
                    <div key={name} className="us-file-row">
                      <span className="us-file-icon">📄</span>
                      <span className="us-file-name">{name}</span>
                      <span className="us-file-size">{formatSize(f.size)}</span>
                      <button
                        className="us-file-remove"
                        onClick={() => removeFile(f)}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Submit button */}
            <div className="ev-proceed-row" style={{ marginTop: 24 }}>
              <button
                className="com-btn primary-btn ev-proceed-btn"
                onClick={handleSubmit}
                disabled={!files.length || isUploading}
              >
                {`Submit${files.length ? ` (${files.length})` : ""} Scripts →`}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default UploadScripts;
