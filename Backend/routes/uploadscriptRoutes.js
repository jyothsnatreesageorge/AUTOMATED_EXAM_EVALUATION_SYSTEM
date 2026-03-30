import express from "express";
import multer from "multer";
import path from "path";
import { PutObjectCommand, S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenAI } from "@google/genai";
import Result from "../models/Result.js";
import {
  getNextApiKey,
  markKeyUsed,
  markKeyFailed,
} from "../utils/geminiKeyManager.js";

const router = express.Router();
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const upload = multer({ storage: multer.memoryStorage() });

/* ── helpers ─────────────────────────────────────────────────────────────── */

/** Convert a readable stream to a Buffer */
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/**
 * Run OCR on a single PDF buffer using Gemini.
 * Retries automatically on a different key if the first key fails.
 */
async function extractTextWithGemini(pdfBuffer, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const keyObj = await getNextApiKey();

    try {
      const ai = new GoogleGenAI({ apiKey: keyObj.key }); // ✅ fixed constructor

      const result = await ai.models.generateContent({     // ✅ fixed method
        model: "gemini-2.5-flash",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: pdfBuffer.toString("base64"),
                },
              },
              {
                text: `You are an OCR engine. Extract ALL handwritten and printed text from this answer script PDF exactly as written.

RULES:
- Preserve question numbers and structure (e.g. Q1, Q2, 1a, 1b).
- Do NOT summarise, interpret, or correct anything.
- Do NOT add any commentary or extra text.
- Separate each page with: --- PAGE [n] ---
- If a page is blank, write: --- PAGE [n] --- (blank)
- Output plain text only.`,
              },
            ],
          },
        ],
      });

      const text = result.text;                            // ✅ fixed response shape
      await markKeyUsed(keyObj.label);
      return text;

    } catch (err) {
      console.error(`❌ FULL OCR ERROR (attempt ${attempt + 1}):`, err); // ✅ full error
      await markKeyFailed(keyObj.label);
      lastError = err;
    }
  }

  throw new Error(`OCR failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/* ── POST /answer-scripts ────────────────────────────────────────────────── */

router.post(
  "/answer-scripts",
  upload.array("answer_scripts", 50),
  async (req, res) => {
    try {
      const { course, examType, classId, examId, evalType } = req.body;

      if (!course || !examType || !classId || !examId || !evalType)
        return res.status(400).json({
          error: "course, examType, classId, examId and evalType are required.",
        });
      if (!req.files?.length)
        return res.status(400).json({ error: "No files uploaded." });

      const uploadedFiles = [];

      await Promise.all(
        req.files.map(async (file) => {
          const originalName = path.basename(file.originalname || "");
          if (!originalName.toLowerCase().endsWith(".pdf"))
            throw new Error(`Only PDF files are allowed: ${originalName}`);

          const key    = `${course}/${classId}/${examType}/${evalType}/answer-scripts/${originalName}`;
          const rollNo = path.parse(originalName).name;

          /* 1. Upload PDF to S3 */
          await s3.send(
            new PutObjectCommand({
              Bucket:      process.env.S3_BUCKET,
              Key:         key,
              Body:        file.buffer,
              ContentType: "application/pdf",
            })
          );
          console.log(`✅ S3 uploaded: ${key}`);

          /* 2. Create/update Result record — mark OCR as pending */
          await Result.updateOne(
            { scriptKey: key },
            {
              $set: {
                rollNo, scriptKey: key,
                classId, course, examType, examId, evalType,
                ocrStatus: "pending",
                ocrError:  "",
              },
            },
            { upsert: true }
          );

          uploadedFiles.push(key);

          /* 3. Copy buffer before setImmediate — multer may reuse it */
          const pdfBuffer = Buffer.from(file.buffer); // ✅ safe copy

          /* 4. Run OCR asynchronously — don't block the upload response */
          setImmediate(async () => {
            try {
              console.log(`🔍 Starting OCR for: ${key}`);
              const extractedText = await extractTextWithGemini(pdfBuffer);

              await Result.updateOne(
                { scriptKey: key },
                {
                  $set: {
                    extractedText,
                    ocrStatus: "done",
                    ocrError:  "",
                    ocrDoneAt: new Date(),
                    updatedAt: new Date(),
                  },
                }
              );
              console.log(`✅ OCR done: ${key}`);
            } catch (ocrErr) {
              console.error(`❌ OCR failed for ${key}:`, ocrErr); // ✅ full error object
              await Result.updateOne(
                { scriptKey: key },
                {
                  $set: {
                    ocrStatus: "failed",
                    ocrError:  ocrErr.message,
                    updatedAt: new Date(),
                  },
                }
              );
            }
          });
        })
      );

      res.json({
        message:      "Scripts uploaded successfully. OCR running in background ✅",
        uploadedFiles,
        uploaded:     uploadedFiles,
      });
    } catch (err) {
      console.error("Upload error:", err);
      return res.status(500).json({ error: err.message || "Upload failed ❌" });
    }
  }
);

/* ── GET /ocr-status ─────────────────────────────────────────────────────── */

router.get("/ocr-status", async (req, res) => {
  try {
    const keys = (req.query.scriptKeys || "")
      .split(",")
      .map((k) => decodeURIComponent(k.trim()))
      .filter(Boolean);

    if (!keys.length) return res.json({ allDone: true, statuses: [] });

    const records = await Result.find(
      { scriptKey: { $in: keys } },
      { scriptKey: 1, ocrStatus: 1, ocrError: 1 }
    ).lean();

    const statuses = keys.map((key) => {
      const r = records.find((r) => r.scriptKey === key);
      return {
        scriptKey: key,
        ocrStatus: r?.ocrStatus ?? "pending",
        ocrError:  r?.ocrError  ?? "",
      };
    });

    const allDone = statuses.every((s) => s.ocrStatus === "done" || s.ocrStatus === "failed");

    return res.json({ allDone, statuses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
