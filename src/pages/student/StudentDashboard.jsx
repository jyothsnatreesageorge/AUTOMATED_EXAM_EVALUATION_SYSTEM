import React from "react";
import { useNavigate } from "react-router-dom";
import "../admin/AdminDashboard.css";

const NAV_ITEMS = [
  { label: "Dashboard", icon: "⊞", path: "/student", active: true },
    { label: "Profile", icon: "👤", path: "/profile" }
];

const FEATURE_CARDS = [
  {
    label: "View Result",
    icon: "📊",
    sub: "Check your exam scores",
    path: "/student/result",
  },
  {
    label: "View Answer Key",
    icon: "📖",
    sub: "Browse approved model answers",
    path: "/student/answer-key",
  },
];

const StudentDashboard = () => {
  const navigate = useNavigate();

  const student = JSON.parse(localStorage.getItem("user"));

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    navigate("/", { replace: true });
  };

  return (
    <div className="container">

      {/* Sidebar */}
      <aside className="sidebar">

        <h2 className="logo">SAGE</h2>

        <div className="user-info">
          <div className="avatar">
            {student?.name?.charAt(0)?.toUpperCase()}
          </div>

          <div className="user-details">
            <h4>{student?.name}</h4>
            <p>Student</p>
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

      {/* Main */}
      <main className="main">

        <div className="logout-container">
          <button className="com-btn logout-btn-top" onClick={handleLogout}>
            ↩ Logout
          </button>
        </div>

        {/* Welcome */}
        <h1 className="page-title">
          Welcome, <span>{student?.name}</span>
        </h1>

        <p style={{ color: "var(--text-3)", marginBottom: "30px" }}>
          Access your results and approved answer keys from here.
        </p>

        {/* Dashboard Cards */}
        <div className="card-grid">

          {FEATURE_CARDS.map(({ label, icon, sub, path }) => (
            <div
              key={label}
              className="dash-card"
              onClick={() => navigate(path)}
            >
              <div className="card-icon">{icon}</div>
              <h3>{label}</h3>
              <p className="card-sub">{sub}</p>
            </div>
          ))}

        </div>

      </main>

    </div>
  );
};

export default StudentDashboard;