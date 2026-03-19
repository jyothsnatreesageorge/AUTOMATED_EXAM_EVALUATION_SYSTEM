import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../admin/AdminDashboard.css";

const Revaluation = () => {
  const teacher = JSON.parse(localStorage.getItem("user"));
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedReq, setSelectedReq] = useState(null);
  const [newMark, setNewMark] = useState("");

  const API_BASE = import.meta.env.VITE_API_BASE_URL;

  const NAV_ITEMS = [
    { label: "Dashboard",        icon: "⊞", path: "/teacher" },
    { label: "Evaluation",       icon: "📋", path: "/evaluation" },
    { label: "View Results",     icon: "📊", path: "/view-mark" },
    { label: "Reference Answer", icon: "📖", path: "/reference-answer" },
    {
      label: "Revaluation",
      icon: "🔄",
      path: "/revaluation",
      active: true,
      badge: pendingCount,
    },
    { label: "My Classes",       icon: "🏫", path: "/courseclass" },
  ];

  /* Load pending revaluation requests */
  useEffect(() => {
    if (!teacher?._id) return;

 fetch(`${API_BASE}/api/teachers/revaluation/${teacher._id}`)
      .then((res) => res.json())
      .then((data) => {
        console.log("Revaluation API response:", data);

        // Ensure requests is always an array
        if (Array.isArray(data)) {
          setRequests(data);
        } else if (Array.isArray(data.requests)) {
          setRequests(data.requests);
        } else {
          setRequests([]);
        }
      })
      .catch((err) => console.error(err));
  }, [teacher?._id]);

  /* Notification badge */
  useEffect(() => {
    if (!teacher?._id) return;

    fetch(`${API_BASE}/api/teachers/notification-count/${teacher._id}`)
      .then((res) => res.json())
      .then((data) => setPendingCount(data.count || 0))
      .catch((err) => console.error(err));
  }, [teacher?._id]);

  const submitMark = async (id) => {
    await fetch(`${API_BASE}/api/teachers/revaluation/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        newMarks: newMark,
      }),
    });

    /* remove updated request from UI */
    setRequests((prev) => prev.filter((r) => r._id !== id));

    /* decrease pending count */
    setPendingCount((prev) => Math.max(prev - 1, 0));

    setSelectedReq(null);
    setNewMark("");
  };

  

  return (
    <div className="container">
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
          {NAV_ITEMS.map(({ label, icon, path, active, badge }) => (
            <li
              key={label}
              className={active ? "active" : ""}
              onClick={() => navigate(path)}
            >
              <span>
                <span className="nav-icon">{icon}</span>
                {label}
              </span>

              {badge > 0 && (
                <span
                  style={{
                    background: "#ff4d4f",
                    color: "white",
                    borderRadius: "12px",
                    padding: "2px 8px",
                    fontSize: "12px",
                    fontWeight: "bold",
                  }}
                >
                  {badge}
                </span>
              )}
            </li>
          ))}
        </ul>
      </aside>

      {/* Main */}
      <main className="main">
        <div className="logout-container">
          <button
            className="com-btn logout-btn-top"
            onClick={() => navigate("/login")}
          >
            ↩ Back
          </button>
        </div>

        <h1 className="page-title">
          Revaluation <span>Requests</span>
        </h1>

        {requests.length === 0 ? (
          <div
            className="com-card"
            style={{ textAlign: "center", padding: "60px 24px" }}
          >
            <p style={{ fontSize: "32px", marginBottom: "12px" }}>✅</p>

            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--text-1)",
                marginBottom: "6px",
              }}
            >
              All caught up!
            </p>

            <p style={{ color: "var(--text-3)", fontSize: "14px" }}>
              No pending revaluation requests.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {Array.isArray(requests) &&
              requests.map((req) => (
                <div className="com-card revaluation-card" key={req._id}>
                  <div className="revaluation-header">
                    <div>
                      <p
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "18px",
                          fontWeight: 700,
                          color: "var(--text-1)",
                          marginBottom: "2px",
                        }}
                      >
                        {req.studentName}
                      </p>

                      <p
                        style={{
                          fontSize: "14px",
                          color: "var(--text-3)",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Roll No: {req.rollNo}
                      </p>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span
                        style={{
                          display: "inline-block",
                          background: "var(--accent-mid)",
                          color: "var(--accent)",
                          border: "1px solid var(--border-bright)",
                          borderRadius: "var(--r-full)",
                          padding: "4px 12px",
                          fontSize: "14px",
                          fontWeight: 600,
                        }}
                      >
                        {req.classId} · {req.examType}
                      </span>
                    </div>
                  </div>

                  <div className="revaluation-content-box">
                    <p style={{ marginBottom: "14px" }}>
                      Revaluation request for{" "}
                      <strong style={{ color: "var(--text-1)" }}>
                        {req.examType}
                      </strong>{" "}
                      in{" "}
                      <strong style={{ color: "var(--text-1)" }}>
                        {req.course}
                      </strong>
                      , class{" "}
                      <strong style={{ color: "var(--text-1)" }}>
                        {req.classId}
                      </strong>
                      .
                    </p>

                    {req.studentReason && (
                      <div
                        style={{
                          background: "#f8f9ff",
                          padding: "12px",
                          borderRadius: "8px",
                          marginBottom: "14px",
                          border: "1px solid #e0e6ff",
                        }}
                      >
                        <p style={{ fontWeight: "600", marginBottom: "4px" }}>
                          Student Reason:
                        </p>

                        <p style={{ fontSize: "14px", color: "#555" }}>
                          {req.studentReason}
                        </p>
                      </div>
                    )}

                    <button
                      className="com-btn revalued-btn"
                      onClick={() => setSelectedReq(req)}
                    >
                      ✏️ Update Mark
                    </button>

                    {selectedReq?._id === req._id && (
                      <div style={{ marginTop: "10px" }}>
                        <input
                          type="number"
                          placeholder="Enter new total mark"
                          value={newMark}
                          onChange={(e) => setNewMark(e.target.value)}
                          style={{
                            padding: "6px",
                            marginRight: "10px",
                          }}
                        />

                        <button
                          className="com-btn"
                          onClick={() => submitMark(req._id)}
                        >
                          Submit
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Revaluation;
