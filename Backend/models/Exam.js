import mongoose from "mongoose";
const examSchema = new mongoose.Schema({
  classId: { type: String, required: true },
  course: { type: String, required: true },
  examType: { type: String, required: true },
  evalType: { type: String, required: true },
  status: { type: String, enum: ["Draft", "Active"], default: "Draft" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Exam", examSchema);