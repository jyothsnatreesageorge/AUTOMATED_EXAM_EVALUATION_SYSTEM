import express from "express";
import Teacher from "../models/Teacher.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Revaluation from "../models/Revaluation.js";
import CourseMapping from "../models/CourseMapping.js";
import Class from "../models/Class.js";
import Course from "../models/Course.js";
import mongoose from "mongoose";

const router = express.Router();

// =========================
// CREATE TEACHER
// Auto Generate ID: CSE001, CSE002...
// =========================
router.post("/", async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    const lastTeacher = await Teacher.findOne().sort({ id: -1 });

    let newId = "CSE001";

    if (lastTeacher && lastTeacher.id) {
      const lastNumber = parseInt(lastTeacher.id.replace("CSE", ""), 10);
      const nextNumber = lastNumber + 1;
      newId = "CSE" + String(nextNumber).padStart(3, "0");
    }

    const generatedPassword =
      name.slice(0, 3).toUpperCase().padEnd(3, "X") + "123";

    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    const teacher = new Teacher({
      id: newId,
      name,
      email,
      phone,
      password: hashedPassword,
    });

    await teacher.save();

    res.status(201).json({
      message: "Teacher added successfully",
      teacher,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// READ ALL TEACHERS
// =========================
router.get("/", async (req, res) => {
  try {
    const teachers = await Teacher.find().sort({ id: 1 });
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// UPDATE TEACHER
// =========================
router.put("/:id", async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    const updatedTeacher = await Teacher.findOneAndUpdate(
      { id: req.params.id },
      { name, email, phone },
      { new: true }
    );

    if (!updatedTeacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.json({
      message: "Teacher updated successfully",
      teacher: updatedTeacher,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// DELETE TEACHER
// =========================
router.delete("/:id", async (req, res) => {
  try {
    const deletedTeacher = await Teacher.findOneAndDelete({
      id: req.params.id,
    });

    if (!deletedTeacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.json({
      message: "Teacher deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// TEACHER LOGIN
// =========================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const teacher = await Teacher.findOne({ email });

    if (!teacher) {
      return res.status(400).json({ message: "Teacher not found" });
    }

    const isMatch = await bcrypt.compare(password, teacher.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign({ id: teacher._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({
      message: "Login successful",
      token,
      teacher,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// =========================
// TEACHER PROFILE
// =========================
router.get("/profile", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const teacher = await Teacher.findById(decoded.id).select("-password");

    res.json(teacher);
  } catch (err) {
    res.status(401).json({ message: "Unauthorized" });
  }
});

// =========================
// GET CLASSES FOR TEACHER
// =========================
router.get("/classes/:teacherId", async (req, res) => {
  try {
    const mappings = await CourseMapping.find({
      teacherId: req.params.teacherId,
    }).populate("classId");

    const uniqueClasses = [
      ...new Map(
        mappings
          .filter((m) => m.classId)
          .map((m) => [m.classId._id.toString(), m.classId])
      ).values(),
    ];

    res.json(uniqueClasses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// =========================
// GET COURSES FOR SELECTED CLASS
// =========================
router.get("/courses/:teacherId/:classId", async (req, res) => {
  try {
    const mappings = await CourseMapping.find({
      teacherId: req.params.teacherId,
      classId: req.params.classId,
    }).populate("courseId");

    const uniqueCourses = [
      ...new Map(
        mappings
          .filter((m) => m.courseId)
          .map((m) => [m.courseId._id.toString(), m.courseId])
      ).values(),
    ];

    res.json(uniqueCourses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// =========================
// GET REVALUATION COUNT
// =========================
router.get("/revaluation-count/:teacherId", async (req, res) => {
  try {
    const teacherId = req.params.teacherId;

    const count = await Revaluation.countDocuments({
      status: "pending",
      $or: [
        { teacherId: teacherId },
        ...(mongoose.Types.ObjectId.isValid(teacherId)
          ? [{ teacherId: new mongoose.Types.ObjectId(teacherId) }]
          : []),
      ],
    });

    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// =========================
// GET ALL PENDING REVALUATION REQUESTS
// =========================
router.get("/revaluation/:teacherId", async (req, res) => {
  try {
    const teacherId = req.params.teacherId;

    const requests = await Revaluation.find({
      status: "pending",
      $or: [
        { teacherId: teacherId },
        ...(mongoose.Types.ObjectId.isValid(teacherId)
          ? [{ teacherId: new mongoose.Types.ObjectId(teacherId) }]
          : []),
      ],
    });

    console.log("FILTERED REQUESTS:", requests);

    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// =========================
// UPDATE REVALUATION MARK
// =========================
router.put("/revaluation/:id", async (req, res) => {
  try {
    const { newMarks } = req.body;

    const updatedRequest = await Revaluation.findByIdAndUpdate(
      req.params.id,
      {
        newMarks: newMarks,
        status: "reviewed",
      },
      { new: true }
    );

    res.json(updatedRequest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;