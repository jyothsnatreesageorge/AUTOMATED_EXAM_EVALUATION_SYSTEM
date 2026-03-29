import express from "express";
import Student from "../models/Student.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Course from "../models/Course.js";
import MarkMatrix from "../models/MarkMatrix.js";
import Class from "../models/Class.js";
import Revaluation from "../models/Revaluation.js";
import CourseMapping from "../models/CourseMapping.js";

const router = express.Router();

// ── auth middleware ───────────────────────────────────────────────────────────
function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided." });
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Unauthorized" });
  }
}

/* ===============================
   PARSE RESULT TABLE
=============================== */
const parseResultTable = (resultTable) => {
  if (!resultTable || typeof resultTable !== "string") return [];

  const rows = resultTable
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r.startsWith("|"));

  if (rows.length < 3) return [];

  const headerRow = rows[0];
  const dataRow   = rows[2];

  const headerParts = headerRow.split("|").map((c) => c.trim());
  const qLabels = headerParts
    .filter((c) => /^q\d+$/i.test(c))
    .map((c) => c.toUpperCase());

  if (!qLabels.length) return [];

  const isFormatA = new RegExp(`\\|\\s*${qLabels[0]}\\s*\\|`, "i").test(dataRow);
  const questions = [];

  if (isFormatA) {
    const splitPattern = new RegExp(`\\|\\s*(${qLabels.join("|")})\\s*\\|`, "gi");
    const matches = [...dataRow.matchAll(splitPattern)];

    for (let i = 0; i < matches.length; i++) {
      const label    = matches[i][1].toUpperCase();
      const segStart = matches[i].index + matches[i][0].length;
      const segEnd   = matches[i + 1]?.index ?? dataRow.lastIndexOf("|");
      const segment  = dataRow.slice(segStart, segEnd);

      const firstPipe  = segment.indexOf("|");
      const secondPipe = segment.indexOf("|", firstPipe + 1);

      const max     = parseFloat(segment.slice(0, firstPipe).trim());
      const marks   = parseFloat(segment.slice(firstPipe + 1, secondPipe).trim());
      const rawJust = segment.slice(secondPipe + 1);
      const reason  = rawJust.replace(/\s*\|\s*$/, "").trim();

      if (!isNaN(max) && !isNaN(marks))
        questions.push({ question: label, maxMarks: max, marks, deductionReason: reason });
    }
  } else {
    const qColIndices = qLabels.map((q) => ({
      label:    q,
      colIndex: headerParts.findIndex((c) => c.toUpperCase() === q),
    }));

    const dataCells = dataRow.split("|").map((c) => c.trim());

    for (let qi = 0; qi < qColIndices.length; qi++) {
      const { label, colIndex } = qColIndices[qi];

      const max   = parseFloat(dataCells[colIndex + 1]);
      const marks = parseFloat(dataCells[colIndex + 2]);

      const nextColIndex = qColIndices[qi + 1]?.colIndex ?? (dataCells.length - 2);
      const justCells    = dataCells.slice(colIndex + 3, nextColIndex);
      const reason       = justCells.join("|").trim();

      if (!isNaN(max) && !isNaN(marks))
        questions.push({ question: label, maxMarks: max, marks, deductionReason: reason });
    }
  }

  return questions;
};

/* =============================
        STUDENT LOGIN
============================= */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Request body:", req.body);

    const student = await Student.findOne({ email });
    console.log("Found student:", student);

    if (!student) return res.status(400).json({ message: "Student not found" });

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign({ id: student._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.json({
      message: "Login successful",
      token,
      student: {
        _id:       student._id,
        name:      student.name,
        email:     student.email,
        admNo:     student.admNo,
        rollNo:    student.rollNo,
        className: student.className,
        classId:   student.classId,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

/* =============================
        STUDENT PROFILE
============================= */
router.get("/profile", auth, async (req, res) => {
  try {
    const student = await Student.findById(req.user.id).select("-password");
    res.json(student);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/* =============================
      CHANGE PASSWORD
============================= */
router.put("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: "All fields are required." });
    if (newPassword.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters." });

    const student = await Student.findById(req.user.id);
    if (!student) return res.status(404).json({ message: "Student not found." });

    const isMatch = await bcrypt.compare(currentPassword, student.password);
    if (!isMatch)
      return res.status(400).json({ message: "Current password is incorrect." });

    student.password = await bcrypt.hash(newPassword, 10);
    await student.save();

    res.json({ message: "Password changed successfully!" });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/* =============================
   COURSES BY CLASS
============================= */
router.get("/courses/byclass/:classId", async (req, res) => {
  try {
    const { classId } = req.params;
    const classDoc = await Class.findOne({ classId });
    if (!classDoc) return res.status(404).json({ message: "Class not found" });

    const mappings = await CourseMapping.find({ classId: classDoc._id }).populate("courseId");
    const courses  = mappings.map((m) => m.courseId).filter(Boolean);
    res.json({ courses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

/* =============================
   GET COURSES FOR STUDENT
============================= */
router.get("/courses/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const student = await Student.findOne({ rollNo: Number(studentId) });
    if (!student) return res.status(404).json({ message: "Student not found" });

    const classDoc = await Class.findOne({ classId: student.classId });
    if (!classDoc) return res.status(404).json({ message: "Class not found" });

    const mappings = await CourseMapping.find({ classId: classDoc._id }).populate("courseId");
    const courses  = mappings.map((m) => m.courseId).filter(Boolean);
    res.json({ courses });
  } catch (error) {
    console.error("COURSE FETCH ERROR:", error);
    res.status(500).json({ message: error.message });
  }
});

/* =============================
   GET STUDENT RESULT
============================= */
router.post("/result", async (req, res) => {
  try {
    const { rollNo, course, examType } = req.body;

    const result = await MarkMatrix.findOne({ rollNo, course, examType });
    if (!result) return res.json({ result: null });

    const questions = parseResultTable(result.resultTable);

    return res.json({
      result: {
        ...result.toObject(),
        questions,
        maxMarks:   result.maxMarks,
        totalMarks: result.totalMarks,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

/* =============================
      REQUEST REVALUATION
============================= */
router.post("/revaluation", async (req, res) => {
  try {
    const { studentName, rollNo, classId, course, examType, studentReason } = req.body;

    const existing = await Revaluation.findOne({ rollNo, course, examType });
    if (existing) return res.json({ message: "Revaluation already requested" });

    const classDoc  = await Class.findOne({ classId });
    const courseDoc = await Course.findOne({ courseName: course });
    const mapping   = await CourseMapping.findOne({
      classId:  classDoc?._id,
      courseId: courseDoc?._id,
    });

    const request = new Revaluation({
      studentName, rollNo, classId, course, examType,
      studentReason,
      teacherId: mapping?.teacherId || null,
    });

    await request.save();
    res.json({ message: "Revaluation request submitted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
