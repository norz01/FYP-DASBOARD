import mongoose from "mongoose";

const ploScoreSchema = new mongoose.Schema(
  {
    label: String,
    value: Number,
  },
  { _id: false }
);

const studentReportSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      index: true,
    },
    studentName: {
      type: String,
      required: true,
    },
    course: {
      type: String,
      default: "",
    },
    cgpa: {
      type: String,
      default: "",
    },
    attendance: {
      type: String,
      default: "",
    },
    riskLevel: {
      type: String,
      default: "",
    },
    semester: {
      type: String,
      default: "",
    },
    ploScores: {
      type: [ploScoreSchema],
      default: [],
    },
    employability: {
      type: Number,
      default: 0,
    },
    authorEmail: {
      type: String,
      required: true,
    },
    authorRole: {
      type: String,
      enum: ["admin", "counselor"],
      required: true,
    },
    authorName: {
      type: String,
      default: "",
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      default: "",
    },
    fileName: {
      type: String,
      default: null,
    },
    filePath: {
      type: String,
      default: null,
    },
    reportType: {
      type: String,
      enum: ["message", "letter", "full"],
      required: true,
    },
    readByStudent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("StudentReport", studentReportSchema);