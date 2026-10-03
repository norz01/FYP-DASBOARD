import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
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
    interventionType: {
      type: String,
      enum: ["kaunseling", "klinik", "softskills"],
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    priority: {
      type: String,
      enum: ["urgent", "normal"],
      default: "normal",
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "scheduled", "completed", "rejected"],
      default: "pending",
    },
    adminEmail: {
      type: String,
      required: true,
    },
    counselorId: {
      type: String,
      default: null,
    },
    counselorNotes: {
      type: String,
      default: "",
    },
    scheduledDate: {
      type: Date,
      default: null,
    },
    fileName: {
      type: String,
      default: null,
    },
    filePath: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Report", reportSchema);