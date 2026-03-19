import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../admin/AdminDashboard.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const NAV_ITEMS = [
  { label: "Dashboard", icon: "⊞", path: "/teacher" },
  { label: "Evaluation", icon: "📋", path: "/evaluation", active: true},
  { label: "View Results", icon: "📊", path: "/view-mark" },
  { label: "Reference Answer", icon: "📖", path: "/reference-answer" },
  { label: "Revaluation", icon: "🔄", path: "/revaluation" },
  { label: "My Classes",icon:"🏫",path:"/courseclass"},
];


/* ── Buffering Modal ── */
const EvaluatingModal = ({ message }) => (
  <div className="eval-overlay">
    <div className="eval-modal">
      <div className="eval-spinner">
        <div className="eval-ring" />
        <div className="eval-ring eval-ring--2" />
        <div className="eval-ring eval-ring--3" />
        <span className="eval-icon">📋</span>
      </div>
      <h3 className="eval-title">{message || "Processing…"}</h3>
      <p className="eval-subtitle">Please wait while SAGE processes the answer scripts…</p>
      <div className="eval-progress">
        <div className="eval-progress-bar" />
      </div>
    </div>
  </div>
);

const UploadScripts = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [teacher,      setTeacher]      = useState(null);
  const [files,        setFiles]        = useState([]);
  const [uploading,    setUploading]    = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [dragOver,     setDragOver]     = useState(false);
  const [evalSuccess,  setEvalSuccess]  = useState(false);

  const fileInputRef   = useRef(null);
  const folderInputRef = useRef(null);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("user"));
    if (stored) setTeacher(stored);
  }, []);

  const exam = location.state?.exam ?? null;

  // Guard: redirect if no exam or not Active
  useEffect(() => {
    if (!exam) {
      console.warn("No exam in state — redirecting to /evaluation.");
      navigate("/evaluation", { replace: true });
      return;
    }
    if (exam.status !== "Active") {
      alert("Exam must be Active before uploading scripts.");
      navigate("/upload-materials", { state: { exam }, replace: true });
    }
  }, [exam, navigate]);

  // ── File helpers ──────────────────────────────────────────────────────────
  const addFiles = (incoming) => {
    const valid = Array.from(incoming).filter(
      (f) => f.type === "application/pdf" || f.type.startsWith("image/")
    );
    if (valid.length === 0) {
      alert("Only PDF and image files are accepted.");
      return;
    }
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.webkitRelativePath || f.name));
      return [...prev, ...valid.filter((f) => !existing.has(f.webkitRelativePath || f.name))];
    });
  };

  const handleFileInput = (e) => addFiles(e.target.files);
  const handleDrop      = (e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); };
  const handleDragOver  = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = ()  => setDragOver(false);

  const removeFile = (target) =>
    setFiles((prev) =>
      prev.filter((f) => (f.webkitRelativePath || f.name) !== (target.webkitRelativePath || target.name))
    );

  const formatSize = (bytes) => {
    if (bytes < 1024)    return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  // ── Submit: upload scripts → then evaluate ────────────────────────────────
  const handleSubmit = async () => {
    if (files.length === 0) { alert("Please upload at least one answer script ❌"); return; }
    if (!exam)              { alert("Exam details missing ❌"); return; }

    setUploading(true);
    setIsEvaluating(true);

    try {
      // ── Step 1: Upload answer scripts ──────────────────────────────────────
      setModalMessage("Uploading Scripts…");

      const formData = new FormData();
      files.forEach((f) =>
        formData.append("answer_scripts", f, f.webkitRelativePath || f.name)
      );
      formData.append("course",    exam.course);
      formData.append("examType",  exam.examType);
      formData.append("classId",   exam.classId);
      formData.append("examClass", exam.examClass ?? exam.classId);
      formData.append("examId",    exam._id);

      const uploadRes = await fetch(
        `${API_BASE}/api/uploadscript/answer-scripts`,
        { method: "POST", body: formData }
      );

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed ❌");
      }

      const uploadData   = await uploadRes.json();
      const uploadedKeys = uploadData.uploaded || uploadData.uploadedFiles || [];
      console.log("✅ Scripts uploaded:", uploadedKeys);

      // ── Step 2: Trigger evaluation ─────────────────────────────────────────
      setModalMessage("Evaluating Answer Scripts…");

      const evalRes = await fetch(`${API_BASE}/api/evaluation/run`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId:    exam.classId,
          course:     exam.course,
          examType:   exam.examType,
          evalType:   exam.evalType,
          scriptKeys: uploadedKeys,
        }),
      });

      if (!evalRes.ok) {
        const err = await evalRes.json().catch(() => ({}));
        throw new Error(err.error || "Evaluation failed ❌");
      }

      const evalData = await evalRes.json();
      console.log("✅ Evaluation complete:", evalData);

      // ── Step 3: Show success screen (no redirect) ─────────────────────────
      setEvalSuccess(true);

    } catch (err) {
      console.error(err);
      alert(err.message || "Upload failed ❌");
    } finally {
      setUploading(false);
      setIsEvaluating(false);
      setModalMessage("");
    }
  };

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="container">
      {isEvaluating && <EvaluatingModal message={modalMessage} />}

      {/* Sidebar */}
      <aside className="sidebar">
        <h2 className="logo">SAGE</h2>
        <div className="user-info">
          <div className="avatar">{teacher?.name ? teacher.name.charAt(0).toUpperCase() : "T"}</div>
          <div className="user-details">
            <h4>{teacher?.name || "Teacher"}</h4>
            <p>Teacher</p>
          </div>
        </div>
        <ul className="sidebar-cards">
          {NAV_ITEMS.map(({ label, icon, path, active }) => (
            <li key={label} className={active ? "active" : ""} onClick={() => navigate(path)}>
              <span className="nav-icon">{icon}</span>{label}
            </li>
          ))}
        </ul>
      </aside>

      {/* Main */}
      <main className="main">
        <div className="logout-container">
          <button
            className="com-btn logout-btn-top"
            onClick={() => navigate("/evaluation")}
          >
            ↩ Back
          </button>
        </div>

        {/* ── Success Screen ── */}
        {evalSuccess ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "70vh", gap: "16px", textAlign: "center" }}>
            <div style={{ fontSize: "64px" }}>✅</div>
            <h2 style={{ fontSize: "24px", fontWeight: "700" }}>Evaluation Complete!</h2>
            <p style={{ color: "#888", maxWidth: "400px" }}>
              All answer scripts have been uploaded and evaluated successfully.
            </p>
            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
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

        ) : (

          /* ── Upload Screen ── */
          <div>
            <h1 className="page-title">Upload <span>Answer Scripts</span></h1>

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
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {/* Hidden: individual PDF picker */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                style={{ display: "none" }}
                onChange={handleFileInput}
              />

              {/* Hidden: folder picker */}
              <input
                ref={folderInputRef}
                type="file"
                webkitdirectory="true"
                directory=""
                multiple
                style={{ display: "none" }}
                onChange={handleFileInput}
              />

              <span className="us-drop-icon">📄</span>
              <p className="us-drop-title">Drop answer scripts or folders here</p>
              <p className="us-drop-sub">or use the buttons below · PDF and images accepted</p>

              <div style={{ display: "flex", gap: "12px", marginTop: "12px", justifyContent: "center" }}>
                <button
                  type="button"
                  className="com-btn primary-btn"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                >
                  📄 Select PDFs
                </button>
                <button
                  type="button"
                  className="com-btn view-btn"
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
                      >✕</button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Submit */}
            <div className="ev-proceed-row" style={{ marginTop: "24px" }}>
              <button
                className="com-btn primary-btn ev-proceed-btn"
                onClick={handleSubmit}
                disabled={files.length === 0 || uploading}
              >
                {uploading
                  ? "Processing…"
                  : `Submit ${files.length > 0 ? `(${files.length})` : ""} Scripts →`}
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default UploadScripts;
