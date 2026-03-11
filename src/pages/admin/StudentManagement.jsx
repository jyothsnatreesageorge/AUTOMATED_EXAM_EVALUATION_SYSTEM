import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";
import * as XLSX from "xlsx";

const NAV_ITEMS = [
  { label: "Dashboard", icon: "⊞", path: "/admin" },
  { label: "Teacher Management", icon: "🎓", path: "/admin/teachers" },
  { label: "Student Management", icon: "👥", path: "/admin/students", active: true },
  { label: "Manage Course", icon: "📚", path: "/admin/add-course" },
  { label: "Manage Class", icon: "🏫", path: "/admin/add-class" },
  { label: "Course Mapping", icon: "🔗", path: "/admin/course-mapping" },
];

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

const API_BASE = import.meta.env.VITE_API_BASE_URL;

const SemesterSelect = ({
  value,
  onChange,
  placeholder = "Select Semester",
  className = "",
}) => (
  <select
    className={className}
    value={value}
    onChange={(e) => onChange(Number(e.target.value))}
  >
    <option value="" disabled>
      {placeholder}
    </option>
    {SEMESTERS.map((s) => (
      <option key={s} value={s}>
        Semester {s}
      </option>
    ))}
  </select>
);

const StudentManagement = () => {
  const admin = { name: "Admin1", role: "System Administrator" };
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [students, setStudents] = useState([]);
  const [classesList, setClassesList] = useState([]);

  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("All");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [showBatchSem, setShowBatchSem] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [batchFile, setBatchFile] = useState(null);
  const [batchStatus, setBatchStatus] = useState("");

  const [batchSemTarget, setBatchSemTarget] = useState("filtered");
  const [batchSemValue, setBatchSemValue] = useState("");
  const [batchSemStatus, setBatchSemStatus] = useState("");

  const [newName, setNewName] = useState("");
  const [newRoll, setNewRoll] = useState("");
  const [newClass, setNewClass] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const [editName, setEditName] = useState("");
  const [editRoll, setEditRoll] = useState("");
  const [editClass, setEditClass] = useState("");
  const [editSemester, setEditSemester] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const fetchClasses = async () => {
    const res = await fetch(`${API_BASE}/api/classes`);
    const data = await res.json();

    if (!res.ok) throw new Error(data?.message || "Failed to fetch classes");
    setClassesList(Array.isArray(data) ? data : []);
  };

  const fetchStudents = async () => {
    const params = new URLSearchParams();

    if (search.trim()) params.set("q", search.trim());
    if (filterClass !== "All") params.set("classId", filterClass);

    const url = params.toString()
      ? `${API_BASE}/api/students?${params.toString()}`
      : `${API_BASE}/api/students`;

    console.log("Fetching students from:", url);

    const res = await fetch(url);
    const data = await res.json();

    console.log("Selected class:", filterClass);
    console.log("API returned students:", data);

    if (!res.ok) throw new Error(data?.message || "Failed to fetch students");
    setStudents(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    fetchClasses().catch((e) => alert(e.message));
  }, []);

  useEffect(() => {
    fetchStudents().catch((e) => alert(e.message));
  }, [search, filterClass]);

  const allClasses = [
    "All",
    ...Array.from(
      new Set(classesList.map((c) => c.classId).filter(Boolean))
    ).sort(),
  ];

  const filtered = students.filter((s) => {
    const matchSearch = [s.name, s.rollNo, s.admnNo, s.email, s.classId, s.semester]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(search.toLowerCase()));

    return matchSearch;
  });

  const rollCollator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
  });

  const filteredSorted = [...filtered].sort((a, b) =>
    rollCollator.compare(String(a.rollNo || ""), String(b.rollNo || ""))
  );

  const totalStudents = filteredSorted.length;
  const totalClasses = allClasses.length - 1;

  const handleAdd = async () => {
    const finalClass = filterClass !== "All" ? filterClass : newClass;

    if (!newName.trim() || !newRoll.trim() || !finalClass.trim() || !newEmail.trim()) {
      alert("Please fill all fields ❌");
      return;
    }

    try {
      const payload = {
        name: newName.trim(),
        rollNo: newRoll.trim(),
        classId: finalClass.trim(),
        email: newEmail.trim(),
      };

      const res = await fetch(`${API_BASE}/api/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to add student");

      if (data?.initialPassword) {
        alert(`✅ Student added!\nGenerated Password: ${data.initialPassword}`);
      }

      setNewName("");
      setNewRoll("");
      setNewClass("");
      setNewEmail("");
      setShowAddForm(false);

      await fetchStudents();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleEditOpen = (s) => {
    setEditingId(s._id);
    setEditName(s.name || "");
    setEditRoll(s.rollNo || "");
    setEditClass(s.classId || "");
    setEditSemester(s.semester || "");
    setEditEmail(s.email || "");
  };

  const handleEditSave = async (mongoId) => {
    if (!editName.trim() || !editRoll.trim() || !editClass.trim() || !editSemester || !editEmail.trim()) {
      alert("Please fill all fields ❌");
      return;
    }

    try {
      const payload = {
        name: editName.trim(),
        rollNo: editRoll.trim(),
        classId: editClass.trim(),
        semester: Number(editSemester),
        email: editEmail.trim(),
      };

      const res = await fetch(`${API_BASE}/api/students/${mongoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to update student");

      setEditingId(null);
      await fetchStudents();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === "student") {
        const res = await fetch(`${API_BASE}/api/students/${deleteTarget.value}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to delete student");
      }

      setDeleteTarget(null);
      await fetchStudents();
    } catch (e) {
      alert(e.message);
    }
  };

  const toggleSelect = (_id) =>
    setSelectedIds((prev) =>
      prev.includes(_id) ? prev.filter((x) => x !== _id) : [...prev, _id]
    );

  const toggleSelectAll = () =>
    setSelectedIds(
      selectedIds.length === filteredSorted.length
        ? []
        : filteredSorted.map((s) => s._id)
    );

  const handleBatchSemesterUpdate = async () => {
    if (!batchSemValue) {
      alert("Please select a semester ❌");
      return;
    }

    const targets =
      batchSemTarget === "filtered"
        ? filteredSorted
        : filterClass !== "All"
        ? students.filter((s) => s.classId === filterClass)
        : [];

    if (targets.length === 0) {
      alert("No students to update ❌");
      return;
    }

    const semNum = Number(batchSemValue);
    if (Number.isNaN(semNum) || semNum < 1 || semNum > 8) {
      alert("Invalid semester selected ❌");
      return;
    }

    try {
      await Promise.all(
        targets.map((s) =>
          fetch(`${API_BASE}/api/students/${s._id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: s.name,
              rollNo: s.rollNo,
              classId: s.classId,
              semester: semNum,
              email: s.email,
            }),
          }).then(async (r) => {
            const d = await r.json();
            if (!r.ok) throw new Error(d?.message || "Batch semester update failed");
          })
        )
      );

      setBatchSemStatus("done");
      setTimeout(() => setBatchSemStatus(""), 3000);
      await fetchStudents();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBatchFile(file);
    setBatchStatus("");
  };

  const handleBatchUpload = async () => {
    if (!batchFile) {
      alert("Please select a file first ❌");
      return;
    }

    try {
      setBatchStatus("processing");

      const selectedClassId = filterClass !== "All" ? filterClass : "";
      if (!selectedClassId) {
        alert("Please select a class first ❌");
        setBatchStatus("");
        return;
      }

      const buffer = await batchFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (!raw.length) {
        alert("Excel is empty ❌");
        setBatchStatus("");
        return;
      }

      const normalizeRow = (r) => {
        const obj = {};
        Object.keys(r).forEach((k) => {
          obj[String(k).trim().toLowerCase()] = r[k];
        });
        return obj;
      };

      const rows = raw.map(normalizeRow).map((r) => ({
        rollNo: String(r.rollno || r["roll no"] || r.roll || "").trim(),
        name: String(r.name || r.studentname || r["student name"] || "").trim(),
        email: String(r.email || r["email id"] || r.emailid || "").trim(),
        classId: selectedClassId,
      }));

      console.log("Batch rows being sent:", rows);

      const bad = rows.findIndex((r) => !r.rollNo || !r.name || !r.email);
      if (bad !== -1) {
        alert(`Row ${bad + 2} missing rollNo/name/email ❌`);
        setBatchStatus("");
        return;
      }

      const res = await fetch(`${API_BASE}/api/students/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });

      const data = await res.json();
      console.log("Batch upload response:", data);

      if (!res.ok) {
        throw new Error(
          (data?.message || "Batch upload failed") +
            (data?.errors?.length
              ? `\n${data.errors.map((e) => `Row ${e.row}: ${e.message}`).join("\n")}`
              : "")
        );
      }

      setBatchStatus("done");
      setBatchFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      alert(
        data.failed > 0
          ? `Batch partially successful. Inserted ${data.inserted}, failed ${data.failed}.`
          : `Batch upload successful. Inserted ${data.inserted} students.`
      );

      await fetchStudents();
    } catch (e) {
      console.error("Batch upload failed:", e);
      setBatchStatus("");
      alert(e.message);
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
            ↩ Logout
          </button>
        </div>

        <h1 className="page-title">
          Student <span>Management</span>
        </h1>

        <div className="sm-stats-row">
          <div className="sm-stat-card">
            <span className="sm-stat-icon">👥</span>
            <div>
              <p className="sm-stat-value">{totalStudents}</p>
              <p className="sm-stat-label">Total Students</p>
            </div>
          </div>

          <div className="sm-stat-card">
            <span className="sm-stat-icon">🏫</span>
            <div>
              <p className="sm-stat-value">{totalClasses}</p>
              <p className="sm-stat-label">Total Classes</p>
            </div>
          </div>

          <div className="sm-stat-card">
            <span className="sm-stat-icon">📋</span>
            <div>
              <p className="sm-stat-value">{filteredSorted.length}</p>
              <p className="sm-stat-label">Showing</p>
            </div>
          </div>
        </div>

        <div className="tm-toolbar" style={{ flexWrap: "wrap", gap: "10px" }}>
          <div className="tm-search-wrap" style={{ flex: "1 1 200px" }}>
            <span className="tm-search-icon">🔍</span>
            <input
              className="tm-search"
              placeholder="Search by name, roll no, semester…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="sm-class-pills">
            {allClasses.map((cls) => (
              <button
                key={cls}
                className={`sm-class-pill ${filterClass === cls ? "active" : ""}`}
                onClick={() => {
                  setFilterClass(cls);
                  setSelectedIds([]);
                }}
              >
                {cls}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              className="com-btn tm-add-btn primary-btn"
              onClick={() => {
                if (!showAddForm && filterClass !== "All") setNewClass(filterClass);
                if (showAddForm) setNewClass("");
                setShowAddForm((p) => !p);
                setShowBatch(false);
                setShowBatchSem(false);
              }}
            >
              {showAddForm ? "✕ Cancel" : "+ Add Student"}
            </button>

            <button
              className="com-btn tm-add-btn"
              onClick={() => {
                setShowBatch((p) => !p);
                setShowAddForm(false);
                setShowBatchSem(false);
              }}
            >
              {showBatch ? "✕ Cancel" : "📂 Batch Upload"}
            </button>

            <button
              className="com-btn tm-add-btn"
              onClick={() => {
                setShowBatchSem((p) => !p);
                setShowAddForm(false);
                setShowBatch(false);
                setBatchSemStatus("");
              }}
            >
              {showBatchSem ? "✕ Cancel" : "🔄 Update Semester"}
            </button>
          </div>
        </div>

        {showAddForm && (
          <div className="com-card tm-add-form" style={{ marginBottom: "20px" }}>
            <h3>Add New Student</h3>

            <div className="tm-form-grid">
              <input
                placeholder="Full Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <input
                placeholder="Roll No"
                value={newRoll}
                onChange={(e) => setNewRoll(e.target.value)}
              />

              {filterClass !== "All" ? (
                <div className="sm-class-locked">
                  <span>
                    Class: <strong>{filterClass}</strong>
                  </span>
                </div>
              ) : (
                <select
                  className="sm-select"
                  value={newClass}
                  onChange={(e) => setNewClass(e.target.value)}
                >
                  <option value="" disabled>
                    Select Class
                  </option>
                  {classesList.map((c) => (
                    <option key={c._id || c.classId} value={c.classId}>
                      {c.classId}
                    </option>
                  ))}
                </select>
              )}

              <input
                placeholder="Email Address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                type="email"
              />
            </div>

            <button className="com-btn primary-btn" onClick={handleAdd}>
              + Add Student
            </button>
          </div>
        )}

        {showBatch && (
          <div className="com-card sm-batch-card">
            <h3>📂 Batch Import Students</h3>

            <div className="sm-batch-upload-row">
              <label className="sm-file-label">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
                <span className="sm-file-btn">
                  📎 {batchFile ? batchFile.name : "Choose File"}
                </span>
              </label>

              <button
                className="com-btn primary-btn"
                onClick={handleBatchUpload}
                disabled={batchStatus === "processing"}
              >
                {batchStatus === "processing" ? "Importing…" : "Import"}
              </button>
            </div>

            {batchStatus === "done" && (
              <p className="success-text">✅ Batch processed.</p>
            )}
          </div>
        )}

        {showBatchSem && (
          <div className="com-card sm-batch-sem-card">
            <h3>🔄 Batch Update Semester</h3>

            <div className="sm-sem-action-row">
              <SemesterSelect
                className="sm-select"
                value={batchSemValue}
                onChange={setBatchSemValue}
                placeholder="Select New Semester"
              />
              <button
                className="com-btn primary-btn"
                onClick={handleBatchSemesterUpdate}
                style={{ width: "200px" }}
              >
                Apply
              </button>
            </div>

            {batchSemStatus === "done" && (
              <p className="success-text">✅ Semester updated successfully!</p>
            )}
          </div>
        )}

        <div className="com-card tm-table-card">
          <table className="tm-table">
            <thead>
              <tr>
                <th style={{ width: "40px" }}>
                  <input
                    type="checkbox"
                    checked={
                      filteredSorted.length > 0 &&
                      selectedIds.length === filteredSorted.length
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Roll No</th>
                <th>Name</th>
                <th>Adm No</th>
                <th>Class</th>
                <th>Semester</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredSorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="tm-empty">
                    No students found.
                  </td>
                </tr>
              ) : (
                filteredSorted.map((student) =>
                  editingId === student._id ? (
                    <tr key={student._id}>
                      <td />
                      <td>
                        <input
                          className="tm-inline-input"
                          value={editRoll}
                          onChange={(e) => setEditRoll(e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="tm-inline-input"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      </td>
                      <td>{student.admnNo}</td>
                      <td>
                        <input
                          className="tm-inline-input"
                          value={editClass}
                          onChange={(e) => setEditClass(e.target.value)}
                        />
                      </td>
                      <td>
                        <select
                          className="tm-inline-input"
                          value={editSemester}
                          onChange={(e) => setEditSemester(e.target.value)}
                        >
                          <option value="" disabled>
                            Sem
                          </option>
                          {SEMESTERS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className="tm-inline-input"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          type="email"
                        />
                      </td>
                      <td className="tm-actions">
                        <button
                          className="tm-btn tm-save-btn"
                          onClick={() => handleEditSave(student._id)}
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
                    <tr key={student._id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(student._id)}
                          onChange={() => toggleSelect(student._id)}
                        />
                      </td>
                      <td>{student.rollNo}</td>
                      <td>{student.name}</td>
                      <td>{student.admnNo}</td>
                      <td>
                        <span className="tm-badge">{student.classId}</span>
                      </td>
                      <td>
                        <span className="sm-sem-badge">{student.semester}</span>
                      </td>
                      <td>{student.email}</td>
                      <td className="tm-actions">
                        <button
                          className="tm-btn tm-edit-btn"
                          onClick={() => handleEditOpen(student)}
                        >
                          ✏️
                        </button>
                        <button
                          className="tm-btn tm-delete-btn"
                          onClick={() =>
                            setDeleteTarget({ type: "student", value: student._id })
                          }
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </main>

      {deleteTarget && (
        <div className="eval-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="tm-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Student?</h3>
            <p>{students.find((s) => s._id === deleteTarget.value)?.name} will be removed.</p>
            <div className="tm-confirm-actions">
              <button className="com-btn" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="com-btn danger-btn" onClick={handleDeleteConfirm}>
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentManagement;
