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

import resultRoutes from "./routes/resultRoutes.js";

const app = express();

// ── CORS — must be first ──────────────────────────────────────────────────
app.use(cors({
  origin: [
    "https://smartautomatedgradingengine.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));
app.options("*", cors({
  origin: [
    "https://smartautomatedgradingengine.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
  ],
  credentials: true,
}));

app.use(express.json());

// Routes
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Connect DB
await connectDB();

// Start server
const PORT = process.env.PORT || 5000;
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
app.use("/api/results", resultRoutes);

app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});
