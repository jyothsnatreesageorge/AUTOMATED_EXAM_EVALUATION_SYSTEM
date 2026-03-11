import express from "express";
import multer from "multer";
import Exam from "../models/Exam.js";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const router = express.Router();

// ── Configure S3 client ──────────────────────────────
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ── Multer memory storage ─────────────────────────────
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ── Upload Evaluation Materials ───────────────────────
router.post("/evaluation-materials", upload.any(), async (req, res) => {
  try {
    const { course, examType, examId } = req.body;  // <- include examId

    if (!course || !examType || !examId) {
      return res.status(400).json({ error: "Course, examType, and examId are required." });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded." });
    }

    const uploadedFiles = [];

    for (const file of req.files) {
      let folder = "";
      switch (file.fieldname) {
        case "question_paper": folder = "question-paper"; break;
        case "marking_scheme": folder = "marking-scheme"; break;
        case "answer_scripts": folder = "answer-scripts"; break;
        case "reference_texts": folder = "reference-text"; break;
        default: folder = "others";
      }

      const key = `${course}/${req.body.classId}/${examType}/${folder}/${file.originalname}`;

      await s3.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }));

      uploadedFiles.push(key);
    }

    // ── Update Exam status to active if all files are uploaded ──
    // Optional: You could check which files exist in DB/S3 if you want
    
    await Exam.findByIdAndUpdate(examId, { status: "Active" });

    return res.json({
      message: "Files uploaded successfully ✅",
      uploadedFiles,
    });

  } catch (err) {
    console.error("Upload error:", err.stack || err);
    return res.status(500).json({ error: err.message || "Upload failed ❌" });
  }
});
export default router;