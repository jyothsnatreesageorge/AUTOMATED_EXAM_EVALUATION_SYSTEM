import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";

const NAV_ITEMS = [
  { label: "Dashboard", icon: "⊞", path: "/admin" },
  { label: "Teacher Management", icon: "🎓", path: "/admin/teachers" },
  { label: "Student Management", icon: "👥", path: "/admin/students" },
  { label: "Manage Course", icon: "📚", path: "/admin/add-course" },
  { label: "Manage Class", icon: "🏫", path: "/admin/add-class", active: true },
  { label: "Course Mapping", icon: "🔗", path: "/admin/course-mapping" },
];

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const DIVISIONS = ["None", "A", "B"];
const API_BASE = import.meta.env.VITE_API_BASE_URL;

const buildClassId = (admYear, passOutYear, division) => {
  const div = division && division !== "None" ? `-${division}` : "";
  return admYear && passOutYear ? `${admYear}-${passOutYear}${div}` : "";
};

const ManageClass = () => {
  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);
  const [activePanel, setActivePanel] = useState(null);

  const [admYear, setAdmYear] = useState("");
  const [passOutYear, setPassOutYear] = useState("");
  const [division, setDivision] = useState("None");
  const [semester, setSemester] = useState("1");

  const [editingClassId, setEditingClassId] = useState(null);
  const [editSemester, setEditSemester] = useState("1");

  const [deleteClassId, setDeleteClassId] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  const previewId = buildClassId(admYear, passOutYear, division);

  useEffect(() => {
    fetchClasses();
  }, []);

  const flashSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const fetchClasses = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/classes`);
      const data = await res.json();

      if (!res.ok) throw new Error(data?.message || "Failed to fetch classes");

      setClasses(Array.isArray(data) ? data : []);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAdd = async () => {
    if (!admYear.trim() || !passOutYear.trim()) {
      alert("Please fill Admission Year and Pass Out Year");
      return;
    }

    if (Number(passOutYear) <= Number(admYear)) {
      alert("Pass Out Year must be greater than Admission Year");
      return;
    }

    const classId = buildClassId(admYear, passOutYear, division);

    try {
      const res = await fetch(`${API_BASE}/api/classes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          admYear,
          passOutYear,
          division,
          semester,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to add class");

      setAdmYear("");
      setPassOutYear("");
      setDivision("None");
      setSemester("1");
      setActivePanel(null);

      flashSuccess("✅ Class added successfully!");
      fetchClasses();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSemesterSave = async (classId) => {
    try {
      const res = await fetch(`${API_BASE}/api/classes/${classId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semester: editSemester }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to update semester");

      setEditingClassId(null);
      setEditSemester("1");
      flashSuccess("✅ Semester updated!");
      fetchClasses();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/classes/${deleteClassId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Delete failed");

      setDeleteClassId(null);
      flashSuccess("🗑️ Class deleted successfully!");
      fetchClasses();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="container">
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
          <button
            className="com-btn logout-btn-top"
            onClick={() => navigate("/login")}
          >
            ↩ Back
          </button>
        </div>

        <h1 className="page-title">
          Manage <span>Class</span>
        </h1>

        <div className="mc-toolbar">
          <p className="mc-count">
            {classes.length} class{classes.length !== 1 ? "es" : ""}
          </p>
          <button
            className="com-btn primary-btn mc-add-btn"
            onClick={() => setActivePanel((p) => (p === "add" ? null : "add"))}
          >
            {activePanel === "add" ? "✕ Cancel" : "+ Add Class"}
          </button>
        </div>

        {successMsg && (
          <p className="success-text" style={{ marginBottom: "16px" }}>
            {successMsg}
          </p>
        )}

        {activePanel === "add" && (
          <div className="com-card mc-form-card">
            <h3>New Class</h3>

            <div className="mc-form-grid">
              <div className="mc-field">
                <label>Admission Year</label>
                <input
                  type="number"
                  placeholder="e.g. 2022"
                  value={admYear}
                  onChange={(e) => setAdmYear(e.target.value)}
                  min="2000"
                  max="2099"
                />
              </div>

              <div className="mc-field">
                <label>Pass Out Year</label>
                <input
                  type="number"
                  placeholder="e.g. 2026"
                  value={passOutYear}
                  onChange={(e) => setPassOutYear(e.target.value)}
                  min="2000"
                  max="2099"
                />
              </div>

              <div className="mc-field">
                <label>Division</label>
                <select
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                >
                  {DIVISIONS.map((d) => (
                    <option key={d} value={d}>
                      {d === "None" ? "No Division" : `Division ${d}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mc-field">
                <label>Semester</label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                >
                  {SEMESTERS.map((s) => (
                    <option key={s} value={String(s)}>
                      Semester {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {previewId && (
              <div className="mc-id-preview">
                <span>Class ID Preview:</span>
                <code>{previewId}</code>
              </div>
            )}

            <button className="com-btn primary-btn" onClick={handleAdd}>
              + Add Class
            </button>
          </div>
        )}

        <div className="com-card tm-table-card">
          <table className="tm-table">
            <thead>
              <tr>
                <th>Class ID</th>
                <th>Adm Year</th>
                <th>Pass Out Year</th>
                <th>Division</th>
                <th>Semester</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {classes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="tm-empty">
                    No classes added yet.
                  </td>
                </tr>
              ) : (
                classes.map((cls) => (
                  <tr key={cls.classId}>
                    <td>
                      <code
                        style={{
                          color: "var(--accent)",
                          fontWeight: 700,
                          fontSize: "14px",
                        }}
                      >
                        {cls.classId}
                      </code>
                    </td>

                    <td style={{ color: "var(--text-2)" }}>
                      {cls.admissionYear}
                    </td>

                    <td style={{ color: "var(--text-2)" }}>
                      {cls.passoutYear}
                    </td>

                    <td>
                      {cls.division && cls.division !== "None" ? (
                        <span className="tm-badge">{cls.division}</span>
                      ) : (
                        <span
                          style={{
                            color: "var(--text-3)",
                            fontSize: "13px",
                          }}
                        >
                          —
                        </span>
                      )}
                    </td>

                    <td>
                      {editingClassId === cls.classId ? (
                        <div className="mc-sem-edit-row">
                          <select
                            className="tm-inline-input"
                            value={editSemester}
                            onChange={(e) => setEditSemester(e.target.value)}
                          >
                            {SEMESTERS.map((s) => (
                              <option key={s} value={String(s)}>
                                Semester {s}
                              </option>
                            ))}
                          </select>

                          <button
                            className="tm-btn tm-save-btn"
                            onClick={() => handleSemesterSave(cls.classId)}
                          >
                            💾
                          </button>

                          <button
                            className="tm-btn tm-cancel-btn"
                            onClick={() => {
                              setEditingClassId(null);
                              setEditSemester("1");
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <span className="sm-sem-badge">{cls.semester}</span>
                      )}
                    </td>

                    <td className="tm-actions">
                      <button
                        className="tm-btn tm-edit-btn"
                        onClick={() => {
                          setEditingClassId(cls.classId);
                          setEditSemester(String(cls.semester));
                        }}
                      >
                        ✏️ Semester
                      </button>

                      <button
                        className="tm-btn tm-delete-btn"
                        onClick={() => setDeleteClassId(cls.classId)}
                      >
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

      {deleteClassId && (
        <div className="eval-overlay" onClick={() => setDeleteClassId(null)}>
          <div
            className="tm-confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="tm-confirm-icon">🗑️</p>
            <h3>Delete Class?</h3>
            <p className="tm-confirm-sub">
              Class{" "}
              <strong style={{ color: "var(--accent)" }}>{deleteClassId}</strong>{" "}
              will be permanently removed from the system.
            </p>
            <p className="warning-text">⚠️ This action cannot be undone.</p>

            <div className="tm-confirm-actions">
              <button
                className="com-btn"
                onClick={() => setDeleteClassId(null)}
              >
                Cancel
              </button>
              <button
                className="com-btn danger-btn"
                onClick={handleDeleteConfirm}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageClass;
