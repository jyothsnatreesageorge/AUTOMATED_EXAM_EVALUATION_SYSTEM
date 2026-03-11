import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    admnNo: { type: String, required: true, trim: true, unique: true },

    name: { type: String, required: true, trim: true },

    rollNo: { type: String, required: true, trim: true },

    classId: { type: String, required: true, trim: true },

    semester: { type: Number, min: 1, max: 8 },

    email: { type: String, required: true, trim: true },

    password: { type: String, required: true },
  },
  { timestamps: true }
);

// unique combination: class + rollNo
studentSchema.index({ classId: 1, rollNo: 1 }, { unique: true });

export default mongoose.models.Student || mongoose.model("Student", studentSchema);