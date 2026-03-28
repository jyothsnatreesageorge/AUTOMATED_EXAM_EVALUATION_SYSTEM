import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../admin/AdminDashboard.css";

const NAV_ITEMS = [
  { label: "Dashboard",       icon: "⊞", path: "/student" },
  { label: "View Answer Key", icon: "📖", path: "/student/answer-key" },
  { label: "View Result",     icon: "📊", path: "/student/result", active: true },
];

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const ViewResult = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  const [course,       setCourse]       = useState("");
  const [exam,         setExam]         = useState("");
  const [courses,      setCourses]      = useState([]);
  const [result,       setResult]       = useState(null);
  const [showResult,   setShowResult]   = useState(false);
  const [revalStatus,  setRevalStatus]  = useState(null);
  const [message,      setMessage]      = useState("");
  const [reason,       setReason]       = useState("");
  const [showRevalBox, setShowRevalBox] = useState(false);
  const [tab,          setTab]          = useState("marks");
  const [extractedText, setExtractedText] = useState("");
  const [ocrStatus,    setOcrStatus]    = useState(null);

  /* ── Load courses ── */
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (!storedUser?.classId) return;

    fetch(`${API_BASE}/api/students/courses/byclass/${storedUser.classId}`)
      .then(r => r.json())
      .then(d => setCourses(Array.isArray(d.courses) ? d.courses : []))
      .catch(console.log);
  }, []);

  /* ── View result ── */
  const handleView = async () => {
    if (!course || !exam) { alert("Please select both a course and exam"); return; }

    try {
      const res  = await fetch(`${API_BASE}/api/students/result`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollNo: user.rollNo, course, examType: exam }),
      });
      const data = await res.json();

      if (data.result) {
        setResult(data.result);
        setShowResult(true);
        setMessage("");
        setTab("marks");
      } else {
        setResult(null);
        setShowResult(false);
        setMessage("Result not available");
      }

      // fetch OCR extracted text
      try {
        const ocrRes  = await fetch(
          `${API_BASE}/api/results/student?rollNo=${encodeURIComponent(user.rollNo)}`
        );
        const ocrData = await ocrRes.json();
        setExtractedText(ocrData.extractedText || "");
        setOcrStatus(ocrData.ocrStatus || null);
      } catch {
        setExtractedText("");
        setOcrStatus(null);
      }

    } catch (err) {
      console.log(err);
      setResult(null);
      setShowResult(false);
      setMessage("Failed to load result");
    }
  };

  const handleChange = (setter) => (e) => {
    setter(e.target.value);
    setShowResult(false);
    setMessage("");
    setResult(null);
    setRevalStatus(null);
    setExtractedText("");
    setOcrStatus(null);
    setTab("marks");
  };

  /* ── Revaluation ── */
  const handleRequestReval = async () => {
    setRevalStatus("pending");
    try {
      const savedUser = JSON.parse(localStorage.getItem("user"));
      const res  = await fetch(`${API_BASE}/api/students/revaluation`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: savedUser.name, rollNo: savedUser.rollNo,
          classId: savedUser.classId, course, examType: exam,
          studentReason: reason,
        }),
      });
      const data = await res.json();
      alert(data.message === "Revaluation already requested"
        ? "⚠️ You have already requested revaluation for this exam."
        : "✅ Revaluation request submitted successfully.");
      setRevalStatus("submitted");
    } catch {
      alert("Server error");
      setRevalStatus(null);
    }
  };

  /* ── Totals ── */
  const total    = result?.totalMarks ?? 0;
  const maxTotal = result?.maxMarks   || 0;
  const pct      = maxTotal ? Math.round((Number(total) / maxTotal) * 100) : 0;

  /* ── Parse resultTable markdown ── */
  const parseResultTable = (markdown) => {
    if (!markdown) return { headers: [], dataRows: [] };
    const lines    = markdown.split("\n").map(l => l.trim()).filter(l => l.startsWith("|"));
    if (lines.length < 2) return { headers: [], dataRows: [] };
    const splitRow = (line) =>
      line.split("|").filter((_, i, arr) => i !== 0 && i !== arr.length - 1).map(c => c.trim());
    return {
      headers:  splitRow(lines[0]),
      dataRows: lines.slice(2).map(splitRow),
    };
  };

  const { headers, dataRows } = parseResultTable(result?.resultTable);

  return (
    <div className="container">

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <h2 className="logo">SAGE</h2>
        <div className="user-info">
          <div className="avatar">{user?.name?.charAt(0).toUpperCase()}</div>
          <div className="user-details">
            <h4>{user?.name}</h4>
            <p>Student</p>
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
        <div className="logout-container">
          <button className="com-btn logout-btn-top" onClick={() => navigate("/login")}>
            ↩ Back
          </button>
        </div>

        <h1 className="page-title">View <span>Result</span></h1>

        {/* Filter */}
        <div className="com-card filter-card">
          <div className="filter-group">
            <label>Course</label>
            <select value={course} onChange={handleChange(setCourse)}>
              <option value="">Select Course</option>
              {courses.map((c) => (
                <option key={c._id || c.courseId} value={c.courseName}>
                  {c.courseName}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Exam</label>
            <select value={exam} onChange={handleChange(setExam)}>
              <option value="">Select Exam</option>
              <option value="Series Test 1">Series Test 1</option>
              <option value="Series Test 2">Series Test 2</option>
            </select>
          </div>
          <button className="com-btn view-btn vsr-view-btn" onClick={handleView}>
            View Result
          </button>
        </div>

        {message && <p className="vsr-message">{message}</p>}

        {/* Result card */}
        {showResult && result && (
          <div className="com-card results-table-card">

            {/* summary row */}
            <div className="vsr-summary-row">
              <div>
                <h3 className="vsr-summary-title">{exam} — {course}</h3>
                <p className="vsr-summary-roll">Roll No: {user.rollNo}</p>
              </div>
              <div className="vsr-score-block">
                <p className="vsr-score-total">{total}/{maxTotal}</p>
                <p className="vsr-score-pct">{pct}%</p>
              </div>
            </div>

            {/* tabs */}
            <div className="vsr-tab-row">
              <button
                className={`com-btn vsr-tab${tab === "marks" ? " vsr-tab--active" : ""}`}
                onClick={() => setTab("marks")}
              >
                📊 Marks Breakdown
              </button>
              <button
                className={`com-btn vsr-tab${tab === "text" ? " vsr-tab--active" : ""}`}
                onClick={() => setTab("text")}
              >
                📝 My Extracted Answers
                {ocrStatus === "pending" && (
                  <span className="ocr-badge badge-warn vsr-tab-badge">processing…</span>
                )}
                {ocrStatus === "done" && extractedText && (
                  <span className="ocr-badge badge-success vsr-tab-badge">ready</span>
                )}
              </button>
            </div>

{tab === "marks" && (
  <>
    <p className="vsr-section-label">Question-wise marks</p>

    {result?.questions?.length > 0 ? (
      <div className="vsr-table-wrap">
        <table className="vsr-table">
          <thead>
            <tr>
              <th className="vsr-th">Q No</th>
              <th className="vsr-th">Max Marks</th>
              <th className="vsr-th">Marks Awarded</th>
              <th className="vsr-th">Justification</th>
            </tr>
          </thead>
          <tbody>
            {result.questions.map((q, i) => (
              <tr key={i} className="vsr-tr">
                <td className="vsr-td">{q.question?.toUpperCase()}</td>
                <td className="vsr-td">{q.max}</td>
                <td className="vsr-td">{q.marks}</td>
                <td className="vsr-td">{q.deductionReason || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <p className="vsr-empty">No result available.</p>
    )}

    {/* revaluation section stays unchanged */}
    <div className="vsr-reval-row">
      {revalStatus !== "submitted" && (
        <button className="com-btn reval-btn" onClick={() => setShowRevalBox(true)}>
          Request Revaluation
        </button>
      )}
      {revalStatus === "submitted" && (
        <p className="vsr-reval-done">Revaluation Requested ✓</p>
      )}
      {showRevalBox && (
        <div className="vsr-reval-box">
          <textarea
            className="vsr-reval-textarea"
            placeholder="Enter reason for revaluation..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button className="com-btn" onClick={handleRequestReval}>
            Submit Request
          </button>
        </div>
      )}
    </div>
  </>
)}

            {/* ── Extracted text tab ── */}
            {tab === "text" && (
              <div>
                <p className="vsr-ocr-hint">
                  This is exactly what the system read from your handwritten answer sheet.
                  If you notice any errors, request for revaluation.
                </p>

                {ocrStatus === "done" && extractedText && (
                  <div className="ocr-textbox">
                    <pre className="ocr-pre">{extractedText}</pre>
                  </div>
                )}

                {ocrStatus === "pending" && (
                  <div className="vsr-status-block vsr-status-block--warn">
                    <span className="vsr-status-icon">⏳</span>
                    <div>
                      <p className="vsr-status-title">Extraction in progress</p>
                      <p className="vsr-status-body">
                        Your answer sheet is being processed. Please check back in a few minutes.
                      </p>
                    </div>
                  </div>
                )}

                {ocrStatus === "failed" && (
                  <div className="vsr-status-block vsr-status-block--error">
                    <span className="vsr-status-icon">⚠</span>
                    <div>
                      <p className="vsr-status-title">Extraction failed</p>
                      <p className="vsr-status-body">
                        There was an error reading your answer sheet. Please contact your teacher.
                      </p>
                    </div>
                  </div>
                )}

                {!ocrStatus && !extractedText && (
                  <div className="vsr-status-block vsr-status-block--warn">
                    <span className="vsr-status-icon">⚠</span>
                    <p className="vsr-status-body">
                      Extracted text not available yet. Please contact your teacher.
                    </p>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
};

export default ViewResult;
