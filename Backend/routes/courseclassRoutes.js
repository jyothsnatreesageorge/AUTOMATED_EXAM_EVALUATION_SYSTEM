import express from "express";
import mongoose from "mongoose";

import Teacher from "../models/Teacher.js";
import Course from "../models/Course.js";
import Class from "../models/Class.js";
import Student from "../models/Student.js";
import CourseMapping from "../models/CourseMapping.js";
import Exam from "../models/Exam.js";

const router = express.Router();

/* =========================
   GET COURSES + CLASSES
========================= */
// GET /api/courseclass/teacher/:teacherId/courses-classes
router.get("/teacher/:teacherId/courses-classes", async (req, res) => {
  try {
    const teacherId = req.params.teacherId;

    const mappings = await CourseMapping.find({ teacherId })
      .populate("courseId", "courseId courseName")
      .populate("classId", "classId admissionYear passOutYear division");

    const coursesMap = {};

    mappings.forEach((m) => {
      const cId = m.courseId?._id?.toString();
      if (!cId) return;

      if (!coursesMap[cId]) {
        coursesMap[cId] = {
          _id: m.courseId._id.toString(),
          courseId: m.courseId.courseId,
          courseName: m.courseId.courseName,
          course: m.courseId.courseName,
          classes: [],
        };
      }

      const classMongoId = m.classId?._id?.toString();
      if (classMongoId && !coursesMap[cId].classes.includes(classMongoId)) {
        coursesMap[cId].classes.push(classMongoId);
      }
    });

    const classesMap = {};

    for (const m of mappings) {
      const clsId = m.classId?._id?.toString();
      if (!clsId) continue;

      if (!classesMap[clsId]) {
        const count = await Student.countDocuments({ classId: m.classId.classId });

        classesMap[clsId] = {
          _id: clsId,
          classId: m.classId.classId,
          division: m.classId.division,
          admYear: m.classId.admissionYear || m.classId.admYear,
          passOutYear: m.classId.passOutYear,
          studentsCount: count,
        };
      }
    }

    res.json({
      courses: Object.values(coursesMap),
      classes: Object.values(classesMap),
    });
  } catch (err) {
    console.error("courses-classes error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   GET STUDENTS OF CLASS
========================= */
// GET /api/courseclass/class/:classId/students
router.get("/class/:classId/students", async (req, res) => {
  try {
    const classMongoId = req.params.classId;

    const classDoc = await Class.findById(classMongoId);
    if (!classDoc) {
      return res.status(404).json({ error: "Class not found" });
    }

    const students = await Student.find({ classId: classDoc.classId }).sort({
      admNo: 1,
      rollNo: 1,
    });

    res.json(students);
  } catch (err) {
    console.error("students error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

/* =========================
   GET EXAMS FOR TEACHER
========================= */
// GET /api/courseclass/exams?teacherId=...&classId=...&course=...
router.get("/exams", async (req, res) => {
  try {
    const { teacherId, classId, course } = req.query;

    if (!teacherId) {
      return res.status(400).json({ error: "teacherId is required" });
    }

    const mappings = await CourseMapping.find({ teacherId })
      .populate("courseId", "courseId courseName")
      .populate("classId", "classId")
      .lean();

    if (!mappings.length) {
      return res.json([]);
    }

    const allowedPairs = mappings
      .filter((m) => m.courseId && m.classId)
      .map((m) => ({
        classId: m.classId.classId,
        course: m.courseId.courseName,
      }));

    let exams = await Exam.find({}).sort({ createdAt: -1 }).lean();

    exams = exams.filter((exam) =>
      allowedPairs.some(
        (p) => p.classId === exam.classId && p.course === exam.course
      )
    );

    if (classId) {
      const classDoc = await Class.findById(classId).lean();
      if (classDoc) {
        exams = exams.filter((exam) => exam.classId === classDoc.classId);
      } else {
        exams = [];
      }
    }

    if (course) {
      const courseDoc = await Course.findById(course).lean();
      if (courseDoc) {
        exams = exams.filter((exam) => exam.course === courseDoc.courseName);
      } else {
        exams = [];
      }
    }

    res.json(exams);
  } catch (err) {
    console.error("exams error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

export default router;