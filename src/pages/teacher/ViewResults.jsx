import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../admin/AdminDashboard.css";

const NAV_ITEMS = [
  { label: "Dashboard", icon: "⊞", path: "/teacher" },
  { label: "My Classes", icon: "🏫", path: "/teacher/classes" },
  { label: "Evaluation", icon: "📋", path: "/evaluation" },
  { label: "View Results", icon: "📊", path: "/view-mark", active: true },
  { label: "Reference Answer", icon: "📖", path: "/reference-answer" },
  { label: "Revaluation", icon: "🔄", path: "/revaluation" },
];

const ViewResult = () => {
  const navigate = useNavigate();
  const teacher = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");

  const [filters, setFilters] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedExam, setSelectedExam] = useState("");

  const [results, setResults] = useState([]);
  const [expandedRollNo, setExpandedRollNo] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/markmatrix/filters", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setFilters(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err);
        setFilters([]);
      }
    };

    if (token) fetchFilters();
  }, [token]);

  const classOptions = useMemo(() => {
    const unique = [...new Set(filters.map((f) => f.classId))];
    return unique;
  }, [filters]);

  const courseOptions = useMemo(() => {
    if (!selectedClass) return [];
    const filtered = filters.filter((f) => f.classId === selectedClass);
    return [...new Set(filtered.map((f) => f.courseName))];
  }, [filters, selectedClass]);

  const examOptions = useMemo(() => {
    if (!selectedClass || !selectedCourse) return [];
    const item = filters.find(
      (f) => f.classId === selectedClass && f.courseName === selectedCourse
    );
    return item?.exams || [];
  }, [filters, selectedClass, selectedCourse]);

  const handleView = async () => {
    if (!selectedClass || !selectedCourse || !selectedExam) {
      alert("Please select class, course and exam");
      return;
    }

    try {
      const res = await axios.get("http://localhost:5000/api/markmatrix/results", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          classId: selectedClass,
          course: selectedCourse,
          examType: selectedExam,
        },
      });

      const data = Array.isArray(res.data) ? res.data : [];
      setResults(data);
      setExpandedRollNo(null);
      setMessage(data.length ? "" : "No results found");
    } catch (err) {
      console.error(err);
      setResults([]);
      setExpandedRollNo(null);
      setMessage(
        err?.response?.data?.message || "Failed to load results"
      );
    }
  };

  const handleChangeClass = (e) => {
    setSelectedClass(e.target.value);
    setSelectedCourse("");
    setSelectedExam("");
    setResults([]);
    setMessage("");
    setExpandedRollNo(null);
  };

  const handleChangeCourse = (e) => {
    setSelectedCourse(e.target.value);
    setSelectedExam("");
    setResults([]);
    setMessage("");
    setExpandedRollNo(null);
  };

  const handleChangeExam = (e) => {
    setSelectedExam(e.target.value);
    setResults([]);
    setMessage("");
    setExpandedRollNo(null);
  };

  return (
    <div className="container">
      <aside className="sidebar">
        <h2 className="logo">SAGE</h2>

        <div className="user-info">
          <div className="avatar">T</div>
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
          View <span>Results</span>
        </h1>

        <div
          className="com-card filter-card"
          style={{ display: "flex", gap: "20px", alignItems: "flex-end", flexWrap: "wrap" }}
        >
          <div className="filter-group">
            <label>Class</label>
            <select value={selectedClass} onChange={handleChangeClass}>
              <option value="">Select Class</option>
              {classOptions.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Course</label>
            <select value={selectedCourse} onChange={handleChangeCourse}>
              <option value="">Select Course</option>
              {courseOptions.map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Exam</label>
            <select value={selectedExam} onChange={handleChangeExam}>
              <option value="">Select Exam</option>
              {examOptions.map((exam) => (
                <option key={exam} value={exam}>
                  {exam}
                </option>
              ))}
            </select>
          </div>

          <button
            className="com-btn view-btn"
            style={{ height: "42px" }}
            onClick={handleView}
          >
            View Results
          </button>
        </div>

        {message && (
          <p style={{ marginTop: "20px", color: "orange" }}>{message}</p>
        )}

        {results.length > 0 && (
          <div className="com-card results-table-card" style={{ marginTop: "20px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "20px",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div>
                <h3>
                  {selectedExam} — {selectedCourse}
                </h3>
                <p>Class: {selectedClass}</p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                <p style={{ fontWeight: 600 }}>{results.length} students</p>

                <button
                className="com-btn"
                style={{ padding: "8px 14px" }}
              >
                Export Excel
              </button>
              </div>
            </div>

            <table className="tm-table">
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Total</th>
                  <th>Max</th>
                  <th>%</th>
                  <th>Details</th>
                </tr>
              </thead>

              <tbody>
                {results.map((row) => {
                  const isOpen = expandedRollNo === row.rollNo;

                  return (
                    <React.Fragment key={row._id || row.rollNo}>
                      <tr>
                        <td>{row.rollNo}</td>
                        <td>{row.totalMarks}</td>
                      <td>{row.maxMarks}</td>
                      <td>{((row.totalMarks / row.maxMarks) * 100).toFixed(1)}%</td>
                        <td>
                          <button
                            className="com-btn"
                            style={{ padding: "6px 12px", fontSize: "12px" }}
                            onClick={() =>
                              setExpandedRollNo(isOpen ? null : row.rollNo)
                            }
                          >
                            {isOpen ? "Hide" : "View"}
                          </button>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr>
                          <td colSpan={5} style={{ background: "#fafafa" }}>
                            <div style={{ padding: "12px 0" }}>
                              <h4 style={{ marginBottom: "10px" }}>
                                Roll No: {row.rollNo}
                              </h4>

                              <table className="tm-table">
                                <thead>
                                  <tr>
                                    <th>Question</th>
                                    <th>Marks</th>
                                    <th>Max</th>
                                    <th>Reason</th>
                                  </tr>
                                </thead>
                                <tbody>
                                 {(row.questions || []).filter((q) => !q.excluded).length > 0 ? (
  (row.questions || [])
    .filter((q) => !q.excluded)
    .map((q) => (
      <tr key={`${row.rollNo}-${q.question}-${q.max}`}>
        <td>{q.question}</td>
        <td>{q.marks}</td>
        <td>{q.max}</td>
        <td>
          {q.marks < q.max ? q.deductionReason : "✓ Full marks"}
        </td>
      </tr>
    ))
) : (
  <tr>
    <td colSpan={4} style={{ textAlign: "center" }}>
      No results found
    </td>
  </tr>
)}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

export default ViewResult;