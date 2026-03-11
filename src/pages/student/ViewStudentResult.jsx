import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../admin/AdminDashboard.css";

const NAV_ITEMS = [
  { label: "Dashboard", icon: "⊞", path: "/student" },
  { label: "View Answer Key", icon: "📖", path: "/student/answer-key" },
  { label: "View Result", icon: "📊", path: "/student/result", active: true },
];

const ViewResult = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  const [course, setCourse] = useState("");
  const [exam, setExam] = useState("");
  const [courses, setCourses] = useState([]);

  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [revalStatus, setRevalStatus] = useState(null);

  const [message, setMessage] = useState("");

  /* ---------------------------------------
     LOAD COURSES FOR STUDENT
  --------------------------------------- */
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await fetch(
          `http://localhost:5000/api/students/courses/${user.rollNo}`
        );

        const data = await res.json();
        setCourses(Array.isArray(data.courses) ? data.courses : []);
      } catch (err) {
        console.log(err);
      }
    };

    if (user?.rollNo) fetchCourses();
  }, [user?.rollNo]);

  /* ---------------------------------------
     VIEW RESULT
  --------------------------------------- */
  const handleView = async () => {
    if (!course || !exam) {
      alert("Please select both a course and exam");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/students/result", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rollNo: user.rollNo,
          course,
          examType: exam,
        }),
      });

      const data = await res.json();

      if (data.result) {
        setResult(data.result);
        setShowResult(true);
        setMessage("");
      } else {
        setResult(null);
        setShowResult(false);
        setMessage("Result not available");
      }
    } catch (err) {
      console.log(err);
      setResult(null);
      setShowResult(false);
      setMessage("Failed to load result");
    }
  };

  const handleChange = (setter) => (e) => {
    setter(e.target.value);
    setShowResult(false);
    setMessage("");
    setResult(null);
    setRevalStatus(null);
  };

  /* ---------------------------------------
     REVALUATION REQUEST
  --------------------------------------- */
  const handleRequestReval = async () => {
    setRevalStatus("pending");

    try {
      const savedUser = JSON.parse(localStorage.getItem("user"));

      const res = await fetch("http://localhost:5000/api/students/revaluation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentName: savedUser.name,
          rollNo: savedUser.rollNo,
          classId: savedUser.classId,
          course: course,
          examType: exam,
        }),
      });

      const data = await res.json();

      if (data.message === "Revaluation already requested") {
        alert("⚠️ You have already requested revaluation for this exam.");
        setRevalStatus("submitted");
      } else {
        alert("✅ Revaluation request submitted successfully.");
        setRevalStatus("submitted");
      }
    } catch (err) {
      console.log(err);
      alert("Server error");
      setRevalStatus(null);
    }
  };

  /* ---------------------------------------
     CALCULATE TOTAL
  --------------------------------------- */
  const validQuestions = result?.questions?.filter((q) => !q.excluded) || [];

 const total = validQuestions.reduce(
  (sum, q) => sum + Number(q.marks || 0),
  0
);

const maxTotal = validQuestions.reduce(
  (sum, q) => sum + Number(q.max || 0),
  0
);

  const pct = maxTotal ? Math.round((Number(total) / maxTotal) * 100) : 0;

  return (
    <div className="container">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <h2 className="logo">SAGE</h2>

        <div className="user-info">
          <div className="avatar">{user?.name?.charAt(0).toUpperCase()}</div>

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
            onClick={() => navigate("/login")}
          >
            ↩ Logout
          </button>
        </div>

        <h1 className="page-title">
          View <span>Result</span>
        </h1>

        {/* FILTER */}
        <div
          className="com-card filter-card"
          style={{ display: "flex", gap: "20px", alignItems: "flex-end" }}
        >
          <div className="filter-group">
            <label>Course</label>

            <select value={course} onChange={handleChange(setCourse)}>
              <option value="">Select Course</option>

              {Array.isArray(courses) &&
                courses.map((c) => (
                  <option key={c._id || c.courseId} value={c.courseName}>
                    {c.courseName}
                  </option>
                ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Exam</label>

            <select value={exam} onChange={handleChange(setExam)}>
              <option value="">Select Exam</option>
              <option value="Series Test 1">Series Test 1</option>
              <option value="Series Test 2">Series Test 2</option>
            </select>
          </div>

          <button
            className="com-btn view-btn"
            style={{ height: "42px" }}
            onClick={handleView}
          >
            View Result
          </button>
        </div>

        {message && (
          <p style={{ marginTop: "20px", color: "orange" }}>{message}</p>
        )}

        {/* RESULT */}
        {showResult && result && (
          <div className="com-card results-table-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              <div>
                <h3>
                  {exam} — {course}
                </h3>

                <p>Roll No: {user.rollNo}</p>
              </div>

              <div>
                <p style={{ fontSize: "28px" }}>
                  {total}/{maxTotal}
                </p>
                <p>{pct}%</p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Marks</th>
                  <th>Max</th>
                  <th>Reason</th>
                </tr>
              </thead>

              <tbody>
                {validQuestions.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "16px" }}>
                      No question-wise result available.
                    </td>
                  </tr>
                ) : (
                  validQuestions.map((q) => (
                    <tr key={q.question}>
                      <td>{q.question}</td>
                      <td>{q.marks}</td>
                      <td>{q.max}</td>
                      <td>
                        {q.marks < q.max ? q.deductionReason : "✓ Full marks"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div style={{ marginTop: "20px", textAlign: "right" }}>
              <button className="com-btn reval-btn" onClick={handleRequestReval}>
                {revalStatus === "submitted"
                  ? "Reval Requested ✓"
                  : "Request Revaluation"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ViewResult;