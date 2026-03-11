import React, { useRef, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../admin/AdminDashboard.css";

const NAV_ITEMS = [
  { label: "Dashboard", icon: "⊞", path: "/teacher" },
  { label: "Evaluation", icon: "📋", path: "/evaluation", active: true },
  { label: "View Results", icon: "📊", path: "/view-mark" },
  { label: "Reference Answer", icon: "📖", path: "/reference-answer" },
  { label: "Revaluation", icon: "🔄", path: "/revaluation" },
  { label: "My Classes", icon: "🏫", path: "/courseclass" },
];

const UPLOAD_TILES = [
  {
    icon: "📄",
    label: "Question Paper",
    hint: "PDF only",
    accept: ".pdf",
    multiple: false,
    dir: false,
  },
  {
    icon: "📝",
    label: "Marking Scheme",
    hint: "PDF only",
    accept: ".pdf",
    multiple: false,
    dir: false,
  },
  {
    icon: "📂",
    label: "Answer Scripts",
    hint: "Upload folder",
    accept: "",
    multiple: true,
    dir: true,
  },
  {
    icon: "📖",
    label: "Reference Texts",
    hint: "PDF only",
    accept: ".pdf",
    multiple: true,
    dir: false,
  },
];

const EvaluatingModal = () => (
  <div className="eval-overlay">
    <div className="eval-modal">
      <div className="eval-spinner">
        <div className="eval-ring" />
        <div className="eval-ring eval-ring--2" />
        <div className="eval-ring eval-ring--3" />
        <span className="eval-icon">📋</span>
      </div>
      <h3 className="eval-title">Evaluating Answers</h3>
      <p className="eval-subtitle">
        Please wait while SAGE processes the submissions…
      </p>
      <div className="eval-progress">
        <div className="eval-progress-bar" />
      </div>
    </div>
  </div>
);

const UploadMaterials = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const exam = location.state?.exam || null;

  const [teacher, setTeacher] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState({});
  const fileRefs = useRef({});

  useEffect(() => {
    try {
      const storedTeacher = JSON.parse(localStorage.getItem("user"));
      if (storedTeacher) setTeacher(storedTeacher);
    } catch (err) {
      console.error("Error reading teacher from localStorage:", err);
    }
  }, []);

  const handleFileSelect = (fieldName, files) => {
    const fileArray = Array.from(files || []);
    setSelectedFiles((prev) => ({ ...prev, [fieldName]: fileArray }));
    console.log(
      `Selected files for ${fieldName}:`,
      fileArray.map((f) => f.name)
    );
  };

  const handleUploadAndEvaluate = async () => {
    if (!exam) {
      alert("Exam details missing!");
      return;
    }

    setIsEvaluating(true);

    try {
      const formData = new FormData();
      formData.append("course", exam.course || "");
      formData.append("examType", exam.examType || "");
      formData.append("classId", exam.classId || "");
      formData.append("examId", exam._id || "");

      console.log("exam from location.state:", exam);
      console.log("values being sent:", {
        classId: exam.classId || "",
        course: exam.course || "",
        examType: exam.examType || "",
        examId: exam._id || "",
        evalType: exam.evalType || "",
      });

      UPLOAD_TILES.forEach(({ label }) => {
        const fieldName = label.toLowerCase().replace(/\s/g, "_");
        const input = fileRefs.current[fieldName];

        if (input?.files?.length > 0) {
          Array.from(input.files).forEach((file) => {
            formData.append(fieldName, file);
          });
        }
      });

      const uploadRes = await fetch(
        "http://localhost:5000/api/upload/evaluation-materials",
        {
          method: "POST",
          body: formData,
        }
      );

      const uploadText = await uploadRes.text();
      console.log("Upload raw response:", uploadText);

      let uploadData;
      try {
        uploadData = JSON.parse(uploadText);
      } catch {
        throw new Error("Upload API returned invalid JSON");
      }

      if (!uploadRes.ok) {
        throw new Error(uploadData.error || "Upload failed");
      }

      console.log("Upload success:", uploadData);

      const evalRes = await fetch("http://localhost:5000/api/evaluation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: exam.classId,
          course: exam.course,
          examType: exam.examType,
          evalType: exam.evalType,
        }),
      });

      const evalText = await evalRes.text();
      console.log("Evaluation raw response:", evalText);

      let evalData;
      try {
        evalData = JSON.parse(evalText);
      } catch {
        throw new Error("Evaluation API returned invalid JSON");
      }

      if (!evalRes.ok) {
        throw new Error(evalData.error || evalData.message || "Evaluation failed");
      }

      console.log("Evaluation success:", evalData);
      alert("Upload and evaluation completed successfully ✅");

      navigate("/view-mark", { state: { exam } });
    } catch (err) {
      console.error(err);
      alert(err.message || "Something went wrong");
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="container">
      {isEvaluating && <EvaluatingModal />}

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
        <button className="us-back-btn" onClick={() => navigate("/evaluation")}>
          ← Back to Evaluation
        </button>

        <h1 className="page-title">
          {exam ? (
            <>
              {exam.examType} — {exam.classId} — <span>{exam.course}</span>
            </>
          ) : (
            "Upload Evaluation Materials"
          )}
        </h1>

        <div className="com-card upload-card">
          <h3>Upload Evaluation Materials</h3>

          <div className="upload-grid option1">
            {UPLOAD_TILES.map(({ icon, label, hint, accept, multiple, dir }) => {
              const fieldName = label.toLowerCase().replace(/\s/g, "_");

              return (
                <label className="upload-tile" key={label}>
                  <span className="icon">{icon}</span>
                  <p>{label}</p>
                  <small>{hint}</small>

                  <input
                    type="file"
                    accept={accept || undefined}
                    multiple={multiple || undefined}
                    ref={(el) => (fileRefs.current[fieldName] = el)}
                    onChange={(e) => handleFileSelect(fieldName, e.target.files)}
                    {...(dir ? { webkitdirectory: "true", directory: "" } : {})}
                  />

                  {selectedFiles[fieldName]?.length > 0 && (
                    <ul className="selected-files-list">
                      {selectedFiles[fieldName].map((f, index) => (
                        <li key={`${f.name}-${index}`}>{f.name}</li>
                      ))}
                    </ul>
                  )}
                </label>
              );
            })}
          </div>

          <button className="com-btn evaluate-btn" onClick={handleUploadAndEvaluate}>
            ⚡ Upload & Evaluate
          </button>
        </div>
      </main>
    </div>
  );
};

export default UploadMaterials;