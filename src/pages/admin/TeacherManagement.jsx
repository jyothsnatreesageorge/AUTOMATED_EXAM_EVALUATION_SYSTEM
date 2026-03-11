import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./AdminDashboard.css";

const NAV_ITEMS = [
  { label: "Dashboard", icon: "⊞", path: "/admin" },
  { label: "Teacher Management", icon: "🎓", path: "/admin/teachers", active: true },
  { label: "Student Management", icon: "👥", path: "/admin/students" },
  { label: "Manage Course", icon: "📚", path: "/admin/add-course" },
  { label: "Manage Class", icon: "🏫", path: "/admin/add-class" },
  { label: "Course Mapping", icon: "🔗", path: "/admin/course-mapping" },
];
const API_BASE = import.meta.env.VITE_API_BASE_URL;

const TeacherManagement = () => {

  const admin = { name: "Admin1", role: "System Administrator" };
  const navigate = useNavigate();

  const [teachers, setTeachers] = useState([]);
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const API = `${API_BASE}/api/teachers`;

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    try {
      const res = await axios.get(API);
      setTeachers(res.data);
    } catch (err) {
      console.error("Error fetching teachers", err);
    }
  };

  const filtered = teachers.filter((t) => {
  const searchText = search.toLowerCase();
  return (
    (t.id || "").toLowerCase().includes(searchText) ||
    (t.name || "").toLowerCase().includes(searchText) ||
    (t.email || "").toLowerCase().includes(searchText) ||
    (t.phone || "").includes(searchText)
  );
});
  const handleAdd = async () => {

    if (!newName || !newEmail || !newPhone ) {
      alert("Please fill all fields ❌");
      return;
    }

    try {

      await axios.post(API, {
        name: newName,
        email: newEmail,
        phone: newPhone
      });

      fetchTeachers();

      setNewName("");
      setNewEmail("");
      setNewPhone("");

      setShowAddForm(false);

    } catch (err) {
      console.error("Add teacher error", err);
    }
  };

  const handleEditOpen = (teacher) => {

    setEditingId(teacher.id);

    setEditName(teacher.name);
    setEditEmail(teacher.email);
    setEditPhone(teacher.phone);
  };

  const handleEditSave = async (id) => {

    try {

      await axios.put(`${API}/${id}`, {
        name: editName,
        email: editEmail,
        phone: editPhone
      });

      fetchTeachers();
      setEditingId(null);

    } catch (err) {
      console.error("Update error", err);
    }
  };

  const handleDeleteConfirm = async () => {

    try {

      await axios.delete(`${API}/${deleteId}`);

      fetchTeachers();
      setDeleteId(null);

    } catch (err) {
      console.error("Delete error", err);
    }
  };

  return (
    <div className="container">

      <aside className="sidebar">
        <h2 className="logo">SAGE</h2>

        <div className="user-info">
          <div className="avatar">{admin.name.charAt(0)}</div>

          <div className="user-details">
            <h4>{admin.name}</h4>
            <p>{admin.role}</p>
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
          Teacher <span>Management</span>
        </h1>

        <div className="tm-stats-row">
          <div className="sm-stat-card">
            <span className="sm-stat-icon">🎓</span>
            <div>
              <p className="sm-stat-value">{teachers.length}</p>
              <p className="sm-stat-label">Total Teachers</p>
            </div>
          </div>

          <div className="sm-stat-card">
            <span className="sm-stat-icon">🔍</span>
            <div>
              <p className="sm-stat-value">{filtered.length}</p>
              <p className="sm-stat-label">Showing</p>
            </div>
          </div>
        </div>

        <div className="tm-toolbar">

          <div className="tm-search-wrap">
            <span className="tm-search-icon">🔍</span>

          <input
            className="tm-search"
            placeholder="Search by name, email, or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          </div>

          <button
            className="com-btn primary-btn tm-add-btn"
            onClick={() => setShowAddForm((p) => !p)}
          >
            {showAddForm ? "✕ Cancel" : "+ Add Teacher"}
          </button>
        </div>

        {showAddForm && (

          <div className="com-card form-card tm-add-form">

            <h3>Add New Teacher</h3>

            <div className="tm-form-grid">

              <input
                placeholder="Full Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />

              <input
                placeholder="Email Address"
                value={newEmail}
                type="email"
                onChange={(e) => setNewEmail(e.target.value)}
              />

              <input
                placeholder="Phone Number"
                value={newPhone}
                type="tel"
                onChange={(e) => setNewPhone(e.target.value)}
              />

            </div>

            <button className="com-btn primary-btn" onClick={handleAdd}>
              + Add Teacher
            </button>

          </div>
        )}

        <div className="com-card tm-table-card">

          <table className="tm-table">

            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>

              {filtered.map((teacher) =>
                editingId === teacher.id ? (

                  <tr key={teacher.id}>

                    <td>{teacher.id}</td>

                    <td>
                      <input value={editName}
                        onChange={(e) => setEditName(e.target.value)} />
                    </td>

                    <td>
                      <input value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)} />
                    </td>

                    <td>
                      <input value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)} />
                    </td>

                    <td>

                      <button
                        className="tm-btn tm-save-btn"
                        onClick={() => handleEditSave(teacher.id)}
                      >
                        💾 Save
                      </button>

                      <button
                        className="tm-btn tm-cancel-btn"
                        onClick={() => setEditingId(null)}
                      >
                        ✕
                      </button>

                    </td>

                  </tr>

                ) : (

                  <tr key={teacher.id}>

                    <td>{teacher.id}</td>
                    <td>{teacher.name}</td>
                    <td>{teacher.email}</td>
                    <td>{teacher.phone}</td>

                    <td>

                      <button
                        className="tm-btn tm-edit-btn"
                        onClick={() => handleEditOpen(teacher)}
                      >
                        ✏️ Edit
                      </button>

                      <button
                        className="tm-btn tm-delete-btn"
                        onClick={() => setDeleteId(teacher.id)}
                      >
                        🗑️ Delete
                      </button>

                    </td>

                  </tr>

                )
              )}

            </tbody>

          </table>
        </div>

      </main>

      {deleteId && (

        <div className="eval-overlay">

          <div className="tm-confirm-modal">

            <h3>Delete Teacher?</h3>

            <p>This action cannot be undone.</p>

            <button
              className="com-btn"
              onClick={() => setDeleteId(null)}
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
      )}

    </div>
  );
};
export default TeacherManagement;
