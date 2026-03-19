import express from "express";
import multer from "multer";
import path from "path";
import { createRequire } from "module";
import { PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import Groq from "groq-sdk";
import Result from "../models/Result.js";

const router  = express.Router();
const require = createRequire(import.meta.url);

// ── S3 client ─────────────────────────────────────────────────────────────────
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const storage = multer.memoryStorage();
const upload  = multer({ storage });

// ── pdfjs-dist v3 + canvas ────────────────────────────────────────────────────
// IMPORTANT: package.json must pin "pdfjs-dist": "3.11.174"
// v4+ removed /legacy/build/pdf.js — v3 is stable and works perfectly on Render
const pdfjsLib = (() => {
  const p = require("pdfjs-dist/legacy/build/pdf.js");
  return p.default ?? p;
})();
const { createCanvas } = require("canvas");
pdfjsLib.GlobalWorkerOptions.workerSrc = false;

async function pdfToJpegBuffers(pdfBuffer) {
  const data   = new Uint8Array(pdfBuffer);
  const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
  const pages  = [];

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page     = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas   = createCanvas(viewport.width, viewport.height);
    const ctx      = canvas.getContext("2d");

    await page.render({ canvasContext: ctx, viewport }).promise;

    pages.push({
      pageNum: i,
      buffer:  canvas.toBuffer("image/jpeg", { quality: 0.92 }),
    });
  }

  return pages;
}

// ── Groq rate-limit helpers ───────────────────────────────────────────────────
function parseGroqRetryDelay(errMessage) {
  const secMatch = String(errMessage).match(/try again in ([\d.]+)s/i);
  if (secMatch) {
    const secs = parseFloat(secMatch[1]);
    if (!isNaN(secs) && secs > 0) {
      return Math.min(Math.ceil(secs + 2) * 1000, 2 * 60 * 60 * 1000);
    }
  }
  return String(errMessage).includes("tokens per day") ? 5 * 60 * 1000 : 60 * 1000;
}

function isGroqRateLimit(err) {
  return (
    err?.status === 429 ||
    String(err?.message || "").includes("rate_limit_exceeded") ||
    String(err?.message || "").includes("429")
  );
}

// ── Groq Vision: OCR one real JPEG page ──────────────────────────────────────
async function ocrPageWithGroq(jpegBuffer, pageNum, rollNo, maxRetries = 5) {
  const client      = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const base64Image = jpegBuffer.toString("base64");

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
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
                text: `This is page ${pageNum} of a handwritten student answer sheet (Roll No: ${rollNo}).
Transcribe ALL handwritten text exactly as written.
Preserve question numbers, headings, and answer structure.
If a section is blank or completely unreadable, write "(blank)".
Output only the transcribed text — no preamble, no explanation.`,
              },
            ],
          },
        ],
      });

      const text = response.choices?.[0]?.message?.content?.trim();
      if (!text || text.length < 3) return "(blank)";
      return text;

    } catch (err) {
      if (isGroqRateLimit(err) && attempt <= maxRetries) {
        const waitMs = parseGroqRetryDelay(err.message);
        const isTPD  = String(err.message).includes("tokens per day");
        console.warn(
          `  ⏳ [OCR] Groq ${isTPD ? "TPD" : "RPM"} limit — waiting ${Math.round(waitMs / 1000)}s (attempt ${attempt}/${maxRetries}) for ${rollNo} page ${pageNum}…`
        );
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      console.error(`  ❌ [OCR] Page ${pageNum} failed for ${rollNo}:`, err.message);
      throw err;
    }
  }
}

