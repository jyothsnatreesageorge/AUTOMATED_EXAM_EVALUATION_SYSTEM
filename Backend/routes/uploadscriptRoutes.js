import express from "express";
import multer from "multer";
import path from "path";
import { createRequire } from "module";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import Groq from "groq-sdk";
import Result from "../models/Result.js";

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

// ── PDF → JPEG page buffers ──────────────────────────────────────────────────
const require  = createRequire(import.meta.url);
const pdfjsLib = (() => {
  const p = require("pdfjs-dist/legacy/build/pdf.js");
  return p.default ?? p;
})();
const { createCanvas } = require("canvas");
pdfjsLib.GlobalWorkerOptions.workerSrc = false;

async function pdfToPageBuffers(pdfBuffer) {
  const data   = new Uint8Array(pdfBuffer);
  const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
  const pages  = [];

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page     = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas   = createCanvas(viewport.width, viewport.height);
    const ctx      = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push({ pageNum: i, buffer: canvas.toBuffer("image/jpeg", { quality: 0.85 }) });
  }

  return pages;
}

// ── Groq Vision: extract one page ───────────────────────────────────────────
async function extractPageWithGroq(imageBuffer, pageNum, retries = 2) {
  const client      = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const base64Image = imageBuffer.toString("base64");

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model:       "meta-llama/llama-4-scout-17b-16e-instruct",
        max_tokens:  4096,
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: [
              {
                type:      "image_url",
                image_url: { url: `data:image/jpeg;base64,${base64Image}` },
              },
              {
                type: "text",
                text: `This is page ${pageNum} of a handwritten student answer sheet.
Transcribe ALL handwritten text exactly as written.
Preserve question numbers, headings, and structure.
If a section is blank or unreadable, write "(blank)".
Output only the transcribed text — no preamble, no explanation.`,
              },
            ],
          },
        ],
      });

      const text = response.choices?.[0]?.message?.content?.trim();
      if (!text || text.length < 3) return "(blank page)";
      return text;

    } catch (err) {
      console.error(`  OCR page ${pageNum} attempt ${attempt} failed:`, err.message);
      if (attempt <= retries) await new Promise(r => setTimeout(r, 2000));
      else return `(error on page ${pageNum}: ${err.message})`;
    }
  }
}

// ── Background OCR — saves to Result collection ──────────────────────────────
async function runBackgroundOcr({ fileBuffer, scriptKey, rollNo, classId, course, examType, examId }) {
  try {
    console.log(`\n🔍 [BG OCR] Starting: ${scriptKey}`);

    await Result.updateOne(
      { scriptKey },
      {
        $set: {
          rollNo, scriptKey, classId, course, examType, examId,
          ocrStatus:     "pending",
          extractedText: "",
        },
      },
      { upsert: true }
    );

    const pages     = await pdfToPageBuffers(fileBuffer);
    const pageTexts = [];

    for (const { pageNum, buffer } of pages) {
      console.log(`  [BG OCR] Page ${pageNum}/${pages.length} — ${rollNo}`);
      const text = await extractPageWithGroq(buffer, pageNum);
      pageTexts.push({ page: pageNum, text });
    }

    const fullText = pageTexts
      .map(p => `=== Page ${p.page} ===\n${p.text}`)
      .join("\n\n");

    await Result.updateOne(
      { scriptKey },
      {
        $set: {
          extractedText: fullText,
          ocrPages:      pageTexts,
          ocrStatus:     "done",
          ocrDoneAt:     new Date(),
          updatedAt:     new Date(),
        },
      }
    );

    console.log(`✅ [BG OCR] Done: ${rollNo} — ${pageTexts.length} pages`);

  } catch (err) {
    console.error(`❌ [BG OCR] Failed for ${scriptKey}:`, err.message);
    await Result.updateOne(
      { scriptKey },
      { $set: { ocrStatus: "failed", ocrError: err.message, updatedAt: new Date() } }
    ).catch(() => {});
  }
}

// ── POST /api/upload/answer-scripts ──────────────────────────────────────────
// 1. Upload answer scripts to S3
// 2. Return uploadedKeys to frontend
// 3. Run OCR in background (non-blocking)
// Evaluation is triggered separately by uploadscript.jsx after this returns
router.post(
  "/answer-scripts",
  upload.array("answer_scripts", 50),
  async (req, res) => {
    try {
      const { course, examType, classId, examId } = req.body;

      if (!course || !examType || !classId || !examId) {
        return res.status(400).json({
          error: "course, examType, classId and examId are required.",
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded." });
      }

      const uploadedFiles = [];
      const ocrQueue      = [];

      for (const file of req.files) {
        if (file.mimetype !== "application/pdf") {
          return res.status(400).json({
            error: `Only PDF files are allowed: ${file.originalname}`,
          });
        }

        const key = `${course}/${classId}/${examType}/answer-scripts/${file.originalname}`;

        await s3.send(new PutObjectCommand({
          Bucket:      process.env.S3_BUCKET,
          Key:         key,
          Body:        file.buffer,
          ContentType: file.mimetype,
        }));

        uploadedFiles.push(key);

        const rollNo = path.parse(file.originalname).name;
        ocrQueue.push({
          fileBuffer: file.buffer,
          scriptKey:  key,
          rollNo,
          classId,
          course,
          examType,
          examId,
        });
      }

      // ✅ respond immediately — frontend gets keys and triggers evaluation
      res.json({
        message:      "Scripts uploaded successfully ✅",
        uploadedFiles,
        uploaded:     uploadedFiles,
      });

      // ✅ OCR runs in background after response
      for (const item of ocrQueue) {
        runBackgroundOcr(item).catch(err =>
          console.error(`[BG OCR] Unhandled error for ${item.scriptKey}:`, err.message)
        );
      }

    } catch (err) {
      console.error("Answer scripts upload error:", err.stack || err);
      return res.status(500).json({
        error: err.message || "Upload failed ❌",
      });
    }
  }
);

export default router;
