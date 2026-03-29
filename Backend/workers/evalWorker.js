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

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) throw new Error("❌ Missing MONGO_URI in .env");

const BUCKET = process.env.S3_BUCKET;
const MODEL  = "gemini-2.5-flash";

/* ── Reference answer generator ─────────────────────────────────────────── */
async function generateReferenceAnswers(
  ai, course, classId, examType, qpKey, qpBytes, msKey, msBytes
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

  const s3Key  = `${course}/${classId}/${examType}/reference-answers/reference.pdf`;
  const pdfBuf = await textToPDFBuffer(finalText);
  await uploadToS3(BUCKET, s3Key, pdfBuf, "application/pdf");

  return await ReferenceAnswer.findOneAndUpdate(
    { course, classId, examType },
    { course, classId, examType, pdfLink: s3Key, status: false },
    { upsert: true, new: true }
  );
}

/* ── Main worker logic ───────────────────────────────────────────────────── */
function startWorker() {

  /* Process ONE paper at a time (concurrency: 1) */
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

    // Download only what this paper needs
    const basePrefix = `${course}/${classId}/${examType}`;
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
      if (hasOcr) {
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

      // Free buffers explicitly
      qpBytes.fill(0);
      scriptBytes.fill(0);
      if (msBytes) msBytes.fill(0);

      job.progress(100);
      console.log(`✅ [WORKER] Done: rollNo=${rollNo} | ${totalMarks}/${maxMarks}`);

      // Generate reference answer only if not already created and all papers done
      const allRows      = await MarkMatrix.find({ classId, course, examType }, { status: 1 }).lean();
      const stillPending = allRows.some((r) => r.status === "pending");

      if (!stillPending) {
        try {
          const refExists = await ReferenceAnswer.findOne({ course, classId, examType }).lean();
          if (refExists?.pdfLink) {
            console.log("⏭ [WORKER] Reference answer already exists — skipping");
          } else {
            console.log("📝 [WORKER] All papers done — generating reference answer");
            const [freshQp, freshMs] = await Promise.all([
              downloadFromS3(BUCKET, qpList[0]),
              msList[0] ? downloadFromS3(BUCKET, msList[0]) : Promise.resolve(null),
            ]);
            const refKeyObj = await getNextApiKey();
            const refAi     = new GoogleGenAI({ apiKey: refKeyObj.key });
            await generateReferenceAnswers(
              refAi, course, classId, examType,
              qpList[0], freshQp, msList[0], freshMs
            );
            await markKeyUsed(refKeyObj.label);
            console.log("✅ [WORKER] Reference answer generated");
          }
        } catch (refErr) {
          console.error("❌ [WORKER] Reference answer generation failed:", refErr?.message);
        }
      }

      return { rollNo, totalMarks, maxMarks };

    } catch (err) {
      const isQuota = err?.message?.includes("429") || err?.message?.includes("quota");
      if (isQuota) await markKeyFailed(keyObj.label);

      await MarkMatrix.updateOne(
        { scriptKey },
        {
          $set: {
            rollNo, scriptKey, classId, course, examType,
            resultTable: "", status: "failed", error: err.message,
          },
        },
        { upsert: true }
      );

      throw err; // Bull retries automatically
    }
  });

  evalQueue.on("completed", (job, result) =>
    console.log(`✅ Queue job ${job.id} completed:`, result)
  );
  evalQueue.on("failed", (job, err) =>
    console.error(`❌ Queue job ${job.id} failed (attempt ${job.attemptsMade}):`, err.message)
  );
  evalQueue.on("stalled", (job) =>
    console.warn(`⚠️ Queue job ${job.id} stalled — will retry`)
  );
  evalQueue.on("error",   (err)   => console.error("❌ [WORKER] Queue error:", err.message));
  evalQueue.on("waiting", (jobId) => console.log("⏳ [WORKER] Job waiting:", jobId));
  evalQueue.on("active",  (job)   => console.log("🔄 [WORKER] Job active:", job.id));

  console.log("🟢 Eval worker started — waiting for jobs...");
}

/* ── Connect MongoDB first, then start worker ────────────────────────────── */
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("✅ [WORKER] MongoDB connected");
    startWorker();
  })
  .catch((err) => {
    console.error("❌ [WORKER] MongoDB connection failed:", err.message);
    process.exit(1);
  });
