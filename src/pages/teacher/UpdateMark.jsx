import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../admin/AdminDashboard.css";

const NAV_ITEMS = [
  { label: "Dashboard",        icon: "⊞", path: "/teacher"          },
  { label: "Evaluation",       icon: "📋", path: "/evaluation"       },
  { label: "View Results",     icon: "📊", path: "/view-mark"        },
  { label: "Reference Answer", icon: "📖", path: "/reference-answer" },
  { label: "Revaluation",      icon: "🔄", path: "/revaluation", active: true },
  {label:"My Classes",icon:"🏫",path:"/courseclass"},
];

// Sample original marks — in a real app this comes from your backend
// keyed by rollNo + course + exam
const ORIGINAL_MARKS = {
  "S2-101_Data Structures_Series Test 1": { q1: 8, q2: 7, q3: 9  },
  "S3-204_DBMS_Series Test 2":            { q1: 6, q2: 5, q3: 7  },
};

const MAX_PER_Q = 10;

const UpdateMark = () => {
  const teacher = JSON.parse(localStorage.getItem("user"));
  const navigate  = useNavigate();
  const location  = useLocation();

  // Data passed from Revaluation.jsx via navigate state
  const {
    id,
    student  = "Unknown Student",
    rollNo   = "—",
    class: cls = "—",
    exam     = "—",
    course   = "—",
  } = location.state || {};

  const key = `${rollNo}_${course}_${exam}`;
  const original = ORIGINAL_MARKS[key] || { q1: 0, q2: 0, q3: 0 };

  // Editable mark state — initialised from original
  const [marks, setMarks] = useState({ ...original });
  const [saved,  setSaved]  = useState(false);
  const [errors, setErrors] = useState({});

  const total    = Object.values(marks).reduce((s, v) => s + (Number(v) || 0), 0);
  const maxTotal = Object.keys(marks).length * MAX_PER_Q;

  // ── Validation ──────────────────────────────────────────────────────────
  const validate = () => {
    const newErrors = {};
    Object.entries(marks).forEach(([q, val]) => {
      const n = Number(val);
      if (val === "" || isNaN(n))       newErrors[q] = "Required";
      else if (n < 0)                   newErrors[q] = "Min 0";
      else if (n > MAX_PER_Q)           newErrors[q] = `Max ${MAX_PER_Q}`;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (q, val) => {
    setMarks((prev) => ({ ...prev, [q]: val }));
    setSaved(false);
    setErrors((prev) => ({ ...prev, [q]: undefined }));
  };

  const handleSave = () => {
    if (!validate()) return;
    // TODO: call your API here — e.g. PUT /api/marks with { rollNo, course, exam, marks }
    console.log("Saving updated marks:", { rollNo, course, exam, marks });
    setSaved(true);
  };

  const handleConfirmAndReturn = () => {
    navigate("/revaluation");
  };

  // ── No state passed (direct URL access) ────────────────────────────────
  if (!location.state) {
    return (
      <div className="container">
        <aside className="sidebar">
          <h2 className="logo">SAGE</h2>
          <div className="user-info">
            <div className="avatar">T</div>
             <div className="user-details">
            <h4>{teacher?.name}</h4>
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
        <main className="main">
          <div className="com-card" style={{ textAlign: "center", padding: "60px 24px", marginTop: "60px" }}>
            <p style={{ fontSize: "32px", marginBottom: "12px" }}>⚠️</p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700,
              color: "var(--text-1)", marginBottom: "10px" }}>No student selected</p>
            <p style={{ color: "var(--text-3)", fontSize: "14px", marginBottom: "24px" }}>
              Please open this page from a revaluation request.
            </p>
            <button className="com-btn view-btn" onClick={() => navigate("/revaluation")}>
              ← Back to Revaluation
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="container">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <h2 className="logo">SAGE</h2>

        <div className="user-info">
          <div className="avatar">T</div>
          <div className="user-details">
            <h4>Teacher Name</h4>
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
          <button className="com-btn logout-btn-top" onClick={() => navigate("/login")}>
            ↩ Logout
          </button>
        </div>

        <h1 className="page-title">
          Update <span>Marks</span>
        </h1>

        {/* ── Student Info Card ── */}
        <div className="com-card" style={{ marginBottom: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "20px" }}>
            {[
              { label: "Student",  value: student },
              { label: "Roll No",  value: rollNo  },
              { label: "Class",    value: cls      },
              { label: "Course",   value: course   },
              { label: "Exam",     value: exam     },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{
                  fontSize: "12px", fontWeight: 600, letterSpacing: "1.2px",
                  textTransform: "uppercase", color: "var(--text-3)", marginBottom: "4px",
                }}>
                  {label}
                </p>
                <p style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-1)" }}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Marks Edit Card ── */}
        <div className="com-card">
          <p style={{
            fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 700,
            color: "var(--text-1)", marginBottom: "20px",
          }}>
            Edit Question Marks
          </p>

          {/* Table */}
          <table style={{ marginBottom: "24px" }}>
            <thead>
              <tr>
                <th>Question</th>
                <th>Original Mark</th>
                <th>Max Mark</th>
                <th>Updated Mark</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(marks).map((q) => {
                const orig   = original[q];
                const cur    = Number(marks[q]) || 0;
                const diff   = cur - orig;
                const hasErr = errors[q];

                return (
                  <tr key={q}>
                    {/* Question label */}
                    <td style={{ fontWeight: 600, color: "var(--text-1)", textTransform: "uppercase" }}>
                      {q}
                    </td>

                    {/* Original */}
                    <td style={{ color: "var(--text-3)" }}>{orig}</td>

                    {/* Max */}
                    <td style={{ color: "var(--text-3)" }}>{MAX_PER_Q}</td>

                    {/* Editable input */}
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center" }}>
                        <input
                          type="number"
                          min={0}
                          max={MAX_PER_Q}
                          value={marks[q]}
                          onChange={(e) => handleChange(q, e.target.value)}
                          style={{
                            width: "72px",
                            padding: "8px 10px",
                            background: "var(--bg-raised)",
                            border: `1px solid ${hasErr ? "var(--danger)" : "var(--border-bright)"}`,
                            borderRadius: "var(--r-md)",
                            color: "var(--text-1)",
                            fontFamily: "var(--font-display)",
                            fontWeight: 700,
                            fontSize: "15px",
                            textAlign: "center",
                            outline: "none",
                          }}
                          onFocus={(e) => e.target.style.boxShadow = "0 0 0 3px var(--primary-glow)"}
                          onBlur={(e)  => e.target.style.boxShadow = "none"}
                        />
                        {hasErr && (
                          <span style={{ fontSize: "11px", color: "var(--danger)" }}>{hasErr}</span>
                        )}
                      </div>
                    </td>

                    {/* Diff badge */}
                    <td>
                      {diff === 0 ? (
                        <span style={{ color: "var(--text-3)", fontSize: "13px" }}>—</span>
                      ) : (
                        <span style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: "var(--r-full)",
                          fontSize: "13px",
                          fontWeight: 700,
                          background: diff > 0 ? "var(--success-soft)" : "var(--danger-soft)",
                          color:      diff > 0 ? "var(--success)"      : "var(--danger)",
                          border: `1px solid ${diff > 0 ? "rgba(54,201,142,0.25)" : "rgba(240,84,84,0.25)"}`,
                        }}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Total row */}
              <tr style={{ borderTop: "1px solid var(--border-bright)" }}>
                <td style={{ fontWeight: 700, color: "var(--text-1)" }}>Total</td>
                <td style={{ color: "var(--text-3)" }}>
                  {Object.values(original).reduce((s, v) => s + v, 0)}
                </td>
                <td style={{ color: "var(--text-3)" }}>{maxTotal}</td>
                <td style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "17px", fontWeight: 800,
                  color: "var(--primary)",
                }}>
                  {total}
                </td>
                <td>
                  {(() => {
                    const origTotal = Object.values(original).reduce((s, v) => s + v, 0);
                    const d = total - origTotal;
                    if (d === 0) return <span style={{ color: "var(--text-3)" }}>—</span>;
                    return (
                      <span style={{
                        display: "inline-block", padding: "3px 10px",
                        borderRadius: "var(--r-full)", fontSize: "13px", fontWeight: 700,
                        background: d > 0 ? "var(--success-soft)" : "var(--danger-soft)",
                        color:      d > 0 ? "var(--success)"      : "var(--danger)",
                        border: `1px solid ${d > 0 ? "rgba(54,201,142,0.25)" : "rgba(240,84,84,0.25)"}`,
                      }}>
                        {d > 0 ? `+${d}` : d}
                      </span>
                    );
                  })()}
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── Action Buttons ── */}
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              className="com-btn approve-btn"
              onClick={handleSave}
              style={{ padding: "11px 28px", fontSize: "15px" }}
            >
              💾 Save Changes
            </button>

            <button
              className="com-btn view-btn"
              onClick={() => navigate("/revaluation")}
            >
              ← Back
            </button>

            {saved && (
              <button
                className="com-btn revalued-btn"
                onClick={handleConfirmAndReturn}
                style={{ padding: "11px 28px", fontSize: "15px" }}
              >
                ✓ Confirm &amp; Mark as Revalued
              </button>
            )}
          </div>

          {/* Success message */}
          {saved && (
            <p className="success-text" style={{ marginTop: "16px" }}>
              ✅ Marks saved successfully. Click "Confirm & Mark as Revalued" to complete.
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default UpdateMark;