// ── Background OCR ────────────────────────────────────────────────────────────
async function runBackgroundOcr({
  fileBuffer, scriptKey, rollNo, classId, course, examType, examId,
}) {
  try {
    console.log(`\n🔍 [BG OCR] Starting: ${scriptKey}`);

    await Result.updateOne(
      { scriptKey },
      {
        $set: {
          rollNo, scriptKey, classId, course, examType, examId,
          ocrStatus:     "processing",
          extractedText: "",
          ocrError:      "",
        },
      },
      { upsert: true }
    );

    console.log(`  [BG OCR] Rendering PDF pages for ${rollNo}…`);
    const pages = await pdfToJpegBuffers(fileBuffer);
    console.log(`  [BG OCR] ${pages.length} page(s) rendered for ${rollNo}`);

    const ocrPages = [];
    for (const { pageNum, buffer } of pages) {
      console.log(`  [BG OCR] OCR page ${pageNum}/${pages.length} for ${rollNo}…`);
      const text = await ocrPageWithGroq(buffer, pageNum, rollNo);
      ocrPages.push({ page: pageNum, text });
    }

    const extractedText = ocrPages
      .map((p) => `=== Page ${p.page} ===\n${p.text}`)
      .join("\n\n");

    await Result.updateOne(
      { scriptKey },
      {
        $set: {
          extractedText,
          ocrPages,
          ocrStatus: "done",
          ocrDoneAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    console.log(`✅ [BG OCR] Done: ${rollNo} — ${ocrPages.length} page(s), ${extractedText.length} chars`);

  } catch (err) {
    console.error(`❌ [BG OCR] Failed for ${scriptKey}:`, err.message);
    await Result.updateOne(
      { scriptKey },
      {
        $set: {
          ocrStatus: "failed",
          ocrError:  err.message,
          updatedAt: new Date(),
        },
      }
    ).catch(() => {});
  }
}

// ── Resume pending/failed OCR jobs on server startup ─────────────────────────
export async function resumePendingOcr() {
  try {
    const pending = await Result.find({
      ocrStatus: { $in: ["pending", "processing", "failed"] },
    }).lean();

    if (!pending.length) {
      console.log("✅ [RESUME OCR] No pending jobs.");
      return;
    }

    console.log(`🔄 [RESUME OCR] Found ${pending.length} job(s) — resuming…`);

    ;(async () => {
      for (const record of pending) {
        try {
          const s3Res = await s3.send(
            new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: record.scriptKey })
          );
          const chunks = [];
          for await (const chunk of s3Res.Body) chunks.push(Buffer.from(chunk));
          const fileBuffer = Buffer.concat(chunks);

          await runBackgroundOcr({
            fileBuffer,
            scriptKey: record.scriptKey,
            rollNo:    record.rollNo,
            classId:   record.classId,
            course:    record.course,
            examType:  record.examType,
            examId:    record.examId,
          });
        } catch (err) {
          console.error(`❌ [RESUME OCR] Failed for ${record.scriptKey}:`, err.message);
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      console.log("✅ [RESUME OCR] All pending jobs processed.");
    })();

  } catch (err) {
    console.error("❌ [RESUME OCR] Error:", err.message);
  }
}

// ── POST /api/uploadscript/answer-scripts ─────────────────────────────────────
router.post(
  "/answer-scripts",
  upload.array("answer_scripts", 50),
  async (req, res) => {
    try {
      const { course, examType, classId, examId } = req.body;

      if (!course || !examType || !classId || !examId) {
        return res.status(400).json({ error: "course, examType, classId and examId are required." });
      }
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded." });
      }

      for (const file of req.files) {
        const originalName = path.basename(file.originalname || "");
        const isPdf =
          file.mimetype === "application/pdf" ||
          originalName.toLowerCase().endsWith(".pdf");
        if (!isPdf) {
          return res.status(400).json({ error: `Only PDF files are allowed: ${originalName}` });
        }
      }

      const uploadedFiles = [];
      const ocrQueue      = [];

      await Promise.all(
        req.files.map(async (file) => {
          const originalName = path.basename(file.originalname || "");
          const key = `${course}/${classId}/${examType}/answer-scripts/${originalName}`;

          await s3.send(new PutObjectCommand({
            Bucket:      process.env.S3_BUCKET,
            Key:         key,
            Body:        file.buffer,
            ContentType: "application/pdf",
          }));

          console.log(`✅ S3 uploaded: ${key}`);
          const rollNo = path.parse(originalName).name;
          uploadedFiles.push(key);
          ocrQueue.push({ fileBuffer: file.buffer, scriptKey: key, rollNo, classId, course, examType, examId });
        })
      );

      res.json({ message: "Scripts uploaded successfully ✅", uploadedFiles, uploaded: uploadedFiles });

      ;(async () => {
        for (const item of ocrQueue) {
          try {
            await runBackgroundOcr(item);
          } catch (err) {
            console.error(`[BG OCR] Unhandled error for ${item.scriptKey}:`, err.message);
          }
          await new Promise((r) => setTimeout(r, 3000));
        }
        console.log(`✅ [BG OCR] All ${ocrQueue.length} script(s) processed`);
      })();

    } catch (err) {
      console.error("Answer scripts upload error:", err.stack || err);
      return res.status(500).json({ error: err.message || "Upload failed ❌" });
    }
  }
);

// ── GET /api/uploadscript/ocr-status ─────────────────────────────────────────
router.get("/ocr-status", async (req, res) => {
  try {
    const keys = (req.query.scriptKeys || "")
      .split(",")
      .map((k) => decodeURIComponent(k.trim()))
      .filter(Boolean);

    if (!keys.length) return res.json({ allDone: true, statuses: [] });

    const records = await Result.find(
      { scriptKey: { $in: keys } },
      { scriptKey: 1, ocrStatus: 1 }
    ).lean();

    const statuses = keys.map((key) => {
      const r = records.find((r) => r.scriptKey === key);
      return { scriptKey: key, ocrStatus: r?.ocrStatus ?? "pending" };
    });

    const allDone = statuses.every(
      (s) => s.ocrStatus === "done" || s.ocrStatus === "failed"
    );

    return res.json({ allDone, statuses });

  } catch (err) {
    console.error("OCR status check error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
