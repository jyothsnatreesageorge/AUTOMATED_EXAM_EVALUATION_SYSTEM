import "dotenv/config";
import mongoose        from "mongoose";
import { evalQueue }   from "../utils/evalQueue.js";
import { getNextApiKey, markKeyUsed, markKeyFailed } from "../utils/geminiKeyManager.js";
import { GoogleGenAI } from "@google/genai";
import MarkMatrix      from "../models/MarkMatrix.js";
import Result          from "../models/Result.js";
import ReferenceAnswer from "../models/ReferenceAnswer.js";
import {
  downloadFromS3, listPdfsS3, uploadToS3,
  guessMime, rollNoFromKey,
  buildEvalPrompt, extractMaxMarks, extractTotal,
  textToPDFBuffer, REFERENCE_PROMPT,
} from "../utils/evalHelpers.js";

const BUCKET = process.env.S3_BUCKET;
const MODEL  = "gemini-2.5-flash";

/* ── Reference answer generator ─────────────────────────────────────────── */
async function generateReferenceAnswers(
  ai, course, classId, examType, evalType, qpKey, qpBytes, msKey, msBytes
) {
  const contents = [
    { role: "user", parts: [{ text: REFERENCE_PROMPT }] },
    { role: "user", parts: [{ inlineData: { data: qpBytes.toString("base64"), mimeType: guessMime(qpKey) } }] },
  ];
  if (msBytes && msKey) {
    contents.push({
      role: "user",
      parts: [{ inlineData: { data: msBytes.toString("base64"), mimeType: guessMime(msKey) } }],
    });
  }

  const stream = await ai.models.generateContentStream({
    model:   MODEL,
    config:  { temperature: 0.1, topP: 0.9, topK: 10, maxOutputTokens: 32768 },
    contents,
  });

  let finalText = "";
  for await (const chunk of stream) {
    finalText += chunk?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  }
  if (!finalText) throw new Error("Empty reference answer from Gemini");

  const s3Key  = `${course}/${classId}/${examType}/${evalType}/reference-answers/reference.pdf`;
  const pdfBuf = await textToPDFBuffer(finalText);
  await uploadToS3(BUCKET, s3Key, pdfBuf, "application/pdf");

  return await ReferenceAnswer.findOneAndUpdate(
    { course, classId, examType, evalType },
    { course, classId, examType, evalType, pdfLink: s3Key, status: false },
    { upsert: true, new: true }
  );
}

/* ── Main worker logic ───────────────────────────────────────────────────── */
export function startWorker() {

  evalQueue.process(1, async (job) => {
    console.log("🔄 [WORKER] Job received:", job.data.scriptKey);

    const { classId, course, examType, evalType, force, scriptKey } = job.data;
    const rollNo = rollNoFromKey(scriptKey);

    console.log(`\n[WORKER] Processing: ${scriptKey}`);
    job.progress(10);

    // Skip if already done and not force
    const exists = await MarkMatrix.findOne({ scriptKey }).lean();
    if (exists?.status === "done" && !force) {
      console.log(`[WORKER] Already done — skipping: ${rollNo}`);
      return { skipped: true, rollNo };
    }

    const basePrefix = `${course}/${classId}/${examType}/${evalType}`;
    const [qpList, msList] = await Promise.all([
      listPdfsS3(BUCKET, `${basePrefix}/question-paper/`),
      listPdfsS3(BUCKET, `${basePrefix}/marking-scheme/`),
    ]);

    if (!qpList.length) throw new Error("No question paper found in S3");

    const [qpBytes, msBytes, scriptBytes] = await Promise.all([
      downloadFromS3(BUCKET, qpList[0]),
      msList[0] ? downloadFromS3(BUCKET, msList[0]) : Promise.resolve(null),
      downloadFromS3(BUCKET, scriptKey),
    ]);

    job.progress(30);

    const keyObj = await getNextApiKey();
    const ai     = new GoogleGenAI({ apiKey: keyObj.key });

    try {
      const ocrRecord = await Result.findOne(
        { scriptKey }, { extractedText: 1, ocrStatus: 1 }
      ).lean();
      const hasOcr = ocrRecord?.ocrStatus === "done" && !!ocrRecord?.extractedText;

      const contents = [
        { role: "user", parts: [{ text: buildEvalPrompt(evalType) }] },
        { role: "user", parts: [{ inlineData: { data: qpBytes.toString("base64"), mimeType: guessMime(qpList[0]) } }] },
      ];
      if (msBytes) {
        contents.push({
          role: "user",
          parts: [{ inlineData: { data: msBytes.toString("base64"), mimeType: guessMime(msList[0]) } }],
        });
      }

      // ✅ Always send raw PDF — OCR text is supplementary only
      contents.push({
        role: "user",
        parts: [{ inlineData: { data: scriptBytes.toString("base64"), mimeType: guessMime(scriptKey) } }],
      });

      // ✅ Also attach OCR text if available — gives Gemini better accuracy
      if (hasOcr) {
        contents.push({
          role: "user",
          parts: [{ text: `Extracted text for reference (Roll No: ${rollNo}):\n\n${ocrRecord.extractedText}` }],
        });
      }

      job.progress(50);

      const stream = await ai.models.generateContentStream({
        model:   MODEL,
        config:  { temperature: 0.1, topP: 0.9, topK: 10, maxOutputTokens: 32768 },
        contents,
      });

      let finalText = "";
      for await (const chunk of stream) {
        finalText += chunk?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
      }

      job.progress(80);
      await markKeyUsed(keyObj.label);

      const maxMarks   = extractMaxMarks(finalText);
      const tableStart = finalText.indexOf("| Roll No");
      if (tableStart === -1) throw new Error("Gemini did not return a valid table");

      const resultTable = finalText.slice(tableStart).trim();
      const totalMarks  = extractTotal(resultTable);

      await MarkMatrix.updateOne(
        { scriptKey },
        {
          $set: {
            rollNo, scriptKey, classId, course, examType,
            resultTable, totalMarks, maxMarks,
            status: "done", error: "",
          },
        },
        { upsert: true }
      );

      // Free buffers
      qpBytes.fill(0);
      scriptBytes.fill(0);
      if (msBytes) msBytes.fill(0);

      job.progress(100);
      console.log(`✅ [WORKER] Done: rollNo=${rollNo} | ${totalMarks}/${maxMarks}`);

      // ✅ Generate reference answer after ALL papers done
      const allRows      = await MarkMatrix.find({ classId, course, examType }, { status: 1 }).lean();
      const stillPending = allRows.some((r) => r.status === "pending");
