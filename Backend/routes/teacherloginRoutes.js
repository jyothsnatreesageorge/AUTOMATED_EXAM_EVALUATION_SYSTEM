import express from "express";
import Teacher from "../models/Teacher.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();

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

    const token = jwt.sign(
      { id: teacher._id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      teacher
    });

  } catch (error) {

    res.status(500).json({ message: "Server error" });

  }

});
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
export default router;