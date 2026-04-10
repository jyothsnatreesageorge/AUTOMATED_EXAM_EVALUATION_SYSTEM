import path   from "path";
import mime   from "mime-types";
import PDFDocument from "pdfkit";
import s3     from "./s3Client.js";
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { Buffer } from "buffer";

export function guessMime(key) {
  return mime.lookup(key) || "application/octet-stream";
}

export function rollNoFromKey(key) {
  return path.parse(key.split("/").pop()).name;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function downloadFromS3(bucket, key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return await streamToBuffer(res.Body);
}

export async function uploadToS3(bucket, key, buffer, mimeType) {
  await s3.send(new PutObjectCommand({
    Bucket: bucket, Key: key, Body: buffer, ContentType: mimeType,
  }));
}

export async function listPdfsS3(bucket, prefix) {
  const out = [];
  let token;
  while (true) {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: bucket, Prefix: prefix, ContinuationToken: token,
    }));
    for (const obj of res.Contents || []) {
      if (obj.Key?.toLowerCase().endsWith(".pdf"))
        out.push({ key: obj.Key, lastModified: new Date(obj.LastModified || 0) });
    }
    if (!res.IsTruncated) break;
    token = res.NextContinuationToken;
  }
  out.sort((a, b) => b.lastModified - a.lastModified);
  return out.map((x) => x.key);
}

