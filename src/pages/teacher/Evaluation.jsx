import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../admin/AdminDashboard.css";

const NAV_ITEMS = [
  { label: "Dashboard", icon: "⊞", path: "/teacher" },
  { label: "Evaluation", icon: "📋", path: "/evaluation", active: true },
  { label: "View Results", icon: "📊", path: "/view-mark" },
  { label: "Reference Answer", icon: "📖", path: "/reference-answer" },
  { label: "Revaluation", icon: "🔄", path: "/revaluation" },
  { label: "My Classes", icon: "🏫", path: "/courseclass" },
];

const EXAM_TYPES = [
  "Series Test 1",
  "Series Test 2",
  "Retest Series 1",
  "Retest Series 2",
];
const API_BASE = import.meta.env.VITE_API_BASE_URL;
const EVALUATION_TYPES = ["Liberal", "Average", "Strict"];

const Evaluation = () => {
  const navigate = useNavigate();

  const [teacher] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  });

  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [mode, setMode] = useState(null);

  const [filterClass, setFilterClass] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedExam, setSelectedExam] = useState(null);

  const [newClass, setNewClass] = useState("");
  const [newCourse, setNewCourse] = useState("");
  const [newType, setNewType] = useState("");
  const [newEvalType, setNewEvalType] = useState("");

  const [editTarget, setEditTarget] = useState(null);
  const [editClass, setEditClass] = useState("");
  const [editCourse, setEditCourse] = useState("");
  const [editType, setEditType] = useState("");
  const [editEvalType, setEditEvalType] = useState("");

  const [deleteActiveCard, setDeleteActiveCard] = useState(null);

  useEffect(() => {
    if (!teacher?._id) return;

    const fetchTeacherExams = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/exams/teacher/${teacher._id}`
        );
        if (!res.ok) throw new Error(`Failed to fetch exams: ${res.status}`);
        const data = await res.json();
        setExams(data || []);
      } catch (err) {
        console.error("Error fetching teacher exams:", err);
      }
    };

    fetchTeacherExams();
  }, [teacher?._id]);

  useEffect(() => {
    if (!teacher?._id) return;

    const fetchOptions = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/exams/teacher/${teacher._id}/options`
        );
        if (!res.ok) throw new Error(`Failed to fetch options: ${res.status}`);
        const data = await res.json();
        setClasses(data.classes || []);
        setCourses(data.courses || []);
      } catch (err) {
        console.error("Error fetching options:", err);
      }
    };

    fetchOptions();
  }, [teacher?._id]);

  const filteredExams = exams.filter((e) => {
    const matchClass = filterClass === "All" || e.classId?.toString() === filterClass;
    const matchType = filterType === "All" || e.examType === filterType;
    const matchSearch = [e.classId, e.course, e.examType, e.evalType].some((v) =>
      (v?.toString() || "").toLowerCase().includes(search.toLowerCase())
    );
    return matchClass && matchType && matchSearch;
  });

  const handleProceedExisting = () => {
    if (!selectedExam) return;

    if (selectedExam.status === "Draft") {
      navigate("/upload-materials", {
        state: { exam: selectedExam, mode: "existing" },
      });
    } else if (selectedExam.status === "Active") {
      navigate("/uploadscript", {
        state: { exam: selectedExam, mode: "existing" },
      });
    }
  };

  const handleProceedNew = async () => {
    if (!newClass || !newCourse || !newType || !newEvalType) return;

    try {
      const res = await fetch("${API_BASE}/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: newClass,
          course: newCourse,
          examType: newType,
          evalType: newEvalType,
          teacherId: teacher._id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error(data);
        return;
      }

      navigate("/upload-materials", {
        state: { exam: data.exam, mode: "new" },
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteExam = async (exam) => {
    try {
      const res = await fetch(`${API_BASE}/api/exams/${exam._id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();

      setExams((prev) => prev.filter((e) => e._id !== exam._id));
      if (selectedExam?._id === exam._id) setSelectedExam(null);
      setDeleteActiveCard(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditExam = async (exam) => {
    const updates = {
      classId: editClass,
      course: editCourse,
      examType: editType,
      evalType: editEvalType,
    };

    try {
      const res = await fetch(`${API_BASE}/api/exams/${exam._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const data = await res.json();
      if (!res.ok) throw new Error();

      setExams((prev) => prev.map((e) => (e._id === exam._id ? data.exam : e)));
      if (selectedExam?._id === exam._id) setSelectedExam(data.exam);
      setEditTarget(null);
    } catch (err) {
      console.error(err);
    }
  };

  const openEdit = (e, exam) => {
    e.stopPropagation();
    setDeleteActiveCard(null);
    setEditTarget(exam._id);
    setEditClass(exam.classId || "");
    setEditCourse(exam.course || "");
    setEditType(exam.examType || "");
    setEditEvalType(exam.evalType || "");
  };

  const openDelete = (e, exam) => {
    e.stopPropagation();
    setEditTarget(null);
    setDeleteActiveCard(exam._id);
  };

  return (
    <div className="container">
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
          Exam <span>Evaluation</span>
        </h1>

        <div className="ev-mode-row">
          <button
            className={`ev-mode-card ${mode === "select" ? "active" : ""}`}
            onClick={() => setMode(mode === "select" ? null : "select")}
          >
            <span className="ev-mode-icon">🗂️</span>
            <span className="ev-mode-title">Select Existing Exam</span>
            <span className="ev-mode-sub">
              Choose from a previously created exam
            </span>
          </button>

          <button
            className={`ev-mode-card ${mode === "create" ? "active" : ""}`}
            onClick={() => setMode(mode === "create" ? null : "create")}
          >
            <span className="ev-mode-icon">✨</span>
            <span className="ev-mode-title">Create New Exam</span>
            <span className="ev-mode-sub">
              Set up a brand new evaluation
            </span>
          </button>
        </div>

        {mode === "select" && (
          <div className="ev-panel">
            <div className="ev-filter-row">
              <div className="tm-search-wrap" style={{ flex: "1 1 200px" }}>
                <span className="tm-search-icon">🔍</span>
                <input
                  className="tm-search"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedExam(null);
                  }}
                />
              </div>

              <div className="sm-class-pills">
                {["All", ...classes].map((cls) => (
                  <button
                    key={cls}
                    className={`sm-class-pill ${
                      filterClass === cls ? "active" : ""
                    }`}
                    onClick={() => {
                      setFilterClass(cls);
                      setSelectedExam(null);
                    }}
                  >
                    {cls}
                  </button>
                ))}
              </div>

              <div className="sm-class-pills">
                {["All", ...EXAM_TYPES].map((t) => (
                  <button
                    key={t}
                    className={`sm-class-pill ${
                      filterType === t ? "active" : ""
                    }`}
                    onClick={() => {
                      setFilterType(t);
                      setSelectedExam(null);
                    }}
                  >
                    {t === "All" ? "All Types" : t}
                  </button>
                ))}
              </div>
            </div>

            <div className="ev-exam-grid">
              {filteredExams.length === 0 ? (
                <p className="tm-empty" style={{ padding: "32px 0" }}>
                  No exams match your filters.
                </p>
              ) : (
                filteredExams.map((exam) => (
                  <div key={exam._id}>
                    {editTarget === exam._id ? (
                      <div className="ev-exam-card ev-edit-card">
                        <p className="ev-edit-label">Edit Exam</p>

                        <div className="mc-form-grid" style={{ marginBottom: "10px" }}>
                          <div className="mc-field">
                            <label>Class</label>
                            <select
                              value={editClass}
                              onChange={(e) => setEditClass(e.target.value)}
                            >
                              <option value="" disabled>
                                Select Class
                              </option>
                              {classes.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="mc-field">
                            <label>Course</label>
                            <select
                              value={editCourse}
                              onChange={(e) => setEditCourse(e.target.value)}
                            >
                              <option value="" disabled>
                                Select Course
                              </option>
                              {courses.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="mc-field">
                            <label>Exam Type</label>
                            <select
                              value={editType}
                              onChange={(e) => setEditType(e.target.value)}
                            >
                              <option value="" disabled>
                                Select Type
                              </option>
                              {EXAM_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="mc-field">
                            <label>Evaluation Type</label>
                            <select
                              value={editEvalType}
                              onChange={(e) => setEditEvalType(e.target.value)}
                            >
                              <option value="" disabled>
                                Select Type
                              </option>
                              {EVALUATION_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                            className="com-btn"
                            style={{ background: "#e5e7eb", color: "#374151" }}
                            onClick={() => setEditTarget(null)}
                          >
                            Cancel
                          </button>
                          <button
                            className="com-btn primary-btn"
                            onClick={() => handleEditExam(exam)}
                            disabled={
                              !editClass || !editCourse || !editType || !editEvalType
                            }
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : deleteActiveCard === exam._id ? (
                      <div className="ev-exam-card ev-delete-card">
                        <p className="ev-delete-msg">
                          Delete <strong>{exam.course}</strong> ({exam.classId} ·{" "}
                          {exam.examType})?
                        </p>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            justifyContent: "flex-end",
                            marginTop: "12px",
                          }}
                        >
                          <button
                            className="com-btn"
                            style={{ background: "#e5e7eb", color: "#374151" }}
                            onClick={() => setDeleteActiveCard(null)}
                          >
                            Cancel
                          </button>
                          <button
                            className="com-btn"
                            style={{ background: "#ef4444", color: "#fff" }}
                            onClick={() => handleDeleteExam(exam)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`ev-exam-card ${
                          selectedExam?._id === exam._id ? "selected" : ""
                        }`}
                        onClick={() => setSelectedExam(exam)}
                      >
                        <div className="ev-exam-card-top">
                          <span className="tm-badge">{exam.classId}</span>
                          <span className="ev-exam-type">{exam.examType}</span>

                          <div
                            className="ev-card-actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="ev-action-btn ev-edit-btn"
                              title="Edit exam"
                              onClick={(e) => openEdit(e, exam)}
                            >
                              ✏️
                            </button>
                            <button
                              className="ev-action-btn ev-delete-btn"
                              title="Delete exam"
                              onClick={(e) => openDelete(e, exam)}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        <p className="ev-exam-course">{exam.course}</p>
                        <p className="ev-exam-meta">{exam.date}</p>
                        <p className="ev-exam-meta">
                          Evaluation Type: {exam.evalType || "Not set"}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="ev-proceed-row" style={{ marginTop: "8px" }}>
              {selectedExam && (
                <div className="ev-selected-summary">
                  Selected: <strong>{selectedExam.course}</strong> ·{" "}
                  {selectedExam.classId} · {selectedExam.examType} ·{" "}
                  {selectedExam.evalType || "Not set"}
                </div>
              )}
              <button
                className="com-btn primary-btn ev-proceed-btn"
                onClick={handleProceedExisting}
                disabled={!selectedExam}
              >
                Proceed →
              </button>
            </div>
          </div>
        )}

        {mode === "create" && (
          <div className="ev-panel">
            <div className="com-card mc-form-card">
              <h3>New Exam Details</h3>

              <div className="mc-form-grid">
                <div className="mc-field">
                  <label>Class</label>
                  <select value={newClass} onChange={(e) => setNewClass(e.target.value)}>
                    <option value="" disabled>
                      Select Class
                    </option>
                    {classes.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mc-field">
                  <label>Course</label>
                  <select value={newCourse} onChange={(e) => setNewCourse(e.target.value)}>
                    <option value="" disabled>
                      Select Course
                    </option>
                    {courses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mc-field">
                  <label>Exam Type</label>
                  <select value={newType} onChange={(e) => setNewType(e.target.value)}>
                    <option value="" disabled>
                      Select Type
                    </option>
                    {EXAM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mc-field">
                  <label>Evaluation Type</label>
                  <select
                    value={newEvalType}
                    onChange={(e) => setNewEvalType(e.target.value)}
                  >
                    <option value="" disabled>
                      Select Type
                    </option>
                    {EVALUATION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="ev-proceed-row" style={{ marginTop: "8px" }}>
                <button
                  className="com-btn primary-btn ev-proceed-btn"
                  onClick={handleProceedNew}
                  disabled={!newClass || !newCourse || !newType || !newEvalType}
                >
                  Save & Continue →
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Evaluation;
