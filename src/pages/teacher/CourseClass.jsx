import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../admin/AdminDashboard.css";

const NAV_ITEMS = [
  { label: "Dashboard", icon: "⊞", path: "/teacher" },
  { label: "My Classes", icon: "🏫", path: "/teacher/classes", active: true },
  { label: "Evaluation", icon: "📋", path: "/evaluation" },
  { label: "View Results", icon: "📊", path: "/view-mark" },
  { label: "Reference Answer", icon: "📖", path: "/reference-answer" },
  { label: "Revaluation", icon: "🔄", path: "/revaluation" },
];

const TABS = ["Classes & Students", "Courses", "Exams"];
const API_BASE = import.meta.env.VITE_API_BASE_URL;

const TeacherClasses = () => {
  const teacher = JSON.parse(localStorage.getItem("user"));
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(0);

  const [teacherClasses, setTeacherClasses] = useState([]);
  const [teacherCourses, setTeacherCourses] = useState([]);
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);

  const [selectedClass, setSelectedClass] = useState(null);
  const [studentSearch, setStudentSearch] = useState("");

  const [courseSearch, setCourseSearch] = useState("");

  const [examClass, setExamClass] = useState("All");
  const [examCourse, setExamCourse] = useState("All");
  const [expandedExam, setExpandedExam] = useState(null);

  const teacherId = teacher?._id || teacher?.id || "";

  useEffect(() => {
    const fetchTeacherData = async () => {
      try {
        if (!teacherId) {
          console.error("Teacher ID not found");
          setTeacherClasses([]);
          setTeacherCourses([]);
          return;
        }

        const res = await axios.get(
          `${API_BASE}/api/courseclass/teacher/${teacherId}/courses-classes`
        );

        const classesData = Array.isArray(res.data?.classes) ? res.data.classes : [];
        const coursesData = Array.isArray(res.data?.courses) ? res.data.courses : [];

        // keep old working intact, but safely enrich each course with classes[]
        const normalizedCourses = coursesData.map((course) => ({
          ...course,
          classes: Array.isArray(course.classes)
            ? course.classes
            : Array.isArray(course.classIds)
            ? course.classIds
            : Array.isArray(course.classId)
            ? course.classId
            : course.classId
            ? [course.classId]
            : [],
        }));

        setTeacherClasses(classesData);
        setTeacherCourses(normalizedCourses);
      } catch (err) {
        console.error("Error fetching teacher data:", err);
        setTeacherClasses([]);
        setTeacherCourses([]);
      }
    };

    fetchTeacherData();
  }, [teacherId]);

  useEffect(() => {
    const fetchExams = async () => {
      try {
        if (!teacherId) {
          setExams([]);
          return;
        }

        const res = await axios.get("${API_BASE}/api/courseclass/exams", {
          params: {
            teacherId,
            classId: examClass !== "All" ? examClass : undefined,
            course: examCourse !== "All" ? examCourse : undefined,
          },
        });

        console.log("Exams API response:", res.data);

        const examsData = Array.isArray(res.data) ? res.data : [];
        setExams(examsData);
      } catch (err) {
        console.error("Error fetching exams:", err);
        setExams([]);
      }
    };

    fetchExams();
  }, [teacherId, examClass, examCourse]);

  console.log("Current states:");
  console.log("teacherClasses:", teacherClasses);
  console.log("teacherCourses:", teacherCourses);
  console.log("students:", students);
  console.log("selectedClass:", selectedClass);
  console.log("exams:", exams);

  const selectedClassData =
    teacherClasses.find((c) => c._id === selectedClass) || { students: [] };

  const filteredStudents = (students || []).filter((s) =>
    [s.name, s.admNo, s.rollNo, s.email].some((v) =>
      (v || "").toString().toLowerCase().includes(studentSearch.toLowerCase())
    )
  );

  const filteredCourses = (teacherCourses || []).filter((c) =>
    [c.courseId, c.courseName, c.course].some((v) =>
      (v || "").toString().toLowerCase().includes(courseSearch.toLowerCase())
    )
  );

  const filteredExams = (exams || []).filter((e) => {
    const examClassId = e.classId?._id || e.classId;
    const examCourseValue = e.courseId?._id || e.course || e.courseId;

    const matchClass = examClass === "All" || examClassId === examClass;
    const matchCourse = examCourse === "All" || examCourseValue === examCourse;

    return matchClass && matchCourse;
  });

  const handleClassClick = async (cls) => {
    setSelectedClass(cls._id);
    setStudentSearch("");

    try {
      const res = await axios.get(
        `${API_BASE}/api/courseclass/class/${cls._id}/students`
      );

      console.log("RAW student response:", res.data);

      const studentData = Array.isArray(res.data) ? res.data : [];
      studentData.sort((a, b) => {
        const ra = parseInt(a.rollNo, 10);
        const rb = parseInt(b.rollNo, 10);

        if (Number.isNaN(ra) || Number.isNaN(rb)) {
          return (a.rollNo || "").toString().localeCompare((b.rollNo || "").toString());
        }

        return ra - rb;
      });

      setStudents(studentData);
    } catch (err) {
      console.error("Error fetching students:", err);
      setStudents([]);
    }
  };

  const openFile = (file) => {
    if (!file) return;
    window.open(file, "_blank");
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
          My <span>Classes</span>
        </h1>

        <div className="tm-stats-row" style={{ marginBottom: "24px" }}>
          <div className="sm-stat-card">
            <span className="sm-stat-icon">🏫</span>
            <div>
              <p className="sm-stat-value">{teacherClasses.length}</p>
              <p className="sm-stat-label">Classes</p>
            </div>
          </div>

          <div className="sm-stat-card">
            <span className="sm-stat-icon">👥</span>
            <div>
              <p className="sm-stat-value">{students.length}</p>
              <p className="sm-stat-label">Total Students</p>
            </div>
          </div>

          <div className="sm-stat-card">
            <span className="sm-stat-icon">📚</span>
            <div>
              <p className="sm-stat-value">{teacherCourses.length}</p>
              <p className="sm-stat-label">Courses</p>
            </div>
          </div>

          <div className="sm-stat-card">
            <span className="sm-stat-icon">📋</span>
            <div>
              <p className="sm-stat-value">{exams.length}</p>
              <p className="sm-stat-label">Exams</p>
            </div>
          </div>
        </div>

        <div className="tc-tab-bar">
          {TABS.map((t, i) => (
            <button
              key={t}
              className={`tc-tab ${activeTab === i ? "active" : ""}`}
              onClick={() => setActiveTab(i)}
            >
              {t}
            </button>
          ))}
        </div>

        {activeTab === 0 && (
          <div className="tc-tab-content">
            <div className="tc-two-col">
              <div className="tc-class-list">
                <p className="tc-col-label">Your Classes</p>

                {(teacherClasses || []).map((cls) => (
                  <div
                    key={cls._id}
                    className={`tc-class-card ${
                      selectedClass === cls._id ? "active" : ""
                    }`}
                    onClick={() => handleClassClick(cls)}
                  >
                    <div className="tc-class-card-top">
                      <span className="tm-badge">{cls.classId}</span>
                      <span className="tc-student-count">
                        {cls.studentsCount || 0} students
                      </span>
                    </div>

                    <p className="tc-class-meta">
                      {cls.admYear} – {cls.passOutYear}{" "}
                      {cls.division && `· Division ${cls.division}`}
                    </p>

                    <div className="tc-class-courses">
                      {(teacherCourses || [])
                        .filter((c) => (c.classes || []).includes(cls._id))
                        .map((c) => (
                          <span key={c._id} className="tc-course-chip">
                            {c.courseName || c.courseId || c.course}
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="tc-student-panel">
                {!selectedClass ? (
                  <div className="tc-empty-state">
                    <span style={{ fontSize: "40px" }}>👈</span>
                    <p>Select a class to view its students</p>
                  </div>
                ) : (
                  <>
                    <div className="tc-student-panel-header">
                      <p className="tc-col-label">
                        Students in{" "}
                        <span style={{ color: "var(--accent)" }}>
                          {selectedClassData.classId}
                        </span>
                      </p>

                      <div
                        className="tm-search-wrap"
                        style={{ maxWidth: "260px" }}
                      >
                        <span className="tm-search-icon">🔍</span>
                        <input
                          className="tm-search"
                          placeholder="Search students…"
                          value={studentSearch}
                          onChange={(e) => setStudentSearch(e.target.value)}
                        />
                      </div>
                    </div>

                    <table className="tm-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Roll No</th>
                          <th>Adm No</th>
                          <th>Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="tm-empty">
                              No students found.
                            </td>
                          </tr>
                        ) : (
                          filteredStudents.map((s) => (
                            <tr key={s._id}>
                              <td
                                style={{
                                  fontWeight: 600,
                                  color: "var(--text-1)",
                                }}
                              >
                                {s.name}
                              </td>
                              <td style={{ color: "var(--text-2)" }}>
                                {s.rollNo}
                              </td>
                              <td style={{ color: "var(--text-2)" }}>
                                {s.admNo}
                              </td>
                              <td style={{ color: "var(--text-2)" }}>
                                {s.email}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 1 && (
          <div className="tc-tab-content">
            <div className="tm-toolbar" style={{ marginBottom: "20px" }}>
              <div className="tm-search-wrap">
                <span className="tm-search-icon">🔍</span>
                <input
                  className="tm-search"
                  placeholder="Search courses…"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="tc-course-grid">
              {filteredCourses.length === 0 ? (
                <p className="tm-empty">No courses found.</p>
              ) : (
                filteredCourses.map((course) => (
                  <div key={course._id} className="tc-course-card">
                    <div className="tc-course-card-top">
                      <code className="tc-course-id">{course.courseId}</code>
                    </div>
                    <p className="tc-course-name">{course.courseName}</p>

                    <div className="tc-course-classes">
                      <span
                        className="tc-col-label"
                        style={{
                          fontSize: "11px",
                          marginBottom: "6px",
                          display: "block",
                        }}
                      >
                        Taught to
                      </span>

                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          flexWrap: "wrap",
                        }}
                      >
                        {(course.classes || []).map((clsId) => {
                          const clsObj = teacherClasses.find((c) => c._id === clsId);
                          return (
                            <span key={clsId} className="tm-badge">
                              {clsObj?.classId || clsId}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 2 && (
          <div className="tc-tab-content">
            <div
              className="tm-toolbar"
              style={{ flexWrap: "wrap", gap: "10px", marginBottom: "20px" }}
            >
              <div className="sm-class-pills">
                {["All", ...(teacherClasses || []).map((c) => c._id)].map((clsId) => {
                  const clsObj = teacherClasses.find((c) => c._id === clsId);
                  return (
                    <button
                      key={clsId}
                      className={`sm-class-pill ${examClass === clsId ? "active" : ""}`}
                      onClick={() => {
                        setExamClass(clsId);
                        setExpandedExam(null);
                      }}
                    >
                      {clsId === "All" ? "All Classes" : clsObj?.classId || clsId}
                    </button>
                  );
                })}
              </div>

              <div className="sm-class-pills">
                {[
                  "All",
                  ...(teacherCourses || []).map((c) => c._id || c.course || c.courseId),
                ].map((courseValue) => {
                  const courseObj = teacherCourses.find(
                    (c) => (c._id || c.course || c.courseId) === courseValue
                  );

                  return (
                    <button
                      key={courseValue}
                      className={`sm-class-pill ${
                        examCourse === courseValue ? "active" : ""
                      }`}
                      onClick={() => {
                        setExamCourse(courseValue);
                        setExpandedExam(null);
                      }}
                    >
                      {courseValue === "All"
                        ? "All Courses"
                        : courseObj?.courseName || courseObj?.courseId || courseValue}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="tc-exam-list">
              {filteredExams.length === 0 ? (
                <div className="com-card" style={{ textAlign: "center", padding: "48px" }}>
                  <p style={{ color: "var(--text-3)", fontSize: "15px" }}>
                    No exams match the selected filters.
                  </p>
                </div>
              ) : (
                filteredExams.map((exam) => {
                  const courseObj =
                    teacherCourses.find(
                      (c) =>
                        c._id === (exam.courseId?._id || exam.courseId) ||
                        c.course === exam.course ||
                        c.courseId === exam.course
                    ) || null;

                  const isOpen = expandedExam === exam._id;

                  return (
                    <div key={exam._id} className={`tc-exam-row ${isOpen ? "open" : ""}`}>
                      <div
                        className="tc-exam-row-header"
                        onClick={() => setExpandedExam(isOpen ? null : exam._id)}
                      >
                        <div className="tc-exam-row-left">
                          <span className="tm-badge">
                            {exam.classId?.classId || exam.classId}
                          </span>
                          <div>
                            <p className="tc-exam-row-name">
                              {exam.courseId?.courseName ||
                                courseObj?.courseName ||
                                courseObj?.courseId ||
                                exam.course ||
                                exam.courseId}
                            </p>
                            <p className="tc-exam-row-meta">
                              {exam.type || exam.examType}
                              {exam.date ? ` · 📅 ${exam.date}` : ""}
                              {exam._id ? (
                                <>
                                  {" "}
                                  · <code>{exam._id}</code>
                                </>
                              ) : null}
                            </p>
                          </div>
                        </div>
                        <span className={`tc-exam-chevron ${isOpen ? "open" : ""}`}>
                          ›
                        </span>
                      </div>

                      {isOpen && exam.files && (
                        <div className="tc-exam-files">
                          {Object.entries(exam.files || {}).map(([key, file]) => (
                            <button
                              key={key}
                              className="tc-file-btn"
                              onClick={() => openFile(file)}
                            >
                              <span className="tc-file-icon">📄</span>
                              <span>{key}</span>
                              <span className="tc-file-name">{file}</span>
                              <span className="tc-file-arrow">↗</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TeacherClasses;
