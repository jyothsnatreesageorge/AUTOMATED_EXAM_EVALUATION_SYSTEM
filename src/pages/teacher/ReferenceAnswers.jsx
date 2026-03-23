import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../admin/AdminDashboard.css";

const NAV_ITEMS = [
  { label: "Dashboard", icon: "⊞", path: "/teacher" },
  { label: "Evaluation", icon: "📋", path: "/evaluation" },
  { label: "View Results", icon: "📊", path: "/view-mark" },
  { label: "Reference Answer", icon: "📖", path: "/teacher/view-reference", active: true },
  { label: "Revaluation", icon: "🔄", path: "/revaluation" },
  {label:"My Classes",icon:"🏫",path:"/courseclass"},
];
const API_BASE = import.meta.env.VITE_API_BASE_URL;
const ReferenceAnswer = () => {
  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [exams, setExams] = useState([]);

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedExam, setSelectedExam] = useState("");

  const [reference, setReference] = useState(null);

  // ===============================
  // Load Dropdown Data
  // ===============================
  useEffect(() => {
    fetch(`${API_BASE}/api/reference/dropdowns`)
      .then(res => res.json())
      .then(data => {
        setClasses(data.classes);
        setCourses(data.courses);
        setExams(data.exams);
      })
      .catch(err => console.error(err));
  }, []);

  // ===============================
  // View Answer
  // ===============================
  const handleView = async () => {
    if (!selectedClass || !selectedCourse || !selectedExam) {
      alert("Please select Class, Course and Exam");
      return;
    }

    const res = await fetch(
      `${API_BASE}/api/reference/view`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          className: selectedClass,
          courseName: selectedCourse,
          examType: selectedExam
        })
      }
    );

    const data = await res.json();

    if (!res.ok) {
      alert(data.message);
      return;
    }

    setReference(data);

    // 🔥 Open PDF
    console.log("PDF LINK:", data.pdfLink);
window.open(data.fileUrl, "_blank");
  };

  // ===============================
  // Approve
  // ===============================
  const handleApprove = async () => {
    await fetch(
      `${API_BASE}/api/reference/approve/${reference._id}`,
      { method: "PUT" }
    );

    setReference({ ...reference, status: true });
  };

  return (
    <div className="container">
      <aside className="sidebar">
        <h2 className="logo">SAGE</h2>
        
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
        <h1 className="page-title">
          Reference <span>Answer</span>
        </h1>

        {/* Filter Card */}
        <div className="com-card filter-card">

          <div className="filter-group">
  <label>Class</label>

  <select
    value={selectedClass}
    onChange={async (e) => {

      const value = e.target.value;
      setSelectedClass(value);

      if (!value) return;

      const res = await fetch(
        `${API_BASE}/api/reference/courses/${value}`
      );

      const data = await res.json();

      setCourses(data.courses || []);
    }}
  >
    {/* ADDED */}
    <option value="">Select Class</option>

    {/* ADDED */}
   {classes.map((cls) => (
  <option key={cls._id} value={cls.classId}>
    {cls.classId}
  </option>
))}

  </select>

</div>

          <div className="filter-group">
            <label>Course</label>
            <select onChange={(e) => setSelectedCourse(e.target.value)}>
              <option value="">Select Course</option>
              {courses.map(c => (
               <option key={c._id} value={c.courseName}>
  {c.courseName}
</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Exam</label>
            <select onChange={(e) => setSelectedExam(e.target.value)}>
              <option value="">Select Exam</option>
              {exams.map(e => (
  <option key={e}>{e}</option>
))}
            </select>
          </div>

          <button className="com-btn view-btn" onClick={handleView}>
            View Answer
          </button>
        </div>

        {/* Reference Panel */}
        {reference && (
          <div className="com-card reference-card">
            <div className="reference-header">
              <h3>Reference Answer</h3>

              {!reference.status ? (
                <button
                  className="com-btn approve-btn"
                  onClick={handleApprove}
                >
                  ✓ Approve
                </button>
              ) : (
                <span className="approved-badge">✓ Approved</span>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ReferenceAnswer;
