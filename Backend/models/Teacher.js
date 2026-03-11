import mongoose from "mongoose";


const teacherSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: String,
  email: String,
  phone: String,
  password:String
});

export default mongoose.model("Teacher", teacherSchema);