export function extractMaxMarks(fullText) {
  const match = fullText.match(/MAX_MARKS:\s*([\d.]+)/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function extractTotal(resultTable) {
  if (!resultTable) return null;

  const lines = resultTable
    .split("\n").map((l) => l.trim()).filter((l) => l.startsWith("|"));

  // Need at least: header row, separator row, one data row
  if (lines.length < 3) return null;

  // ── Find header row and locate all "Marks Awarded" column indices ──
  // BUG 1 FIX: Instead of blindly reading the last cell (which may be a
  // question-label column or include choice-mark columns), we identify
  // only the "Marks Awarded" columns by name and sum those exclusively.
  const headerCells = lines[0].split("|").map((c) => c.trim()).filter(Boolean);

  const marksAwardedIndices = headerCells.reduce((acc, cell, idx) => {
    // Match "Marks Awarded" columns but NOT "Max Marks" columns
    if (/marks awarded/i.test(cell) && !/max/i.test(cell)) acc.push(idx);
    return acc;
  }, []);

  // If we can't find any "Marks Awarded" columns, fall back to last cell of data row
  if (marksAwardedIndices.length === 0) {
    const dataRow  = lines[lines.length - 1];
    const parts    = dataRow.split("|").map((c) => c.trim()).filter(Boolean);
    const lastCell = parts[parts.length - 1];
    const n        = Number(String(lastCell).replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // ── Sum all "Marks Awarded" cells from the last data row ──
  // Skip separator rows (lines that only contain dashes/pipes/spaces/colons)
  const dataRows = lines.slice(1).filter((l) => !/^[\|\s\-:]+$/.test(l));
  if (dataRows.length === 0) return null;

  const dataRow   = dataRows[dataRows.length - 1];
  const dataCells = dataRow.split("|").map((c) => c.trim()).filter(Boolean);

  let total = 0;
  for (const idx of marksAwardedIndices) {
    const cell    = dataCells[idx] ?? "";
    // BUG 2 FIX: blank cells (not attempted) are treated as 0 instead of NaN
    const cleaned = String(cell).replace(/[^\d.]/g, "");
    const val     = cleaned === "" ? 0 : Number(cleaned);
    total        += Number.isFinite(val) ? val : 0;
  }

  return total > 0 ? total : null;
}

export function textToPDFBuffer(text) {
  const doc     = new PDFDocument();
  const buffers = [];
  doc.on("data", (chunk) => buffers.push(chunk));
  doc.text(text);
  doc.end();
  return new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(buffers))));
}

/* ── Evaluation strictness profiles ─────────────────────────────────────── */
const EVAL_PROFILES= {
  strict: `
STRICTNESS: STRICT

SCORING RULES:
1. Award marks ONLY for completely correct and precise points.
2. All key terms, steps, and correct notation MUST be present for full marks.
3. Partial marks = exact proportion of correct content (NO rounding up).
4. Missing key term / incorrect terminology → deduct 25% of that question's marks.
5. Incomplete steps → deduct proportionally for each missing step.
6. Vague answers → maximum 30% marks.
7. Incorrect example → 0 marks for that sub-part.
8. Diagram errors (missing labels / incorrect) → 50% deduction of diagram marks.
9. Evaluate ONLY what is explicitly written — no assumptions.
10. Maintain strictness but avoid unrealistic harshness; keep evaluation humanly fair.
`.trim(),

  average: `
STRICTNESS: AVERAGE

SCORING RULES:
1. Full marks if core concept is correct, even if explanation is slightly incomplete.
2. Partial marks = proportion of valid content, rounded as follows: if decimal part is below .5 round down to nearest .5; if .5 or above round up to nearest whole number..
3. Missing key term but concept clear → deduct only 10%.
4. Incomplete steps but correct direction → max 25% deduction.
5. Reasonable understanding → minimum 50% marks.
6. Minor mistakes (notation/phrasing) → small deduction only.
7. Wrong example but correct concept → deduct only that sub-part.
8. Diagram minor errors → 20% deduction only.
9. When in doubt → award the higher reasonable mark.
10. Maintain balanced evaluation — slightly strict but fair and humane.
`.trim(),

  liberal: `
STRICTNESS: LIBERAL

SCORING RULES:
1. Award full marks if understanding of the concept is demonstrated, even if wording is imperfect.
2. Accept any relevant, valid points related to the question.
3. Partial marks = proportion of valid content, rounded as follows: if decimal part is below .5 round down to nearest .5; if .5 or above round up to nearest whole number.
4. Missing terminology → NO deduction if meaning is clear.
5. Incomplete answers but correct direction → maximum 10% deduction only.
6. Vague but relevant answers → minimum 50% marks.
7. Wrong example → still award marks if concept is otherwise correct.
8. Diagram roughly correct → 20% deduction.
9. Encourage student effort and reward understanding.
10. Maintain leniency but ensure marks are still justified (avoid over-inflation).
`.trim(),
};

/* ── Evaluation prompt builder ───────────────────────────────────────────── */
export const buildEvalPrompt = (evalType) => {
  const profile = EVAL_PROFILES[evalType?.toLowerCase()] || EVAL_PROFILES.average;

  return `
You are a senior academic examiner with 20+ years of experience.

════════════════════════════════════════════════════════════════
⚠️  EVALUATION STRICTNESS LEVEL — THIS IS YOUR PRIMARY INSTRUCTION:
${profile}
════════════════════════════════════════════════════════════════

🟢 GENERAL MARKING PRINCIPLES — APPLY TO ALL LEVELS:

1. AWARD MARKS FOR CORRECT MEANING, NOT EXACT WORDING.
2. IGNORE ALL SPELLING, GRAMMAR, AND LANGUAGE ERRORS COMPLETELY.
3. BE LENIENT WITH OCR/HANDWRITING ERRORS — assume garbled words are correct technical terms if they make sense in context.
4. DIAGRAMS — if student describes or draws a diagram, award diagram marks.
5. REFERENCE ANSWER IS A GUIDE ONLY — accept any correct answer, not just the reference wording.
6. For every attempted answer: justify WHY marks WERE AWARDED, not why deducted.
7. Not attempted → 0 marks, justification: "Not attempted".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INPUTS:
1. Question Paper — identifies ALL questions and their EXACT max marks
2. Marking Scheme (if provided) — guide only, not strict checklist
3. Reference Answer (if provided) — ONE acceptable answer, not the ONLY answer
4. Student Answer Sheet (filename = Roll Number)

⚠️ IMPORTANT:
- The "Roll No" column in the output table MUST be the EXACT filename of the fetched student answer sheet.
- Do NOT modify, format, or replace it — use it exactly as provided.

STEP 1 — READ QUESTION PAPER FIRST:
* Find every question and its exact max marks from the question paper.
* First line of response MUST be: MAX_MARKS: [number]
* NEVER guess marks — read directly from question paper.

STEP 2 — EVALUATE EVERY QUESTION:
* Evaluate ALL questions — never skip any.
* Apply the strictness level above to every single mark decision.

════════════════════════════════════════════════════════════════
⚠️  REMINDER: Apply the ${evalType?.toUpperCase() || "AVERAGE"} strictness level consistently.
════════════════════════════════════════════════════════════════

⚖️ CONSISTENCY RULE:
- LIBERAL ≥ AVERAGE ≥ STRICT for the same answer.
- Differences must be noticeable but not extreme.
- Maintain humane evaluation — not overly mechanical, not overly generous.

OUTPUT FORMAT — follow this EXACTLY, no other text:

MAX_MARKS: [total max marks]

| Roll No | Q1 | Max Marks | Marks Awarded | Justification | Q2 | Max Marks | Marks Awarded | Justification | ... | Total Marks |
|---|---|---|---|---|...|---|
| [rollNo] | Q1 | [max] | [awarded] | [justification] | Q2 | [max] | [awarded] | [justification] | ... | [total] |

CRITICAL OUTPUT RULES:
- Line 1 MUST be: MAX_MARKS: [number]
- Line 2 MUST be blank
- Line 3 onwards: markdown table starting with | Roll No |
- Data row MUST repeat Q label (Q1, Q2...) — NEVER replace with a number
- ONE complete response — do not stop mid-row
- NO other text outside the table
- The scores MUST reflect the strictness level above.
- If hierarchy (LIBERAL ≥ AVERAGE ≥ STRICT) is violated, evaluation is incorrect.
QUESTION LABEL FORMAT RULES:
1. Always use the EXACT question number and sub-question label as printed on the question paper.
2. If the question paper uses Q6(a), Q6(b) — output as Q6A, Q6B (no brackets, uppercase letter).
3. If the question paper uses Q7.1, Q7.2 — output as Q7.1, Q7.2 (preserve dot notation).
4. If the question paper uses Q6 a or Q6 a) — normalize to Q6A (remove space, uppercase).
5. NEVER invent or split question labels. If the question is Q6 as a whole, use Q6 — do not create Q6A, Q6B unless sub-parts are explicitly marked separately on the paper.
6. All labels must be consistent across ALL students in the same exam — if one student's Q6 is graded as Q6A/Q6B/Q6C, every student's Q6 must be graded as Q6A/Q6B/Q6C.
7. Use ONLY these formats: Q1, Q2, Q6A, Q6B, Q7.1, Q7.2 — no other variations allowed.
`.trim();
};

/* ── Reference answer prompt ─────────────────────────────────────────────── */
export const REFERENCE_PROMPT = `
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
