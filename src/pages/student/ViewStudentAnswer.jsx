import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../admin/AdminDashboard.css";

const NAV_ITEMS = [
  { label: "Dashboard", icon: "⊞", path: "/student" },
  { label: "View Answer Key", icon: "📖", path: "/student/answer-key", active: true },
  { label: "View Result", icon: "📊", path: "/student/result" },
];
const API_BASE = import.meta.env.VITE_API_BASE_URL;

const ViewAnswerKey = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  const [course, setCourse] = useState("");
  const [exam, setExam] = useState("");
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/students/courses/${user.rollNo}`
        );

        const data = await res.json();
        setCourses(Array.isArray(data.courses) ? data.courses : []);
      } catch (err) {
        console.log(err);
      }
    };

    if (user?.rollNo) fetchCourses();
  }, [user?.rollNo]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    navigate("/");
  };

  const handleViewAnswerKey = async () => {
    if (!course || !exam) {
      alert("Please select course and exam");
      return;
    }

    if (!user?.classId) {
      alert("Class not found for this student");
      return;
    }

    try {
      console.log("User object:", user);
      console.log("Course:", course);
      console.log("Exam:", exam);
      console.log("ClassId:", user.classId);

      const res = await axios.get(
        `${API_BASE}/api/reference/student/${encodeURIComponent(
          course
        )}/${encodeURIComponent(exam)}/${encodeURIComponent(user.classId)}`
      );

      console.log("Answer key response:", res.data);

      if (res.data?.fileUrl) {
        window.open(res.data.fileUrl, "_blank");
      } else if (res.data?.pdfLink) {
        const url = `https://exam-evaluation-mini2026.s3.amazonaws.com/${res.data.pdfLink}`;
        window.open(url, "_blank");
      } else {
        alert(res.data?.message || "Answer key not available");
      }
    } catch (err) {
      console.log(err);
      alert(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to open answer key"
      );
    }
  };

  return (
    <div className="container">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <h2 className="logo">SAGE</h2>

        <div className="user-info">
          <div className="avatar">
            {user?.name?.charAt(0).toUpperCase()}
          </div>

          <div className="user-details">
            <h4>{user?.name}</h4>
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

      {/* MAIN */}
      <main className="main">
        <div className="logout-container">
          <button
            className="com-btn logout-btn-top"
            onClick={handleLogout}
          >
            ↩ Logout
          </button>
        </div>

        <h1 className="page-title">
          View <span>Answer Key</span>
        </h1>

        <div
          className="com-card filter-card"
          style={{ display: "flex", gap: "20px", alignItems: "flex-end" }}
        >
          {/* COURSE */}
          <div className="filter-group">
            <label>Course</label>

            <select
              value={course}
              onChange={(e) => setCourse(e.target.value)}
            >
              <option value="">Select Course</option>

              {Array.isArray(courses) &&
                courses.map((c) => (
                  <option key={c._id || c.courseId} value={c.courseName}>
                    {c.courseName}
                  </option>
                ))}
            </select>
          </div>

          {/* EXAM */}
          <div className="filter-group">
            <label>Exam</label>

            <select
              value={exam}
              onChange={(e) => setExam(e.target.value)}
            >
              <option value="">Select Exam</option>
              <option value="Series Test 1">Series Test 1</option>
              <option value="Series Test 2">Series Test 2</option>
              <option value="Retest Series 1">Retest Series 1</option>
              <option value="Retest Series 2">Retest Series 2</option>
            </select>
          </div>

          <button
            className="com-btn view-btn"
            style={{ height: "42px" }}
            onClick={handleViewAnswerKey}
          >
            View Answer Key
          </button>
        </div>
      </main>
    </div>
  );
};

export default ViewAnswerKey;
