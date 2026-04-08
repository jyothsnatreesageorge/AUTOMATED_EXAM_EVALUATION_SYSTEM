import express from "express";
import bcrypt from "bcryptjs";
import Student from "../models/Student.js";
import Class from "../models/Class.js";

const router = express.Router();

const normalizeClassId = (v) => String(v || "").trim().toUpperCase();

async function findClassSmart(classIdInput) {
  const cid = normalizeClassId(classIdInput);
  if (!cid) return null;

  let cls = await Class.findOne({ classId: cid }).lean();
  if (cls) return cls;

  if (/[A-Z]$/.test(cid)) {
    const base = cid.slice(0, -1);
    cls = await Class.findOne({ classId: base }).lean();
    if (cls) return cls;
  }

  return null;
}

async function generateAdmnNoFromLast(admissionYear) {
  const year = Number(admissionYear);
  if (!year || Number.isNaN(year)) throw new Error("Invalid admissionYear");

  const prefix = `${year}BR`;

  const last = await Student.findOne({ admnNo: new RegExp(`^${prefix}`) })
    .sort({ admnNo: -1 })
    .select("admnNo")
    .lean();

  let nextSeq = 1;

  if (last?.admnNo) {
    const lastSeqStr = last.admnNo.slice(prefix.length);
    const lastSeqNum = Number(lastSeqStr);
    if (!Number.isNaN(lastSeqNum)) nextSeq = lastSeqNum + 1;
  }

  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

/* =======================
   GET ALL / FILTER
======================= */
router.get("/", async (req, res) => {
  try {
    const { q, classId } = req.query;
    const filter = {};

    if (classId && String(classId).trim() && String(classId) !== "All") {
      filter.classId = normalizeClassId(classId);
    }

    if (q && String(q).trim()) {
      const re = new RegExp(String(q).trim(), "i");
      filter.$or = [
        { name: re },
        { rollNo: re },
        { admnNo: re },
        { email: re },
        { classId: re },
      ];
    }

    const list = await Student.find(filter).sort({ rollNo: 1 });
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

/* =======================
   ADD SINGLE STUDENT
======================= */
router.post("/", async (req, res) => {
  try {
    const { name, rollNo, classId, email } = req.body;

    if (!name?.trim()) return res.status(400).json({ message: "name is required" });
    if (!rollNo?.trim()) return res.status(400).json({ message: "rollNo is required" });
    if (!classId?.trim()) return res.status(400).json({ message: "classId is required" });
    if (!email?.trim()) return res.status(400).json({ message: "email is required" });

    const cls = await findClassSmart(classId);
    if (!cls) return res.status(400).json({ message: "Invalid classId (class not found)" });

    const admissionYear = Number(cls.admissionYear);
    if (!admissionYear || Number.isNaN(admissionYear)) {
      return res.status(400).json({ message: "Class admissionYear invalid" });
    }

    const semesterNum = Number(cls.semester);
    if (Number.isNaN(semesterNum) || semesterNum < 1 || semesterNum > 8) {
      return res.status(400).json({ message: "Class semester invalid" });
    }

    const admnNo = await generateAdmnNoFromLast(admissionYear);

    const generatedPassword =
      name.trim().slice(0, 3).toUpperCase().padEnd(3, "X") + "123";
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    const doc = await Student.create({
      name: name.trim(),
      rollNo: rollNo.trim(),
      admnNo,
      classId: normalizeClassId(classId),
      semester: semesterNum,
      email: email.trim(),
      password: hashedPassword,
    });

    return res.status(201).json({
      message: "Student added successfully",
      initialPassword: generatedPassword,
      student: doc,
    });
  } catch (err) {
    if (err?.code === 11000) {
      const field = Object.keys(err.keyValue || {})[0] || "field";
      return res.status(409).json({ message: `Duplicate ${field}` });
    }
    return res.status(400).json({ message: err.message });
  }
});

/* =======================
   BATCH ADD
======================= */
router.post("/batch", async (req, res) => {
  try {
    const { rows } = req.body;

    console.log("Incoming batch rows:", rows);

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: "rows[] is required" });
    }

    const classIds = [
      ...new Set(rows.map((r) => normalizeClassId(r?.classId)).filter(Boolean)),
    ];

    console.log("Normalized classIds:", classIds);

    const existing = await Class.find({ classId: { $in: classIds } })
      .select("classId admissionYear semester")
      .lean();

    console.log("Matching classes from DB:", existing);

    const classMap = new Map(existing.map((c) => [normalizeClassId(c.classId), c]));
    const missingClasses = classIds.filter((id) => !classMap.has(id));

    const stillMissing = [];
    for (const mc of missingClasses) {
      const smart = await findClassSmart(mc);
      if (smart) classMap.set(normalizeClassId(mc), smart);
      else stillMissing.push(mc);
    }

    if (stillMissing.length) {
      return res.status(400).json({
        message: "Invalid classId(s)",
        missingClasses: stillMissing,
      });
    }

    let inserted = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || {};

      const name = String(r.name || "").trim();
      const rollNo = String(r.rollNo || "").trim();
      const email = String(r.email || "").trim();
      const cid = normalizeClassId(r.classId);

      console.log(`Processing row ${i + 2}:`, { name, rollNo, email, cid });

      if (!name || !rollNo || !email || !cid) {
        errors.push({ row: i + 2, message: "Missing name/rollNo/email/classId" });
        continue;
      }

      const cls = classMap.get(cid) || (await findClassSmart(cid));
      if (!cls) {
        errors.push({ row: i + 2, message: `Class not found for classId ${cid}` });
        continue;
      }

      const admissionYear = Number(cls.admissionYear);
      const semesterNum = Number(cls.semester);

      try {
        const admnNo = await generateAdmnNoFromLast(admissionYear);

        const generatedPassword =
          name.slice(0, 3).toUpperCase().padEnd(3, "X") + "123";
        const hashedPassword = await bcrypt.hash(generatedPassword, 10);

        await Student.create({
          name,
          rollNo,
          admnNo,
          classId: cid,
          semester: semesterNum,
          email,
          password: hashedPassword,
        });

        inserted++;
      } catch (e) {
        console.error(`Row ${i + 2} insert failed:`, e.message);
        errors.push({ row: i + 2, message: e.message });
      }
    }

    console.log("Batch result:", { inserted, failed: errors.length, errors });

    if (inserted === 0) {
      return res.status(400).json({
        message: "No students were inserted",
        inserted,
        failed: errors.length,
        errors,
      });
    }

    return res.status(201).json({
      message:
        errors.length > 0
          ? "Batch upload partially successful"
          : "Batch upload successful",
      inserted,
      failed: errors.length,
      errors,
    });
  } catch (err) {
    console.error("Batch fatal error:", err);
    return res.status(500).json({ message: err.message });
  }
});

