import express from "express";
import jwt from "jsonwebtoken";
import {
  saveTeacherKey,
  deleteTeacherKey,
  getTeacherKeyStatus,
  getTeacherKey,
} from "../utils/teacherKeyManager.js";

const router = express.Router();

// ── auth middleware ──
function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided." });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("🔑 JWT decoded:", decoded); // 👈 add this temporarily
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Unauthorized" });
  }
}

router.use(auth);

// ── Save or update Gemini key ──
router.post("/", async (req, res) => {
  try {
    const { key } = req.body;

    if (!key)
      return res.status(400).json({ message: "Key is required" });

    if (!key.startsWith("AIzaSy"))
      return res.status(400).json({ message: "Invalid Gemini key format" });

    await saveTeacherKey(req.user.id, "gemini", key);
    res.json({ message: "Gemini key saved successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to save key", error: err.message });
  }
});

// ── Get status ──
router.get("/", async (req, res) => {
  try {
    const status = await getTeacherKeyStatus(req.user.id);
    res.json(status);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch key status" });
  }
});

// ── Delete Gemini key ──
router.delete("/", async (req, res) => {
  try {
    await deleteTeacherKey(req.user.id, "gemini");
    res.json({ message: "Gemini key removed" });
  } catch (err) {
    res.status(500).json({ message: "Failed to remove key" });
  }
});

// ── Test Gemini key ──
router.post("/test", async (req, res) => {
  try {
    const actualKey = await getTeacherKey(req.user.id, "gemini");

    if (!actualKey)
      return res.status(404).json({ message: "No Gemini key found. Please add one first." });

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${actualKey}`
    );

    res.json({
      ok:      r.ok,
      message: r.ok
        ? "Gemini key is working"
        : "Invalid Gemini key — check and retry",
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: "Test failed", error: err.message });
  }
});

export default router;