import mongoose from "mongoose";

// Bookmarks are student-owned records, independent of the daily search cache.
const savedJobSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  jobId: { type: String, required: true },
  title: { type: String, required: true },
  company: String,
  location: String,
  applyLink: String,
  salary: String,
  postedAt: String,
  source: String,
  savedAt: { type: Date, default: Date.now },
});
savedJobSchema.index({ studentId: 1, jobId: 1 }, { unique: true });
savedJobSchema.index({ studentId: 1, savedAt: -1 });

export default mongoose.model("SavedJob", savedJobSchema);
