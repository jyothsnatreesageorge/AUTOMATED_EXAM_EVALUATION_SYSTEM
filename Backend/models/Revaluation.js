import mongoose from "mongoose";

const revaluationSchema = new mongoose.Schema({

  studentName: {
    type: String,
    required: true
  },

  rollNo: {
    type: String,
    required: true
  },

  classId: {
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

  status: {
    type: String,
    enum: ["pending", "reviewed"],
    default: "pending"
  },

 teacherId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Teacher",
  default: null
},
  newMarks: {
    type: Number,
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now
  }

});

const Revaluation = mongoose.model("Revaluation", revaluationSchema);

export default Revaluation;