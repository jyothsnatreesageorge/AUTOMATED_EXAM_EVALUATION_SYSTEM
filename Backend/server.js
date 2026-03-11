import express from "express";
import cors from "cors";
import "dotenv/config";
import { connectDB } from "./db.js";
import studentRoutes from "./routes/student.js";
import courseRoutes from "./routes/courseRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import examRoutes from "./routes/examRoutes.js";
import evaluationRoutes from "./routes/evaluationRoutes.js";
import markMatrixRoutes from "./routes/markMatrixRoutes.js";
import studentController from "./routes/studentRoutes.js";
import teacherRoutes from "./routes/teacherRoutes.js";
import courseMappingRoutes from "./routes/coursemappingRoutes.js";
import classRoutes from "./routes/classroutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import teacherlogin from "./routes/teacherloginRoutes.js";
import UploadscriptRoutes from "./routes/uploadscriptRoutes.js";
import ReferenceAnswerRoutes from "./routes/referenceAnswerRoutes.js";
import courseclass from "./routes/courseclassRoutes.js";

const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://smartautomatedgradingengine.vercel.app"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Backend is live",
    status: "ok"
  });
});

await connectDB();

app.use("/api/courses", courseRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/uploadscript", UploadscriptRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/evaluation", evaluationRoutes);
app.use("/api/markmatrix", markMatrixRoutes);
app.use("/api/students", studentController);
app.use("/api/teachers", teacherRoutes);
app.use("/api/course-mapping", courseMappingRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/teacherlogin", teacherlogin);
app.use("/api/reference", ReferenceAnswerRoutes);
app.use("/api/courseclass", courseclass);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});
