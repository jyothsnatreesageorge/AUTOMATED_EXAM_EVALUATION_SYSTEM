import mongoose from "mongoose";


const courseSchema = new mongoose.Schema({
    courseId: {
        type: String,
        required: true,
        unique: true
    },
    courseName: {
        type: String,
        required: true
    },
   
});

export default mongoose.model("Course", courseSchema,"courses");