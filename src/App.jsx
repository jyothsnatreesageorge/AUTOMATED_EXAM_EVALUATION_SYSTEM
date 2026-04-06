import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/auth/Login";
import Profile from "./pages/Profile";

/* ========== Student Pages ========== */
import StudentDashboard from "./pages/student/StudentDashboard";
import ViewAnswerKey from "./pages/student/ViewStudentAnswer";
import ViewResult from "./pages/student/ViewStudentResult";

/* ========== Teacher Pages ========== */
import Teacher from "./pages/teacher/TeacherDashboard";
import Evaluation from "./pages/teacher/Evaluation";
import ViewResults from "./pages/teacher/ViewResults";
import ReferenceAnswer from "./pages/teacher/ReferenceAnswers";
import Revaluation from "./pages/teacher/Revaluation";
import UploadMaterials from "./pages/teacher/UploadMaterials";
import UpdateMark from "./pages/teacher/UpdateMark";
import Uploadscript from "./pages/teacher/uploadscript";
import Courseclass from "./pages/teacher/CourseClass";
import ApiKeys from "./pages/teacher/ApiKeys";

/* ========== Admin Pages ========== */
import AdminDashboard from "./pages/admin/AdminDashboard";
import TeacherManagement from "./pages/admin/TeacherManagement";
import StudentManagement from "./pages/admin/StudentManagement";
import AddCourse from "./pages/admin/AddCourse";
import AddClass from "./pages/admin/AddClass";
import CourseMapping from "./pages/admin/CourseMapping";

function App() {
  return (
    <Routes>

      {/* ===== Login ===== */}
      <Route path="/login" element={<Login />} />

      {/* ===== Profile ===== */}
      <Route path="/profile" element={<Profile />} />

      {/* ===== Student Routes ===== */}
      <Route path="/student" element={<StudentDashboard />} />
      <Route path="/student/answer-key" element={<ViewAnswerKey />} />
      <Route path="/student/result" element={<ViewResult />} />

      {/* ===== Teacher Routes ===== */}
      <Route path="/teacher" element={<Teacher />} />
      <Route path="/evaluation" element={<Evaluation />} />
      <Route path="/upload-materials" element={<UploadMaterials />} />
      <Route path="/view-mark" element={<ViewResults />} />
      <Route path="/reference-answer" element={<ReferenceAnswer />} />
      <Route path="/revaluation" element={<Revaluation />} />
      <Route path="/update-mark" element={<UpdateMark />} /> 
      <Route path="/uploadscript" element={<Uploadscript />} />
      <Route path="/courseclass" element={<Courseclass />} />
      <Route path="/api-keys" element={<ApiKeys />} />

      
      {/* ===== Admin Routes ===== */}
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/teachers" element={<TeacherManagement />} />
      <Route path="/admin/students" element={<StudentManagement />} />
      <Route path="/admin/add-course" element={<AddCourse />} />
      <Route path="/admin/add-class" element={<AddClass />} />
      <Route path="/admin/course-mapping" element={<CourseMapping />} />

      {/* ===== Default Redirect ===== */}
      <Route path="/" element={<Navigate to="/login" />} />

      {/* ===== Fallback ===== */}
      <Route path="*" element={<Navigate to="/login" />} />

    </Routes>
  );
}

export default App;
