import express from "express";
import multer from "multer";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const router = express.Router();

// Configure S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Use memory storage for multer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ── Upload Answer Scripts ────────────────────────────────────────────────
router.post(
  "/evaluation-materials",
  upload.array("answer_scripts", 50), // field name must match frontend
  async (req, res) => {
    try {
      const { course, examType } = req.body;

      if (!course || !examType) {
        return res.status(400).json({ error: "Course and examType are required." });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded." });
      }

      const uploadedFiles = [];

      for (const file of req.files) {
        const key = `${course}/${exam.classId}/${examType}/answer-scripts/${file.originalname}`;
        const params = {
          Bucket: process.env.S3_BUCKET,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        };
        await s3.send(new PutObjectCommand(params));
        uploadedFiles.push(key);
      }

      return res.json({
        message: "Files uploaded successfully ✅",
        uploadedFiles,
      });
    } catch (err) {
      console.error("Upload error:", err.stack || err);
      return res.status(500).json({ error: err.message || "Upload failed ❌" });
    }
  }
);
export default router;