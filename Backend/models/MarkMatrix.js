import mongoose from "mongoose";

const markMatrixSchema = new mongoose.Schema({

  rollNo: {
    type: String,
    required: true
  },

  course: {
    type: String,
    required: true
  },

  examType: {
    type: String,
    required: true
  },
   classId: { type: String, required: true },

  scriptKey: String,

  questions: [
    {
      question: String,
      marks: Number,
      max: Number,
      deductionReason: String
    }
  ],

  resultTable: String,

  totalMarks: Number,
  maxMarks: Number,

  createdAt: {
    type: Date,
    default: Date.now
  }

});

export default mongoose.model("MarkMatrix", markMatrixSchema);