import mongoose from "mongoose";

const referenceAnswerSchema = new mongoose.Schema({

  course:{
    type:String,
    required:true
  },

  examType:{
    type:String,
    required:true
  },

  classId:{
    type:String,
    required:true
  },

  pdfLink:{
    type:String,
    required:true
  },

  status:{
    type:Boolean,
    default:false
  }

},{
  timestamps:true
});

const ReferenceAnswer = mongoose.model(
  "ReferenceAnswer",
  referenceAnswerSchema,
  "referenceanswers"   // collection name
);

export default ReferenceAnswer;