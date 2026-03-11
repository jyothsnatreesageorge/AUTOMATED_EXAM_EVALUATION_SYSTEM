import express from "express";
import Course from "../models/Course.js";
import Teacher from "../models/Teacher.js";
import ClassModel from "../models/Class.js";
import CourseMapping from "../models/CourseMapping.js";

const router = express.Router();

/* GET COURSES */
router.get("/courses", async (req, res) => {
  try {
    const courses = await Course.find({}, "_id courseId courseName");
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch courses" });
  }
});

/* GET TEACHERS */
router.get("/teachers", async (req, res) => {
  try {
    const teachers = await Teacher.find({}, "_id id name").sort({ name: 1 });
    res.json(teachers);
  } catch (err) {
    console.error("Get teachers error:", err);
    res.status(500).json({ message: "Failed to fetch teachers" });
  }
});

/* GET CLASSES */
router.get("/classes", async (req, res) => {
  try {
    const classes = await ClassModel.find({}, "_id classId").sort({ classId: 1 });
    res.json(classes);
  } catch (err) {
    console.error("Get classes error:", err);
    res.status(500).json({ message: "Failed to fetch classes" });
  }
});

/* MAP COURSE */
router.post("/", async (req, res) => {
  try {
    const { courseId, teacherId, classId } = req.body;

    if (!courseId) return res.status(400).json({ message: "courseId is required" });
    if (!teacherId) return res.status(400).json({ message: "teacherId is required" });
    if (!classId?.trim()) return res.status(400).json({ message: "classId is required" });

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });

    const cls = await ClassModel.findOne({ classId: classId.trim() });
    if (!cls) return res.status(404).json({ message: "Class not found" });

    /* CHECK DUPLICATE MAPPING */

    const existing = await CourseMapping.findOne({
      courseId,
      teacherId,
      classId: cls._id
    });

    if (existing) {
      return res.json({
        message: "This course is already mapped to the selected teacher and class"
      });
    }

    /* CREATE NEW MAPPING */

    const mapping = new CourseMapping({
      courseId,
      teacherId,
      classId: cls._id
    });

    await mapping.save();

    const populated = await CourseMapping.findById(mapping._id)
      .populate("courseId", "courseId courseName")
      .populate("teacherId", "id name")
      .populate("classId", "classId");

    res.json({
      message: "Course mapped successfully ✅",
      data: populated
    });

  } catch (err) {
    console.error("Mapping error:", err);
    res.status(500).json({ message: err.message });
  }
});

/* GET ALL COURSE MAPPINGS */

router.get("/mappings", async (req, res) => {
  try {

    const mappings = await CourseMapping.find()
      .populate("courseId", "courseName")
      .populate("teacherId", "name")
      .populate("classId", "classId")
      .sort({ createdAt: -1 });

    res.json(mappings);

  } catch (err) {

    console.error("Fetch mappings error:", err);
    res.status(500).json({ message: "Failed to fetch mappings" });

  }
});

export default router;