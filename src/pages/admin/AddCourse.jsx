import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";

const NAV_ITEMS = [
  { label: "Dashboard",          icon: "⊞", path: "/admin"                          },
  { label: "Teacher Management", icon: "🎓", path: "/admin/teachers"                 },
  { label: "Student Management", icon: "👥", path: "/admin/students"                 },
  { label: "Manage Course",         icon: "📚", path: "/admin/add-course", active: true },
  { label: "Manage Class",       icon: "🏫", path: "/admin/add-class"                },
  { label: "Course Mapping",     icon: "🔗", path: "/admin/course-mapping"           },
];

// Sample data — replace with real API fetch
const INITIAL_COURSES = [
  { courseId: "CS101", courseName: "Introduction to Programming"  },
  { courseId: "CS202", courseName: "Data Structures & Algorithms" },
  { courseId: "CS303", courseName: "Database Management Systems"  },
  { courseId: "CS404", courseName: "Operating Systems"            },
  { courseId: "CS505", courseName: "Computer Networks"            },
];

const ManageCourse = () => {
  const navigate = useNavigate();

  const [courses,     setCourses]     = useState(INITIAL_COURSES);
  const [search,      setSearch]      = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteId,    setDeleteId]    = useState(null);
  const [successMsg,  setSuccessMsg]  = useState("");

  // Add form fields
  const [newCourseId,   setNewCourseId]   = useState("");
  const [newCourseName, setNewCourseName] = useState("");

  // ── Derived: filtered list ─────────────────────────────────────────────────
  const filtered = courses.filter((c) =>
    [c.courseId, c.courseName]
      .some((v) => v.toLowerCase().includes(search.toLowerCase()))
  );
  useEffect(() => {
  fetch("http://localhost:5000/api/courses")
    .then(res => res.json())
    .then(data => setCourses(data))
    .catch(err => console.error(err));
}, []);
  // ── Add ────────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
  if (!newCourseId.trim() || !newCourseName.trim()) {
    alert("Please fill all fields ❌");
    return;
  }

  try {
    const res = await fetch("http://localhost:5000/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId: newCourseId,
        courseName: newCourseName
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message);
      return;
    }

    setCourses(prev => [data.course, ...prev]);

    setNewCourseId("");
    setNewCourseName("");
    setShowAddForm(false);

    flash("✅ Course added successfully!");

  } catch (err) {
    console.error(err);
    alert("Failed to add course ❌");
  }
};

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
  try {
    const res = await fetch(
      `http://localhost:5000/api/courses/${deleteId}`,
      { method: "DELETE" }
    );

    if (!res.ok) {
      alert("Delete failed");
      return;
    }

    setCourses(prev => prev.filter(c => c.courseId !== deleteId));

    setDeleteId(null);
    flash("🗑️ Course deleted.");

  } catch (err) {
    console.error(err);
    alert("Failed to delete course ❌");
  }
};

  const flash = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  return (
    <div className="container">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <h2 className="logo">SAGE</h2>
        <div className="user-info">
          <div className="avatar">A</div>
          <div className="user-details">
            <h4>Admin1</h4>
            <p>System Administrator</p>
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
          <button
            className="com-btn logout-btn-top"
            onClick={() => navigate("/login")}
          >
            ↩ Logout
          </button>
        </div>
        <h1 className="page-title">Manage <span>Courses</span></h1>

        {/* Stats + global flash */}
        <div className="mc-toolbar">
          <p className="mc-count">{courses.length} course{courses.length !== 1 ? "s" : ""}</p>
          <button className="com-btn primary-btn mc-add-btn"
            onClick={() => { setShowAddForm((p) => !p); setNewCourseId(""); setNewCourseName(""); }}>
            {showAddForm ? "✕ Cancel" : "+ Add Course"}
          </button>
        </div>

        {successMsg && <p className="success-text" style={{ marginBottom: "16px" }}>{successMsg}</p>}

        {/* ── Add form ── */}
        {showAddForm && (
          <div className="com-card mc-form-card">
            <h3>New Course</h3>
            <div className="mc-form-grid">
              <div className="mc-field">
                <label>Course ID</label>
                <input placeholder="e.g. CS101" value={newCourseId}
                  onChange={(e) => setNewCourseId(e.target.value)} />
              </div>
              <div className="mc-field">
                <label>Course Name</label>
                <input placeholder="e.g. Data Structures" value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)} />
              </div>
            </div>
            <button className="com-btn primary-btn" onClick={handleAdd}>+ Add Course</button>
          </div>
        )}

        {/* ── Table card ── */}
        <div className="com-card tm-table-card">
          {/* Search inside table card header */}
          <div className="tm-table-header">
            <div className="tm-search-wrap" style={{ flex: 1, maxWidth: "360px" }}>
              <span className="tm-search-icon">🔍</span>
              <input className="tm-search" placeholder="Search by course ID or name…"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <span style={{ fontSize: "13px", color: "var(--text-3)", fontWeight: 600 }}>
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          <table className="tm-table">
            <thead>
              <tr>
                <th>Course ID</th>
                <th>Course Name</th>
                <th style={{ width: "100px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={3} className="tm-empty">No courses found.</td></tr>
              ) : (
                filtered.map((course) => (
                  <tr key={course.courseId}>
                    <td>
                      <code style={{ color: "var(--accent)", fontWeight: 700, fontSize: "14px" }}>
                        {course.courseId}
                      </code>
                    </td>
                    <td style={{ color: "var(--text-1)", fontWeight: 500 }}>{course.courseName}</td>
                    <td className="tm-actions">
                      <button className="tm-btn tm-delete-btn"
                        onClick={() => setDeleteId(course.courseId)}>
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* ── Delete confirmation modal ── */}
      {deleteId && (
        <div className="eval-overlay" onClick={() => setDeleteId(null)}>
          <div className="tm-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <p className="tm-confirm-icon">🗑️</p>
            <h3>Delete Course?</h3>
            <p className="tm-confirm-sub">
              Course <strong style={{ color: "var(--accent)" }}>{deleteId}</strong> —{" "}
              {courses.find((c) => c.courseId === deleteId)?.courseName} will be permanently removed.
            </p>
            <p className="warning-text">⚠️ This action cannot be undone.</p>
            <div className="tm-confirm-actions">
              <button className="com-btn" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="com-btn danger-btn" onClick={handleDeleteConfirm}>Confirm Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageCourse;