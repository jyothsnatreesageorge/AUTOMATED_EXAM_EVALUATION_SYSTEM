import express from "express";
import multer from "multer";
import path from "path";
import { PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import Groq from "groq-sdk";
import Result from "../models/Result.js";

const router = express.Router();

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

async function extractPdfWithGroq(pdfBuffer, rollNo, retries = 2) {
  const client     = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const base64Pdf  = pdfBuffer.toString("base64");

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model:       "meta-llama/llama-4-scout-17b-16e-instruct",
        max_tokens:  8192,
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `This is a handwritten student answer sheet for roll number ${rollNo}.
Transcribe ALL handwritten text exactly as written, page by page.
Use this format for each page:
=== Page N ===
[transcribed text for that page]

Preserve all question numbers, headings, and answer structure.
If a page or section is blank or unreadable, write "(blank)".
Output only the transcribed text — no preamble, no explanation.`,
              },
              {
                type:      "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${base64Pdf}`,
                },
              },
            ],
          },
        ],
      });

      const text = response.choices?.[0]?.message?.content?.trim();
      if (!text || text.length < 3) return "(blank)";
      return text;

    } catch (err) {
      console.error(`  OCR attempt ${attempt} failed for ${rollNo}:`, err.message);
      if (attempt <= retries) {
        await new Promise((r) => setTimeout(r, 3000));
      } else {
        return `(error: ${err.message})`;
      }
    }
  }
}

// ── Background OCR — sequential, one script at a time ────────────────────────
async function runBackgroundOcr({
  fileBuffer,
  scriptKey,
  rollNo,
  classId,
  course,
  examType,
  examId,
}) {
  try {
    console.log(`\n🔍 [BG OCR] Starting: ${scriptKey}`);

    // Mark as pending
    await Result.updateOne(
      { scriptKey },
      {
        $set: {
          rollNo,
          scriptKey,
          classId,
          course,
          examType,
          examId,
          ocrStatus:     "pending",
          extractedText: "",
        },
      },
      { upsert: true }
    );

    
    const extractedText = await extractPdfWithGroq(fileBuffer, rollNo);

  
    const ocrPages = [];
    const pageRegex = /===\s*Page\s*(\d+)\s*===\s*([\s\S]*?)(?====\s*Page\s*\d+\s*===|$)/gi;
    let match;
    while ((match = pageRegex.exec(extractedText)) !== null) {
      ocrPages.push({
        page: parseInt(match[1], 10),
        text: match[2].trim() || "(blank)",
      });
    }

    // If Groq didn't use page markers, store whole text as page 1
    if (ocrPages.length === 0) {
      ocrPages.push({ page: 1, text: extractedText });
    }

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

    console.log(`✅ [BG OCR] Done: ${rollNo} — ${ocrPages.length} page(s) extracted`);

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

// ── Resume pending OCR jobs (called from server.js on startup) ────────────────
// Handles cases where server was restarted mid-OCR
export async function resumePendingOcr() {
  try {
    const pending = await Result.find({
      ocrStatus: { $in: ["pending", "failed"] },
    }).lean();

    if (!pending.length) {
      console.log("✅ [RESUME OCR] No pending jobs.");
      return;
    }

    console.log(`🔄 [RESUME OCR] Found ${pending.length} pending/failed job(s) — resuming...`);

    // Run sequentially in background
    ;(async () => {
      for (const record of pending) {
        try {
          // Re-download PDF from S3
          const s3Res = await s3.send(
            new GetObjectCommand({
              Bucket: process.env.S3_BUCKET,
              Key:    record.scriptKey,
            })
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
        // Cooldown between scripts
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
        return res.status(400).json({
          error: "course, examType, classId and examId are required.",
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded." });
      }

      // Validate all files are PDFs before uploading anything
      for (const file of req.files) {
        const originalName = path.basename(file.originalname || "");
        const isPdf =
          file.mimetype === "application/pdf" ||
          originalName.toLowerCase().endsWith(".pdf");

        if (!isPdf) {
          return res.status(400).json({
            error: `Only PDF files are allowed: ${originalName}`,
          });
        }
      }

      const uploadedFiles = [];
      const ocrQueue      = [];

      // ✅ Upload ALL files to S3 in parallel — fast, no timeout risk
      await Promise.all(
        req.files.map(async (file) => {
          const originalName = path.basename(file.originalname || "");
          const key = `${course}/${classId}/${examType}/answer-scripts/${originalName}`;

          await s3.send(
            new PutObjectCommand({
              Bucket:      process.env.S3_BUCKET,
              Key:         key,
              Body:        file.buffer,
              ContentType: "application/pdf",
            })
          );

          console.log(`✅ S3 uploaded: ${key}`);

          const rollNo = path.parse(originalName).name;
          uploadedFiles.push(key);
          ocrQueue.push({
            fileBuffer: file.buffer,
            scriptKey:  key,
            rollNo,
            classId,
            course,
            examType,
            examId,
          });
        })
      );

      // ✅ Respond immediately — OCR runs in background
      res.json({
        message:      "Scripts uploaded successfully ✅",
        uploadedFiles,
        uploaded:     uploadedFiles,
      });

      // ✅ Run OCR jobs SEQUENTIALLY — one at a time to prevent RAM spike
      ;(async () => {
        for (const item of ocrQueue) {
          try {
            await runBackgroundOcr(item);
          } catch (err) {
            console.error(`[BG OCR] Unhandled error for ${item.scriptKey}:`, err.message);
          }
          // 3s cooldown between scripts for GC
          await new Promise((r) => setTimeout(r, 3000));
        }
        console.log(`✅ [BG OCR] All ${ocrQueue.length} script(s) processed`);
      })();

    } catch (err) {
      console.error("Answer scripts upload error:", err.stack || err);
      return res.status(500).json({
        error: err.message || "Upload failed ❌",
      });
    }
  }
);

export default router;
