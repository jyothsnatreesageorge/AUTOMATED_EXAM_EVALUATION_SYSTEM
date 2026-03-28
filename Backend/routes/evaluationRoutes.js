import express from "express";
import path from "path";
import mime from "mime-types";
import PDFDocument from "pdfkit";

import s3 from "../utils/s3Client.js";
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenAI } from "@google/genai";

import MarkMatrix     from "../models/MarkMatrix.js";
import Result         from "../models/Result.js";
import ReferenceAnswer from "../models/ReferenceAnswer.js";
import { Buffer } from "buffer";

// ─── Helper: strip empty first/last cells from split("|") ───────────────────
function splitRow(line) {
  const parts = line.split("|");
  return parts
    .filter((_, i, arr) => i !== 0 && i !== arr.length - 1)
    .map((c) => c.trim());
}

// ─── Helper: extract awarded total — always the LAST cell of the last row ────
function extractTotal(resultTable) {
  if (!resultTable) return null;

  const lines = resultTable
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|"));

  if (lines.length < 3) return null;

  const dataRow  = splitRow(lines[lines.length - 1]);
  const lastCell = dataRow[dataRow.length - 1];

  console.log("🔍 [extractTotal] lastCell:", lastCell);

  const n = Number(String(lastCell).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ─── Helper: extract max marks from Gemini's MAX_MARKS: line ─────────────────
function extractMaxMarks(fullText) {
  const match = fullText.match(/MAX_MARKS:\s*([\d.]+)/i);
  if (!match) {
    console.log("🔍 [extractMaxMarks] MAX_MARKS line not found");
    return null;
  }
  const n = Number(match[1]);
  console.log("🔍 [extractMaxMarks] found:", n);
  return Number.isFinite(n) && n > 0 ? n : null;
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

// ─── Improved Evaluation Prompt ──────────────────────────────────────────────
const buildEvalPrompt = (evalType) => `
You are a senior academic examiner with 20+ years of experience in fair, generous marking.

════════════════════════════════════════════════════════════════
⚠️  EVALUATION TYPE — THIS IS YOUR PRIMARY INSTRUCTION:
${evalType}
════════════════════════════════════════════════════════════════

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟢 FAIR MARKING PRINCIPLES — MANDATORY — APPLY TO EVERY QUESTION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. AWARD MARKS FOR CORRECT MEANING, NOT EXACT WORDING.
   - If the student expresses the right concept in their own words → award full marks.
   - Do NOT penalize paraphrasing, synonyms, or different-but-correct explanations.

2. GIVE GENEROUS PARTIAL MARKS.
   - If a student gets some points of a multi-mark question correct, award marks proportionally.
   - Example: 3 correct points out of 5 → award 3 marks, not 0.
   - Never award 0 for an answer that shows any correct understanding.

3. IGNORE SPELLING AND GRAMMAR ERRORS.
   - Evaluate the technical content and meaning only.
   - Spelling mistakes, grammatical errors, and poor sentence structure must NOT reduce marks.

4. BE LENIENT WITH OCR/HANDWRITING ERRORS.
   - The answer sheet was handwritten and OCR-transcribed. Some words may be garbled.
   - If a garbled word is clearly meant to be a technical term → treat it as correct.
   - Give benefit of the doubt when transcription quality may have affected the answer.

5. AWARD MARKS FOR CORRECT EXAMPLES AND DIAGRAMS DESCRIBED IN TEXT.
   - If a student describes a diagram or gives a valid example, award marks for it.

6. DO NOT PENALIZE FOR MISSING EXAMPLES unless the question EXPLICITLY asks for one.

7. WHEN IN DOUBT → AWARD THE HIGHER MARK.
   - If you are unsure whether a point deserves a mark, award it.
   - A student should never lose marks due to ambiguity in their answer.

8. NEVER AWARD LESS THAN HALF MARKS for an answer that shows clear understanding of the topic,
   even if some details are missing.

9. DO NOT COMPARE STUDENT ANSWERS TO THE REFERENCE ANSWER WORD-FOR-WORD.
   - The reference answer is a guide, not a template. Alternate correct answers must be accepted.

10. MAXIMUM GENEROSITY RULE:
    - Your goal is to find reasons to AWARD marks, not reasons to DEDUCT them.
    - A student who clearly understands the concept deserves full or near-full marks.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INPUTS PROVIDED:
1. Question Paper — use this to identify ALL questions and their exact max marks
2. Marking Scheme (if provided) — use as a guide, not a strict checklist
3. Reference Answer (if provided) — use as one acceptable answer, not the only answer
4. Student Answer Sheet (File name = Student Roll Number)

STEP 1 — READ THE QUESTION PAPER FIRST:
* Identify every question number and its exact max marks as printed in the question paper.
* Sum all question max marks to get the total maximum marks for this paper.
* Output this on the very first line of your response as: MAX_MARKS: [number]
* Do NOT guess or assume max marks — read them directly from the question paper.

STEP 2 — EVALUATE EVERY QUESTION:
* You MUST evaluate EVERY question in the question paper — do not skip any.
* Students may have answered extra questions — evaluate ONLY the questions listed in the question paper.
* Apply the FAIR MARKING PRINCIPLES above strictly to every mark decision.
* Award full / partial / zero marks along with a concise justification per question.
* If a question was not attempted by the student, award 0 with justification "Not attempted".
* For every attempted answer, justify why marks WERE awarded, not why they were deducted.

════════════════════════════════════════════════════════════════
⚠️  REMINDER — FAIR MARKING PRINCIPLES apply to EVERY single mark decision.
    WHEN IN DOUBT → AWARD THE HIGHER MARK.
    evalType context: ${evalType}
════════════════════════════════════════════════════════════════

OUTPUT FORMAT — your entire response must follow this exact structure, nothing else:

MAX_MARKS: [total maximum marks from the question paper]

| Roll No | Q1 | Max Marks | Marks Awarded | Justification | Q2 | Max Marks | Marks Awarded | Justification | ... (repeat for ALL questions) | Total Marks |
|---|---|---|---|---|---|---|---|---|---|
| [rollNo] | Q1 | [max marks for Q1] | [marks awarded for Q1] | [justification for Q1] | Q2 | [max marks for Q2] | [marks awarded for Q2] | [justification for Q2] | ... | [total awarded] |

CRITICAL OUTPUT RULES:
- Line 1 MUST be: MAX_MARKS: [number]
- Line 2 MUST be blank
- Line 3 onwards: the markdown table starting with | Roll No |
- Output the table in ONE single complete response — do not stop mid-row
- Every row must be complete from Roll No to Total Marks
- Do NOT add any other text, preamble, explanation, or conclusion
- Do NOT say "Here is the evaluation" or anything similar
`.trim();

// ─── Reference Answer Generation ────────────────────────────────────────────
const REFERENCE_PROMPT = `
You are a senior academic examiner. Generate concise, mark-scoring reference answers for ALL questions in the Question Paper.

CRITICAL FIRST STEP — READ THE QUESTION PAPER CAREFULLY:
* Identify every question and its exact mark value directly from the question paper.
* Do not assume any fixed mark scheme. Marks vary per question.
* The number of bullet points for each answer MUST exactly equal the marks assigned to that question.

ANSWER FORMAT RULES:
* For every question: number of bullet points = number of marks for that question.
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
    config: { temperature: 0.1, topP: 0.9, topK: 10, maxOutputTokens: 32768 },
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

// ─── Background Evaluation Logic ─────────────────────────────────────────────
async function runEvaluationInBackground({
  classId, course, examType, evalType, force, scriptKeys, BUCKET,
}) {
  try {
    const basePrefix = `${course}/${classId}/${examType}/${evalType}`;
    const qpPrefix   = `${basePrefix}/question-paper/`;
    const msPrefix   = `${basePrefix}/marking-scheme/`;
    const refPrefix  = `${basePrefix}/reference-text/`;

    const [qpPdfs, msPdfs, refPdfs] = await Promise.all([
      listPdfsS3(BUCKET, qpPrefix),
      listPdfsS3(BUCKET, msPrefix),
      listPdfsS3(BUCKET, refPrefix),
    ]);

    const scriptPdfs = scriptKeys
      .map((s) => (typeof s === "string" ? s : s.key))
      .filter(Boolean);

    console.log("📥 [BG] Scripts to evaluate:", scriptPdfs);

    if (!qpPdfs.length) {
      console.error("❌ [BG] No Question Paper found at:", qpPrefix);
      return;
    }

    const qpKey  = qpPdfs[0];
    const msKey  = msPdfs[0]  || null;
    const refKey = refPdfs[0] || null;

    console.log("\n=== [BG] EVALUATION RUN ===");
    console.log("classId:", classId, "| course:", course, "| examType:", examType);
    console.log("evalType:", evalType);
    console.log("QP:", qpKey, "| MS:", msKey, "| REF:", refKey);
    console.log("scripts:", scriptPdfs.length);

    const [qpBytes, msBytes, refBytes] = await Promise.all([
      downloadFromS3(BUCKET, qpKey),
      msKey  ? downloadFromS3(BUCKET, msKey)  : Promise.resolve(null),
      refKey ? downloadFromS3(BUCKET, refKey) : Promise.resolve(null),
    ]);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    let processed       = 0;
    let newlySaved      = 0;
    let updatedExisting = 0;
    let skippedExisting = 0;
    const failures      = [];

    // ── Evaluation loop ───────────────────────────────────────────────────────
    for (const scriptKey of scriptPdfs) {
      processed++;
      const rollNo = rollNoFromKey(scriptKey);

      try {
        const exists = await MarkMatrix.findOne({ scriptKey }).lean();
        if (exists && !force) {
          console.log("⏭ [BG] Skipping already evaluated:", scriptKey);
          skippedExisting++;
          continue;
        }

        console.log(`\n[BG] ---- Evaluating (${processed}/${scriptPdfs.length}): ${scriptKey} ----`);

        const scriptBytes = await downloadFromS3(BUCKET, scriptKey);

        // ✅ Check Result collection for pre-extracted OCR text
        const ocrRecord = await Result.findOne(
          { scriptKey },
          { extractedText: 1, ocrStatus: 1 }
        ).lean();

        const hasOcrText = ocrRecord?.ocrStatus === "done" && !!ocrRecord?.extractedText;

        if (hasOcrText) {
          console.log(`  ✅ [BG] Using OCR text (${ocrRecord.extractedText.length} chars)`);
        } else {
          console.log(`  ℹ️  [BG] No OCR text — Gemini reads PDF directly`);
        }

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

        if (hasOcrText) {
          contents.push({
            role: "user",
            parts: [{ text: `Student Answer Sheet (Roll No: ${rollNo}):\n\n${ocrRecord.extractedText}` }],
          });
        } else {
          contents.push({
            role: "user",
            parts: [{ inlineData: { data: scriptBytes.toString("base64"), mimeType: guessMime(scriptKey) } }],
          });
        }

        const stream = await ai.models.generateContentStream({
          model: MODEL,
          config: { temperature: 0.1, topP: 0.9, topK: 10, maxOutputTokens: 32768 },
          contents,
        });

        let finalText = "";
        for await (const chunk of stream) {
          const text =
            chunk?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
          finalText += text;
        }

        const maxMarks = extractMaxMarks(finalText);

        const tableStart = finalText.indexOf("| Roll No");
        if (tableStart === -1) throw new Error("Gemini did not return a valid table");
        const resultTable = finalText.slice(tableStart).trim();
        if (!resultTable) throw new Error("Empty result from Gemini");

        const totalMarks = extractTotal(resultTable);

        console.log(`📊 [BG] rollNo=${rollNo} | totalMarks=${totalMarks} | maxMarks=${maxMarks}`);

        await MarkMatrix.updateOne(
          { scriptKey },
          {
            $set: {
              rollNo, scriptKey, classId, course, examType,
              resultTable,
              totalMarks,
              maxMarks,
              status: "done",
              error:  "",
            },
          },
          { upsert: true }
        );

        if (exists) updatedExisting++; else newlySaved++;
        console.log(`✅ [BG] Saved: rollNo=${rollNo} | totalMarks=${totalMarks} | maxMarks=${maxMarks}`);

      } catch (e) {
        console.error("❌ [BG] Failed script:", scriptKey, e?.message || e);

        await MarkMatrix.updateOne(
          { scriptKey },
          {
            $set: {
              rollNo, scriptKey, classId, course, examType,
              resultTable: "",
              status:      "failed",
              error:       e?.message || String(e),
              updatedAt:   new Date(),
            },
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true }
        );

        failures.push({ scriptKey, error: e?.message || String(e) });
      }
    }

    console.log(`\n✅ [BG] Evaluation complete — processed:${processed} saved:${newlySaved} updated:${updatedExisting} skipped:${skippedExisting} failed:${failures.length}`);

    // ── Generate reference answers after evaluation ───────────────────────────
    try {
      console.log("\n=== [BG] GENERATING REFERENCE ANSWERS ===");
      const referenceAnswer = await generateReferenceAnswers(
        ai, course, classId, examType, qpKey, qpBytes, msKey, msBytes
      );
      console.log("✅ [BG] Reference answers saved:", referenceAnswer?.pdfLink);
    } catch (refErr) {
      console.error("❌ [BG] Reference answer generation failed:", refErr?.message || refErr);
    }

  } catch (err) {
    console.error("❌ [BG] runEvaluationInBackground crashed:", err?.message || err);
  }
}

// ─── Router ──────────────────────────────────────────────────────────────────
const router = express.Router();
const MODEL  = "gemini-2.5-flash";

/**
 * POST /api/evaluation/run
 * ✅ Responds immediately — runs evaluation in background to avoid Render timeout
 * body: { classId, course, examType, evalType, force?, scriptKeys }
 */
router.post("/run", async (req, res) => {
  try {
    const { classId, course, examType, evalType, force, scriptKeys } = req.body || {};

    if (!classId || !course || !examType || !evalType) {
      return res.status(400).json({ error: "classId, course, examType, evalType are required" });
    }

    const BUCKET = process.env.S3_BUCKET;
    if (!BUCKET)                    return res.status(500).json({ error: "Missing S3_BUCKET in .env" });
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "Missing GEMINI_API_KEY in .env" });

    if (!scriptKeys || scriptKeys.length === 0) {
      return res.status(400).json({ error: "No scripts provided for evaluation" });
    }

    console.log(`\n🚀 [EVAL] Received ${scriptKeys.length} script(s) — starting background evaluation`);

    // ✅ Respond immediately so frontend doesn't hit timeout / CORS error
    res.json({
      ok: true,
      message: "Evaluation started — processing in background ✅",
      scriptCount: scriptKeys.length,
      classId,
      course,
      examType,
    });

    // ✅ Fire and forget — runs after response is sent
    runEvaluationInBackground({ classId, course, examType, evalType, force, scriptKeys, BUCKET })
      .catch((err) => console.error("❌ [EVAL] Unhandled background error:", err?.message || err));

  } catch (err) {
    console.error("Evaluation route error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ ok: false, error: err?.message || "Evaluation failed" });
    }
  }
});

export default router;
