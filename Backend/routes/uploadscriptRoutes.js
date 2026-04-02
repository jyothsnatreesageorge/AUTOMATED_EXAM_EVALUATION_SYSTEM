import express  from "express";
import multer   from "multer";
import path     from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GoogleGenAI }  from "@google/genai";
import Result           from "../models/Result.js";
import { getNextApiKey, markKeyUsed, markKeyFailed } from "../utils/geminiKeyManager.js";

const router = express.Router();
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ✅ Accept up to 15 files per batch (frontend sends 10, give headroom)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 15 },
  fileFilter: (_, file, cb) =>
    cb(null, file.originalname.toLowerCase().endsWith(".pdf")),
});

/* ── OCR helper (unchanged) ──────────────────────────────────────────────── */
async function extractTextWithGemini(pdfBuffer, maxRetries = 3) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const keyObj = await getNextApiKey();
    try {
      const ai = new GoogleGenAI({ apiKey: keyObj.key });
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          parts: [
            { inlineData: { mimeType: "application/pdf", data: pdfBuffer.toString("base64") } },
            { text: `You are an OCR engine. Extract ALL handwritten and printed text from this answer script PDF exactly as written.\n\nRULES:\n- Preserve question numbers and structure.\n- Do NOT summarise, interpret, or correct.\n- Separate pages with: --- PAGE [n] ---\n- Blank pages: --- PAGE [n] --- (blank)\n- Plain text only.` },
          ],
        }],
      });
      await markKeyUsed(keyObj.label);
      return result.text;
    } catch (err) {
      const isQuota = err?.message?.includes("429") ||
                      err?.message?.includes("RESOURCE_EXHAUSTED") ||
                      err?.message?.includes("quota");
      const isInvalid = err?.message?.includes("INVALID_ARGUMENT") ||
                        err?.message?.includes("API_KEY_INVALID");

      if (isQuota || isInvalid) {
        await markKeyFailed(keyObj.label, isQuota);
      }
      // For other errors (network, timeout) — don't penalise the key

      console.error(`❌ OCR attempt ${attempt + 1} failed:`, err.message);
      lastError = err;

      // Wait if quota hit before retrying with next key
      if (isQuota) {
        const retryMatch = err.message?.match(/retry in ([\d.]+)s/i);
        const waitMs     = retryMatch ? parseFloat(retryMatch[1]) * 1000 : 65_000;
        console.log(`⏳ Waiting ${waitMs / 1000}s before retry...`);
        await new Promise(r => setTimeout(r, waitMs));
      }
    }
  }

  throw new Error(`OCR failed after ${maxRetries} attempts: ${lastError?.message}`);
}
  }
  throw new Error(`OCR failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/* ── Process files one-by-one (sequential = low memory) ─────────────────── */
async function processFile(file, { course, classId, examType, examId, evalType }) {
  const originalName = path.basename(file.originalname);
  const key    = `${course}/${classId}/${examType}/${evalType}/answer-scripts/${originalName}`;
  const rollNo = path.parse(originalName).name;

  // 1. Upload to S3
  await s3.send(new PutObjectCommand({
    Bucket:      process.env.S3_BUCKET,
    Key:         key,
    Body:        file.buffer,
    ContentType: "application/pdf",
  }));

  // 2. Save to DB as pending
  await Result.updateOne(
    { scriptKey: key },
    { $set: { rollNo, scriptKey: key, classId, course, examType, examId, evalType, ocrStatus: "pending", ocrError: "" } },
    { upsert: true }
  );

  // 3. Keep buffer copy, then free original
  const pdfBuffer = Buffer.from(file.buffer);
  file.buffer = null; // ✅ free memory immediately

  // 4. Queue OCR — staggered to avoid API key storm
  return { key, pdfBuffer, rollNo };
}

/* ── OCR queue — runs with concurrency 3 ────────────────────────────────── */
// In uploadscript route — replace runOcrQueue

async function runOcrQueue(items) {
  const CONCURRENCY   = 2;          // max parallel OCR calls
  const DELAY_MS      = 3000;       // 3 second gap between each call
  const queue         = [...items];

  const worker = async () => {
    while (queue.length) {
      const { key, pdfBuffer, rollNo } = queue.shift();
      try {
        console.log(`🔍 OCR start: ${rollNo}`);
        const extractedText = await extractTextWithGemini(pdfBuffer);
        await Result.updateOne(
          { scriptKey: key },
          { $set: { extractedText, ocrStatus: "done", ocrError: "", ocrDoneAt: new Date() } }
        );
        console.log(`✅ OCR done: ${rollNo}`);
      } catch (err) {
        console.error(`❌ OCR failed: ${rollNo}`, err.message);
        await Result.updateOne(
          { scriptKey: key },
          { $set: { ocrStatus: "failed", ocrError: err.message } }
        );
      }
      // ✅ Wait between each call — prevents quota storm
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  };

  // Run with limited concurrency
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

/* ── POST /answer-scripts ────────────────────────────────────────────────── */
router.post("/answer-scripts", upload.array("answer_scripts", 15), async (req, res) => {
  try {
    const { course, examType, classId, examId, evalType } = req.body;

    if (!course || !examType || !classId || !examId || !evalType)
      return res.status(400).json({ error: "course, examType, classId, examId and evalType are required." });
    if (!req.files?.length)
      return res.status(400).json({ error: "No files uploaded." });

    const meta = { course, examType, classId, examId, evalType };

    // ✅ Process files sequentially — low memory, no parallel RAM spike
    const ocrItems = [];
    for (const file of req.files) {
      const item = await processFile(file, meta);
      ocrItems.push(item);
    }

    // ✅ Respond immediately — don't make client wait for OCR
    res.json({
      message:      `${ocrItems.length} scripts uploaded. OCR running in background ✅`,
      uploaded:     ocrItems.map(i => i.key),
      uploadedFiles: ocrItems.map(i => i.key),
    });

    // ✅ OCR runs AFTER response with controlled concurrency
    runOcrQueue(ocrItems).catch(err =>
      console.error("❌ OCR queue error:", err.message)
    );

  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message || "Upload failed ❌" });
  }
});

/* ── GET /ocr-status (unchanged) ─────────────────────────────────────────── */
router.get("/ocr-status", async (req, res) => {
  try {
    const keys = (req.query.scriptKeys || "")
      .split(",").map(k => decodeURIComponent(k.trim())).filter(Boolean);
    if (!keys.length) return res.json({ allDone: true, statuses: [] });

    const records = await Result.find(
      { scriptKey: { $in: keys } },
      { scriptKey: 1, ocrStatus: 1, ocrError: 1 }
    ).lean();

    const statuses = keys.map(key => {
      const r = records.find(r => r.scriptKey === key);
      return { scriptKey: key, ocrStatus: r?.ocrStatus ?? "pending", ocrError: r?.ocrError ?? "" };
    });

    res.json({ allDone: statuses.every(s => s.ocrStatus === "done" || s.ocrStatus === "failed"), statuses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
