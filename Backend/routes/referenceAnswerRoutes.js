import express from "express";

import Class from "../models/Class.js";
import Course from "../models/Course.js";
import Exam from "../models/Exam.js";
import ReferenceAnswer from "../models/ReferenceAnswer.js";
import CourseMapping from "../models/CourseMapping.js";

const router = express.Router();

// =============================
// GET DROPDOWN DATA
// =============================
router.get("/dropdowns", async (req, res) => {
  try {
    const classes = await Class.find();
    const courses = await Course.find();
    const exams = await Exam.distinct("examType");

    res.json({ classes, courses, exams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================
// GET COURSES BY CLASS
// =============================
router.get("/courses/:classId", async (req, res) => {
  try {
    const { classId } = req.params;

    const classDoc = await Class.findOne({ classId });

    if (!classDoc) {
      return res.json({ courses: [] });
    }

    const mappings = await CourseMapping.find({ classId: classDoc._id }).populate("courseId");

    const courses = mappings.map((m) => m.courseId);

    res.json({ courses });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

// =============================
// VALIDATE + VIEW REFERENCE
// =============================
router.post("/view", async (req, res) => {
  const { className, courseName, examType } = req.body;

  try {
    const classDoc = await Class.findOne({ classId: className });

    if (!classDoc) {
      return res.status(400).json({ message: "Class not found" });
    }

    const courseDoc = await Course.findOne({ courseName });

    if (!courseDoc) {
      return res.status(400).json({ message: "Course not found" });
    }

    const mapping = await CourseMapping.findOne({
      classId: classDoc._id,
      courseId: courseDoc._id,
    });

    if (!mapping) {
      return res.status(400).json({
        message: "Course is not mapped to this class",
      });
    }

    const reference = await ReferenceAnswer.findOne({
      classId: className,
      course: courseName,
      examType: examType,
    });

    if (!reference) {
      return res.status(400).json({
        message: "Incorrect Class-Course-Exam combination",
      });
    }

    const fileUrl = reference.pdfLink
      ? `https://exam-evaluation-mini2026.s3.amazonaws.com/${reference.pdfLink}`
      : null;

    res.json({
      ...reference.toObject(),
      fileUrl,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================
// APPROVE (Publish)
// =============================
router.put("/approve/:id", async (req, res) => {
  try {
    const updated = await ReferenceAnswer.findByIdAndUpdate(
      req.params.id,
      { status: true },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================
// STUDENT VIEW ANSWER KEY
// =============================
router.get("/student/:course/:examType/:classId", async (req, res) => {
  try {
    const course = req.params.course.trim();
    const examType = decodeURIComponent(req.params.examType).trim();
    const classId = req.params.classId.trim();

    console.log("COURSE:", course);
    console.log("EXAM:", examType);
    console.log("CLASS:", classId);

    const answer = await ReferenceAnswer.findOne({
      course: course,
      examType: examType,
      classId: classId,
      status: true,
    });

    if (!answer) {
      return res.json({
        message: "Answer key not available",
      });
    }

    res.json({
      pdfLink: answer.pdfLink,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Server error",
    });
  }
});

export default router;