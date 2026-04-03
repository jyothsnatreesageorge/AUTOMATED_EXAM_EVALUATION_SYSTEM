import express from "express";
import "dotenv/config";
import { connectDB } from "./db.js";
import { startWorker } from "./workers/evalWorker.js";
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

const ALLOWED_ORIGINS = [
  "https://smartautomatedgradingengine.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH,DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

// ── Connect DB then start worker and server ───────────────────────────────────
await connectDB();

// ✅ Start eval worker inside the same process
startWorker();
console.log("🟢 Eval worker started");

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/courses",        courseRoutes);
app.use("/api/students",       studentRoutes);
app.use("/api/upload",         uploadRoutes);
app.use("/api/uploadscript",   UploadscriptRoutes);
app.use("/api/exams",          examRoutes);
app.use("/api/evaluation",     evaluationRoutes);
app.use("/api/markmatrix",     markMatrixRoutes);
app.use("/api/students",       studentController);
app.use("/api/teachers",       teacherRoutes);
app.use("/api/course-mapping", courseMappingRoutes);
app.use("/api/classes",        classRoutes);
app.use("/api/admin",          adminRoutes);
app.use("/api/teacherlogin",   teacherlogin);
app.use("/api/reference",      ReferenceAnswerRoutes);
app.use("/api/courseclass",    courseclass);
app.use("/api/results",        resultRoutes);

// ── Start server ──────────────────────────────────────────────────────────────
// server.js — update the listen block at the bottom
const PORT     = process.env.PORT || 5000;
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);

  // ✅ Keep-alive — prevents Render free tier from sleeping during eval
  setInterval(async () => {
    try {
      const res = await fetch(`${SELF_URL}/api/health`);
      console.log(`🏓 Keep-alive: ${res.status}`);
    } catch (err) {
      console.warn("⚠️ Keep-alive failed:", err.message);
    }
  }, 10 * 60 * 1000); // every 10 minutes
});
