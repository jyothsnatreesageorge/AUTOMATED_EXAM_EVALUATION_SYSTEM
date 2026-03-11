import express from "express";
import Exam from "../models/Exam.js";
import Course from "../models/Course.js";

const router = express.Router();
// -----------------------------
// GET all courses
// -----------------------------
router.get("/", async (req, res) => {
  try {
    const courses = await Course.find().sort({ courseId: 1 });
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: "Error fetching courses" });
  }
});


// -----------------------------
// ADD new course
// -----------------------------
router.post("/", async (req, res) => {
  try {
    const { courseId, courseName } = req.body;

    if (!courseId || !courseName) {
      return res.status(400).json({ message: "Course ID and Name required" });
    }

    const existing = await Course.findOne({
      courseId: courseId.trim(),
    });

    if (existing) {
      return res.status(400).json({
        message: "Course with this ID already exists",
      });
    }

    const course = new Course({
      courseId: courseId.trim(),
      courseName: courseName.trim(),
    });

    await course.save();

    res.status(201).json({
      message: "Course added successfully",
      course,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error adding course" });
  }
});


// -----------------------------
// DELETE course
// -----------------------------
router.delete("/:courseId", async (req, res) => {
  try {
    const { courseId } = req.params;

    const deleted = await Course.findOneAndDelete({ courseId });

    if (!deleted) {
      return res.status(404).json({
        message: "Course not found",
      });
    }

    res.json({
      message: "Course deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: "Error deleting course",
    });
  }
});

export default router;