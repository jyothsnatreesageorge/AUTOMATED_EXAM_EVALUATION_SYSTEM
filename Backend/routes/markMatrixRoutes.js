import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import CourseMapping from "../models/CourseMapping.js";
import Course from "../models/Course.js";
import Class from "../models/Class.js";
import MarkMatrix from "../models/MarkMatrix.js";

const router = express.Router();

/* ===============================
   AUTH MIDDLEWARE
=============================== */
const authTeacher = (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }
    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};

/* ===============================
   HELPERS
=============================== */
const normalize = (value) => String(value || "").trim().toLowerCase();

const getTeacherIdFromToken = (user) => {
  return user?._id || user?.id || user?.teacherId || null;
};

const getTeacherPairs = async (teacherId) => {
  if (!teacherId) return [];

  let teacherObjectId;
  try {
    teacherObjectId = new mongoose.Types.ObjectId(String(teacherId));
  } catch (err) {
    console.error("Invalid teacherId in token:", teacherId);
    return [];
  }

  const mappings = await CourseMapping.find({ teacherId: teacherObjectId }).lean();
  if (!mappings.length) return [];

  const pairs = await Promise.all(
    mappings.map(async (m) => {
      try {
        const [classDoc, courseDoc] = await Promise.all([
          Class.findById(m.classId).lean(),
          Course.findById(m.courseId).lean(),
        ]);
        const classString  = classDoc?.classId  || classDoc?.name  || classDoc?.className  || "";
        const courseString = courseDoc?.courseName || courseDoc?.name || courseDoc?.courseId || "";
        if (!classString || !courseString) return null;
        return { classId: String(classString).trim(), course: String(courseString).trim() };
      } catch (err) {
        console.error("Error resolving mapping:", err.message);
        return null;
      }
    })
  );

  return pairs.filter(Boolean);
};

/* ===============================
   GET FILTERS
=============================== */
router.get("/filters", authTeacher, async (req, res) => {
  try {
    const teacherId  = getTeacherIdFromToken(req.user);
    const validPairs = await getTeacherPairs(teacherId);

    if (!validPairs.length) return res.json([]);

    const filters = [];
    for (const pair of validPairs) {
      const rows = await MarkMatrix.find({
        classId: pair.classId,
        course:  pair.course,
      }).select("examType");

      if (rows.length > 0) {
        filters.push({
          courseName: pair.course,
          classId:    pair.classId,
          exams:      [...new Set(rows.map((r) => r.examType))],
        });
      }
    }

    return res.json(filters);
  } catch (err) {
    console.error("Filter load error:", err);
    return res.status(500).json({ message: "Failed to load filters", error: err.message });
  }
});

