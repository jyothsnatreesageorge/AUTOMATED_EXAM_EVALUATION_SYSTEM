import express from "express";
import Class from "../models/Class.js";

const router = express.Router();

const parseSemester = (val) => {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (!s) return null;

  if (/^s\d+$/i.test(s)) return Number(s.slice(1));
  if (/^\d+$/.test(s)) return Number(s);

  return null;
};

// CREATE CLASS
router.post("/", async (req, res) => {
  try {
    console.log("POST /api/classes req.body:", req.body);

    const { classId, admYear, passOutYear, division, semester } = req.body;

    if (!classId || !admYear || !passOutYear) {
      return res.status(400).json({
        message: "classId, admYear, passOutYear are required",
      });
    }

    const semNum = parseSemester(semester);
    if (!semNum || semNum < 1 || semNum > 8) {
      return res.status(400).json({
        message: "semester must be 1-8",
      });
    }

    const divClean =
      !division || String(division).trim() === "" || division === "None"
        ? "None"
        : String(division).toUpperCase();

    const doc = await Class.create({
      classId: String(classId).trim(),
      admissionYear: String(admYear).trim(),
      passoutYear: String(passOutYear).trim(),
      semester: semNum,
      division: divClean,
    });

    res.status(201).json({
      _id: doc._id,
      classId: doc.classId,
      admissionYear: doc.admissionYear,
      passoutYear: doc.passoutYear,
      semester: doc.semester,
      division: doc.division,
    });
  } catch (err) {
    console.error("POST /api/classes error:", err);
    res.status(500).json({ message: err.message });
  }
});

// GET ALL CLASSES
router.get("/", async (req, res) => {
  try {
    console.log("🔥 NEW GET /api/classes route is running");

    const classes = await Class.find().sort({ classId: 1 });

    const normalized = classes.map((c) => ({
      _id: c._id,
      classId: c.classId,
      admissionYear: c.admissionYear || "",
      passoutYear: c.passoutYear || "",
      semester: c.semester || "",
      division:
        c.division === null || c.division === undefined || c.division === ""
          ? "None"
          : String(c.division).toUpperCase(),
    }));

    console.log("🔥 GET RESULT:", normalized);
    res.json(normalized);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// UPDATE SEMESTER
router.patch("/:classId", async (req, res) => {
  try {
    const { classId } = req.params;
    const semNum = parseSemester(req.body.semester);

    if (!semNum || semNum < 1 || semNum > 8) {
      return res.status(400).json({
        message: "semester must be 1-8",
      });
    }

    const updated = await Class.findOneAndUpdate(
      { classId },
      { $set: { semester: semNum } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Class not found" });
    }

    res.json({
      _id: updated._id,
      classId: updated.classId,
      admissionYear: updated.admissionYear,
      passoutYear: updated.passoutYear,
      semester: updated.semester,
      division: updated.division || "None",
    });
  } catch (err) {
    console.error("PATCH /api/classes/:classId error:", err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE CLASS
router.delete("/:classId", async (req, res) => {
  try {
    const deleted = await Class.findOneAndDelete({ classId: req.params.classId });

    if (!deleted) {
      return res.status(404).json({ message: "Class not found" });
    }

    res.json({ message: "Class deleted", classId: req.params.classId });
  } catch (err) {
    console.error("DELETE /api/classes/:classId error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;