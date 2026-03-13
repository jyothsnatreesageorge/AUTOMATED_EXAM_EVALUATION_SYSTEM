import React from "react";
import { useNavigate } from "react-router-dom";
import "../admin/AdminDashboard.css";

const NAV_ITEMS = [
  { label: "Dashboard", icon: "⊞", path: "/teacher", active: true },
  { label: "Profile", icon: "👤", path: "/profile" },
  {label:"My Classes",icon:"🏫",path:"/courseclass"}
];

const FEATURE_CARDS = [
  { label: "Evaluation", icon: "📋", sub: "Manage & score exams", path: "/evaluation" },
  { label: "View Results", icon: "📊", sub: "Browse mark matrices", path: "/view-mark" },
{ label: "Reference Answer", icon: "📖", sub: "Approve model answers", path: "/reference-answer" },
  { label: "Revaluation", icon: "🔄", sub: "Handle student requests", path: "/revaluation" },
  {label:"My Classes",icon:"🏫",sub:"View class and courses",path:"/courseclass"},
];
const TeacherDashboard = () => {

  const navigate = useNavigate();

  const teacher = JSON.parse(localStorage.getItem("user"));

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");

    navigate("/", { replace: true });
  };

  return (
    <div className="container">

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

      <main className="main">

        <div className="logout-container">
          <button className="com-btn logout-btn-top" onClick={handleLogout}>
            ↩ Logout
          </button>
        </div>

        <h1 className="page-title">
          Teacher <span>Dashboard</span>
        </h1>

        <div className="card-grid">
          {FEATURE_CARDS.map(({ label, icon, sub, path }) => (
            <div key={label} className="dash-card" onClick={() => navigate(path)}>
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

export default TeacherDashboard;
