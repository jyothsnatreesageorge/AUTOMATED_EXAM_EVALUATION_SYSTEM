import express from "express";
import multer from "multer";
import Exam from "../models/Exam.js";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const router = express.Router();

// ── S3 client ────────────────────────────────────────────────────────────────
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const storage = multer.memoryStorage();
const upload  = multer({ storage });

// ── POST /api/upload/evaluation-materials ────────────────────────────────────
// Uploads QP, Marking Scheme, Reference Texts to S3 only.
// Sets exam status to Active.
// No evaluation here — evaluation is triggered from uploadscript.jsx
router.post("/evaluation-materials", upload.any(), async (req, res) => {
  try {
    const { course, examType, classId, examId, evalType } = req.body;
    console.log("Backend received evalType:", evalType);

    if (!course || !examType || !classId || !examId) {
      return res.status(400).json({
        error: "course, examType, classId and examId are required.",
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded." });
    }

    const uploadedFiles = [];

    for (const file of req.files) {
      let folder;
      switch (file.fieldname) {
        case "question_paper":  folder = "question-paper"; break;
        case "marking_scheme":  folder = "marking-scheme"; break;
        case "reference_texts": folder = "reference-text"; break;
        default:
          console.warn(`Skipping unexpected field: ${file.fieldname}`);
          continue; // skip answer_scripts or anything else
      }

      const key = `${course}/${classId}/${examType}/${evalType}/${folder}/${file.originalname}`;

      await s3.send(new PutObjectCommand({
        Bucket:      process.env.S3_BUCKET,
        Key:         key,
        Body:        file.buffer,
        ContentType: file.mimetype,
      }));

      uploadedFiles.push(key);
      console.log(`✅ Uploaded: ${key}`);
    }

    // set exam status to Active
    await Exam.findByIdAndUpdate(examId, { status: "Active" });
    console.log(`✅ Exam ${examId} set to Active`);

    return res.json({
      message:      "Materials uploaded successfully ✅",
      uploadedFiles,
      uploaded:     uploadedFiles,
    });

  } catch (err) {
    console.error("Upload materials error:", err.stack || err);
    return res.status(500).json({ error: err.message || "Upload failed ❌" });
  }
});

export default router;
