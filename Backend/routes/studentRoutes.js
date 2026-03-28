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

/* =============================
        STUDENT LOGIN
============================= */

router.post("/login", async (req, res) => {

  try {

    const { email, password } = req.body;

    console.log("Request body:", req.body);

    const student = await Student.findOne({ email });

    console.log("Found student:", student);

    if (!student) {
      return res.status(400).json({ message: "Student not found" });
    }

    const isMatch = await bcrypt.compare(password, student.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }
    const token = jwt.sign(
      { id: student._id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      student: {
        _id: student._id,
        name: student.name,
        email: student.email,
        admNo: student.admNo,
        rollNo: student.rollNo,
        className: student.className,
        classId: student.classId
      }
    });

  } catch (error) {

    console.error(error);
    res.status(500).json({ message: "Server error" });

  }

});

router.get("/profile", async (req, res) => {
  try {

    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const student = await Student.findById(decoded.id).select("-password");

    res.json(student);

  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
});
// ADD THIS BEFORE the existing /courses/:studentId route
router.get("/courses/byclass/:classId", async (req, res) => {
  try {
    const { classId } = req.params;

    const classDoc = await Class.findOne({ classId });
    if (!classDoc)
      return res.status(404).json({ message: "Class not found" });

    const mappings = await CourseMapping
      .find({ classId: classDoc._id })
      .populate("courseId");

    const courses = mappings.map(m => m.courseId).filter(Boolean);
    res.json({ courses });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});


// GET COURSES FOR STUDENT
router.get("/courses/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findOne({
      rollNo: Number(studentId),
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const classDoc = await Class.findOne({ classId: student.classId });

    if (!classDoc) {
      return res.status(404).json({ message: "Class not found" });
    }

    const mappings = await CourseMapping.find({ classId: classDoc._id }).populate("courseId");

    const courses = mappings.map((m) => m.courseId).filter(Boolean);

    res.json({ courses });
  } catch (error) {
    console.error("COURSE FETCH ERROR:", error);
    res.status(500).json({ message: error.message });
  }
});

// GET STUDENT RESULT
router.post("/result", async (req, res) => {
  try {
    const { rollNo, course, examType } = req.body;

    const result = await MarkMatrix.findOne({ rollNo, course, examType });

    if (!result) return res.json({ result: null });

    const rows = result.resultTable
      .split("\n")
      .map((r) => r.trim())
      .filter((r) => r.startsWith("|"));

    if (rows.length < 3) {
      return res.json({ result: { ...result.toObject(), questions: [] } });
    }

    const splitRow = (row) =>
      row.split("|").map((c) => c.trim()).filter(Boolean);

    const dataCells = splitRow(rows[2]);

    const questions = [];

    // Find where Q labels start
    let startIndex = -1;
    for (let i = 0; i < dataCells.length; i++) {
      if (/^q\d+$/i.test(dataCells[i])) {
        startIndex = i;
        break;
      }
    }

    if (startIndex !== -1) {
      // Groups of 4: Qn | Max | Marks | Justification
      for (let i = startIndex; i < dataCells.length - 1; i += 4) {
        const label = dataCells[i];
        if (!/^q\d+$/i.test(label)) break;

        const max    = parseFloat(dataCells[i + 1]);
        const marks  = parseFloat(dataCells[i + 2]);
        const reason = dataCells[i + 3] || "";

        if (!isNaN(max) && !isNaN(marks)) {
          questions.push({
            question: label.toUpperCase(),
            maxMarks: max,
            marks,
            deductionReason: reason,
          });
        }
      }
    }

    return res.json({
      result: {
        ...result.toObject(),
        questions,
        maxMarks: result.maxMarks,
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

    const existing = await Revaluation.findOne({
      rollNo,
      course,
      examType
    });

    if (existing) {
      return res.json({
        message: "Revaluation already requested"
      });
    }

    const classDoc = await Class.findOne({ classId });

    const courseDoc = await Course.findOne({ courseName: course });

    const mapping = await CourseMapping.findOne({
      classId: classDoc?._id,
      courseId: courseDoc?._id
    });

    const request = new Revaluation({
      studentName,
      rollNo,
      classId,
      course,
      examType,
      studentReason,
      teacherId: mapping?.teacherId || null
    });

    await request.save();

    res.json({
      message: "Revaluation request submitted"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Server error"
    });

  }

});

export default router;
