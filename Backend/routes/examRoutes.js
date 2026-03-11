import express from "express";
import Exam from "../models/Exam.js";
import Class from "../models/Class.js";
import Course from "../models/Course.js";
import CourseMapping from "../models/CourseMapping.js";

const router = express.Router();

// GET all distinct classes from exams
const getTeacherPairs = async (teacherId) => {
  console.log("1. Finding mappings for teacherId:", teacherId);
  
  const mappings = await CourseMapping.find({ teacherId }).lean();
  console.log("2. Mappings found:", mappings.length, mappings);
  
  if (!mappings.length) return [];

  const pairs = await Promise.all(
    mappings.map(async (m) => {
      console.log("3. Processing mapping:", m);
      
      const classDoc = await Class.findById(m.classId).lean();
      console.log("4. classDoc:", classDoc);
      
      const courseDoc = await Course.findById(m.courseId).lean();
      console.log("5. courseDoc:", courseDoc);

      const classString = classDoc?.classId || classDoc?.name || null;
      const courseString = courseDoc?.courseName || null;

      console.log("6. resolved ->", classString, courseString);

      if (!classString || !courseString) return null;
      return { classId: classString, course: courseString };
    })
  );

  const result = pairs.filter(Boolean);
  console.log("7. Final pairs:", result);
  return result;
};
// ── GET /teacher/:teacherId — fetch exams for this teacher ──
router.get("/teacher/:teacherId", async (req, res) => {
  try {
    const { teacherId } = req.params;

    const validPairs = await getTeacherPairs(teacherId);
    if (!validPairs.length) return res.json([]);

    const exams = await Exam.find({
      $or: validPairs.map(({ classId, course }) => ({ classId, course }))
    }).lean();

    res.json(exams);
  } catch (err) {
    console.error("Error fetching exams:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ── GET /teacher/:teacherId/options — dropdown options for create exam ──
router.get("/teacher/:teacherId/options", async (req, res) => {
  try {
    const { teacherId } = req.params;

    const validPairs = await getTeacherPairs(teacherId);
    if (!validPairs.length) return res.json({ classes: [], courses: [] });

    const classes = [...new Set(validPairs.map((p) => p.classId))];
    const courses = [...new Set(validPairs.map((p) => p.course))];

    res.json({ classes, courses });
  } catch (err) {
    console.error("Error fetching options:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ── POST / — create new exam ──
router.post("/", async (req, res) => {
  try {
    const { classId, course, examType, evalType, teacherId } = req.body;
    if (!classId || !course || !examType || !teacherId)
      return res.status(400).json({ error: "All fields required." });

    const newExam = await Exam.create({ classId, course, examType, evalType,  teacherId, status: "Draft" });
    res.status(201).json({ exam: newExam });
  } catch (err) {
    console.error("Error creating exam:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /:id ──
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Exam.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Exam not found." });
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /:id ──
router.put("/:id", async (req, res) => {
  try {
    const updated = await Exam.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: "Exam not found." });
    res.json({ exam: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;