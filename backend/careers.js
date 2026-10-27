import { Router } from "express";
import rateLimit from "express-rate-limit";
import Student from "./models/Student.js";
import { verifyToken, requireOwnershipOrAdmin } from "./middleware/authMiddleware.js";
import { buildStudentPathway } from "./utils/careerPathway.js";
import { CAREER_DEPARTMENTS, CareerError, parseSearchParameters } from "./utils/careerCache.js";
import { careerCache } from "./services/careerCache.service.js";
import savedJobsRouter from "./savedJobs.js";

const router = Router();
const limiter = rateLimit({
  windowMs: 60000,
  limit: 20,
  keyGenerator: (req) => req.user.email || req.user.studentId || "authenticated",
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Terlalu banyak carian. Sila cuba lagi selepas seminit." },
});

/** Student department is database-owned. A query parameter can never grant department access. */
async function resolveDepartment(user, input, loadedStudent) {
  const staff = ["admin", "counselor"].includes(user.role);
  if (!staff && user.role !== "user") throw new CareerError("Akses ditolak.", 403, "FORBIDDEN", 0);
  for (const name of ["department", "studentId"]) {
    if (input[name] !== undefined && (typeof input[name] !== "string" || !input[name].trim())) throw new CareerError("Jabatan atau ID pelajar tidak sah.", 400, "INVALID_SCOPE", 0);
  }
  if (staff && input.department && input.studentId) throw new CareerError("Pilih jabatan atau pelajar, bukan kedua-duanya.", 400, "INVALID_SCOPE", 0);
  if (!staff && (!user.studentId || (input.studentId && input.studentId !== user.studentId))) throw new CareerError("Akaun ini tidak mempunyai akses kepada rekod pelajar tersebut.", 403, "FORBIDDEN", 0);
  let department;
  if (staff && input.department) {
    department = input.department.trim().toUpperCase();
  } else {
    const studentId = staff ? input.studentId : user.studentId;
    if (!studentId) throw new CareerError("Pilih jabatan atau pelajar untuk carian.", 400, "SCOPE_REQUIRED", 0);
    const student = loadedStudent || await Student.findOne({ ID_Pelajar: studentId });
    if (!student) throw new CareerError("Pelajar tidak dijumpai.", 404, "STUDENT_NOT_FOUND", 0);
    department = String(student.Kursus || "").replaceAll("*", "").trim().toUpperCase();
    if (!staff && input.department && input.department.trim().toUpperCase() !== department) throw new CareerError("Akses kepada sejarah atau carian jabatan lain ditolak.", 403, "FORBIDDEN", 0);
  }
  if (!CAREER_DEPARTMENTS.includes(department)) throw new CareerError("Jabatan pelajar belum direkodkan dengan betul.", 403, "INVALID_DEPARTMENT", 0);
  return department;
}

function sendError(res, cause) {
  const error = cause instanceof CareerError ? cause : new CareerError("Carian sementara tidak tersedia. Sila cuba lagi.");
  if (error.retryAfter) res.set("Retry-After", String(error.retryAfter));
  return res.status(error.status).json({ success: false, code: error.code, message: error.message, retryAfter: error.retryAfter });
}

router.use(verifyToken, (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});

router.get("/search", limiter, async (req, res) => {
  try {
    const { params, keyword } = parseSearchParameters(req.query);
    const department = await resolveDepartment(req.user, req.query);
    return res.json({ success: true, department, ...await careerCache.search(department, params, keyword) });
  } catch (error) { return sendError(res, error); }
});

router.use("/saved-jobs", savedJobsRouter);

async function history(req, res) {
  try {
    if (Object.keys(req.query).some((key) => !["department", "studentId"].includes(key))) throw new CareerError("Parameter sejarah tidak sah.", 400, "INVALID_SCOPE", 0);
    const input = req.params.department ? { ...req.query, department: req.params.department } : req.query;
    const department = await resolveDepartment(req.user, input);
    return res.json({ success: true, department, ...await careerCache.history(department) });
  } catch (error) { return sendError(res, error); }
}
router.get("/history", history);
router.get("/history/:department", history);

router.get("/job-details", limiter, async (req, res) => {
  try {
    const { job_id: jobId } = req.query;
    if (Object.keys(req.query).some((key) => !["job_id", "department", "studentId"].includes(key)) || typeof jobId !== "string" || !jobId.trim() || jobId.length > 4096 || /[,\u0000-\u001f]/.test(jobId)) throw new CareerError("ID jawatan tidak sah.", 400, "INVALID_JOB_ID", 0);
    await resolveDepartment(req.user, req.query);
    return res.json({ success: true, ...await careerCache.details(jobId.trim()) });
  } catch (error) { return sendError(res, error); }
});

router.get("/pathways/:studentId", requireOwnershipOrAdmin, limiter, async (req, res) => {
  try {
    const student = await Student.findOne({ ID_Pelajar: req.params.studentId });
    if (!student) throw new CareerError("Pelajar tidak dijumpai.", 404, "STUDENT_NOT_FOUND", 0);
    const department = await resolveDepartment(req.user, { studentId: req.params.studentId }, student);
    const pathway = buildStudentPathway(student);
    // Current grades are derived. No separate student cache can bypass the daily policy.
    if (!pathway.baseQuery) return res.json({ success: true, department, pathway, jobs: [], cursor: null, cached: false });
    const { params } = parseSearchParameters({ q: pathway.baseQuery });
    try {
      return res.json({ success: true, department, pathway, ...await careerCache.search(department, params) });
    } catch (error) {
      return res.json({ success: true, department, pathway, jobs: [], cursor: null, warning: error instanceof CareerError ? error.message : "Carian sementara tidak tersedia." });
    }
  } catch (error) { return sendError(res, error); }
});

export default router;