/* =======================
   UPDATE
======================= */
router.put("/:id", async (req, res) => {
  try {
    const { name, rollNo, classId, semester, email } = req.body;

    if (!name?.trim() || !rollNo?.trim() || !classId?.trim() || !email?.trim()) {
      return res.status(400).json({ message: "name, rollNo, classId, email are required" });
    }

    let semNum = undefined;
    if (semester !== undefined && semester !== null && String(semester).trim() !== "") {
      semNum = Number(semester);
      if (Number.isNaN(semNum) || semNum < 1 || semNum > 8) {
        return res.status(400).json({ message: "semester must be a number 1-8" });
      }
    }

    const cls = await findClassSmart(classId);
    if (!cls) return res.status(400).json({ message: "Invalid classId (class not found)" });

    const updated = await Student.findByIdAndUpdate(
      req.params.id,
      {
        name: name.trim(),
        rollNo: rollNo.trim(),
        classId: normalizeClassId(classId),
        ...(semNum !== undefined ? { semester: semNum } : {}),
        email: email.trim(),
      },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Student not found" });
    return res.json({ message: "Updated", student: updated });
  } catch (err) {
    if (err?.code === 11000) {
      const field = Object.keys(err.keyValue || {})[0] || "field";
      return res.status(409).json({ message: `Duplicate ${field}` });
    }
    return res.status(400).json({ message: err.message });
  }
});

/* =======================
   DELETE SINGLE
======================= */
router.delete("/:id", async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    return res.json({ message: "Deleted" });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});
/* =======================
   GET BY CLASS (for export)
======================= */
router.get("/by-class/:classId", async (req, res) => {
  try {
    const students = await Student.find(
      { classId: normalizeClassId(req.params.classId) },
      { rollNo: 1, name: 1, _id: 0 }
    ).sort({ rollNo: 1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch students" });
  }
});
export default router;