/* ===============================
   PARSE RESULT TABLE
   Handles:
   - Format A: data row repeats Q label → | 61 | Q1 | 3 | 3 | Justification | Q2 | ...
               also supports sub-question labels → | 61 | Q6a | 3 | 3 | Justification | Q6b | ...
   - Format B: data row skips Q label   → | 10 | 1  | 3 | 3 | Justification | 2  | ...
   - Pipe characters INSIDE justification text (e.g. S→abAA|ab)
=============================== */
const parseResultTableForDisplay = (resultTable) => {
  if (!resultTable || typeof resultTable !== "string") return { questions: [] };

  const rows = resultTable
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r.startsWith("|"));

  if (rows.length < 3) return { questions: [] };

  const headerRow = rows[0];
  const dataRow   = rows[2];

  const headerParts = headerRow.split("|").map((c) => c.trim());
  const qLabels = headerParts
    .filter((c) => /^(q\d+[\s.]?[a-z\d]*|[a-z])$/i.test(c))
    .map((c) => c.replace(/\s+/g, "").toUpperCase());

  if (!qLabels.length) return { questions: [] };

  const escapedLabels = qLabels.map((q) => q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  const normalizedDataRow = dataRow.replace(/\|\s*(Q\d+)\s+([A-Z])\s*\|/gi, "|$1$2|");

  const isFormatA = new RegExp(`\\|\\s*${escapedLabels[0]}\\s*\\|`, "i").test(normalizedDataRow);

  // ✅ must be declared HERE, before the if/else
  const questions = [];

  if (isFormatA) {
    const splitPattern = new RegExp(`\\|\\s*(${escapedLabels.join("|")})\\s*\\|`, "gi");
    const matches = [...normalizedDataRow.matchAll(splitPattern)];

    for (let i = 0; i < matches.length; i++) {
      const label    = matches[i][1].toUpperCase().replace(/\s+/g, "");
      const segStart = matches[i].index + matches[i][0].length;
      const segEnd   = matches[i + 1]?.index ?? normalizedDataRow.lastIndexOf("|", normalizedDataRow.lastIndexOf("|") - 1);
      const segment  = normalizedDataRow.slice(segStart, segEnd);

      const firstPipe  = segment.indexOf("|");
      const secondPipe = segment.indexOf("|", firstPipe + 1);

      const max     = parseFloat(segment.slice(0, firstPipe).trim());
      const marks   = parseFloat(segment.slice(firstPipe + 1, secondPipe).trim());
      const rawJust = segment.slice(secondPipe + 1);
      const reason  = rawJust.replace(/\s*\|\s*$/, "").trim();

      if (!isNaN(max) && !isNaN(marks)) {
        questions.push({ question: label, max, marks, deductionReason: reason });
      }
    }

  } else {
    const qColIndices = qLabels.map((q) => ({
      label:    q,
      colIndex: headerParts.findIndex((c) => c.replace(/\s+/g, "").toUpperCase() === q),
    }));

    const dataCells = dataRow.split("|").map((c) => c.trim());

    for (let qi = 0; qi < qColIndices.length; qi++) {
      const { label, colIndex } = qColIndices[qi];

      const max   = parseFloat(dataCells[colIndex + 1]);
      const marks = parseFloat(dataCells[colIndex + 2]);

      const nextColIndex = qColIndices[qi + 1]?.colIndex ?? (dataCells.length - 2);
      const justCells    = dataCells.slice(colIndex + 3, nextColIndex);
      const reason       = justCells.join("|").trim();

      if (!isNaN(max) && !isNaN(marks)) {
        questions.push({ question: label, max, marks, deductionReason: reason });
      }
    }
  }

  return { questions };
};
/* ===============================
   GET RESULTS
=============================== */
router.get("/results", authTeacher, async (req, res) => {
  try {
    const teacherId = getTeacherIdFromToken(req.user);
    const { course, classId, examType } = req.query;

    if (!course || !classId || !examType) {
      return res.status(400).json({ message: "course, classId and examType required" });
    }

    const validPairs = await getTeacherPairs(teacherId);

    const reqCourse = normalize(course);
    const reqClass  = normalize(classId);
    const reqExam   = String(examType).trim();

    const allowed = validPairs.some(
      (p) => normalize(p.course) === reqCourse && normalize(p.classId) === reqClass
    );

    if (!allowed) {
      return res.status(403).json({ message: "This result is not mapped to the logged-in teacher" });
    }

    const rows = await MarkMatrix.find({ examType: reqExam }).lean();

    const filteredRows = rows
      .filter(
        (row) =>
          normalize(row.course)  === reqCourse &&
          normalize(row.classId) === reqClass
      )
      .map((row) => {
        const parsed   = parseResultTableForDisplay(row.resultTable);
        const total    = row.totalMarks;
        const maxTotal = row.maxMarks;
        const pct      = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;

        const { questions: _old, ...rowWithoutQuestions } = row;

        return {
          ...rowWithoutQuestions,
          questions: parsed.questions,
          total,
          maxTotal,
          pct,
        };
      });

    filteredRows.sort((a, b) =>
      String(a.rollNo || "").localeCompare(String(b.rollNo || ""), undefined, {
        numeric:     true,
        sensitivity: "base",
      })
    );

    return res.json(filteredRows);
  } catch (err) {
    console.error("Results load error:", err);
    return res.status(500).json({ message: "Failed to load results", error: err.message });
  }
});
router.get("/results", authTeacher, async (req, res) => {
  try {
    console.log("Results query:", req.query);
    const teacherId = getTeacherIdFromToken(req.user);
    console.log("Teacher ID:", teacherId);

    const validPairs = await getTeacherPairs(teacherId);
    console.log("Valid pairs:", validPairs);

    // ... rest of route
    console.log("Raw rows found:", rows.length);
    console.log("Filtered rows:", filteredRows.length);

  } catch (err) {
    console.error("Results load error FULL:", err); // <-- check Render logs for this
    return res.status(500).json({ message: "Failed to load results", error: err.message });
  }
});

export default router;
