import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import "../admin/AdminDashboard.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const NAV_ITEMS = [
  { label: "Dashboard",        icon: "⊞", path: "/teacher" },
  { label: "Evaluation",       icon: "📋", path: "/evaluation" },
  { label: "View Results",     icon: "📊", path: "/view-mark", active: true },
  { label: "Reference Answer", icon: "📖", path: "/reference-answer" },
  { label: "Revaluation",      icon: "🔄", path: "/revaluation" },
  { label: "My Classes",       icon: "🏫", path: "/courseclass" },
];

const ViewResult = () => {
  const navigate = useNavigate();
  const teacher  = JSON.parse(localStorage.getItem("user"));
  const token    = localStorage.getItem("token");

  const [filters,        setFilters]        = useState([]);
  const [selectedClass,  setSelectedClass]  = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedExam,   setSelectedExam]   = useState("");
  const [results,        setResults]        = useState([]);
  const [expandedRollNo, setExpandedRollNo] = useState(null);
  const [message,        setMessage]        = useState("");

  /* ── Load filters ── */
  useEffect(() => {
    if (!token) return;
    axios
      .get(`${API_BASE}/api/markmatrix/filters`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setFilters(Array.isArray(res.data) ? res.data : []))
      .catch((err) => { console.error(err); setFilters([]); });
  }, [token]);

  /* ── Derived filter options ── */
  const classOptions = useMemo(
    () => [...new Set(filters.map((f) => f.classId))],
    [filters]
  );

  const courseOptions = useMemo(() => {
    if (!selectedClass) return [];
    return [...new Set(
      filters.filter((f) => f.classId === selectedClass).map((f) => f.courseName)
    )];
  }, [filters, selectedClass]);

  const examOptions = useMemo(() => {
    if (!selectedClass || !selectedCourse) return [];
    const item = filters.find(
      (f) => f.classId === selectedClass && f.courseName === selectedCourse
    );
    return item?.exams || [];
  }, [filters, selectedClass, selectedCourse]);

  /* ── Fetch results ── */
  const handleView = async () => {
    if (!selectedClass || !selectedCourse || !selectedExam) {
      alert("Please select class, course and exam");
      return;
    }
    try {
      const res = await axios.get(`${API_BASE}/api/markmatrix/results`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { classId: selectedClass, course: selectedCourse, examType: selectedExam },
      });
      const data = Array.isArray(res.data) ? res.data : [];
      setResults(data);
      setExpandedRollNo(null);
      setMessage(data.length ? "" : "No results found");
    } catch (err) {
      console.error(err);
      setResults([]);
      setExpandedRollNo(null);
      setMessage(err?.response?.data?.message || "Failed to load results");
    }
  };

  const handleChangeClass = (e) => {
    setSelectedClass(e.target.value);
    setSelectedCourse(""); setSelectedExam("");
    setResults([]); setMessage(""); setExpandedRollNo(null);
  };
  const handleChangeCourse = (e) => {
    setSelectedCourse(e.target.value);
    setSelectedExam("");
    setResults([]); setMessage(""); setExpandedRollNo(null);
  };
  const handleChangeExam = (e) => {
    setSelectedExam(e.target.value);
    setResults([]); setMessage(""); setExpandedRollNo(null);
  };
