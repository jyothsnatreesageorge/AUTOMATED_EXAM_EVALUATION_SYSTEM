import express from "express";
import path from "path";
import mime from "mime-types";
import PDFDocument from "pdfkit";

import s3 from "../utils/s3Client.js";
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenAI } from "@google/genai";

import MarkMatrix from "../models/MarkMatrix.js";
import ReferenceAnswer from "../models/ReferenceAnswer.js";
import { Buffer } from "buffer";

function extractTotal(resultTable) {
  if (!resultTable) return null;

  const lines = resultTable
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|"));

  if (lines.length < 2) return null;

  const header = lines[0]
    .split("|")
    .map((c) => c.trim());

  const dataRow = lines[2]
    ?.split("|")
    .map((c) => c.trim());

  if (!dataRow) return null;

  // 🔍 Find index of "Total"
  const totalIndex = header.findIndex(h =>
    h.toLowerCase().includes("total")
  );

  if (totalIndex === -1) return null;

  const totalCell = dataRow[totalIndex];

  const n = Number(String(totalCell).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function guessMime(key) {
  return mime.lookup(key) || "application/octet-stream";
}

function rollNoFromKey(key) {
  return path.parse(key.split("/").pop()).name;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function downloadFromS3(bucket, key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return await streamToBuffer(res.Body);
}

async function uploadToS3(bucket, key, buffer, mimeType) {
  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: mimeType })
  );
}

function textToPDFBuffer(text) {
  const doc = new PDFDocument();
  const buffers = [];
  doc.on("data", (chunk) => buffers.push(chunk));
  doc.text(text);
  doc.end();
  return new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(buffers))));
}

async function listPdfsS3(bucket, prefix) {
  const out = [];
  let token;
  while (true) {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    for (const obj of res.Contents || []) {
      const key = obj.Key;
      if (key && key.toLowerCase().endsWith(".pdf")) {
        out.push({
          key,
          lastModified: obj.LastModified ? new Date(obj.LastModified) : new Date(0),
        });
      }
    }
    if (!res.IsTruncated) break;
    token = res.NextContinuationToken;
  }
  out.sort((a, b) => b.lastModified - a.lastModified);
  return out.map((x) => x.key);
}

// ─── Reference Answer Generation ────────────────────────────────────────────

const REFERENCE_PROMPT = `
You are a senior academic examiner. Generate concise, mark-scoring reference answers for ALL questions in the Question Paper.

CRITICAL FIRST STEP — READ THE QUESTION PAPER CAREFULLY:
* Identify every question and its exact mark value directly from the question paper.
* Do not assume any fixed mark scheme. Marks vary per question.
* The number of bullet points for each answer MUST exactly equal the marks assigned to that question.

ANSWER FORMAT RULES:
* For every question: number of bullet points = number of marks for that question (e.g., 2-mark question → 2 bullets, 5-mark question → 5 bullets, 10-mark question → 10 bullets).
* Each bullet point = one scorable fact/concept (1 sentence max, under 20 words).
* No paragraphs, no elaboration, no examples unless directly mark-worthy.
* Every point must be something an examiner would award a mark for.
* If a question has sub-parts, allocate bullets proportionally to each sub-part's marks, clearly labelled.

OUTPUT FORMAT (follow strictly for every question, no exceptions):

--------------------------------------------------
Question No: [Number]
Marks: [Exact marks as shown in question paper]

Reference Answer:
- [Scoring point 1]
- [Scoring point 2]
- [continue until bullet count matches marks]
--------------------------------------------------

CRITICAL INSTRUCTIONS:
* You MUST generate answers for ALL questions in the paper. Do not stop early.
* Read the mark allocation from the question paper — never assume or guess marks.
* Do not write any introduction or conclusion outside the format above.
* Do not skip any question even if the answer seems obvious.
* Bullet count must match marks exactly — no more, no fewer.
`.trim();

async function generateReferenceAnswers(ai, course, classId, examType, qpKey, qpBytes, msKey, msBytes) {
  const BUCKET = process.env.S3_BUCKET;

  const contents = [
    { role: "user", parts: [{ text: REFERENCE_PROMPT }] },
    {
      role: "user",
      parts: [{ inlineData: { data: qpBytes.toString("base64"), mimeType: guessMime(qpKey) } }],
    },
  ];

  if (msBytes && msKey) {
    contents.push({
      role: "user",
      parts: [{ inlineData: { data: msBytes.toString("base64"), mimeType: guessMime(msKey) } }],
    });
  }

  const stream = await ai.models.generateContentStream({
    model: MODEL,
    config: { temperature: 0.1, topP: 0.9, topK: 10, maxOutputTokens: 16384 },
    contents,
  });

  let finalText = "";
  for await (const chunk of stream) {
    const text =
      chunk?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    finalText += text;
  }

  if (!finalText) throw new Error("Empty reference answer result from Gemini");

  const s3Key = `${course}/${classId}/${examType}/reference-answers/reference.pdf`;
  const pdfBuffer = await textToPDFBuffer(finalText);
  await uploadToS3(BUCKET, s3Key, pdfBuffer, "application/pdf");

  const refAnswer = await ReferenceAnswer.findOneAndUpdate(
    { course, classId, examType },
    { course, classId, examType, pdfLink: s3Key, status: false },
    { upsert: true, new: true }
  );

  return refAnswer;
}

// ─── Router ──────────────────────────────────────────────────────────────────

const router = express.Router();
const MODEL = "gemini-2.5-flash";

const buildEvalPrompt = (evalType) => `
You are an expert academic evaluator.

Your task is to evaluate student answer sheets using the provided Question Paper and Textbook as the primary reference.

EVALUATION TYPE:
${evalType}

INPUTS PROVIDED:
1. Question Paper
2. Marking Scheme (if provided)
3. Official Textbook Content (if provided)
4. Student Answer Sheet (File name = Student Roll Number)

EVALUATION INSTRUCTIONS:
1. Use the Question Paper to identify questions and max marks.
2. Use the textbook as primary reference.
3. Follow the selected evaluation type while awarding marks.
4. Award full/partial/zero marks with concise justification.
5. If optional/best-of applies, evaluate all attempted and take best-scoring as per question paper rule.
6. Output ONLY a markdown table:
| Roll No | Q1 | Max Marks | Marks Awarded | Justification | ... | Total Marks |
Do not write anything after the table.
`.trim();

/**
 * POST /api/evaluation/run
 * body: { classId, course, examType, force?: boolean }
 */
router.post("/run", async (req, res) => {
  try {
    const { classId, course, examType, evalType, force } = req.body || {};

    if (!classId || !course || !examType || !evalType) {
      return res.status(400).json({ error: "classId, course, examType evalType are required" });
    }

    const BUCKET = process.env.S3_BUCKET;
    if (!BUCKET) return res.status(500).json({ error: "Missing S3_BUCKET in Backend .env" });
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "Missing GEMINI_API_KEY in Backend .env" });

    const basePrefix = `${course}/${classId}/${examType}`;
    const qpPrefix = `${basePrefix}/question-paper/`;
    const msPrefix = `${basePrefix}/marking-scheme/`;
    const refPrefix = `${basePrefix}/reference-text/`;
    const scriptsPrefix = `${basePrefix}/answer-scripts/`;

    const [qpPdfs, msPdfs, refPdfs, scriptPdfs] = await Promise.all([
      listPdfsS3(BUCKET, qpPrefix),
      listPdfsS3(BUCKET, msPrefix),
      listPdfsS3(BUCKET, refPrefix),
      listPdfsS3(BUCKET, scriptsPrefix),
    ]);

    if (!qpPdfs.length) {
      return res.status(400).json({ error: `No Question Paper PDFs found at prefix: ${qpPrefix}` });
    }
    if (!scriptPdfs.length) {
      return res.status(400).json({ error: `No Answer Script PDFs found at prefix: ${scriptsPrefix}` });
    }

    const qpKey = qpPdfs[0];
    const msKey = msPdfs[0] || null;
    const refKey = refPdfs[0] || null;

    console.log("\n=== EVALUATION RUN ===");
    console.log("classId:", classId, "| course:", course, "| examType:", examType);
    console.log("force:", !!force, "| bucket:", BUCKET);
    console.log("QP:", qpKey, "| MS:", msKey, "| REF:", refKey);
    console.log("scripts found:", scriptPdfs.length);

    const [qpBytes, msBytes, refBytes] = await Promise.all([
      downloadFromS3(BUCKET, qpKey),
      msKey ? downloadFromS3(BUCKET, msKey) : Promise.resolve(null),
      refKey ? downloadFromS3(BUCKET, refKey) : Promise.resolve(null),
    ]);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    let processed = 0;
    let newlySaved = 0;
    let updatedExisting = 0;
    let skippedExisting = 0;
    const failures = [];

    // ── Evaluation loop ──────────────────────────────────────────────────────
    for (const scriptKey of scriptPdfs) {
      processed++;
      const rollNo = rollNoFromKey(scriptKey);

      try {
        const exists = await MarkMatrix.findOne({ scriptKey }).lean();
        if (exists && !force) { skippedExisting++; continue; }

        console.log(`\n---- Evaluating (${processed}/${scriptPdfs.length}): ${scriptKey} ----`);

        const scriptBytes = await downloadFromS3(BUCKET, scriptKey);

        const contents = [
          { role: "user", parts: [{ text: buildEvalPrompt(evalType) }] },
          {
            role: "user",
            parts: [{ inlineData: { data: qpBytes.toString("base64"), mimeType: guessMime(qpKey) } }],
          },
        ];

        if (msBytes && msKey) {
          contents.push({
            role: "user",
            parts: [{ inlineData: { data: msBytes.toString("base64"), mimeType: guessMime(msKey) } }],
          });
        }

        if (refBytes && refKey) {
          contents.push({
            role: "user",
            parts: [{ inlineData: { data: refBytes.toString("base64"), mimeType: guessMime(refKey) } }],
          });
        }

        contents.push({
          role: "user",
          parts: [{ inlineData: { data: scriptBytes.toString("base64"), mimeType: guessMime(scriptKey) } }],
        });

        const stream = await ai.models.generateContentStream({
          model: MODEL,
          config: { temperature: 0.1, topP: 0.9, topK: 10, maxOutputTokens: 8192 },
          contents,
        });

        let finalText = "";
        for await (const chunk of stream) {
          const text =
            chunk?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
          finalText += text;
        }

        const resultTable = finalText.trim();
        if (!resultTable) throw new Error("Empty result from Gemini");

        const totalMarks = extractTotal(resultTable);

        await MarkMatrix.updateOne(
          { scriptKey },
          {
            $set: {
              rollNo, scriptKey, classId, course, examType,
              resultTable, totalMarks, status: "done", error: "",
            },
          },
          { upsert: true }
        );

        if (exists) updatedExisting++; else newlySaved++;
        console.log(`✅ Saved: rollNo=${rollNo}`);

      } catch (e) {
        console.error("❌ Failed script:", scriptKey, e?.message || e);

        await MarkMatrix.updateOne(
          { scriptKey },
          {
            $set: {
              rollNo, scriptKey, classId, course, examType,
              resultTable: "", status: "failed",
              error: e?.message || String(e),
              updatedAt: new Date(),
            },
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true }
        );

        failures.push({ scriptKey, error: e?.message || String(e) });
      }
    }

    // ── Generate reference answers after evaluation ───────────────────────────
    let referenceAnswer = null;
    let referenceAnswerError = null;

    try {
      console.log("\n=== GENERATING REFERENCE ANSWERS ===");
      referenceAnswer = await generateReferenceAnswers(
        ai, course, classId, examType, qpKey, qpBytes, msKey, msBytes
      );
      console.log("✅ Reference answers saved:", referenceAnswer?.pdfLink);
    } catch (refErr) {
      referenceAnswerError = refErr?.message || String(refErr);
      console.error("❌ Reference answer generation failed:", referenceAnswerError);
    }

    return res.json({
      ok: true,
      message: "Evaluation finished",
      classId, course, examType,
      bucket: BUCKET,
      force: !!force,
      used: { questionPaper: qpKey, markingScheme: msKey, referenceText: refKey },
      totalScriptsFound: scriptPdfs.length,
      processed, newlySaved, updatedExisting, skippedExisting,
      failuresCount: failures.length,
      failures,
      referenceAnswer: referenceAnswer
        ? { pdfLink: referenceAnswer.pdfLink, status: referenceAnswer.status }
        : null,
      referenceAnswerError,
    });

  } catch (err) {
    console.error("Evaluation route error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "Evaluation failed. Check backend console.",
    });
  }
});

export default router;
