import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../admin/AdminDashboard.css";

const NAV_ITEMS = [
  { label: "Dashboard", icon: "⊞", path: "/teacher" },
  { label: "Evaluation", icon: "📋", path: "/evaluation", active: true },
  { label: "View Results", icon: "📊", path: "/view-mark" },
  { label: "Reference Answer", icon: "📖", path: "/reference-answer" },
  { label: "Revaluation", icon: "🔄", path: "/revaluation" },
  {label:"My Classes",icon:"🏫",path:"/courseclass"},
];
const API_BASE = import.meta.env.VITE_API_BASE_URL;
/* ── Buffering Modal ── */
const EvaluatingModal = () => (
  <div className="eval-overlay">
    <div className="eval-modal">
      <div className="eval-spinner">
        <div className="eval-ring" />
        <div className="eval-ring eval-ring--2" />
        <div className="eval-ring eval-ring--3" />
        <span className="eval-icon">📋</span>
      </div>
      <h3 className="eval-title">Evaluating Answers</h3>
      <p className="eval-subtitle">Please wait while SAGE processes the submissions…</p>
      <div className="eval-progress">
        <div className="eval-progress-bar" />
      </div>
    </div>
  </div>
);

const UploadScripts = () => {
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState(null);

    useEffect(() => {
      const storedTeacher = JSON.parse(localStorage.getItem("user"));
      if (storedTeacher) {
        setTeacher(storedTeacher);
      }
    }, []);
  const location = useLocation();
  const fileInputRef = useRef(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const exam = location.state?.exam ?? null;

  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  // ── File handling ──
  const addFiles = (incoming) => {
    const valid = Array.from(incoming).filter(
  (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
);

    if (valid.length === 0) {
      alert("Only PDF files are accepted.");
      return;
    }

    setFiles((prev) => {
      const paths = new Set(prev.map((f) => f.webkitRelativePath || f.name));
      return [
        ...prev,
        ...valid.filter((f) => !paths.has(f.webkitRelativePath || f.name))
      ];
    });
  };

  const handleFileInput = (e) => addFiles(e.target.files);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  const removeFile = (fileToRemove) =>
    setFiles((prev) =>
      prev.filter((f) => (f.webkitRelativePath || f.name) !== (fileToRemove.webkitRelativePath || fileToRemove.name))
    );

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  // ── Submit ──
  const handleUploadAndEvaluate = async () => {
  if (!exam) {
    alert("Exam details missing!");
    return;
  }

  if (files.length === 0) {
    alert("Please select at least one answer script.");
    return;
  }

  setIsEvaluating(true);
  setUploading(true);

  try {
    // ---------- Upload answer scripts ----------
    const formData = new FormData();
    formData.append("course", exam.course);
    formData.append("examType", exam.examType);
    formData.append("classId", exam.classId);
    formData.append("examId", exam._id);

    files.forEach((file) => {
      formData.append("answer_scripts", file);
    });

    const uploadRes = await fetch(
      `${API_BASE}/api/upload/evaluation-materials`,
      {
        method: "POST",
        body: formData,
      }
    );

    const uploadText = await uploadRes.text();
    console.log("Upload raw response:", uploadText);

    let uploadData;
    try {
      uploadData = JSON.parse(uploadText);
    } catch {
      throw new Error("Upload API returned invalid JSON");
    }

    if (!uploadRes.ok) {
      throw new Error(uploadData.error || "Upload failed");
    }

 console.log("Upload success:", uploadData);

const scriptKeys = Array.isArray(uploadData?.uploadedFiles)
  ? uploadData.uploadedFiles.map(f => ({ key: f.key }))
  : [];

console.log("Scripts to evaluate:", scriptKeys);

if (!scriptKeys.length) {
  throw new Error("No answer scripts uploaded properly");
}
    // ---------- Evaluate ----------
   const evalRes = await fetch(`${API_BASE}/api/evaluation/run`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
  classId: exam.classId,
  course: exam.course,
  examType: exam.examType,
  evalType: exam.evalType,
  force: false,
  scriptKeys, // 🔥 THIS IS THE FIX
}),
});

    const evalText = await evalRes.text();
    console.log("Evaluation raw response:", evalText);

    let evalData;
    try {
      evalData = JSON.parse(evalText);
    } catch {
      throw new Error("Evaluation API returned invalid JSON");
    }

    if (!evalRes.ok) {
      throw new Error(evalData.error || evalData.message || "Evaluation failed");
    }

    console.log("Evaluation success:", evalData);

    setUploadedFiles(files);
    setUploadDone(true);
    alert("Upload and evaluation completed successfully ✅");
  } catch (err) {
    console.error(err);
    alert(err.message);
  } finally {
    setIsEvaluating(false);
    setUploading(false);
  }
};
  return (
    <div className="container">
      {isEvaluating && <EvaluatingModal />}
      {/* ── Sidebar ── */}
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
            <li key={label} className={active ? "active" : ""} onClick={() => navigate(path)}>
              <span className="nav-icon">{icon}</span>{label}
            </li>
          ))}
        </ul>
      </aside>

      {/* ── Main ── */}
      <main className="main">
        <button className="us-back-btn" onClick={() => navigate("/evaluation")}>← Back to Evaluation</button>
        <h1 className="page-title">Upload <span>Answer Scripts</span></h1>

        {exam && (
          <div className="us-exam-banner">
            <span className="us-banner-icon">📋</span>
            <div className="us-banner-info">
              <span className="us-banner-course">{exam.course}</span>
              <span className="us-banner-meta">{exam.classId} · {exam.examType} · <code>{exam._id}</code></span>
            </div>
            <span className="us-banner-tag">Answer Scripts Only</span>
          </div>
        )}

        {uploadDone ? (
          <div className="com-card us-success-card">
            <p style={{ fontSize: "52px", marginBottom: "12px" }}>✅</p>
            <h2>Scripts Uploaded Successfully!</h2>
            <p className="us-success-sub">
              {uploadedFiles.length} answer script{uploadedFiles.length !== 1 ? "s" : ""} have been submitted.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "24px" }}>
              <button className="com-btn primary-btn" onClick={() => navigate("/view-mark")}>View Results →</button>
              <button className="com-btn" onClick={() => navigate("/evaluation")}>Back to Evaluation</button>
            </div>
          </div>
        ) : (
          <>
            {/* Drop zone */}
            <div
              className={`us-dropzone ${dragOver ? "drag-over" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
             <input
  ref={fileInputRef}
  type="file"
  accept=".pdf"
  multiple
  style={{ display: "none" }}
  onChange={handleFileInput}
/>
              <span className="us-drop-icon">📄</span>
              <p className="us-drop-title">Drop answer scripts here</p>
              <p className="us-drop-sub">or click to browse · PDF accepted</p>

              {/* Show selected file names inside dropzone */}
              {files.length > 0 && (
                <div className="us-drop-selected">
                  <strong>Selected files:</strong>
                  <ul style={{ marginTop: "4px", paddingLeft: "18px" }}>
                    {files.map((f) => (
                      <li key={f.webkitRelativePath || f.name}>
                        {f.webkitRelativePath || f.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Submit button */}
            <div className="ev-proceed-row" style={{ marginTop: "24px" }}>
              <button className="com-btn primary-btn ev-proceed-btn" onClick={handleUploadAndEvaluate} disabled={files.length === 0 || uploading}>
                {uploading ? "Uploading…" : `Submit ${files.length > 0 ? `(${files.length})` : ""} Scripts →`}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default UploadScripts;
