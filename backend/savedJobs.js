import { Router } from "express";
import Student from "./models/Student.js";
import SavedJob from "./models/SavedJob.js";

const router = Router();

function invalid(message = "Maklumat jawatan tidak sah.") {
  return Object.assign(new Error(message), { status: 400 });
}

function jobId(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 4096 || /[,\u0000-\u001f]/.test(value)) throw invalid("ID jawatan tidak sah.");
  return value.trim();
}

function snapshot(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw invalid();
  const job = { jobId: jobId(input.jobId) };
  for (const [field, max] of Object.entries({ title: 500, company: 500, location: 500, applyLink: 8192, salary: 300, postedAt: 100, source: 300 })) {
    const value = input[field] ?? "";
    if (typeof value !== "string" || value.length > max) throw invalid();
    job[field] = value.trim();
  }
  if (!job.title) throw invalid();
  if (job.applyLink) {
    let url;
    try { url = new URL(job.applyLink); } catch { throw invalid("Pautan jawatan tidak sah."); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw invalid("Pautan jawatan tidak sah.");
  }
  return job;
}

// Authentication runs in careers.js; ownership comes exclusively from the JWT.
router.use(async (req, res, next) => {
  try {
    if (req.user.role !== "user" || !req.user.studentId) return res.status(403).json({ success: false, message: "Hanya pelajar boleh menyimpan jawatan sendiri." });
    if (!await Student.exists({ ID_Pelajar: req.user.studentId })) return res.status(404).json({ success: false, message: "Pelajar tidak dijumpai." });
    next();
  } catch (error) { next(error); }
});

router.get("/", async (req, res, next) => {
  try {
    if (Object.keys(req.query).length) throw invalid();
    const jobs = await SavedJob.find({ studentId: req.user.studentId }).sort({ savedAt: -1, _id: -1 }).select("-studentId -__v").lean();
    res.json({ success: true, jobs });
  } catch (error) { next(error); }
});

router.post("/", async (req, res, next) => {
  try {
    if (Object.keys(req.query).length || Object.keys(req.body || {}).some((key) => key !== "job")) throw invalid();
    const job = snapshot(req.body?.job);
    const owner = { studentId: req.user.studentId, jobId: job.jobId };
    let saved;
    try {
      saved = await SavedJob.findOneAndUpdate(owner, { $setOnInsert: { ...job, savedAt: new Date() } }, { upsert: true, new: true, runValidators: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      saved = await SavedJob.findOne(owner);
      if (!saved) throw error;
    }
    const { studentId, __v, ...result } = saved.toObject();
    res.json({ success: true, job: result });
  } catch (error) { next(error); }
});

router.delete("/", async (req, res, next) => {
  try {
    if (Object.keys(req.query).some((key) => key !== "job_id")) throw invalid();
    await SavedJob.deleteOne({ studentId: req.user.studentId, jobId: jobId(req.query.job_id) });
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.use((error, req, res, next) => {
  res.status(error.status === 400 ? 400 : 503).json({ success: false, message: error.status === 400 ? error.message : "Jawatan disimpan tidak dapat dikemas kini. Sila cuba lagi." });
});

export default router;