// FIND and REPLACE handleExportExcel with this:
const handleExportExcel = () => {
  if (!results.length) return;

  const maxQ = results.reduce((max, row) => {
    return Math.max(max, (row.questions || []).length);
  }, 0);

  const headers = ["Roll No"];
  for (let i = 1; i <= maxQ; i++) {
    headers.push(`Q${i} Marks`, `Q${i} Max`, `Q${i} Justification`);
  }
  headers.push("Total Marks", "Max Marks", "Percentage");

  const excelRows = results.map((row) => {
    const questions = row.questions || [];
    const dataRow = [row.rollNo];

    for (let i = 0; i < maxQ; i++) {
      const q = questions[i];
      dataRow.push(
        q ? q.marks           : "",
        q ? q.max             : "",
        q ? q.deductionReason : ""
      );
    }

    const pct = row.maxMarks
      ? ((row.totalMarks / row.maxMarks) * 100).toFixed(1) + "%"
      : "—";

    dataRow.push(row.totalMarks, row.maxMarks, pct);
    return dataRow;
  });

  const wsData = [headers, ...excelRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[cellAddress]) continue;
    ws[cellAddress].s = { font: { bold: true } };
  }

  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 14) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Results");

  const fileName = `${selectedClass}_${selectedCourse}_${selectedExam}_Results.xlsx`
    .replace(/\s+/g, "_");

  XLSX.writeFile(wb, fileName);
};

  return (
    <div className="container">

      {/* ── Sidebar ── */}
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
            <li key={label} className={active ? "active" : ""} onClick={() => navigate(path)}>
              <span className="nav-icon">{icon}</span>{label}
            </li>
          ))}
        </ul>
      </aside>

      {/* ── Main ── */}
      <main className="main">
        <div className="logout-container">
          <button className="com-btn logout-btn-top" onClick={() => navigate("/login")}>
            ↩ Back
          </button>
        </div>

        <h1 className="page-title">View <span>Results</span></h1>

        {/* Filters */}
        <div
          className="com-card filter-card"
          style={{ display: "flex", gap: "20px", alignItems: "flex-end", flexWrap: "wrap" }}
        >
          <div className="filter-group">
            <label>Class</label>
            <select value={selectedClass} onChange={handleChangeClass}>
              <option value="">Select Class</option>
              {classOptions.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Course</label>
            <select value={selectedCourse} onChange={handleChangeCourse}>
              <option value="">Select Course</option>
              {courseOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Exam</label>
            <select value={selectedExam} onChange={handleChangeExam}>
              <option value="">Select Exam</option>
              {examOptions.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <button className="com-btn view-btn inline-btn" onClick={handleView}>
            View Results
          </button>
        </div>

        {message && <p className="vr-message">{message}</p>}

        {/* Results table */}
        {results.length > 0 && (
          <div className="com-card results-table-card" style={{ marginTop: "20px" }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              marginBottom: "20px", alignItems: "center",
              flexWrap: "wrap", gap: "10px",
            }}>
              <div>
                <h3>{selectedExam} — {selectedCourse}</h3>
                <p>Class: {selectedClass}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                <p style={{ fontWeight: 600 }}>{results.length} students</p>
                <button
  className="com-btn ghost-btn inline-btn"
  onClick={handleExportExcel}
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
                  const pct    = row.maxMarks
                    ? ((row.totalMarks / row.maxMarks) * 100).toFixed(1)
                    : "—";

                  return (
                    <React.Fragment key={row._id || row.rollNo}>

                      {/* Summary row */}
                      <tr>
                        <td>{row.rollNo}</td>
                        <td>{row.totalMarks}</td>
                        <td>{row.maxMarks}</td>
                        <td>{pct}%</td>
                        <td>
                          <button
                            className="com-btn view-btn"
                            onClick={() => setExpandedRollNo(isOpen ? null : row.rollNo)}
                          >
                            {isOpen ? "Hide" : "View"}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded detail */}
                      {isOpen && (
                        <tr>
                          <td colSpan={5} className="vr-expanded-td">
                            <div className="vr-expanded-inner">

                              {/* Summary header */}
                              <div className="vsr-summary-row">
                                <div>
                                  <h3 className="vsr-summary-title">
                                    {selectedExam} — {selectedCourse}
                                  </h3>
                                  <p className="vsr-summary-roll">Roll No: {row.rollNo}</p>
                                </div>
                                <div className="vsr-score-block">
                                  <p className="vsr-score-total">
                                    {row.totalMarks}/{row.maxMarks}
                                  </p>
                                  <p className="vsr-score-pct">{pct}%</p>
                                </div>
                              </div>

                              {/* Question-wise marks */}
                              <p className="vsr-section-label">Question-wise marks</p>

                              {row.questions?.length > 0 ? (
                                <div className="vsr-table-wrap">
                                  <table className="vsr-table">
                                    <thead>
                                      <tr>
                                        <th className="vsr-th">Q No</th>
                                        <th className="vsr-th">Max Marks</th>
                                        <th className="vsr-th">Marks Awarded</th>
                                        <th className="vsr-th">Justification</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {row.questions.map((q, i) => (
                                        <tr key={i} className="vsr-tr">
                                          <td className="vsr-td">{q.question?.toUpperCase()}</td>
                                          <td className="vsr-td">{q.max}</td>
                                          <td className="vsr-td">{q.marks}</td>
                                          <td className="vsr-td">{q.deductionReason || "—"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="vsr-empty">No detailed breakdown available.</p>
                              )}

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
