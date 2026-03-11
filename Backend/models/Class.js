import mongoose from "mongoose";

const classSchema = new mongoose.Schema({
  classId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  admissionYear: {
    type: String,
    required: true
  },

  passoutYear: {
    type: String,
    required: true
  },

  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },

  division: {
    type: String,
    default: null,
    uppercase: true
  }

}, { timestamps: true });


export default mongoose.models.Class || mongoose.model("Class", classSchema);