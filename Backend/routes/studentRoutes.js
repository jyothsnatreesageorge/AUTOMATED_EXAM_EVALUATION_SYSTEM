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

// GET COURSES FOR STUDENT
router.get("/courses/:rollNo", async (req, res) => {

  try {

    const { rollNo } = req.params;

    // 1️⃣ find student
    const student = await Student.findOne({ rollNo });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // 2️⃣ find class document
    const classDoc = await Class.findOne({ classId: student.classId });

    if (!classDoc) {
      return res.status(404).json({ message: "Class not found" });
    }

    // 3️⃣ find course mappings for this class
    const mappings = await CourseMapping
      .find({ classId: classDoc._id })
      .populate("courseId");

    // 4️⃣ extract courses
    const courses = mappings.map(m => m.courseId);

    res.json({ courses });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Server error"
    });

  }

});

// GET STUDENT RESULT
// GET STUDENT RESULT
router.post("/result", async (req, res) => {
  try {
    const { rollNo, course, examType } = req.body;

    const result = await MarkMatrix.findOne({
      rollNo,
      course,
      examType,
    });

    if (!result) {
      return res.json({ result: null });
    }

    const rows = result.resultTable
      .split("\n")
      .map((r) => r.trim())
      .filter((r) => r.includes("|"));

    if (rows.length < 3) {
      return res.json({
        result: { ...result.toObject(), questions: [] },
      });
    }

    const headerCells = rows[0]
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);

    const dataCells = rows[2]
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);

    const questions = [];

    let dataIndex = 1;

    for (let i = 1; i < headerCells.length; i += 4) {
      const questionLabel = headerCells[i];

      if (!questionLabel || /total marks/i.test(questionLabel)) {
        break;
      }

      const max = parseFloat(dataCells[dataIndex]);
      const marks = parseFloat(dataCells[dataIndex + 1]);
      const reason = dataCells[dataIndex + 2] || "";

      if (!isNaN(max) && !isNaN(marks)) {
        questions.push({
          question: questionLabel,
          maxMarks: max,   // FIXED
          marks,
          deductionReason: reason,
          excluded: /not counted in total/i.test(reason),
        });
      }

      dataIndex += 3;
    }

    const storedTotal = parseFloat(dataCells[dataCells.length - 1]);

res.json({
  result: {
    ...result.toObject(),
    questions,
    storedTotal: !isNaN(storedTotal) ? storedTotal : null,
    maxMarks: result.maxMarks   // fetch from DB
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

    // Check if already requested
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

    // 🔹 find class document
    const classDoc = await Class.findOne({ classId });

    // 🔹 find course document
    const courseDoc = await Course.findOne({ courseName: course });

    // 🔹 find mapping to get teacherId
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
