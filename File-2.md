# File-2: Career Feature Source Bundle
Verbatim contents of every file listed below, ordered as requested. Each section shows the repository-relative path, line count, and byte size.

## Index

1. `backend/careers.js`
2. `backend/savedJobs.js`
3. `backend/services/jobSearch.service.js`
4. `backend/services/careerCache.service.js`
5. `backend/utils/careerCache.js`
6. `backend/utils/careerPathway.js`
7. `backend/models/SavedJob.js`
8. `backend/server.js`
9. `backend/package.json`
10. `backend/package-lock.json`
11. `backend/.env.example`
12. `src/components/dashboard/StudentDashboardClient.jsx`
13. `src/components/JobCard.jsx`
14. `src/__tests__/Careers.test.jsx`
15. `compose.yml`
16. `.env.example`
17. `.github/workflows/ci.yml`
18. `scripts/check-repository.py`
19. `docs/career-cache.md`
20. `ML_TEST_RESULTS.md`

---

## backend/careers.js
`js` · 102 lines · 5852 bytes · path `backend/careers.js`

```js
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
```

---

## backend/savedJobs.js
`js` · 80 lines · 3373 bytes · path `backend/savedJobs.js`

```js
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
```

---

## backend/services/jobSearch.service.js
`js` · 74 lines · 3992 bytes · path `backend/services/jobSearch.service.js`

```js
import { CareerError } from "../utils/careerCache.js";

function normaliseJob(job, country = "my") {
  if (!job || typeof job !== "object" || !job.job_id || !job.job_title) return null;
  let applyLink;
  try {
    const url = new URL(job.job_apply_link);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    applyLink = url.href;
  } catch {
    return null;
  }
  const currency = job.job_salary_currency || (country === "my" ? "MYR" : "");
  const amount = Number(job.job_min_salary);
  const salary = typeof job.job_salary_string === "string" && job.job_salary_string.trim()
    ? job.job_salary_string.trim()
    : job.job_min_salary != null && Number.isFinite(amount) && amount > 0
    ? `${currency === "MYR" ? "RM" : currency || "Mata wang tidak dinyatakan:"} ${amount.toLocaleString("en-MY")}+${job.job_salary_period ? ` / ${job.job_salary_period}` : ""}`
    : "Gaji / elaun tidak dinyatakan";
  return {
    jobId: String(job.job_id),
    title: String(job.job_title),
    company: String(job.employer_name || "Majikan tidak dinyatakan"),
    location: String(job.job_location || [job.job_city, job.job_state, job.job_country].filter(Boolean).join(", ") || "Lokasi tidak dinyatakan"),
    applyLink,
    salary,
    postedAt: String(job.job_posted_at_datetime_utc || ""),
    source: String(job.job_publisher || "JSearch"),
  };
}

async function requestProvider(endpoint, params) {
  const apiKey = process.env.JSEARCH_API_KEY;
  if (!apiKey) throw new CareerError("Carian jawatan belum tersedia. Hubungi penyelaras untuk mengaktifkannya.", 503, "API_KEY_MISSING", 30);
  const url = new URL(`https://api.openwebninja.com/jsearch/${endpoint}`);
  url.search = new URLSearchParams(params).toString();

  try {
    const response = await fetch(url, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 429) {
      const header = response.headers.get("retry-after");
      const seconds = /^\d+$/.test(header || "") ? Number(header) : Math.ceil((Date.parse(header) - Date.now()) / 1000);
      throw new CareerError("Had penyedia carian dicapai. Sila cuba lagi kemudian.", 429, "PROVIDER_RATE_LIMIT", Number.isFinite(seconds) ? Math.max(1, Math.min(300, seconds)) : 60);
    }
    if (response.status === 400 || response.status === 410) throw new CareerError("Parameter atau halaman carian telah luput. Mulakan carian baharu.", 400, "PROVIDER_INVALID_QUERY", 0);
    if (!response.ok) throw new Error("Provider request failed");
    const data = await response.json();
    if (data.status !== "OK") throw new Error("Invalid provider response");
    return data.data;
  } catch (error) {
    if (error instanceof CareerError) throw error;
    throw new CareerError("Carian jawatan tergendala. Sila cuba lagi sebentar nanti.", 503, "PROVIDER_UNAVAILABLE", 5);
  }
}

export async function searchJobsFromProvider(params) {
  const data = await requestProvider("search-v2", params);
  if (!Array.isArray(data?.jobs) || (data.cursor != null && typeof data.cursor !== "string")) throw new CareerError("Respons carian tidak sah.");
  const jobs = data.jobs.map((job) => normaliseJob(job, params.country)).filter(Boolean);
  // Keep the entire paid page. Truncating ten cards to six would skip jobs during pagination.
  return { jobs: [...new Map(jobs.map((job) => [job.jobId, job])).values()], cursor: data.cursor && data.cursor !== params.cursor ? data.cursor : null };
}

export async function getJobDetailsFromProvider(jobId) {
  const data = await requestProvider("job-details", { job_id: jobId, country: "my", language: "en" });
  if (!Array.isArray(data)) throw new CareerError("Respons butiran jawatan tidak sah.");
  const raw = data.find((job) => job?.job_id === jobId);
  const job = normaliseJob(raw);
  if (!job) throw new CareerError("Jawatan tidak dijumpai.", 404, "JOB_NOT_FOUND", 0);
  return { job: { ...job, description: String(raw.job_description || "Huraian tidak dinyatakan.") } };
}
```

---

## backend/services/careerCache.service.js
`js` · 177 lines · 7527 bytes · path `backend/services/careerCache.service.js`

```js
import { createClient } from "redis";
import crypto from "crypto";
import { setTimeout as delay } from "node:timers/promises";
import { CareerError, buildSearchCacheKey, getDailyCacheWindow } from "../utils/careerCache.js";
import { searchJobsFromProvider, getJobDetailsFromProvider } from "./jobSearch.service.js";

let redis;
let connecting;
let retryConnectionAt = 0;

async function getRedis() {
  if (redis?.isReady) return redis;
  if (connecting) return connecting;
  if (Date.now() < retryConnectionAt) throw new Error("Redis unavailable");
  redis = createClient({
    url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
    socket: { connectTimeout: 2000, reconnectStrategy: false },
    disableOfflineQueue: true,
  });
  // Error events must have a listener. Never log connection URLs or credentials.
  redis.on("error", () => {});
  connecting = redis.connect().then(() => redis).catch(() => {
    if (redis.isOpen) redis.destroy();
    retryConnectionAt = Date.now() + 3000;
    throw new Error("Redis unavailable");
  }).finally(() => { connecting = undefined; });
  return connecting;
}

const luaTime = `local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local deadline = tonumber(ARGV[1])
`;

// Read and claim are one atomic operation, including a second cache check on miss.
const claim = luaTime + `
if now >= deadline then return {'reset'} end
local value = redis.call('GET', KEYS[1])
if value then
  local envelope = cjson.decode(value)
  if envelope.resetAt == deadline then return {'cached', value} end
end
local failure = redis.call('GET', KEYS[3])
if failure then return {'error', failure} end
local cooldown = redis.call('PTTL', KEYS[4])
if cooldown > 0 then return {'cooldown', tostring(cooldown)} end
if redis.call('SET', KEYS[2], ARGV[2], 'NX', 'PX', 30000) then return {'owner'} end
return {'wait'}
`;

const historyWrite = `
redis.call('LREM', KEYS[5], 0, ARGV[4])
redis.call('LPUSH', KEYS[5], ARGV[4])
redis.call('LTRIM', KEYS[5], 0, 9)
redis.call('PEXPIREAT', KEYS[5], deadline)
`;

// An old or expired owner cannot publish into a new day's cache or recreate history.
const publish = luaTime + `
if redis.call('GET', KEYS[2]) ~= ARGV[2] then return -1 end
if now >= deadline then redis.call('DEL', KEYS[2]); return 0 end
redis.call('SET', KEYS[1], ARGV[3], 'PXAT', deadline)
if ARGV[4] ~= '' then ${historyWrite} end
redis.call('DEL', KEYS[2], KEYS[3])
return 1
`;

const touchHistory = luaTime + `
if now >= deadline then return 0 end
${historyWrite}
return 1
`;

const fail = luaTime + `
if redis.call('GET', KEYS[2]) ~= ARGV[2] then return 0 end
if tonumber(ARGV[4]) > 0 then
  local remaining = redis.call('PTTL', KEYS[4])
  redis.call('SET', KEYS[4], '1', 'PX', math.max(remaining, tonumber(ARGV[4])))
end
if now < deadline then
  redis.call('SET', KEYS[3], ARGV[3], 'PX', math.min(5000, deadline - now))
end
redis.call('DEL', KEYS[2])
return 1
`;

const readHistory = luaTime + `
if now >= deadline then return {'reset'} end
local result = {'ok'}
for _, keyword in ipairs(redis.call('LRANGE', KEYS[1], 0, 9)) do table.insert(result, keyword) end
return result
`;

function resetError() {
  return new CareerError("Carian harian telah ditetapkan semula pada 8 pagi. Mulakan carian baharu.", 409, "DAILY_RESET", 0);
}

/** One owner for all career results. Injection is limited to provider and Redis test boundaries. */
export function createCareerCache({ client = getRedis, search = searchJobsFromProvider, details = getJobDetailsFromProvider, windowFor = getDailyCacheWindow } = {}) {
  async function context() {
    try {
      const connection = await client();
      const [seconds, microseconds] = await connection.time();
      const now = Number(seconds) * 1000 + Math.floor(Number(microseconds) / 1000);
      return { connection, ...windowFor(now) };
    } catch {
      // Fail closed: an unconfirmed cache miss must never spend provider credits.
      throw new CareerError("Carian sementara tidak tersedia. Sila cuba lagi.", 503, "CACHE_UNAVAILABLE", 3);
    }
  }

  async function getOrLoad(key, load, department, keyword = "") {
    const { connection, expiresAt: resetAt } = await context();
    const keys = [key, `job_lock:${key}`, `job_failure:${key}`, "jsearch:cooldown", department ? `job_history:${department}` : "job_history:unused"];
    const token = crypto.randomUUID();
    const stopWaitingAt = Date.now() + 12000;
    try {
      while (true) {
        const [state, data] = await connection.eval(claim, { keys, arguments: [String(resetAt), token] });
        if (state === "reset") throw resetError();
        if (state === "cooldown") throw new CareerError("Had penyedia carian dicapai. Sila cuba lagi kemudian.", 429, "PROVIDER_RATE_LIMIT", Math.ceil(Number(data) / 1000));
        if (state === "error") {
          const error = JSON.parse(data);
          throw new CareerError(error.message, error.status, error.code, error.retryAfter);
        }
        if (state === "cached") {
          if (keyword && !await connection.eval(touchHistory, { keys, arguments: [String(resetAt), token, "", keyword] })) throw resetError();
          return { ...JSON.parse(data).value, cached: true, resetAt };
        }
        if (state === "owner") break;
        if (Date.now() >= stopWaitingAt) throw new CareerError("Carian yang sama sedang diproses. Cuba lagi sebentar nanti.", 503, "SEARCH_IN_PROGRESS", 2);
        await delay(100);
      }
      let value;
      try {
        value = await load();
      } catch (cause) {
        const error = cause instanceof CareerError ? cause : new CareerError("Penyedia carian tidak dapat dihubungi.");
        await connection.eval(fail, {
          keys,
          arguments: [String(resetAt), token, JSON.stringify({ message: error.message, status: error.status, code: error.code, retryAfter: error.retryAfter }), String(error.code === "PROVIDER_RATE_LIMIT" ? error.retryAfter * 1000 : 0)],
        });
        throw error;
      }
      const saved = await connection.eval(publish, { keys, arguments: [String(resetAt), token, JSON.stringify({ resetAt, value }), keyword] });
      if (saved < 0) throw new CareerError("Carian sedang diproses semula. Sila cuba lagi.", 503, "CACHE_OWNER_LOST", 2);
      if (!saved) throw resetError();
      return { ...value, cached: false, resetAt };
    } catch (error) {
      if (error instanceof CareerError) throw error;
      throw new CareerError("Carian sementara tidak tersedia. Sila cuba lagi.", 503, "CACHE_UNAVAILABLE", 3);
    }
  }

  return {
    search(department, params, keyword = "") {
      return getOrLoad(buildSearchCacheKey(department, params), () => search(params), department, keyword);
    },
    details(jobId) {
      // Country and response language are fixed server-side, so job_id is the global identity.
      return getOrLoad(`job_details:${jobId}`, () => details(jobId));
    },
    async history(department) {
      const { connection, expiresAt: resetAt } = await context();
      try {
        const keywords = await connection.eval(readHistory, { keys: [`job_history:${department}`], arguments: [String(resetAt)] });
        if (keywords[0] === "reset") throw resetError();
        return { keywords: keywords.slice(1), resetAt };
      } catch (error) {
        if (error instanceof CareerError) throw error;
        throw new CareerError("Sejarah carian sementara tidak tersedia.", 503, "CACHE_UNAVAILABLE", 3);
      }
    },
  };
}

export const careerCache = createCareerCache();
```

---

## backend/utils/careerCache.js
`js` · 98 lines · 4665 bytes · path `backend/utils/careerCache.js`

```js
import crypto from "crypto";

export const CAREER_DEPARTMENTS = ["ITW", "DFK", "DGA", "SLR", "DCG", "SED", "PPU"];

/** Malaysia is UTC+8: its daily 08:00 reset is midnight UTC, regardless of host TZ. */
export function getDailyCacheWindow(now = Date.now()) {
  const expiresAt = (Math.floor(now / 86400000) + 1) * 86400000;
  return { expiresAt, ttlSeconds: Math.ceil((expiresAt - now) / 1000) };
}

export function secondsUntilNextEight(now = Date.now()) {
  return getDailyCacheWindow(now).ttlSeconds;
}

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
  }
  return value;
}

export function buildSearchCacheKey(department, params) {
  const hash = crypto.createHash("md5").update(JSON.stringify(sorted(params))).digest("hex");
  return `job_cache:${department}:${hash}`;
}

export class CareerError extends Error {
  constructor(message, status = 503, code = "CAREER_UNAVAILABLE", retryAfter = 1) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

function invalid() {
  throw new CareerError("Parameter carian tidak sah.", 400, "INVALID_SEARCH", 0);
}

function text(value, max) {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) invalid();
  return value.trim().replace(/\s+/g, " ");
}

function csv(value, allowed) {
  const values = text(value, 1000).split(",").map((item) => item.trim());
  if (values.some((item) => !item || (allowed && !allowed.includes(item)))) invalid();
  return [...new Set(values)].sort().join(",");
}

/** This object is BOTH the outgoing provider request and the hashed cache identity. */
export function parseSearchParameters(input) {
  const accepted = ["query", "q", "location", "employmentType", "country", "date_posted", "cursor", "num_pages", "language", "work_from_home", "employment_types", "job_requirements", "radius", "exclude_job_publishers", "fields", "department", "studentId"];
  if (Object.keys(input).some((key) => !accepted.includes(key))) invalid();
  if (input.query !== undefined && (input.q !== undefined || input.location !== undefined)) invalid();
  if (input.employmentType !== undefined && input.employment_types !== undefined) invalid();
  const keyword = text(input.query ?? input.q, 150).toLowerCase();
  const query = input.query === undefined
    ? `${keyword} in ${text(input.location ?? "Malaysia", 100).toLowerCase()}`
    : keyword;
  const params = {
    query,
    country: text(input.country ?? "my", 2).toLowerCase(),
    date_posted: input.date_posted ?? "all",
    employment_types: csv(input.employment_types ?? input.employmentType ?? "INTERN", ["FULLTIME", "CONTRACTOR", "PARTTIME", "INTERN"]),
    num_pages: "1",
    work_from_home: "false",
  };
  if (!/^[a-z]{2}$/.test(params.country) || !["all", "today", "3days", "week", "month"].includes(params.date_posted)) invalid();
  // One page costs one provider credit. Higher page counts are deliberately rejected.
  if (input.num_pages !== undefined && input.num_pages !== "1") invalid();
  if (input.work_from_home !== undefined) {
    if (!["true", "false"].includes(input.work_from_home)) invalid();
    params.work_from_home = input.work_from_home;
  }
  if (input.cursor !== undefined && input.cursor !== "") {
    if (typeof input.cursor !== "string" || input.cursor.length > 8192 || /[\u0000-\u001f]/.test(input.cursor)) invalid();
    params.cursor = input.cursor; // Opaque provider cursor: do not lowercase or split it.
  }
  if (input.language !== undefined) {
    params.language = text(input.language, 2).toLowerCase();
    if (!/^[a-z]{2}$/.test(params.language)) invalid();
  }
  if (input.job_requirements !== undefined) params.job_requirements = csv(input.job_requirements, ["under_3_years_experience", "more_than_3_years_experience", "no_experience", "no_degree"]);
  if (input.radius !== undefined) {
    if (typeof input.radius !== "string" || !/^(\d+)(\.\d+)?$/.test(input.radius) || Number(input.radius) > 1000) invalid();
    params.radius = String(Number(input.radius));
  }
  if (input.exclude_job_publishers !== undefined) params.exclude_job_publishers = csv(input.exclude_job_publishers);
  if (input.fields !== undefined) {
    params.fields = csv(input.fields);
    if (!/^[a-z_,]+$/.test(params.fields)) invalid();
    // A projection must still contain the minimum fields needed to display a job card.
    params.fields = csv(`${params.fields},job_id,job_title,job_apply_link`);
  }
  return { params, keyword };
}
```

---

## backend/utils/careerPathway.js
`js` · 97 lines · 5627 bytes · path `backend/utils/careerPathway.js`

```js
export const pathwayMap = {
  SED: {
    courseName: "Diploma Kompetensi Elektrik (Penyelenggaraan) (Industri)",
    targetRoles: ["Electrical Technician", "Chargeman Trainee (PW4)", "Penjaga Jentera Elektrik"],
    baseQuery: "Electrical Maintenance Technician Industrial",
    recommendedCertifications: ["Sijil Kompetisi Juruwireman (PW2/PW4)", "Chargeman AO/A4 (Suruhanjaya Tenaga)", "CIDB Green Card"],
    suggestedSearches: [
      { label: "Electrical Intern", q: "Electrical Technician Intern", location: "Malaysia", employmentType: "INTERN" },
      { label: "Wireman / Chargeman", q: "Wireman Chargeman Trainee", location: "Malaysia", employmentType: "INTERN" },
    ],
  },
  ITW: {
    courseName: "Diploma Kompetensi Kimpalan",
    targetRoles: ["Welder / Fabricator", "Welding Inspector (VI)", "NDT Technician", "Pipe Welder"],
    baseQuery: "Welder Fabricator QAQC NDT",
    recommendedCertifications: ["TWIMC", "ASME / AWS Welding", "NDT Level 1/2", "Visual Inspector (VI)"],
    suggestedSearches: [
      { label: "Welder Intern", q: "Welder Fabricator Intern", location: "Malaysia", employmentType: "INTERN" },
      { label: "Oil & Gas Welder", q: "Pipe Welder NDT Intern", location: "Terengganu", employmentType: "INTERN" },
    ],
  },
  DFK: {
    courseName: "Diploma Teknologi Komputer (Komputasi Awan)",
    targetRoles: ["Cloud Support Trainee", "IT Support Technician", "System Administrator Assistant"],
    baseQuery: "Cloud Computing IT Support System Admin",
    recommendedCertifications: ["AWS Certified Cloud Practitioner", "Microsoft Azure Fundamentals (AZ-900)", "Cisco CCNA"],
    suggestedSearches: [
      { label: "Cloud Intern", q: "Cloud Computing Support Intern", location: "Malaysia", employmentType: "INTERN" },
      { label: "IT Support", q: "IT Support Technician Intern", location: "Malaysia", employmentType: "INTERN" },
    ],
  },
  PPU: {
    courseName: "Diploma Teknologi Penyejukan dan Penyamanan Udara",
    targetRoles: ["HVAC Technician Trainee", "Air Conditioning Mechanic", "Facility M&E Assistant"],
    baseQuery: "HVAC Air Conditioning Refrigeration Technician",
    recommendedCertifications: ["CIDB Green Card", "DOS Refrigerant Handling", "SKM/DKM (Penyejukan)"],
    suggestedSearches: [
      { label: "HVAC Intern", q: "HVAC Technician Intern", location: "Malaysia", employmentType: "INTERN" },
      { label: "Facility M&E", q: "Facility Maintenance M&E Intern", location: "Malaysia", employmentType: "INTERN" },
    ],
  },
  SLR: {
    courseName: "Sijil Teknologi Kejuruteraan Mekanikal (Lukisan Rekabentuk)",
    targetRoles: ["CAD Drafter Intern", "Mechanical Design Trainee", "Junior Draftsperson"],
    baseQuery: "CAD Drafter Mechanical Design AutoCAD SolidWorks",
    recommendedCertifications: ["AutoCAD Certified Professional", "SolidWorks CSWA"],
    suggestedSearches: [
      { label: "CAD Drafter", q: "CAD Drafter Intern AutoCAD", location: "Malaysia", employmentType: "INTERN" },
      { label: "Mechanical Design", q: "Mechanical Design Trainee", location: "Malaysia", employmentType: "INTERN" },
    ],
  },
};

function score(value, max) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(max, numeric)) : 0;
}

export function buildStudentPathway(student) {
  const courseCode = String(student.Kursus || "").replaceAll("*", "").trim().toUpperCase();
  const course = pathwayMap[courseCode] || {
    courseName: courseCode || "Kursus belum direkodkan",
    targetRoles: [],
    baseQuery: null,
    recommendedCertifications: [],
    suggestedSearches: [],
  };
  const ploScores = Array.from({ length: 9 }, (_, i) => score(student[`PLO_${i + 1}`], 100));
  const ploAverage = ploScores.reduce((sum, value) => sum + value, 0) / 9;
  const cgpa = score(student.CGPA, 4);
  const attendance = score(student.Kehadiran_Pct, 100);
  const readinessScore = Math.round(ploAverage * 0.4 + (cgpa / 4) * 30 + attendance * 0.3);
  const actionPlan = [];
  const missingPlos = ploScores.flatMap((value, i) => value === 0 ? [`PLO ${i + 1}`] : []);
  if (missingPlos.length) {
    actionPlan.push({ title: "Lengkapkan rekod PLO", description: `Semak ${missingPlos.join(", ")} bersama pensyarah. Skor sifar dianggap belum direkodkan.` });
  }
  const weakPlos = ploScores.flatMap((value, i) => value > 0 && value < 80 ? [`PLO ${i + 1}`] : []);
  if (weakPlos.length) {
    actionPlan.push({ title: "Tingkatkan kemahiran PLO", description: `Utamakan latihan untuk ${weakPlos.join(", ")} sehingga mencapai sasaran 80%.` });
  }
  if (cgpa < 3) actionPlan.push({ title: "Kukuhkan pencapaian akademik", description: "Bincangkan pelan ulang kaji dan klinik akademik dengan pensyarah untuk mencapai CGPA 3.00." });
  if (attendance < 80) actionPlan.push({ title: "Perbaiki kehadiran", description: "Rancang jadual bersama penasihat untuk mencapai kehadiran sekurang-kurangnya 80%." });
  if (course.recommendedCertifications.length) {
    actionPlan.push({ title: "Rancang pensijilan industri", description: `Semak syarat, pengalaman dan latihan yang diperlukan untuk ${course.recommendedCertifications.join(", ")}.` });
  }
  actionPlan.push({ title: "Sediakan permohonan latihan industri", description: "Kemas kini CV, sijil dan portfolio projek. Sesuaikan permohonan dengan syarat setiap jawatan." });

  return {
    ...course,
    courseCode,
    supported: Boolean(pathwayMap[courseCode]),
    readinessScore,
    readinessExplanation: "Indeks panduan: purata 9 PLO (40%), CGPA (30%) dan kehadiran (30%). Data belum direkodkan dikira sifar. Ini bukan kebarangkalian mendapat kerja.",
    actionPlan,
  };
}
```

---

## backend/models/SavedJob.js
`js` · 19 lines · 638 bytes · path `backend/models/SavedJob.js`

```js
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
```

---

## backend/server.js
`js` · 154 lines · 3758 bytes · path `backend/server.js`

```js
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import authRouter from "./auth.js";
import itemsRouter from "./items.js";
import reportsRouter from "./reports.js";
import studentReportsRouter from "./studentReports.js";
import careersRouter from "./careers.js";
import MdbFile from "./models/MdbFile.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
  })
);

app.use(express.json({ limit: "200kb" }));

// Ensure upload directories exist
const uploadDirectories = ["certificates", "mdb", "referrals", "reports"];

for (const dir of uploadDirectories) {
  const uploadPath = path.join(__dirname, "uploads", dir);

  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }
}

// Public static uploads
app.use(
  "/uploads/certificates",
  express.static(path.join(__dirname, "uploads", "certificates"))
);

app.use(
  "/uploads/referrals",
  express.static(path.join(__dirname, "uploads", "referrals"))
);

app.use(
  "/uploads/reports",
  express.static(path.join(__dirname, "uploads", "reports"))
);

// Swagger Configuration
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "TVETMARA Besut Dashboard API",
      version: "1.0.0",
      description:
        "API documentation for the TVETMARA Skills Talent Development Dashboard FYP.",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: [
    "./auth.js",
    "./items.js",
    "./reports.js",
    "./studentReports.js",
  ],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

if (process.env.NODE_ENV !== "test") {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(async () => {
      console.log("✅ Connected to MongoDB successfully!");

      const reset = await MdbFile.updateMany(
        { status: "Processing" },
        { $set: { status: "Saved" } }
      );

      if (reset.modifiedCount > 0) {
        console.log(`🔄 Recovered ${reset.modifiedCount} stuck MDB file(s).`);
      }
    })
    .catch((err) => console.error("❌ MongoDB connection error:", err));
}

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health Check
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server is healthy.
 */
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", source: "mongodb-database" });
});

// Mount routers
app.use("/api/auth", authRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/student-reports", studentReportsRouter);
app.use("/api/careers", careersRouter);
app.use("/api", itemsRouter);

// Global error handler
app.use((err, req, res, next) => {
  console.error("🔥 GLOBAL UNHANDLED ERROR:", err);

  res.status(500).json({
    message: err.message || "Global server error",
    stack: err.stack,
  });
});

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT) || 5000;

  app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
    console.log(
      `📄 API Documentation available at: http://localhost:${port}/api/docs`
    );
  });
}

export default app;
```

---

## backend/package.json
`json` · 35 lines · 937 bytes · path `backend/package.json`

```json
{
  "name": "tvetmara-backend",
  "version": "1.0.0",
  "description": "Backend API for TVETMARA Besut Dashboard",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "seed": "node seed.js",
    "start:prod": "node server.js",
    "test": "cross-env NODE_ENV=test node --experimental-vm-modules node_modules/jest/bin/jest.js --forceExit"
  },
  "dependencies": {
    "bcryptjs": "^3.0.3",
    "cors": "^2.8.6",
    "dotenv": "^17.3.1",
    "express": "^5.2.1",
    "express-rate-limit": "^8.7.0",
    "helmet": "^8.3.0",
    "jsonwebtoken": "^9.0.3",
    "mongoose": "^9.3.3",
    "multer": "^2.2.0",
    "redis": "^5.12.1",
    "swagger-jsdoc": "^6.3.0",
    "swagger-ui-express": "^5.0.1"
  },
  "devDependencies": {
    "@babel/preset-env": "^7.24.7",
    "cross-env": "^10.1.0",
    "jest": "^30.4.2",
    "nodemon": "^3.1.14",
    "supertest": "^7.2.2"
  }
}
```

---

## backend/package-lock.json
`json` · 8275 lines · 306610 bytes · path `backend/package-lock.json`

```json
{
  "name": "tvetmara-backend",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "tvetmara-backend",
      "version": "1.0.0",
      "dependencies": {
        "bcryptjs": "^3.0.3",
        "cors": "^2.8.6",
        "dotenv": "^17.3.1",
        "express": "^5.2.1",
        "express-rate-limit": "^8.7.0",
        "helmet": "^8.3.0",
        "jsonwebtoken": "^9.0.3",
        "mongoose": "^9.3.3",
        "multer": "^2.2.0",
        "redis": "^5.12.1",
        "swagger-jsdoc": "^6.3.0",
        "swagger-ui-express": "^5.0.1"
      },
      "devDependencies": {
        "@babel/preset-env": "^7.24.7",
        "cross-env": "^10.1.0",
        "jest": "^30.4.2",
        "nodemon": "^3.1.14",
        "supertest": "^7.2.2"
      }
    },
    "node_modules/@apidevtools/json-schema-ref-parser": {
      "version": "14.0.1",
      "resolved": "https://registry.npmjs.org/@apidevtools/json-schema-ref-parser/-/json-schema-ref-parser-14.0.1.tgz",
      "integrity": "sha512-Oc96zvmxx1fqoSEdUmfmvvb59/KDOnUoJ7s2t7bISyAn0XEz57LCCw8k2Y4Pf3mwKaZLMciESALORLgfe2frCw==",
      "license": "MIT",
      "dependencies": {
        "@types/json-schema": "^7.0.15",
        "js-yaml": "^4.1.0"
      },
      "engines": {
        "node": ">= 16"
      },
      "funding": {
        "url": "https://github.com/sponsors/philsturgeon"
      }
    },
    "node_modules/@apidevtools/json-schema-ref-parser/node_modules/argparse": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/argparse/-/argparse-2.0.1.tgz",
      "integrity": "sha512-8+9WqebbFzpX9OR+Wa6O29asIogeRMzcGtAINdpMHHyAg10f05aSFVBbcEqGf/PXw1EjAZ+q2/bEBg3DvurK3Q==",
      "license": "Python-2.0"
    },
    "node_modules/@apidevtools/json-schema-ref-parser/node_modules/js-yaml": {
      "version": "4.3.0",
      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.0.tgz",
      "integrity": "sha512-1td788aAnnZ5qs7V2QIRl1owjtYpbKt749Y3xauqQgwIIGF/xXWz1wMTEBx5O3LK3lXLVuqXPdPxj2BoFHaW9Q==",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/puzrin"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/nodeca"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "argparse": "^2.0.1"
      },
      "bin": {
        "js-yaml": "bin/js-yaml.js"
      }
    },
    "node_modules/@apidevtools/openapi-schemas": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/@apidevtools/openapi-schemas/-/openapi-schemas-2.1.0.tgz",
      "integrity": "sha512-Zc1AlqrJlX3SlpupFGpiLi2EbteyP7fXmUOGup6/DnkRgjP9bgMM/ag+n91rsv0U1Gpz0H3VILA/o3bW7Ua6BQ==",
      "license": "MIT",
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/@apidevtools/swagger-methods": {
      "version": "3.0.2",
      "resolved": "https://registry.npmjs.org/@apidevtools/swagger-methods/-/swagger-methods-3.0.2.tgz",
      "integrity": "sha512-QAkD5kK2b1WfjDS/UQn/qQkbwF31uqRjPTrsCs5ZG9BQGAkjwvqGFjjPqAuzac/IYzpPtRzjCP1WrTuAIjMrXg==",
      "license": "MIT"
    },
    "node_modules/@apidevtools/swagger-parser": {
      "version": "12.1.0",
      "resolved": "https://registry.npmjs.org/@apidevtools/swagger-parser/-/swagger-parser-12.1.0.tgz",
      "integrity": "sha512-e5mJoswsnAX0jG+J09xHFYQXb/bUc5S3pLpMxUuRUA2H8T2kni3yEoyz2R3Dltw5f4A6j6rPNMpWTK+iVDFlng==",
      "license": "MIT",
      "dependencies": {
        "@apidevtools/json-schema-ref-parser": "14.0.1",
        "@apidevtools/openapi-schemas": "^2.1.0",
        "@apidevtools/swagger-methods": "^3.0.2",
        "ajv": "^8.17.1",
        "ajv-draft-04": "^1.0.0",
        "call-me-maybe": "^1.0.2"
      },
      "peerDependencies": {
        "openapi-types": ">=7"
      }
    },
    "node_modules/@babel/code-frame": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.29.7.tgz",
      "integrity": "sha512-Aup7aUOfpbAUg2ROOJN6Iw5f9DMBlzu0mIkm/malLQFN/YQgO48wCj0Kxa3sEHJvPVFg7siR+qRInwXd2qhQKw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-validator-identifier": "^7.29.7",
        "js-tokens": "^4.0.0",
        "picocolors": "^1.1.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/compat-data": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.29.7.tgz",
      "integrity": "sha512-locTkQyKvwIEgBzVrn8693ebc97F2U8ZHjbXwDXJ5Fn2TCpNwTlKcaKLkdHop5c/icOFE7qt7Q9JC5hnKNa6Gg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/core": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/core/-/core-7.29.7.tgz",
      "integrity": "sha512-RgHBCvtjbOK2gXSNBNIkNoEc9qoVEtau3hj8gEqKQuL3HZAibKarWFEI3Lfm6EYKkLalOh8eSrj9b+ch9H/VBA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/code-frame": "^7.29.7",
        "@babel/generator": "^7.29.7",
        "@babel/helper-compilation-targets": "^7.29.7",
        "@babel/helper-module-transforms": "^7.29.7",
        "@babel/helpers": "^7.29.7",
        "@babel/parser": "^7.29.7",
        "@babel/template": "^7.29.7",
        "@babel/traverse": "^7.29.7",
        "@babel/types": "^7.29.7",
        "@jridgewell/remapping": "^2.3.5",
        "convert-source-map": "^2.0.0",
        "debug": "^4.1.0",
        "gensync": "^1.0.0-beta.2",
        "json5": "^2.2.3",
        "semver": "^6.3.1"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/babel"
      }
    },
    "node_modules/@babel/core/node_modules/semver": {
      "version": "6.3.1",
      "resolved": "https://registry.npmjs.org/semver/-/semver-6.3.1.tgz",
      "integrity": "sha512-BR7VvDCVHO+q2xBEWskxS6DJE1qRnb7DxzUrogb71CWoSficBxYsiAGd+Kl0mmq/MprG9yArRkyrQxTO6XjMzA==",
      "dev": true,
      "license": "ISC",
      "bin": {
        "semver": "bin/semver.js"
      }
    },
    "node_modules/@babel/generator": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.29.7.tgz",
      "integrity": "sha512-DkXD5OJQaAQIdZ1bt3UZdEnHAn9Imd3IVBdX03UFe+ony9Ojw5pzr9YVKGDY1jt+Gcn/FnGkNf8r+Vj5NOJWtQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/parser": "^7.29.7",
        "@babel/types": "^7.29.7",
        "@jridgewell/gen-mapping": "^0.3.12",
        "@jridgewell/trace-mapping": "^0.3.28",
        "jsesc": "^3.0.2"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-annotate-as-pure": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/helper-annotate-as-pure/-/helper-annotate-as-pure-7.29.7.tgz",
      "integrity": "sha512-OoK6239jHPuSQOoS0kfTVKn0b/rVTk0seKq4Gd2UMLtmOVLjDC0ki3e+c90Trqv2gMfvJFqkiljrr568+qddiw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/types": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-compilation-targets": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/helper-compilation-targets/-/helper-compilation-targets-7.29.7.tgz",
      "integrity": "sha512-wem6WaBj4NaVYVdNhLPPVacES6ZJ+KBBfSkTMD3YZxbP3rm3Di85tJU5ljaUNhaOynt+Aj0xruhYuzQBt8n71g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/compat-data": "^7.29.7",
        "@babel/helper-validator-option": "^7.29.7",
        "browserslist": "^4.24.0",
        "lru-cache": "^5.1.1",
        "semver": "^6.3.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-compilation-targets/node_modules/semver": {
      "version": "6.3.1",
      "resolved": "https://registry.npmjs.org/semver/-/semver-6.3.1.tgz",
      "integrity": "sha512-BR7VvDCVHO+q2xBEWskxS6DJE1qRnb7DxzUrogb71CWoSficBxYsiAGd+Kl0mmq/MprG9yArRkyrQxTO6XjMzA==",
      "dev": true,
      "license": "ISC",
      "bin": {
        "semver": "bin/semver.js"
      }
    },
    "node_modules/@babel/helper-create-class-features-plugin": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/helper-create-class-features-plugin/-/helper-create-class-features-plugin-7.29.7.tgz",
      "integrity": "sha512-IY3ZD9Tmooqr3TUhc3DUWxiuo8xx1DWLhd5M7hQ+ZWJamqM2BbalrBJb2MisSLoYorOj75U03qULCxQTY9r3hg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-annotate-as-pure": "^7.29.7",
        "@babel/helper-member-expression-to-functions": "^7.29.7",
        "@babel/helper-optimise-call-expression": "^7.29.7",
        "@babel/helper-replace-supers": "^7.29.7",
        "@babel/helper-skip-transparent-expression-wrappers": "^7.29.7",
        "@babel/traverse": "^7.29.7",
        "semver": "^6.3.1"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0"
      }
    },
    "node_modules/@babel/helper-create-class-features-plugin/node_modules/semver": {
      "version": "6.3.1",
      "resolved": "https://registry.npmjs.org/semver/-/semver-6.3.1.tgz",
      "integrity": "sha512-BR7VvDCVHO+q2xBEWskxS6DJE1qRnb7DxzUrogb71CWoSficBxYsiAGd+Kl0mmq/MprG9yArRkyrQxTO6XjMzA==",
      "dev": true,
      "license": "ISC",
      "bin": {
        "semver": "bin/semver.js"
      }
    },
    "node_modules/@babel/helper-create-regexp-features-plugin": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/helper-create-regexp-features-plugin/-/helper-create-regexp-features-plugin-7.29.7.tgz",
      "integrity": "sha512-907Uymvqgg1dwUA+7IGwFAOSYzQOuzPXKNJ1yxzwPffzkYFg2q2eHi1fIOs6sXkG9NbIUMunnUlkYsfRFNvomg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-annotate-as-pure": "^7.29.7",
        "regexpu-core": "^6.3.1",
        "semver": "^6.3.1"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0"
      }
    },
    "node_modules/@babel/helper-create-regexp-features-plugin/node_modules/semver": {
      "version": "6.3.1",
      "resolved": "https://registry.npmjs.org/semver/-/semver-6.3.1.tgz",
      "integrity": "sha512-BR7VvDCVHO+q2xBEWskxS6DJE1qRnb7DxzUrogb71CWoSficBxYsiAGd+Kl0mmq/MprG9yArRkyrQxTO6XjMzA==",
      "dev": true,
      "license": "ISC",
      "bin": {
        "semver": "bin/semver.js"
      }
    },
    "node_modules/@babel/helper-define-polyfill-provider": {
      "version": "0.6.8",
      "resolved": "https://registry.npmjs.org/@babel/helper-define-polyfill-provider/-/helper-define-polyfill-provider-0.6.8.tgz",
      "integrity": "sha512-47UwBLPpQi1NoWzLuHNjRoHlYXMwIJoBf7MFou6viC/sIHWYygpvr0B6IAyh5sBdA2nr2LPIRww8lfaUVQINBA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-compilation-targets": "^7.28.6",
        "@babel/helper-plugin-utils": "^7.28.6",
        "debug": "^4.4.3",
        "lodash.debounce": "^4.0.8",
        "resolve": "^1.22.11"
      },
      "peerDependencies": {
        "@babel/core": "^7.4.0 || ^8.0.0-0 <8.0.0"
      }
    },
    "node_modules/@babel/helper-globals": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/helper-globals/-/helper-globals-7.29.7.tgz",
      "integrity": "sha512-3nQVUAtvkKH9zahfWgw96Jc/uFOmjACE1kQz82E2lqWmHBgjzbNlsC22nuQTfahmWeQtTq5nQ/4Nnd2A1wj4zA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-member-expression-to-functions": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/helper-member-expression-to-functions/-/helper-member-expression-to-functions-7.29.7.tgz",
      "integrity": "sha512-j+7JYmk1JYDtACIGj0QJqqWZjoUpMoEikQGADMaHgCMCSDqd2+P32rfcibUNrGOMWrlzK1WJBdxrB3JJQZwWtg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/traverse": "^7.29.7",
        "@babel/types": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-module-imports": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/helper-module-imports/-/helper-module-imports-7.29.7.tgz",
      "integrity": "sha512-ejHwrQQYcm9xnTivShn2IDOlIzInN34AXskvq9QicvCtEzq1Vzclu/tKF8Jq1Cg8JG2GL6/EmjgsCT7lXepE3g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/traverse": "^7.29.7",
        "@babel/types": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-module-transforms": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/helper-module-transforms/-/helper-module-transforms-7.29.7.tgz",
      "integrity": "sha512-UPUVSyXbOh627KiCIGQSgwWzGeBKLkaJ9PJEdrngIwMSzxLR4jS4+f1f1jb7VzBbg8nFLaYotvVPFCTqdrmTAg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-module-imports": "^7.29.7",
        "@babel/helper-validator-identifier": "^7.29.7",
        "@babel/traverse": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0"
      }
    },
    "node_modules/@babel/helper-optimise-call-expression": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/helper-optimise-call-expression/-/helper-optimise-call-expression-7.29.7.tgz",
      "integrity": "sha512-+kmGVjcT9RGYzoDwdwEqEvGgKe3BYq+O1iGzjFubaNgZHwYHP6lsF2Yghf4kEuv9BV7tYDZ913aBW9am6YKong==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/types": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-plugin-utils": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/helper-plugin-utils/-/helper-plugin-utils-7.29.7.tgz",
      "integrity": "sha512-G7sHYigPY17oO5SYWnfD/0MTBwVR781S/JI643e/JhUYgVgWE/61SoW3NH9KWUKyKq5LVh3npif99Wkt6j86Jw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-remap-async-to-generator": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/helper-remap-async-to-generator/-/helper-remap-async-to-generator-7.29.7.tgz",
      "integrity": "sha512-16AMiW26DbXWBbr3B8wNozKM0ydMLB892vaOaJW/fPJdnT8vJk5sdkQcU/isqUxyCE0cEoa8wZOcbgDuC4b6Og==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-annotate-as-pure": "^7.29.7",
        "@babel/helper-wrap-function": "^7.29.7",
        "@babel/traverse": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0"
      }
    },
    "node_modules/@babel/helper-replace-supers": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/helper-replace-supers/-/helper-replace-supers-7.29.7.tgz",
      "integrity": "sha512-atfGXWSeCiF4DnKZIfmJfQRkSw9b9gNNXR1kqKjbhG4pGYCOnkp8OcTB8E3NXjBu8NpheSnOeNKz8KT7UNFTmQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-member-expression-to-functions": "^7.29.7",
        "@babel/helper-optimise-call-expression": "^7.29.7",
        "@babel/traverse": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0"
      }
    },
    "node_modules/@babel/helper-skip-transparent-expression-wrappers": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/helper-skip-transparent-expression-wrappers/-/helper-skip-transparent-expression-wrappers-7.29.7.tgz",
      "integrity": "sha512-brcMGQaVzIeUb+6/bs1Av0f8YuNNjKY2JyvfRCsFuFsdKccEQ5Ges2y74D74NZ1Rz8lKJ9ksJkfqwQFJ/iNEyQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/traverse": "^7.29.7",
        "@babel/types": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-string-parser": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/helper-string-parser/-/helper-string-parser-7.29.7.tgz",
      "integrity": "sha512-Pb5ijPrZ89GDH8223L4UP8i6QApWxs04RbPQJTeWDV0/keR2E36MeKnyr6LYmUUvqRRI+Iv87SuF1W6ErINzYw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-validator-identifier": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/helper-validator-identifier/-/helper-validator-identifier-7.29.7.tgz",
      "integrity": "sha512-qehxGkRj55h/ff8EMaJ+cYhyaKlHIxqYDn682wQD7RNp9UujOQsHog2uS0r2vzr4pW+sXf90NeeayjcNaX3fFg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-validator-option": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/helper-validator-option/-/helper-validator-option-7.29.7.tgz",
      "integrity": "sha512-N9ZErrD+yW5geCDtBqnOoxmR8+tNKiGuxKlDpuJxfsqpa2dFcexaziGAE/qoHLiDDreVNMupxGmSoNlyvsA3gw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helper-wrap-function": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/helper-wrap-function/-/helper-wrap-function-7.29.7.tgz",
      "integrity": "sha512-iES0Skag9ERIF68aXadpO6dbXa03mNWK3sEqJaMnLNs/eC3l0lkImdfoy6Y09/SfkpawdAB4RjQ7PVA7TcVGdw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/template": "^7.29.7",
        "@babel/traverse": "^7.29.7",
        "@babel/types": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/helpers": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/helpers/-/helpers-7.29.7.tgz",
      "integrity": "sha512-1k2lAGRMfHTcwuNYcCNUmaUffmQv8KWMfh2iJUUeRlwlwH4FdNG7mfPI10NPfLHJFThE4Tyr4mv7kTNZOiPuBg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/template": "^7.29.7",
        "@babel/types": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/parser": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/parser/-/parser-7.29.7.tgz",
      "integrity": "sha512-hnORnjP/1P/zFEndoeX+n+t1RwWRJiJpM/jO7FW32Kn9r5+sJB2JWOdYo4L6k78j15eCwY3Gm/7364B1EMwtNg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/types": "^7.29.7"
      },
      "bin": {
        "parser": "bin/babel-parser.js"
      },
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@babel/plugin-bugfix-firefox-class-in-computed-class-key": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-bugfix-firefox-class-in-computed-class-key/-/plugin-bugfix-firefox-class-in-computed-class-key-7.29.7.tgz",
      "integrity": "sha512-j8SrR0zLZrRsC09DlszEx8FpMiwukKffYXMK0d5LmOglO7vGG6sz/BR/20yHqWH+Lnn31JTt2PE3hIWNgM2J6w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7",
        "@babel/traverse": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0"
      }
    },
    "node_modules/@babel/plugin-bugfix-safari-id-destructuring-collision-in-function-expression": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-bugfix-safari-id-destructuring-collision-in-function-expression/-/plugin-bugfix-safari-id-destructuring-collision-in-function-expression-7.29.7.tgz",
      "integrity": "sha512-GE1TFSiuFeGsCxmYXZl8HwoPrVlwe4rHPFE8weieGKZqnDORK+Ar3vgWMgW+AOxQ6/2TgLSKx9p6W7O4rC6qgQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0"
      }
    },
    "node_modules/@babel/plugin-bugfix-v8-spread-parameters-in-optional-chaining": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-bugfix-v8-spread-parameters-in-optional-chaining/-/plugin-bugfix-v8-spread-parameters-in-optional-chaining-7.29.7.tgz",
      "integrity": "sha512-QQt9qKHZ2sg/kivaLr7lnQr8HVrQDdBNSfCsTjiDxRuX/K5ORyKq+Bu8Xr0cDE3Dfkv0cw28Ve0EKyKMvulkOw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7",
        "@babel/helper-skip-transparent-expression-wrappers": "^7.29.7",
        "@babel/plugin-transform-optional-chaining": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.13.0"
      }
    },
    "node_modules/@babel/plugin-bugfix-v8-static-class-fields-redefine-readonly": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-bugfix-v8-static-class-fields-redefine-readonly/-/plugin-bugfix-v8-static-class-fields-redefine-readonly-7.29.7.tgz",
      "integrity": "sha512-pn6QacGLgvCcwc+syUhKE/qSjV2D1IHDB84RNxWYSt1mW3K/SCtjinZ2p0cETJxAWBjPy3K/1lHwG5BjjPxNlw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7",
        "@babel/traverse": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0"
      }
    },
    "node_modules/@babel/plugin-proposal-private-property-in-object": {
      "version": "7.21.0-placeholder-for-preset-env.2",
      "resolved": "https://registry.npmjs.org/@babel/plugin-proposal-private-property-in-object/-/plugin-proposal-private-property-in-object-7.21.0-placeholder-for-preset-env.2.tgz",
      "integrity": "sha512-SOSkfJDddaM7mak6cPEpswyTRnuRltl429hMraQEglW+OkovnCzsiszTmsrlY//qLFjCpQDFRvjdm2wA5pPm9w==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-syntax-async-generators": {
      "version": "7.8.4",
      "resolved": "https://registry.npmjs.org/@babel/plugin-syntax-async-generators/-/plugin-syntax-async-generators-7.8.4.tgz",
      "integrity": "sha512-tycmZxkGfZaxhMRbXlPXuVFpdWlXpir2W4AMhSJgRKzk/eDlIXOhb2LHWoLpDF7TEHylV5zNhykX6KAgHJmTNw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.8.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-syntax-bigint": {
      "version": "7.8.3",
      "resolved": "https://registry.npmjs.org/@babel/plugin-syntax-bigint/-/plugin-syntax-bigint-7.8.3.tgz",
      "integrity": "sha512-wnTnFlG+YxQm3vDxpGE57Pj0srRU4sHE/mDkt1qv2YJJSeUAec2ma4WLUnUPeKjyrfntVwe/N6dCXpU+zL3Npg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.8.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-syntax-class-properties": {
      "version": "7.12.13",
      "resolved": "https://registry.npmjs.org/@babel/plugin-syntax-class-properties/-/plugin-syntax-class-properties-7.12.13.tgz",
      "integrity": "sha512-fm4idjKla0YahUNgFNLCB0qySdsoPiZP3iQE3rky0mBUtMZ23yDJ9SJdg6dXTSDnulOVqiF3Hgr9nbXvXTQZYA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.12.13"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-syntax-class-static-block": {
      "version": "7.14.5",
      "resolved": "https://registry.npmjs.org/@babel/plugin-syntax-class-static-block/-/plugin-syntax-class-static-block-7.14.5.tgz",
      "integrity": "sha512-b+YyPmr6ldyNnM6sqYeMWE+bgJcJpO6yS4QD7ymxgH34GBPNDM/THBh8iunyvKIZztiwLH4CJZ0RxTk9emgpjw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.14.5"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-syntax-dynamic-import": {
      "version": "7.8.3",
      "resolved": "https://registry.npmjs.org/@babel/plugin-syntax-dynamic-import/-/plugin-syntax-dynamic-import-7.8.3.tgz",
      "integrity": "sha512-5gdGbFon+PszYzqs83S3E5mpi7/y/8M9eC90MRTZfduQOYW76ig6SOSPNe41IG5LoP3FGBn2N0RjVDSQiS94kQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.8.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-syntax-export-namespace-from": {
      "version": "7.8.3",
      "resolved": "https://registry.npmjs.org/@babel/plugin-syntax-export-namespace-from/-/plugin-syntax-export-namespace-from-7.8.3.tgz",
      "integrity": "sha512-MXf5laXo6c1IbEbegDmzGPwGNTsHZmEy6QGznu5Sh2UCWvueywb2ee+CCE4zQiZstxU9BMoQO9i6zUFSY0Kj0Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.8.3"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-syntax-import-assertions": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-syntax-import-assertions/-/plugin-syntax-import-assertions-7.29.7.tgz",
      "integrity": "sha512-/An1OCBN93thpBAGyfsK2pcf0jvju1SAtKkL2Ny++B5Sy6sqgzXDQH1cZxWbF96Wuk+bn41MDA9bLd4VVAw6rw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-syntax-import-attributes": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-syntax-import-attributes/-/plugin-syntax-import-attributes-7.29.7.tgz",
      "integrity": "sha512-zGYcYfq/WmZ4V+kBIXQon9dSSc8ircGZqw9ZaNhhGj9nZkeBu1jHLBDQqYYi5WA9uawvA2sIMbry2nCFhf5Djg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-syntax-import-meta": {
      "version": "7.10.4",
      "resolved": "https://registry.npmjs.org/@babel/plugin-syntax-import-meta/-/plugin-syntax-import-meta-7.10.4.tgz",
      "integrity": "sha512-Yqfm+XDx0+Prh3VSeEQCPU81yC+JWZ2pDPFSS4ZdpfZhp4MkFMaDC1UqseovEKwSUpnIL7+vK+Clp7bfh0iD7g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.10.4"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-syntax-json-strings": {
      "version": "7.8.3",
      "resolved": "https://registry.npmjs.org/@babel/plugin-syntax-json-strings/-/plugin-syntax-json-strings-7.8.3.tgz",
      "integrity": "sha512-lY6kdGpWHvjoe2vk4WrAapEuBR69EMxZl+RoGRhrFGNYVK8mOPAW8VfbT/ZgrFbXlDNiiaxQnAtgVCZ6jv30EA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.8.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-syntax-jsx": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-syntax-jsx/-/plugin-syntax-jsx-7.29.7.tgz",
      "integrity": "sha512-TSu8+mHCoEaaCDEZ0I3+6mvTBYR4PCxQwf2z9/r5Tbztv6NaLR3B9thGTTxX2WGuGHJqRiAbKPeGTJ5XWXVg6A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-syntax-logical-assignment-operators": {
      "version": "7.10.4",
      "resolved": "https://registry.npmjs.org/@babel/plugin-syntax-logical-assignment-operators/-/plugin-syntax-logical-assignment-operators-7.10.4.tgz",
      "integrity": "sha512-d8waShlpFDinQ5MtvGU9xDAOzKH47+FFoney2baFIoMr952hKOLp1HR7VszoZvOsV/4+RRszNY7D17ba0te0ig==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.10.4"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-syntax-nullish-coalescing-operator": {
      "version": "7.8.3",
      "resolved": "https://registry.npmjs.org/@babel/plugin-syntax-nullish-coalescing-operator/-/plugin-syntax-nullish-coalescing-operator-7.8.3.tgz",
      "integrity": "sha512-aSff4zPII1u2QD7y+F8oDsz19ew4IGEJg9SVW+bqwpwtfFleiQDMdzA/R+UlWDzfnHFCxxleFT0PMIrR36XLNQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.8.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-syntax-numeric-separator": {
      "version": "7.10.4",
      "resolved": "https://registry.npmjs.org/@babel/plugin-syntax-numeric-separator/-/plugin-syntax-numeric-separator-7.10.4.tgz",
      "integrity": "sha512-9H6YdfkcK/uOnY/K7/aA2xpzaAgkQn37yzWUMRK7OaPOqOpGS1+n0H5hxT9AUw9EsSjPW8SVyMJwYRtWs3X3ug==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.10.4"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-syntax-object-rest-spread": {
      "version": "7.8.3",
      "resolved": "https://registry.npmjs.org/@babel/plugin-syntax-object-rest-spread/-/plugin-syntax-object-rest-spread-7.8.3.tgz",
      "integrity": "sha512-XoqMijGZb9y3y2XskN+P1wUGiVwWZ5JmoDRwx5+3GmEplNyVM2s2Dg8ILFQm8rWM48orGy5YpI5Bl8U1y7ydlA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.8.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-syntax-optional-catch-binding": {
      "version": "7.8.3",
      "resolved": "https://registry.npmjs.org/@babel/plugin-syntax-optional-catch-binding/-/plugin-syntax-optional-catch-binding-7.8.3.tgz",
      "integrity": "sha512-6VPD0Pc1lpTqw0aKoeRTMiB+kWhAoT24PA+ksWSBrFtl5SIRVpZlwN3NNPQjehA2E/91FV3RjLWoVTglWcSV3Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.8.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-syntax-optional-chaining": {
      "version": "7.8.3",
      "resolved": "https://registry.npmjs.org/@babel/plugin-syntax-optional-chaining/-/plugin-syntax-optional-chaining-7.8.3.tgz",
      "integrity": "sha512-KoK9ErH1MBlCPxV0VANkXW2/dw4vlbGDrFgz8bmUsBGYkFRcbRwMh6cIJubdPrkxRwuGdtCk0v/wPTKbQgBjkg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.8.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-syntax-private-property-in-object": {
      "version": "7.14.5",
      "resolved": "https://registry.npmjs.org/@babel/plugin-syntax-private-property-in-object/-/plugin-syntax-private-property-in-object-7.14.5.tgz",
      "integrity": "sha512-0wVnp9dxJ72ZUJDV27ZfbSj6iHLoytYZmh3rFcxNnvsJF3ktkzLDZPy/mA17HGsaQT3/DQsWYX1f1QGWkCoVUg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.14.5"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-syntax-top-level-await": {
      "version": "7.14.5",
      "resolved": "https://registry.npmjs.org/@babel/plugin-syntax-top-level-await/-/plugin-syntax-top-level-await-7.14.5.tgz",
      "integrity": "sha512-hx++upLv5U1rgYfwe1xBQUhRmU41NEvpUvrp8jkrSCdvGSnM5/qdRMtylJ6PG5OFkBaHkbTAKTnd3/YyESRHFw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.14.5"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-syntax-typescript": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-syntax-typescript/-/plugin-syntax-typescript-7.29.7.tgz",
      "integrity": "sha512-ngr+82Sh0xMz25TPCZi+nC2iTzjfCdWS2ONXTp/PtSCHCgaCNBpdMqgvJ2ccdLlClVZ7sisIgB914j/JFe+RZA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-syntax-unicode-sets-regex": {
      "version": "7.18.6",
      "resolved": "https://registry.npmjs.org/@babel/plugin-syntax-unicode-sets-regex/-/plugin-syntax-unicode-sets-regex-7.18.6.tgz",
      "integrity": "sha512-727YkEAPwSIQTv5im8QHz3upqp92JTWhidIC81Tdx4VJYIte/VndKf1qKrfnnhPLiPghStWfvC/iFaMCQu7Nqg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-create-regexp-features-plugin": "^7.18.6",
        "@babel/helper-plugin-utils": "^7.18.6"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0"
      }
    },
    "node_modules/@babel/plugin-transform-arrow-functions": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-arrow-functions/-/plugin-transform-arrow-functions-7.29.7.tgz",
      "integrity": "sha512-N7zArUXWzAMzm+/N0uPBeVB3Fam5lMxtUwMmDK5f/IBBS7a7p1qeUoxd/6CckXoxUdgsntq1Dh8xNW06maZbDQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-async-generator-functions": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-async-generator-functions/-/plugin-transform-async-generator-functions-7.29.7.tgz",
      "integrity": "sha512-d98gXZkgswvkyohMBABkhm3GeXhYj8psWfwQ2C7gtfrKGTykQa/iOIi+JJhwMjPlZ6Vm2XN+DCf3Es1EoG4ZLA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7",
        "@babel/helper-remap-async-to-generator": "^7.29.7",
        "@babel/traverse": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-async-to-generator": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-async-to-generator/-/plugin-transform-async-to-generator-7.29.7.tgz",
      "integrity": "sha512-pcUb2SS+RMo9TWVBwKGI5ShtoG7R+zBsFmCKDa6fe8c+hPr3XJlZgoE5j6i8W7gDjhyvy+85vmYexanvXh3d1w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-module-imports": "^7.29.7",
        "@babel/helper-plugin-utils": "^7.29.7",
        "@babel/helper-remap-async-to-generator": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-block-scoped-functions": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-block-scoped-functions/-/plugin-transform-block-scoped-functions-7.29.7.tgz",
      "integrity": "sha512-cUSmjh72N+rN4PrkFlN1dJwNCwjVp5d38/CQrEsFggkD10UiFlBFgdH3tv5dNsLuHY+3S8db2xCHjhZcv5WgvA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-block-scoping": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-block-scoping/-/plugin-transform-block-scoping-7.29.7.tgz",
      "integrity": "sha512-ONyr4+AZhKh8yKWInVxU9AXA9EbsyeLcL6V0dJy6M2/62vuvpGm29zzuymbTpdc451GEpDIdAyPLP3r+P61yKQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-class-properties": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-class-properties/-/plugin-transform-class-properties-7.29.7.tgz",
      "integrity": "sha512-GtcpjFvanPfzNQi3eTitsCqtRRmmqzpy/A+yhTR1HaZo1Ly3EA8ZXxlPyHdR8/IuRMYc3E4wdGBewB2QKQjAaA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-create-class-features-plugin": "^7.29.7",
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-class-static-block": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-class-static-block/-/plugin-transform-class-static-block-7.29.7.tgz",
      "integrity": "sha512-kibJgmEdX2iMwsHY2tSZNDgj8PwIlCQz7FK9KuGKO8zsuoUwSEhoNnNVp/emKWrbY4HeO6kkXfdMqRKKKXBm2A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-create-class-features-plugin": "^7.29.7",
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.12.0"
      }
    },
    "node_modules/@babel/plugin-transform-classes": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-classes/-/plugin-transform-classes-7.29.7.tgz",
      "integrity": "sha512-qV0OGGBVacduzQHE649JyCneOFI/maT+YKsO+K4Yi3xv2wTPNjM/W2o2gdzMwEAZz7fXNTHAe0NcSg30bIN69g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-annotate-as-pure": "^7.29.7",
        "@babel/helper-compilation-targets": "^7.29.7",
        "@babel/helper-globals": "^7.29.7",
        "@babel/helper-plugin-utils": "^7.29.7",
        "@babel/helper-replace-supers": "^7.29.7",
        "@babel/traverse": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-computed-properties": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-computed-properties/-/plugin-transform-computed-properties-7.29.7.tgz",
      "integrity": "sha512-RK7/IyU5phpuCdBAuig5VkzG/EnbDaui5SQGdU9BFrHdV+mV4cUjLMQ9lJDjLNtWHsqtiefpGZUXQP2BiTYMsA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7",
        "@babel/template": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-destructuring": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-destructuring/-/plugin-transform-destructuring-7.29.7.tgz",
      "integrity": "sha512-iPX8aD6H9zV5s7ZsqTdNocPN/MGQ5sSMnElKrktxjJRMnB2jN/1p2+R7GkfD6CAYoVFqy5A4XnSIUeGgJzIWpg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7",
        "@babel/traverse": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-dotall-regex": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-dotall-regex/-/plugin-transform-dotall-regex-7.29.7.tgz",
      "integrity": "sha512-3qc18hsD2RdZiyJNDNc7HQpv6xbncwh8FYtxNFFzclSyh/trPD9KkVR9BDECUjDLvb7yJVF15GfYUuC+LMkkiQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-create-regexp-features-plugin": "^7.29.7",
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-duplicate-keys": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-duplicate-keys/-/plugin-transform-duplicate-keys-7.29.7.tgz",
      "integrity": "sha512-6IvRRriEMqnBwD6chtxdLpMYCHWEzN+oL5cyQtjykya19UgzbmKhxmhZgKC/LHxS2nYr9Q/qYPZ5Lr6jOL9+yQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-dynamic-import": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-dynamic-import/-/plugin-transform-dynamic-import-7.29.7.tgz",
      "integrity": "sha512-giOlEm/EFjfjr+te9NsdjkUo2v4f8rS/SXPumRVHAtbNcyNlvtREkU1dZzaIDclNpnaVhlCqRdFKhJBjBikzLg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-exponentiation-operator": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-exponentiation-operator/-/plugin-transform-exponentiation-operator-7.29.7.tgz",
      "integrity": "sha512-zFpMOTLZBdW5LfObqcSbL6kefg4R4eLdmvS0wbN9M6D5Mym/sKm9toOoWyVOa+xDjvCnuWcHls2YonXwHvH3CQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-export-namespace-from": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-export-namespace-from/-/plugin-transform-export-namespace-from-7.29.7.tgz",
      "integrity": "sha512-24B2nOy2TeJSMheqwPD4DDQOV/elLSIlKxjZt4i05H5AgdPdWR3n18HnNrcJ+j76WJd9gbwb9jPjNYUy6RautA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-for-of": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-for-of/-/plugin-transform-for-of-7.29.7.tgz",
      "integrity": "sha512-zeSIHh0+E1Um1WJRXCFlHQYu2ieJNdivLLjlBEp+dIBu3S51n+SZZmIXjxnItw6pz56Cn+KvK68BIBVsxq2JiQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7",
        "@babel/helper-skip-transparent-expression-wrappers": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-function-name": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-function-name/-/plugin-transform-function-name-7.29.7.tgz",
      "integrity": "sha512-otRWaHXE6fbAGkePvaj/kvs3HsqXfPhlnzwSOlnFgbqCPMd975dW+4wZ00WFBt+/YlBGcJwNrARQTOJOb4ZrIg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-compilation-targets": "^7.29.7",
        "@babel/helper-plugin-utils": "^7.29.7",
        "@babel/traverse": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-json-strings": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-json-strings/-/plugin-transform-json-strings-7.29.7.tgz",
      "integrity": "sha512-RRnE2+eon1rJAq8MnoF1b5kTpY1vU88twHcvcKMrsqP/jxIRqDVs9iJB5fqPuqyeFAW0wJo4MlUIPpQCq/aRsg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-literals": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-literals/-/plugin-transform-literals-7.29.7.tgz",
      "integrity": "sha512-DZ/oLP21ZuWx1vKqnoNv6/tvEK48AQOBRai40CX9dTjGluvT/YZCyY3rryDtyUqCEoyNroy5KKPwX2iQCiRvyw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-logical-assignment-operators": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-logical-assignment-operators/-/plugin-transform-logical-assignment-operators-7.29.7.tgz",
      "integrity": "sha512-A0H91hh6W8MFRkp5TqJmMr39jzGD1A1E1Ysiv2O06Sfbhkapm+XyIzxWCEh5kqwOZ1/8QZ0dY3SeQ7XBqfJd5Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-member-expression-literals": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-member-expression-literals/-/plugin-transform-member-expression-literals-7.29.7.tgz",
      "integrity": "sha512-hl1kwFZCCiDyfH25Xmco9jTrkPgnS9pmOzSG7W5I4SaGbLeqKv417hcU2RKmaxoPEgsoJh7ZPOrnPGq99bHoUg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-modules-amd": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-modules-amd/-/plugin-transform-modules-amd-7.29.7.tgz",
      "integrity": "sha512-fxtQoH3m5ywUSIfaH0FGCzWu4McsYon5bD3K4XnskC7f+OyQMj7rsOMi4NvvmJ83WwBAg4UCe+ov4VZlqEvyew==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-module-transforms": "^7.29.7",
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-modules-commonjs": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-modules-commonjs/-/plugin-transform-modules-commonjs-7.29.7.tgz",
      "integrity": "sha512-j0vCldybPC5b5dwCQOJ21uKtHzt7hxLygJTg9eF1ScfaikEDNfzn94XoW5Fi+seBR0nCyL23xaBFFkq7dTM8XQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-module-transforms": "^7.29.7",
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-modules-systemjs": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-modules-systemjs/-/plugin-transform-modules-systemjs-7.29.7.tgz",
      "integrity": "sha512-TM2ZcQLoG2/y4HODiStCo10DibYhWhGWAwVv+EQKmG/7GFl0N+AAmUiXOMKM+aiJ9XBJ9AHVZBvTzMnJ2sM3cQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-module-transforms": "^7.29.7",
        "@babel/helper-plugin-utils": "^7.29.7",
        "@babel/helper-validator-identifier": "^7.29.7",
        "@babel/traverse": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-modules-umd": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-modules-umd/-/plugin-transform-modules-umd-7.29.7.tgz",
      "integrity": "sha512-B4UkaTK3QpgCwJnrxKfMPKdo92CN7OKXAlpAAnM3UPu0Q0lCCk57ylA9AJbRy2v8dDKOPAAWcoR6CMyeoHwRCA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-module-transforms": "^7.29.7",
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-named-capturing-groups-regex": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-named-capturing-groups-regex/-/plugin-transform-named-capturing-groups-regex-7.29.7.tgz",
      "integrity": "sha512-vuFoLwr4qnv2xbZ16SQd6uPcH5FNrLHhk/Jzo++0XJFcaDsr4gjJVg6j398oMHiC+83k/GiBzviwF5KBJkPUtQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-create-regexp-features-plugin": "^7.29.7",
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0"
      }
    },
    "node_modules/@babel/plugin-transform-new-target": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-new-target/-/plugin-transform-new-target-7.29.7.tgz",
      "integrity": "sha512-fEo41GmsOUhOBlw8ioo6zvjX5Xc2Lqkzlyfqbpsk3eB6TReV18uhxZ0esfEokVbY2+PVJAQHNKxER6lGrzNd3A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-nullish-coalescing-operator": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-nullish-coalescing-operator/-/plugin-transform-nullish-coalescing-operator-7.29.7.tgz",
      "integrity": "sha512-idmp1dFaekP9GbcMvG24Kvw2BfhFZjHnNJCkV4WuIY4PskJzwI3f1N5OdgYke38T7rftO6ERulFRn2cFeZwRkg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-numeric-separator": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-numeric-separator/-/plugin-transform-numeric-separator-7.29.7.tgz",
      "integrity": "sha512-zR7fv/z14OjgHl4AgRtkDBvBMhIzCxqV/qN/2BCRC7LjFwvuzjYe7gDWxC4Wl/SNsLM6SE1IWvRPYMgSJaUvNw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-object-rest-spread": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-object-rest-spread/-/plugin-transform-object-rest-spread-7.29.7.tgz",
      "integrity": "sha512-Ld98jn4c0smUywL57m7SgsHq3OpThOa6LqZJif3G6jYOovPleoFhVrBJ1WegRApSFB2wu4+RelAj9AC9G08Z4A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-compilation-targets": "^7.29.7",
        "@babel/helper-plugin-utils": "^7.29.7",
        "@babel/plugin-transform-destructuring": "^7.29.7",
        "@babel/plugin-transform-parameters": "^7.29.7",
        "@babel/traverse": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-object-super": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-object-super/-/plugin-transform-object-super-7.29.7.tgz",
      "integrity": "sha512-Ea/diGcw0twB5IlZPO5sgET6fJsLJqPABqTuFWIR+iMPGPZJkATEIWx0wa+aEQ5UY1CBQyP/gkAiLEqn1vBiQA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7",
        "@babel/helper-replace-supers": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-optional-catch-binding": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-optional-catch-binding/-/plugin-transform-optional-catch-binding-7.29.7.tgz",
      "integrity": "sha512-sLsyndxK2VwX6yNUOakMb7Sh553ZTe/vVM1XJ+9Z5aW1ytsc8xOIwmyk05NNjN60vkc5/KqoTH6hB4V41LJhng==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-optional-chaining": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-optional-chaining/-/plugin-transform-optional-chaining-7.29.7.tgz",
      "integrity": "sha512-6GM1dhvK3gNODkXcEcMCOLEDCLSoZ/sBbro2Ax8HURyasQ4NshagQixkRFdh5niI6E4gmA/jYI/4aT7rRos3ZQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7",
        "@babel/helper-skip-transparent-expression-wrappers": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-parameters": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-parameters/-/plugin-transform-parameters-7.29.7.tgz",
      "integrity": "sha512-ZDOBqV/qLYJI0YElr8DcENEyARsFQeESqWXH6gZlghYXuPPjvweuDhP4VyEi4BlUBlLRFZVjxoZDMjxhLW766g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-private-methods": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-private-methods/-/plugin-transform-private-methods-7.29.7.tgz",
      "integrity": "sha512-/6Rz4DK1ETDEM/bWHsPHcaEe7ZaT1EqSXjtSP/L0DijOYuaUhiRiOKcwpZ8P7zR4xXEHc2ITdiCgBm9Tpyv9ug==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-create-class-features-plugin": "^7.29.7",
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-private-property-in-object": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-private-property-in-object/-/plugin-transform-private-property-in-object-7.29.7.tgz",
      "integrity": "sha512-+BNo06dnrzdNNqCm1X6YUaVv0DKk8Q+JYcoZfOkLhYWNCXzlwTSRq8zGWayT1csjcpNXV9CQTBRRbmTLZac5cA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-annotate-as-pure": "^7.29.7",
        "@babel/helper-create-class-features-plugin": "^7.29.7",
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-property-literals": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-property-literals/-/plugin-transform-property-literals-7.29.7.tgz",
      "integrity": "sha512-bOMRLQuI0A5ZqHq3OWJ89/rXpJ/NJrbVhXiP4zwPGMs6kpcVsuTUNjwoE30K0Qm3mf48a/TnRYYD6vPNqcg6jA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-regenerator": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-regenerator/-/plugin-transform-regenerator-7.29.7.tgz",
      "integrity": "sha512-rNNFV0DBAJp988xW2DOntfDoYn1eR8GGF5AT5vYc+rjyfaQkM242c9tZUHHPe7KYaiJizXPWhQTzzdbXySyhBw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-reserved-words": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-reserved-words/-/plugin-transform-reserved-words-7.29.7.tgz",
      "integrity": "sha512-5+YhdpVgmfSmwZyLMftfaiffLRMHjzIRHFHHLdibcSyJm2pasMrKHrO3Ptrt2DRshjvpgjEJJ1zVW14WPq/6QA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-shorthand-properties": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-shorthand-properties/-/plugin-transform-shorthand-properties-7.29.7.tgz",
      "integrity": "sha512-I+WYbGBAiCn7nA6xBrlgPH+MB7HWb4u8pv5S0Pv7OtwNvIFvCCb24YlttKEeUFVurfBCEaOTnuhlqsb7f0Z5Dg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-spread": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-spread/-/plugin-transform-spread-7.29.7.tgz",
      "integrity": "sha512-/u5K1QWada7tbYNqTjMh96718g9NTwh9tfPJMsSmVsQwGT447FskV+KcfeXkXq2GWki4EM/MuTdmBec+hOuVTQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7",
        "@babel/helper-skip-transparent-expression-wrappers": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-sticky-regex": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-sticky-regex/-/plugin-transform-sticky-regex-7.29.7.tgz",
      "integrity": "sha512-BCHzNYJGe9l7EpwwDBN/ztlL2NYFFq8hp9ddjtUEM9f2O7S7kKV/lL6Fwo7IF7NSkYhPK2vO+86nIGltA90MsA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-template-literals": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-template-literals/-/plugin-transform-template-literals-7.29.7.tgz",
      "integrity": "sha512-NCSEJ4sLFU2gqAub45HYh4fus2yQ36rr6ei6vpU7NdoJqCpxvEG8E6eJpscGyXP3VHD2Ny+fSXr04k1hoUrFqA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-typeof-symbol": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-typeof-symbol/-/plugin-transform-typeof-symbol-7.29.7.tgz",
      "integrity": "sha512-223mNGoTkBiTEWFoK+Q6Go3tueMRclO8vxxxxquNCYuNI4jWOofFKJRRDu6SDrB8Sgo1UEGW9T4GAQ8ZyRso1A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-unicode-escapes": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-unicode-escapes/-/plugin-transform-unicode-escapes-7.29.7.tgz",
      "integrity": "sha512-jCfXxSjf94lf4E0hKE0AByxF6F3/pVFqRdUUNkDJhsY0m1ZKjnN6ZYyMeHNpzflxb/0q5b7t3p+BE+SLF1WOtA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-unicode-property-regex": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-unicode-property-regex/-/plugin-transform-unicode-property-regex-7.29.7.tgz",
      "integrity": "sha512-OgZ+zoAJgZLUCunsTRQ5LAjOywDv5zzZ2/hQ5aMw1pGXyY2rtE8/chXYUmu3AlVHKpm10KEdG9aMwbI/K76ZGw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-create-regexp-features-plugin": "^7.29.7",
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-unicode-regex": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-unicode-regex/-/plugin-transform-unicode-regex-7.29.7.tgz",
      "integrity": "sha512-7D/x/23/d/3VqZ0QA+LGbZMlGwZjztBygSWWWsfTPoQ1oQ6Q1P6Mr3d0kk42XabyUVw+fha3LqdRsFqeKqvCyA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-create-regexp-features-plugin": "^7.29.7",
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/plugin-transform-unicode-sets-regex": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/plugin-transform-unicode-sets-regex/-/plugin-transform-unicode-sets-regex-7.29.7.tgz",
      "integrity": "sha512-BLOhLht9DOJwIxlmp91wHvkXv1lguuHS3/FwUO8HL1H0u8s4hR1gASVFyilu9iGtcTRYqjTZmlsFFeQletntEg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-create-regexp-features-plugin": "^7.29.7",
        "@babel/helper-plugin-utils": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0"
      }
    },
    "node_modules/@babel/preset-env": {
      "version": "7.24.7",
      "resolved": "https://registry.npmjs.org/@babel/preset-env/-/preset-env-7.24.7.tgz",
      "integrity": "sha512-1YZNsc+y6cTvWlDHidMBsQZrZfEFjRIo/BZCT906PMdzOyXtSLTgqGdrpcuTDCXyd11Am5uQULtDIcCfnTc8fQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/compat-data": "^7.24.7",
        "@babel/helper-compilation-targets": "^7.24.7",
        "@babel/helper-plugin-utils": "^7.24.7",
        "@babel/helper-validator-option": "^7.24.7",
        "@babel/plugin-bugfix-firefox-class-in-computed-class-key": "^7.24.7",
        "@babel/plugin-bugfix-safari-id-destructuring-collision-in-function-expression": "^7.24.7",
        "@babel/plugin-bugfix-v8-spread-parameters-in-optional-chaining": "^7.24.7",
        "@babel/plugin-bugfix-v8-static-class-fields-redefine-readonly": "^7.24.7",
        "@babel/plugin-proposal-private-property-in-object": "7.21.0-placeholder-for-preset-env.2",
        "@babel/plugin-syntax-async-generators": "^7.8.4",
        "@babel/plugin-syntax-class-properties": "^7.12.13",
        "@babel/plugin-syntax-class-static-block": "^7.14.5",
        "@babel/plugin-syntax-dynamic-import": "^7.8.3",
        "@babel/plugin-syntax-export-namespace-from": "^7.8.3",
        "@babel/plugin-syntax-import-assertions": "^7.24.7",
        "@babel/plugin-syntax-import-attributes": "^7.24.7",
        "@babel/plugin-syntax-import-meta": "^7.10.4",
        "@babel/plugin-syntax-json-strings": "^7.8.3",
        "@babel/plugin-syntax-logical-assignment-operators": "^7.10.4",
        "@babel/plugin-syntax-nullish-coalescing-operator": "^7.8.3",
        "@babel/plugin-syntax-numeric-separator": "^7.10.4",
        "@babel/plugin-syntax-object-rest-spread": "^7.8.3",
        "@babel/plugin-syntax-optional-catch-binding": "^7.8.3",
        "@babel/plugin-syntax-optional-chaining": "^7.8.3",
        "@babel/plugin-syntax-private-property-in-object": "^7.14.5",
        "@babel/plugin-syntax-top-level-await": "^7.14.5",
        "@babel/plugin-syntax-unicode-sets-regex": "^7.18.6",
        "@babel/plugin-transform-arrow-functions": "^7.24.7",
        "@babel/plugin-transform-async-generator-functions": "^7.24.7",
        "@babel/plugin-transform-async-to-generator": "^7.24.7",
        "@babel/plugin-transform-block-scoped-functions": "^7.24.7",
        "@babel/plugin-transform-block-scoping": "^7.24.7",
        "@babel/plugin-transform-class-properties": "^7.24.7",
        "@babel/plugin-transform-class-static-block": "^7.24.7",
        "@babel/plugin-transform-classes": "^7.24.7",
        "@babel/plugin-transform-computed-properties": "^7.24.7",
        "@babel/plugin-transform-destructuring": "^7.24.7",
        "@babel/plugin-transform-dotall-regex": "^7.24.7",
        "@babel/plugin-transform-duplicate-keys": "^7.24.7",
        "@babel/plugin-transform-dynamic-import": "^7.24.7",
        "@babel/plugin-transform-exponentiation-operator": "^7.24.7",
        "@babel/plugin-transform-export-namespace-from": "^7.24.7",
        "@babel/plugin-transform-for-of": "^7.24.7",
        "@babel/plugin-transform-function-name": "^7.24.7",
        "@babel/plugin-transform-json-strings": "^7.24.7",
        "@babel/plugin-transform-literals": "^7.24.7",
        "@babel/plugin-transform-logical-assignment-operators": "^7.24.7",
        "@babel/plugin-transform-member-expression-literals": "^7.24.7",
        "@babel/plugin-transform-modules-amd": "^7.24.7",
        "@babel/plugin-transform-modules-commonjs": "^7.24.7",
        "@babel/plugin-transform-modules-systemjs": "^7.24.7",
        "@babel/plugin-transform-modules-umd": "^7.24.7",
        "@babel/plugin-transform-named-capturing-groups-regex": "^7.24.7",
        "@babel/plugin-transform-new-target": "^7.24.7",
        "@babel/plugin-transform-nullish-coalescing-operator": "^7.24.7",
        "@babel/plugin-transform-numeric-separator": "^7.24.7",
        "@babel/plugin-transform-object-rest-spread": "^7.24.7",
        "@babel/plugin-transform-object-super": "^7.24.7",
        "@babel/plugin-transform-optional-catch-binding": "^7.24.7",
        "@babel/plugin-transform-optional-chaining": "^7.24.7",
        "@babel/plugin-transform-parameters": "^7.24.7",
        "@babel/plugin-transform-private-methods": "^7.24.7",
        "@babel/plugin-transform-private-property-in-object": "^7.24.7",
        "@babel/plugin-transform-property-literals": "^7.24.7",
        "@babel/plugin-transform-regenerator": "^7.24.7",
        "@babel/plugin-transform-reserved-words": "^7.24.7",
        "@babel/plugin-transform-shorthand-properties": "^7.24.7",
        "@babel/plugin-transform-spread": "^7.24.7",
        "@babel/plugin-transform-sticky-regex": "^7.24.7",
        "@babel/plugin-transform-template-literals": "^7.24.7",
        "@babel/plugin-transform-typeof-symbol": "^7.24.7",
        "@babel/plugin-transform-unicode-escapes": "^7.24.7",
        "@babel/plugin-transform-unicode-property-regex": "^7.24.7",
        "@babel/plugin-transform-unicode-regex": "^7.24.7",
        "@babel/plugin-transform-unicode-sets-regex": "^7.24.7",
        "@babel/preset-modules": "0.1.6-no-external-plugins",
        "babel-plugin-polyfill-corejs2": "^0.4.10",
        "babel-plugin-polyfill-corejs3": "^0.10.4",
        "babel-plugin-polyfill-regenerator": "^0.6.1",
        "core-js-compat": "^3.31.0",
        "semver": "^6.3.1"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0"
      }
    },
    "node_modules/@babel/preset-env/node_modules/semver": {
      "version": "6.3.1",
      "resolved": "https://registry.npmjs.org/semver/-/semver-6.3.1.tgz",
      "integrity": "sha512-BR7VvDCVHO+q2xBEWskxS6DJE1qRnb7DxzUrogb71CWoSficBxYsiAGd+Kl0mmq/MprG9yArRkyrQxTO6XjMzA==",
      "dev": true,
      "license": "ISC",
      "bin": {
        "semver": "bin/semver.js"
      }
    },
    "node_modules/@babel/preset-modules": {
      "version": "0.1.6-no-external-plugins",
      "resolved": "https://registry.npmjs.org/@babel/preset-modules/-/preset-modules-0.1.6-no-external-plugins.tgz",
      "integrity": "sha512-HrcgcIESLm9aIR842yhJ5RWan/gebQUJ6E/E5+rf0y9o6oj7w0Br+sWuL6kEQ/o/AdfvR1Je9jG18/gnpwjEyA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.0.0",
        "@babel/types": "^7.4.4",
        "esutils": "^2.0.2"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0-0 || ^8.0.0-0 <8.0.0"
      }
    },
    "node_modules/@babel/template": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/template/-/template-7.29.7.tgz",
      "integrity": "sha512-puq+Gf35oI24FeN11LkoUQFqv9uwNeWpxXZi/Ji3rRIoKAzKnxRaZ+Gkj0vKS9ZCiTESfng1N9LyOyXvo+m+Gg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/code-frame": "^7.29.7",
        "@babel/parser": "^7.29.7",
        "@babel/types": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/traverse": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/traverse/-/traverse-7.29.7.tgz",
      "integrity": "sha512-EhlfNQtZ+NK22w5BM61ciuiq1m58ed33Wr1Xan//ZRTy6hgjnwyCffRYwzsGXdASJSUJ1guZILsErh1eQcl+zw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/code-frame": "^7.29.7",
        "@babel/generator": "^7.29.7",
        "@babel/helper-globals": "^7.29.7",
        "@babel/parser": "^7.29.7",
        "@babel/template": "^7.29.7",
        "@babel/types": "^7.29.7",
        "debug": "^4.3.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/types": {
      "version": "7.29.7",
      "resolved": "https://registry.npmjs.org/@babel/types/-/types-7.29.7.tgz",
      "integrity": "sha512-4zBIxpPzowiZpusoFkyGVwakdRJUyuH5PxQ/PrqghfdFWWasvnCdPfQXHrenDai+gyLARulZjZowCOj6fjT4pA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-string-parser": "^7.29.7",
        "@babel/helper-validator-identifier": "^7.29.7"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@bcoe/v8-coverage": {
      "version": "0.2.3",
      "resolved": "https://registry.npmjs.org/@bcoe/v8-coverage/-/v8-coverage-0.2.3.tgz",
      "integrity": "sha512-0hYQ8SB4Db5zvZB4axdMHGwEaQjkZzFjQiN9LVYvIFB2nSUHW9tYpxWriPrWDASIxiaXax83REcLxuSdnGPZtw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@epic-web/invariant": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/@epic-web/invariant/-/invariant-1.0.0.tgz",
      "integrity": "sha512-lrTPqgvfFQtR/eY/qkIzp98OGdNJu0m5ji3q/nJI8v3SXkRKEnWiOxMmbvcSoAIzv/cGiuvRy57k4suKQSAdwA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@isaacs/cliui": {
      "version": "8.0.2",
      "resolved": "https://registry.npmjs.org/@isaacs/cliui/-/cliui-8.0.2.tgz",
      "integrity": "sha512-O8jcjabXaleOG9DQ0+ARXWZBTfnP4WNAqzuiJK7ll44AmxGKv/J2M4TPjxjY3znBCfvBXFzucm1twdyFybFqEA==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "string-width": "^5.1.2",
        "string-width-cjs": "npm:string-width@^4.2.0",
        "strip-ansi": "^7.0.1",
        "strip-ansi-cjs": "npm:strip-ansi@^6.0.1",
        "wrap-ansi": "^8.1.0",
        "wrap-ansi-cjs": "npm:wrap-ansi@^7.0.0"
      },
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/@istanbuljs/load-nyc-config": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/@istanbuljs/load-nyc-config/-/load-nyc-config-1.1.0.tgz",
      "integrity": "sha512-VjeHSlIzpv/NyD3N0YuHfXOPDIixcA1q2ZV98wsMqcYlPmv2n3Yb2lYP9XMElnaFVXg5A7YLTeLu6V84uQDjmQ==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "camelcase": "^5.3.1",
        "find-up": "^4.1.0",
        "get-package-type": "^0.1.0",
        "js-yaml": "^3.13.1",
        "resolve-from": "^5.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/@istanbuljs/schema": {
      "version": "0.1.6",
      "resolved": "https://registry.npmjs.org/@istanbuljs/schema/-/schema-0.1.6.tgz",
      "integrity": "sha512-+Sg6GCR/wy1oSmQDFq4LQDAhm3ETKnorxN+y5nbLULOR3P0c14f2Wurzj3/xqPXtasLFfHd5iRFQ7AJt4KH2cw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/@jest/console": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/@jest/console/-/console-30.4.1.tgz",
      "integrity": "sha512-v3bhyxUh9Hgmo5p6hAOXe14/R3ZxZDOsvHleh4B07z3m/x4/ngPUXEm9XwK4sF4u+f+P2ORb0Ge+MgpaqRMVDA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/types": "30.4.1",
        "@types/node": "*",
        "chalk": "^4.1.2",
        "jest-message-util": "30.4.1",
        "jest-util": "30.4.1",
        "slash": "^3.0.0"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/@jest/core": {
      "version": "30.4.2",
      "resolved": "https://registry.npmjs.org/@jest/core/-/core-30.4.2.tgz",
      "integrity": "sha512-TZJA6cPJUFxoWhxaLo8t0VX/MZX2wPWr0uIDvLSHIvN4gu9h02vSzqI2kBADG1ExqQlC+cY09xKMSreivvrChQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/console": "30.4.1",
        "@jest/pattern": "30.4.0",
        "@jest/reporters": "30.4.1",
        "@jest/test-result": "30.4.1",
        "@jest/transform": "30.4.1",
        "@jest/types": "30.4.1",
        "@types/node": "*",
        "ansi-escapes": "^4.3.2",
        "chalk": "^4.1.2",
        "ci-info": "^4.2.0",
        "exit-x": "^0.2.2",
        "fast-json-stable-stringify": "^2.1.0",
        "graceful-fs": "^4.2.11",
        "jest-changed-files": "30.4.1",
        "jest-config": "30.4.2",
        "jest-haste-map": "30.4.1",
        "jest-message-util": "30.4.1",
        "jest-regex-util": "30.4.0",
        "jest-resolve": "30.4.1",
        "jest-resolve-dependencies": "30.4.2",
        "jest-runner": "30.4.2",
        "jest-runtime": "30.4.2",
        "jest-snapshot": "30.4.1",
        "jest-util": "30.4.1",
        "jest-validate": "30.4.1",
        "jest-watcher": "30.4.1",
        "pretty-format": "30.4.1",
        "slash": "^3.0.0"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      },
      "peerDependencies": {
        "node-notifier": "^8.0.1 || ^9.0.0 || ^10.0.0"
      },
      "peerDependenciesMeta": {
        "node-notifier": {
          "optional": true
        }
      }
    },
    "node_modules/@jest/diff-sequences": {
      "version": "30.4.0",
      "resolved": "https://registry.npmjs.org/@jest/diff-sequences/-/diff-sequences-30.4.0.tgz",
      "integrity": "sha512-zOpzlfUs45l6u7jm39qr87JCHUDsaeCtvL+kQe/Vn9jSnRB4/5IPXISm0h9I1vZW/o00Kn4UTJ2MOlhnUGwv3g==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/@jest/environment": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/@jest/environment/-/environment-30.4.1.tgz",
      "integrity": "sha512-AK9yNRqgKxiabqMoe4oW+3/TSSeV8vkdC7BGaxZdU0AFXfOpofTLqdru2GXKZghP3sdgwE9XXpnVwfZ8JnFV4w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/fake-timers": "30.4.1",
        "@jest/types": "30.4.1",
        "@types/node": "*",
        "jest-mock": "30.4.1"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/@jest/expect": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/@jest/expect/-/expect-30.4.1.tgz",
      "integrity": "sha512-ginrj6TMgh2GshLUGCjO94Ptx9HhdZA/I6A9iUfyeLKFtdAjnKzHDgzgP9HYQgbxM1lbXScQ2eUBz2lGeVDPWA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "expect": "30.4.1",
        "jest-snapshot": "30.4.1"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/@jest/expect-utils": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/@jest/expect-utils/-/expect-utils-30.4.1.tgz",
      "integrity": "sha512-ZBn5CglH8fBsQsvs4VWNzD4aWfUYks+IdOOQU3MEK71ol/BcVm+P+rtb1KpiFBpSWSCE27uOahyyf1vfqOVbcQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/get-type": "30.1.0"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/@jest/fake-timers": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/@jest/fake-timers/-/fake-timers-30.4.1.tgz",
      "integrity": "sha512-iW5umdmfPeWzehrVhugFQZqCchSCud5S1l2YT0O9ZhjRR0ExclANDZkiSBwzqtnlOn0J1JXvO+HZ6rkuyOVOgQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/types": "30.4.1",
        "@sinonjs/fake-timers": "^15.4.0",
        "@types/node": "*",
        "jest-message-util": "30.4.1",
        "jest-mock": "30.4.1",
        "jest-util": "30.4.1"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/@jest/get-type": {
      "version": "30.1.0",
      "resolved": "https://registry.npmjs.org/@jest/get-type/-/get-type-30.1.0.tgz",
      "integrity": "sha512-eMbZE2hUnx1WV0pmURZY9XoXPkUYjpc55mb0CrhtdWLtzMQPFvu/rZkTLZFTsdaVQa+Tr4eWAteqcUzoawq/uA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/@jest/globals": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/@jest/globals/-/globals-30.4.1.tgz",
      "integrity": "sha512-ZbuY4cmXC8DkxYjfvT2DbcHWL2T6vmsMhXCDcmTB2T0y0gaezBI77ufq5ZAIdcRkYZ7NEQEDg1xFeKbxUJ5v5Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/environment": "30.4.1",
        "@jest/expect": "30.4.1",
        "@jest/types": "30.4.1",
        "jest-mock": "30.4.1"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/@jest/pattern": {
      "version": "30.4.0",
      "resolved": "https://registry.npmjs.org/@jest/pattern/-/pattern-30.4.0.tgz",
      "integrity": "sha512-RAWn3+f9u8BsHijKJ71uHcFp6vmyEt6VvoWXkl6hKF3qVIuWNmudVjg12DlBPGup/frIl5UcUlH5HfEuvHpEXg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@types/node": "*",
        "jest-regex-util": "30.4.0"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/@jest/reporters": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/@jest/reporters/-/reporters-30.4.1.tgz",
      "integrity": "sha512-/SnkPCzEQpUaBH81kjdEdDdo2WZl5hxw+BmLDGWjRkm8o7XlhjwsU36cqwe5PGBE5WYpBvDzRSdXx9rbGuJtNA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@bcoe/v8-coverage": "^0.2.3",
        "@jest/console": "30.4.1",
        "@jest/test-result": "30.4.1",
        "@jest/transform": "30.4.1",
        "@jest/types": "30.4.1",
        "@jridgewell/trace-mapping": "^0.3.25",
        "@types/node": "*",
        "chalk": "^4.1.2",
        "collect-v8-coverage": "^1.0.2",
        "exit-x": "^0.2.2",
        "glob": "^10.5.0",
        "graceful-fs": "^4.2.11",
        "istanbul-lib-coverage": "^3.0.0",
        "istanbul-lib-instrument": "^6.0.0",
        "istanbul-lib-report": "^3.0.0",
        "istanbul-lib-source-maps": "^5.0.0",
        "istanbul-reports": "^3.1.3",
        "jest-message-util": "30.4.1",
        "jest-util": "30.4.1",
        "jest-worker": "30.4.1",
        "slash": "^3.0.0",
        "string-length": "^4.0.2",
        "v8-to-istanbul": "^9.0.1"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      },
      "peerDependencies": {
        "node-notifier": "^8.0.1 || ^9.0.0 || ^10.0.0"
      },
      "peerDependenciesMeta": {
        "node-notifier": {
          "optional": true
        }
      }
    },
    "node_modules/@jest/schemas": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/@jest/schemas/-/schemas-30.4.1.tgz",
      "integrity": "sha512-i6b4qw5qnP8c5FEeBJg/uZQ4ddrkN6Ca8qISJh0pr7a5hfn3h3v5x60BEbOC7OYAGZNMs1LfFLwnW2CuK8F57Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@sinclair/typebox": "^0.34.0"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/@jest/snapshot-utils": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/@jest/snapshot-utils/-/snapshot-utils-30.4.1.tgz",
      "integrity": "sha512-ObY4ljvQ95mt6iwKtVLetR/4yXiAgl3H4nJxhztr0MTjrN97TwDYrnCp/kF60Ec9HdhkWTHSu+Hg05aXfngpOA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/types": "30.4.1",
        "chalk": "^4.1.2",
        "graceful-fs": "^4.2.11",
        "natural-compare": "^1.4.0"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/@jest/source-map": {
      "version": "30.0.1",
      "resolved": "https://registry.npmjs.org/@jest/source-map/-/source-map-30.0.1.tgz",
      "integrity": "sha512-MIRWMUUR3sdbP36oyNyhbThLHyJ2eEDClPCiHVbrYAe5g3CHRArIVpBw7cdSB5fr+ofSfIb2Tnsw8iEHL0PYQg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/trace-mapping": "^0.3.25",
        "callsites": "^3.1.0",
        "graceful-fs": "^4.2.11"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/@jest/test-result": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/@jest/test-result/-/test-result-30.4.1.tgz",
      "integrity": "sha512-/ZG7pgEiOmmWkN9TplKbOu4id2N5lh7FHwRwlkgBVAzGdRH+OkkQ8wX/kIxg4zmd3ZQvAL1RwL2yWsvNYYECTw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/console": "30.4.1",
        "@jest/types": "30.4.1",
        "@types/istanbul-lib-coverage": "^2.0.6",
        "collect-v8-coverage": "^1.0.2"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/@jest/test-sequencer": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/@jest/test-sequencer/-/test-sequencer-30.4.1.tgz",
      "integrity": "sha512-PeYE+4td5rKjoRPxztObrXU+H8hsjZfxKMXOcmrr34JerSyB/ROOxbbicz8B7A5j9R9VayDnVPvBmedqCsFCdw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/test-result": "30.4.1",
        "graceful-fs": "^4.2.11",
        "jest-haste-map": "30.4.1",
        "slash": "^3.0.0"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/@jest/transform": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/@jest/transform/-/transform-30.4.1.tgz",
      "integrity": "sha512-Wz0LyktlTvRefoymh+n64hQ84KNXsRGcwdoZ8CSa0Ea+fgYcHZlnk+hDP7v2MS7il2bQ5uTEIxf4/NNfhMN4KQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/core": "^7.27.4",
        "@jest/types": "30.4.1",
        "@jridgewell/trace-mapping": "^0.3.25",
        "babel-plugin-istanbul": "^7.0.1",
        "chalk": "^4.1.2",
        "convert-source-map": "^2.0.0",
        "fast-json-stable-stringify": "^2.1.0",
        "graceful-fs": "^4.2.11",
        "jest-haste-map": "30.4.1",
        "jest-regex-util": "30.4.0",
        "jest-util": "30.4.1",
        "pirates": "^4.0.7",
        "slash": "^3.0.0",
        "write-file-atomic": "^5.0.1"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/@jest/types": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/@jest/types/-/types-30.4.1.tgz",
      "integrity": "sha512-f1x/vJXIfjOlEmejYpbkbgw1gOqpPECwMvMEtBqe47j7H2Hg8h8w3o3ikhSXq3MI15kg+oQ0exWO0uCtTNJLoQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/pattern": "30.4.0",
        "@jest/schemas": "30.4.1",
        "@types/istanbul-lib-coverage": "^2.0.6",
        "@types/istanbul-reports": "^3.0.4",
        "@types/node": "*",
        "@types/yargs": "^17.0.33",
        "chalk": "^4.1.2"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/@jridgewell/gen-mapping": {
      "version": "0.3.13",
      "resolved": "https://registry.npmjs.org/@jridgewell/gen-mapping/-/gen-mapping-0.3.13.tgz",
      "integrity": "sha512-2kkt/7niJ6MgEPxF0bYdQ6etZaA+fQvDcLKckhy1yIQOzaoKjBBjSj63/aLVjYE3qhRt5dvM+uUyfCg6UKCBbA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/sourcemap-codec": "^1.5.0",
        "@jridgewell/trace-mapping": "^0.3.24"
      }
    },
    "node_modules/@jridgewell/remapping": {
      "version": "2.3.5",
      "resolved": "https://registry.npmjs.org/@jridgewell/remapping/-/remapping-2.3.5.tgz",
      "integrity": "sha512-LI9u/+laYG4Ds1TDKSJW2YPrIlcVYOwi2fUC6xB43lueCjgxV4lffOCZCtYFiH6TNOX+tQKXx97T4IKHbhyHEQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/gen-mapping": "^0.3.5",
        "@jridgewell/trace-mapping": "^0.3.24"
      }
    },
    "node_modules/@jridgewell/resolve-uri": {
      "version": "3.1.2",
      "resolved": "https://registry.npmjs.org/@jridgewell/resolve-uri/-/resolve-uri-3.1.2.tgz",
      "integrity": "sha512-bRISgCIjP20/tbWSPWMEi54QVPRZExkuD9lJL+UIxUKtwVJA8wW1Trb1jMs1RFXo1CBTNZ/5hpC9QvmKWdopKw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/@jridgewell/sourcemap-codec": {
      "version": "1.5.5",
      "resolved": "https://registry.npmjs.org/@jridgewell/sourcemap-codec/-/sourcemap-codec-1.5.5.tgz",
      "integrity": "sha512-cYQ9310grqxueWbl+WuIUIaiUaDcj7WOq5fVhEljNVgRfOUhY9fy2zTvfoqWsnebh8Sl70VScFbICvJnLKB0Og==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@jridgewell/trace-mapping": {
      "version": "0.3.31",
      "resolved": "https://registry.npmjs.org/@jridgewell/trace-mapping/-/trace-mapping-0.3.31.tgz",
      "integrity": "sha512-zzNR+SdQSDJzc8joaeP8QQoCQr8NuYx2dIIytl1QeBEZHJ9uW6hebsrYgbz8hJwUQao3TWCMtmfV8Nu1twOLAw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/resolve-uri": "^3.1.0",
        "@jridgewell/sourcemap-codec": "^1.4.14"
      }
    },
    "node_modules/@mongodb-js/saslprep": {
      "version": "1.4.12",
      "resolved": "https://registry.npmjs.org/@mongodb-js/saslprep/-/saslprep-1.4.12.tgz",
      "integrity": "sha512-QAfAMwNgnYxZ2C6D1HgeP7Gc4i/uvJRim415PCIL9ptRxWMNbWeLBYb2/9R4pGKny/s1FVu2JA2cxCUBUOggrA==",
      "license": "MIT",
      "dependencies": {
        "sparse-bitfield": "^3.0.3"
      }
    },
    "node_modules/@napi-rs/wasm-runtime": {
      "version": "1.1.6",
      "resolved": "https://registry.npmjs.org/@napi-rs/wasm-runtime/-/wasm-runtime-1.1.6.tgz",
      "integrity": "sha512-ZLv/JdUfkvOy9eCnnBaGfiO+XimbjebAeO+MRQqD/B+FR1tnRN0tpKSJHRbE8sFfS6aqsXZ67TQjfwfsxULVbg==",
      "dev": true,
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "@tybys/wasm-util": "^0.10.3"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/Brooooooklyn"
      },
      "peerDependencies": {
        "@emnapi/core": "^1.7.1",
        "@emnapi/runtime": "^1.7.1"
      }
    },
    "node_modules/@noble/hashes": {
      "version": "1.8.0",
      "resolved": "https://registry.npmjs.org/@noble/hashes/-/hashes-1.8.0.tgz",
      "integrity": "sha512-jCs9ldd7NwzpgXDIf6P3+NrHh9/sD6CQdxHyjQI+h/6rDNo88ypBxxz45UDuZHz9r3tNz7N/VInSVoVdtXEI4A==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^14.21.3 || >=16"
      },
      "funding": {
        "url": "https://paulmillr.com/funding/"
      }
    },
    "node_modules/@paralleldrive/cuid2": {
      "version": "2.3.1",
      "resolved": "https://registry.npmjs.org/@paralleldrive/cuid2/-/cuid2-2.3.1.tgz",
      "integrity": "sha512-XO7cAxhnTZl0Yggq6jOgjiOHhbgcO4NqFqwSmQpjK3b6TEE6Uj/jfSk6wzYyemh3+I0sHirKSetjQwn5cZktFw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@noble/hashes": "^1.1.5"
      }
    },
    "node_modules/@pkgjs/parseargs": {
      "version": "0.11.0",
      "resolved": "https://registry.npmjs.org/@pkgjs/parseargs/-/parseargs-0.11.0.tgz",
      "integrity": "sha512-+1VkjdD0QBLPodGrJUeqarH8VAIvQODIbwh9XpP5Syisf7YoQgsJKPNFoqqLQlu+VQ/tVSshMR6loPMn8U+dPg==",
      "dev": true,
      "license": "MIT",
      "optional": true,
      "engines": {
        "node": ">=14"
      }
    },
    "node_modules/@pkgr/core": {
      "version": "0.3.6",
      "resolved": "https://registry.npmjs.org/@pkgr/core/-/core-0.3.6.tgz",
      "integrity": "sha512-SEeaJLb3qBNF/OaXnaR1NmmBbFYk1zC0ZH/52fATcRPLFg/p791YrcyFFy44Bo9sLaGuSuLp5Q6axbb/O+v/RA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^14.18.0 || >=16.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/pkgr"
      }
    },
    "node_modules/@redis/bloom": {
      "version": "5.12.1",
      "resolved": "https://registry.npmjs.org/@redis/bloom/-/bloom-5.12.1.tgz",
      "integrity": "sha512-PUUfv+ms7jgPSBVoo/DN4AkPHj4D5TZSd6SbJX7egzBplkYUcKmHRE8RKia7UtZ8bSQbLguLvxVO+asKtQfZWA==",
      "license": "MIT",
      "engines": {
        "node": ">= 18.19.0"
      },
      "peerDependencies": {
        "@redis/client": "^5.12.1"
      }
    },
    "node_modules/@redis/client": {
      "version": "5.12.1",
      "resolved": "https://registry.npmjs.org/@redis/client/-/client-5.12.1.tgz",
      "integrity": "sha512-7aPGWeqA3uFm43o19umzdl16CEjK/JQGtSXVPevplTaOU3VJA/rseBC1QvYUz9lLDIMBimc4SW/zrW4S89BaCA==",
      "license": "MIT",
      "dependencies": {
        "cluster-key-slot": "1.1.2"
      },
      "engines": {
        "node": ">= 18.19.0"
      },
      "peerDependencies": {
        "@node-rs/xxhash": "^1.1.0",
        "@opentelemetry/api": ">=1 <2"
      },
      "peerDependenciesMeta": {
        "@node-rs/xxhash": {
          "optional": true
        },
        "@opentelemetry/api": {
          "optional": true
        }
      }
    },
    "node_modules/@redis/json": {
      "version": "5.12.1",
      "resolved": "https://registry.npmjs.org/@redis/json/-/json-5.12.1.tgz",
      "integrity": "sha512-eOze75esLve4vfqDel7aMX08CNaiLLQS2fV8mpRN9NxPe1rVR4vQyYiW/OgtGUysF6QOr9ANhfxABKNOJfXdKg==",
      "license": "MIT",
      "engines": {
        "node": ">= 18.19.0"
      },
      "peerDependencies": {
        "@redis/client": "^5.12.1"
      }
    },
    "node_modules/@redis/search": {
      "version": "5.12.1",
      "resolved": "https://registry.npmjs.org/@redis/search/-/search-5.12.1.tgz",
      "integrity": "sha512-ItlxbxC9cKI6IU1TLWoczwJCRb6TdmkEpWv05UrPawqaAnWGRu3rcIqsc5vN483T2fSociuyV1UkWIL5I4//2w==",
      "license": "MIT",
      "engines": {
        "node": ">= 18.19.0"
      },
      "peerDependencies": {
        "@redis/client": "^5.12.1"
      }
    },
    "node_modules/@redis/time-series": {
      "version": "5.12.1",
      "resolved": "https://registry.npmjs.org/@redis/time-series/-/time-series-5.12.1.tgz",
      "integrity": "sha512-c6JL6E3EcZJuNqKFz+KM+l9l5mpcQiKvTwgA3blt5glWJ8hjDk0yeHN3beE/MpqYIQ8UEX44ItQzgkE/gCBELQ==",
      "license": "MIT",
      "engines": {
        "node": ">= 18.19.0"
      },
      "peerDependencies": {
        "@redis/client": "^5.12.1"
      }
    },
    "node_modules/@scarf/scarf": {
      "version": "1.4.0",
      "resolved": "https://registry.npmjs.org/@scarf/scarf/-/scarf-1.4.0.tgz",
      "integrity": "sha512-xxeapPiUXdZAE3che6f3xogoJPeZgig6omHEy1rIY5WVsB3H2BHNnZH+gHG6x91SCWyQCzWGsuL2Hh3ClO5/qQ==",
      "hasInstallScript": true,
      "license": "Apache-2.0"
    },
    "node_modules/@sinclair/typebox": {
      "version": "0.34.50",
      "resolved": "https://registry.npmjs.org/@sinclair/typebox/-/typebox-0.34.50.tgz",
      "integrity": "sha512-ydBWw0G6WFwWHzh9RK4B5c690UkreOG0llq0r+DaI7LgKgxigf8mhHzIPI3S0850g1BPkq/zpuCfrq4QFgUlTQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@sinonjs/commons": {
      "version": "3.0.1",
      "resolved": "https://registry.npmjs.org/@sinonjs/commons/-/commons-3.0.1.tgz",
      "integrity": "sha512-K3mCHKQ9sVh8o1C9cxkwxaOmXoAMlDxC1mYyHrjqOWEcBjYr76t96zL2zlj5dUGZ3HSw240X1qgH3Mjf1yJWpQ==",
      "dev": true,
      "license": "BSD-3-Clause",
      "dependencies": {
        "type-detect": "4.0.8"
      }
    },
    "node_modules/@sinonjs/fake-timers": {
      "version": "15.4.0",
      "resolved": "https://registry.npmjs.org/@sinonjs/fake-timers/-/fake-timers-15.4.0.tgz",
      "integrity": "sha512-DsG+8/LscQIQg68J6Ef3dv10u6nVyetYn923s3/sus5eaGfTo1of5WMZSLf0UJc9KDuKPilPH0UDJCjvNbDNCA==",
      "dev": true,
      "license": "BSD-3-Clause",
      "dependencies": {
        "@sinonjs/commons": "^3.0.1"
      }
    },
    "node_modules/@standard-schema/spec": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/@standard-schema/spec/-/spec-1.1.0.tgz",
      "integrity": "sha512-l2aFy5jALhniG5HgqrD6jXLi/rUWrKvqN/qJx6yoJsgKhblVd+iqqU4RCXavm/jPityDo5TCvKMnpjKnOriy0w==",
      "license": "MIT"
    },
    "node_modules/@tybys/wasm-util": {
      "version": "0.10.3",
      "resolved": "https://registry.npmjs.org/@tybys/wasm-util/-/wasm-util-0.10.3.tgz",
      "integrity": "sha512-F3fo1MYrRJYL3zER0OUOmkutjr1Vp23m7OsSgp7nq4SP6OqX6C/56XFIPAl5bt3zaBRjmW7SGz3u/6LwFpYcOg==",
      "dev": true,
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "tslib": "^2.4.0"
      }
    },
    "node_modules/@types/babel__core": {
      "version": "7.20.5",
      "resolved": "https://registry.npmjs.org/@types/babel__core/-/babel__core-7.20.5.tgz",
      "integrity": "sha512-qoQprZvz5wQFJwMDqeseRXWv3rqMvhgpbXFfVyWhbx9X47POIA6i/+dXefEmZKoAgOaTdaIgNSMqMIU61yRyzA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/parser": "^7.20.7",
        "@babel/types": "^7.20.7",
        "@types/babel__generator": "*",
        "@types/babel__template": "*",
        "@types/babel__traverse": "*"
      }
    },
    "node_modules/@types/babel__generator": {
      "version": "7.27.0",
      "resolved": "https://registry.npmjs.org/@types/babel__generator/-/babel__generator-7.27.0.tgz",
      "integrity": "sha512-ufFd2Xi92OAVPYsy+P4n7/U7e68fex0+Ee8gSG9KX7eo084CWiQ4sdxktvdl0bOPupXtVJPY19zk6EwWqUQ8lg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/types": "^7.0.0"
      }
    },
    "node_modules/@types/babel__template": {
      "version": "7.4.4",
      "resolved": "https://registry.npmjs.org/@types/babel__template/-/babel__template-7.4.4.tgz",
      "integrity": "sha512-h/NUaSyG5EyxBIp8YRxo4RMe2/qQgvyowRwVMzhYhBCONbW8PUsg4lkFMrhgZhUe5z3L3MiLDuvyJ/CaPa2A8A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/parser": "^7.1.0",
        "@babel/types": "^7.0.0"
      }
    },
    "node_modules/@types/babel__traverse": {
      "version": "7.28.0",
      "resolved": "https://registry.npmjs.org/@types/babel__traverse/-/babel__traverse-7.28.0.tgz",
      "integrity": "sha512-8PvcXf70gTDZBgt9ptxJ8elBeBjcLOAcOtoO/mPJjtji1+CdGbHgm77om1GrsPxsiE+uXIpNSK64UYaIwQXd4Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/types": "^7.28.2"
      }
    },
    "node_modules/@types/istanbul-lib-coverage": {
      "version": "2.0.6",
      "resolved": "https://registry.npmjs.org/@types/istanbul-lib-coverage/-/istanbul-lib-coverage-2.0.6.tgz",
      "integrity": "sha512-2QF/t/auWm0lsy8XtKVPG19v3sSOQlJe/YHZgfjb/KBBHOGSV+J2q/S671rcq9uTBrLAXmZpqJiaQbMT+zNU1w==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@types/istanbul-lib-report": {
      "version": "3.0.3",
      "resolved": "https://registry.npmjs.org/@types/istanbul-lib-report/-/istanbul-lib-report-3.0.3.tgz",
      "integrity": "sha512-NQn7AHQnk/RSLOxrBbGyJM/aVQ+pjj5HCgasFxc0K/KhoATfQ/47AyUl15I2yBUpihjmas+a+VJBOqecrFH+uA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@types/istanbul-lib-coverage": "*"
      }
    },
    "node_modules/@types/istanbul-reports": {
      "version": "3.0.4",
      "resolved": "https://registry.npmjs.org/@types/istanbul-reports/-/istanbul-reports-3.0.4.tgz",
      "integrity": "sha512-pk2B1NWalF9toCRu6gjBzR69syFjP4Od8WRAX+0mmf9lAjCRicLOWc+ZrxZHx/0XRjotgkF9t6iaMJ+aXcOdZQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@types/istanbul-lib-report": "*"
      }
    },
    "node_modules/@types/json-schema": {
      "version": "7.0.15",
      "resolved": "https://registry.npmjs.org/@types/json-schema/-/json-schema-7.0.15.tgz",
      "integrity": "sha512-5+fP8P8MFNC+AyZCDxrB2pkZFPGzqQWUzpSeuuVLvm8VMcorNYavBqoFcxK8bQz4Qsbn4oUEEem4wDLfcysGHA==",
      "license": "MIT"
    },
    "node_modules/@types/node": {
      "version": "26.1.1",
      "resolved": "https://registry.npmjs.org/@types/node/-/node-26.1.1.tgz",
      "integrity": "sha512-nxAkRSVkN1Y0JC1W8ky/fTfkGsMmcrRsbx+3XoZE+rMOX71kLYTV7fLXpqud1GpbpP5TuffXFqfX7fH2GgZREw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "undici-types": "~8.3.0"
      }
    },
    "node_modules/@types/stack-utils": {
      "version": "2.0.3",
      "resolved": "https://registry.npmjs.org/@types/stack-utils/-/stack-utils-2.0.3.tgz",
      "integrity": "sha512-9aEbYZ3TbYMznPdcdr3SmIrLXwC/AKZXQeCf9Pgao5CKb8CyHuEX5jzWPTkvregvhRJHcpRO6BFoGW9ycaOkYw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@types/webidl-conversions": {
      "version": "7.0.3",
      "resolved": "https://registry.npmjs.org/@types/webidl-conversions/-/webidl-conversions-7.0.3.tgz",
      "integrity": "sha512-CiJJvcRtIgzadHCYXw7dqEnMNRjhGZlYK05Mj9OyktqV8uVT8fD2BFOB7S1uwBE3Kj2Z+4UyPmFw/Ixgw/LAlA==",
      "license": "MIT"
    },
    "node_modules/@types/whatwg-url": {
      "version": "13.0.0",
      "resolved": "https://registry.npmjs.org/@types/whatwg-url/-/whatwg-url-13.0.0.tgz",
      "integrity": "sha512-N8WXpbE6Wgri7KUSvrmQcqrMllKZ9uxkYWMt+mCSGwNc0Hsw9VQTW7ApqI4XNrx6/SaM2QQJCzMPDEXE058s+Q==",
      "license": "MIT",
      "dependencies": {
        "@types/webidl-conversions": "*"
      }
    },
    "node_modules/@types/yargs": {
      "version": "17.0.35",
      "resolved": "https://registry.npmjs.org/@types/yargs/-/yargs-17.0.35.tgz",
      "integrity": "sha512-qUHkeCyQFxMXg79wQfTtfndEC+N9ZZg76HJftDJp+qH2tV7Gj4OJi7l+PiWwJ+pWtW8GwSmqsDj/oymhrTWXjg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@types/yargs-parser": "*"
      }
    },
    "node_modules/@types/yargs-parser": {
      "version": "21.0.3",
      "resolved": "https://registry.npmjs.org/@types/yargs-parser/-/yargs-parser-21.0.3.tgz",
      "integrity": "sha512-I4q9QU9MQv4oEOz4tAHJtNz1cwuLxn2F3xcc2iV5WdqLPpUnj30aUuxt1mAxYTG+oe8CZMV/+6rU4S4gRDzqtQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@ungap/structured-clone": {
      "version": "1.3.2",
      "resolved": "https://registry.npmjs.org/@ungap/structured-clone/-/structured-clone-1.3.2.tgz",
      "integrity": "sha512-5jsZFwgR5rTdKwidH9Qmat75RKwqfpKlWWB1frDkljN127mwqBu8K0PYo7/hFpF03IEJpfVPpCQDY/eDx3iHvA==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/@unrs/resolver-binding-android-arm-eabi": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-android-arm-eabi/-/resolver-binding-android-arm-eabi-1.12.2.tgz",
      "integrity": "sha512-g5T90pqg1bo/7mytQx6F4iBNC0Wsh9cu+z9veDbFjc7HjpesJFWD7QMS0NGStXM075+7dJPPVvBbpZlnrdpi/w==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ]
    },
    "node_modules/@unrs/resolver-binding-android-arm64": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-android-arm64/-/resolver-binding-android-arm64-1.12.2.tgz",
      "integrity": "sha512-YGCRZv/9GLhwmz6mYDeTsm/92BAyR28l6c2ReweVW5pWgfsitWLY8upvfRlGdoyD8HjeTHSYJWyZGD4KJA/nFQ==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ]
    },
    "node_modules/@unrs/resolver-binding-darwin-arm64": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-darwin-arm64/-/resolver-binding-darwin-arm64-1.12.2.tgz",
      "integrity": "sha512-u9DiNT1auQMO20A9SyTuG3wUgQWB9Z7KjAg0uFuCDR1FsAY8A0CG2S6JpHS1xwm/w1G08bjXZDcyOCjv1WAm2w==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ]
    },
    "node_modules/@unrs/resolver-binding-darwin-x64": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-darwin-x64/-/resolver-binding-darwin-x64-1.12.2.tgz",
      "integrity": "sha512-f7rPLi/T1HVKZu/u6t87lroib16n8vrSzcyxI7lg4BGO9UF26KhQL44sd9eOUgrTYhvRXtWOIZT5PejdPyJfUA==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ]
    },
    "node_modules/@unrs/resolver-binding-freebsd-x64": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-freebsd-x64/-/resolver-binding-freebsd-x64-1.12.2.tgz",
      "integrity": "sha512-BpcOjWCJub6nRZUS2zA20pmLvjtqAtGejETaIyRLiZiQf++cbrjltLA5NN/xaXfqeOBOSlMFbemIl5/S5tljmg==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ]
    },
    "node_modules/@unrs/resolver-binding-linux-arm-gnueabihf": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-arm-gnueabihf/-/resolver-binding-linux-arm-gnueabihf-1.12.2.tgz",
      "integrity": "sha512-vZTDvdSISZjJx66OzJqtsOhzifbqRjbmI1Mnu49fQDwog5GtDI4QidRiEAYbZCRj9C8YZEW+3ZjqsyS9GR4k2A==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@unrs/resolver-binding-linux-arm-musleabihf": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-arm-musleabihf/-/resolver-binding-linux-arm-musleabihf-1.12.2.tgz",
      "integrity": "sha512-BiPI+IrIlwcW4nLLMM21+B1dFPzd55yAVgVGrdgDjNef+ch03GdxrcyaIz8X9SsQirh/kCQ7mviyWlMxdh2D7g==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@unrs/resolver-binding-linux-arm64-gnu": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-arm64-gnu/-/resolver-binding-linux-arm64-gnu-1.12.2.tgz",
      "integrity": "sha512-zJc0H99FEPoFfSrNpa91HYfxzfAJCr502oxNK1cfdC9hlaFI43RT+JFCann9JUgZmLzzntChHyn13Sgn9ljHNg==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@unrs/resolver-binding-linux-arm64-musl": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-arm64-musl/-/resolver-binding-linux-arm64-musl-1.12.2.tgz",
      "integrity": "sha512-KQ3Lki6l+Pz1k/eBipN41ES+YUK30beLGb9YqcB1O542cyLCNE6GaxrfcY3T6EezmGGk84wb5XyO9loTM9tkcA==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@unrs/resolver-binding-linux-loong64-gnu": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-loong64-gnu/-/resolver-binding-linux-loong64-gnu-1.12.2.tgz",
      "integrity": "sha512-3SJGEh1DborhG6pyxvhPzCT4bbSIVihsvgJc13P1bHG7KLdNDaF9T3gsTwFc7Jw/5Y5/iWOjkEx7Zy0NvCGX3Q==",
      "cpu": [
        "loong64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@unrs/resolver-binding-linux-loong64-musl": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-loong64-musl/-/resolver-binding-linux-loong64-musl-1.12.2.tgz",
      "integrity": "sha512-jiuG/Obbel7uw1PwHNFfrkiKhLAF6mnyZ6aWlOAVN9WqKm8v0OFGnciJIHu8+CMvXLQ8AD51LPzAoUfT21D5Ew==",
      "cpu": [
        "loong64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@unrs/resolver-binding-linux-ppc64-gnu": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-ppc64-gnu/-/resolver-binding-linux-ppc64-gnu-1.12.2.tgz",
      "integrity": "sha512-q7xRvVpmcfeL+LlZg8Pbbo6QaTZwDU5BaGZbwfhkEsXJn3Was8xYfE0RBH266xZt0rM6B7i8xAYIvjthuUIWHg==",
      "cpu": [
        "ppc64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@unrs/resolver-binding-linux-riscv64-gnu": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-riscv64-gnu/-/resolver-binding-linux-riscv64-gnu-1.12.2.tgz",
      "integrity": "sha512-0CVdx6lcnT3Q9inOH8tsMIOJ6ImndllMjqJHg8RLVdB7Vq4SfkEXl9mCSsVNuNA4MCYycRicCUxPCabVHJRr6A==",
      "cpu": [
        "riscv64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@unrs/resolver-binding-linux-riscv64-musl": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-riscv64-musl/-/resolver-binding-linux-riscv64-musl-1.12.2.tgz",
      "integrity": "sha512-iOwlRo9vnp6R6ohHQS11n0NnfdXx/omhkocmIfaPRpQhKZ+3BDMkkdRVh53qjkFkpPddf+FETA28NwGN7l5l+w==",
      "cpu": [
        "riscv64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@unrs/resolver-binding-linux-s390x-gnu": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-s390x-gnu/-/resolver-binding-linux-s390x-gnu-1.12.2.tgz",
      "integrity": "sha512-HYJtLfXq94q8iZNFT1lknx258wlkkWhZeUXJRqzKBBUJ00CvZ+N33zgbCqimLjsyw5Va6uUxhVa12mI+kaveEw==",
      "cpu": [
        "s390x"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@unrs/resolver-binding-linux-x64-gnu": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-x64-gnu/-/resolver-binding-linux-x64-gnu-1.12.2.tgz",
      "integrity": "sha512-mPsUhunKKDih5O96Y6enDQyHc1SqBPlY1E/SfMWDM3EdJ95Z9CArPeCVwCCqbP45ljvivdEk8Fxn+SIb1rDAJQ==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@unrs/resolver-binding-linux-x64-musl": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-x64-musl/-/resolver-binding-linux-x64-musl-1.12.2.tgz",
      "integrity": "sha512-azrt6+5ydLd8Vt210AAFis/lZevSfPw93EJRIJG+xPu4WCJ8K0kppCTpMyLPcKT7H15M4Jnt2tMp5bOvCkRC6A==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/@unrs/resolver-binding-openharmony-arm64": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-openharmony-arm64/-/resolver-binding-openharmony-arm64-1.12.2.tgz",
      "integrity": "sha512-YZ9hP4O0X9PQb8eO980qmLNGH4zT3I9+SZTdt0Pr0YyuGQhYKoOZkV02VzrzyOZJ5xIJ3UFIenKkUkGg8GjgWQ==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "openharmony"
      ]
    },
    "node_modules/@unrs/resolver-binding-wasm32-wasi": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-wasm32-wasi/-/resolver-binding-wasm32-wasi-1.12.2.tgz",
      "integrity": "sha512-tYFDIkMxSflfEc/h92ZWNsZlHSwgimbNHSO3PL2JWQHfCuC2q316jMyYU9TIWZsFK2bQwyK5VAdYgn8ygPj69A==",
      "cpu": [
        "wasm32"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "@emnapi/core": "1.10.0",
        "@emnapi/runtime": "1.10.0",
        "@napi-rs/wasm-runtime": "^1.1.4"
      },
      "engines": {
        "node": ">=14.0.0"
      }
    },
    "node_modules/@unrs/resolver-binding-wasm32-wasi/node_modules/@emnapi/core": {
      "version": "1.10.0",
      "resolved": "https://registry.npmjs.org/@emnapi/core/-/core-1.10.0.tgz",
      "integrity": "sha512-yq6OkJ4p82CAfPl0u9mQebQHKPJkY7WrIuk205cTYnYe+k2Z8YBh11FrbRG/H6ihirqcacOgl2BIO8oyMQLeXw==",
      "dev": true,
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "@emnapi/wasi-threads": "1.2.1",
        "tslib": "^2.4.0"
      }
    },
    "node_modules/@unrs/resolver-binding-wasm32-wasi/node_modules/@emnapi/runtime": {
      "version": "1.10.0",
      "resolved": "https://registry.npmjs.org/@emnapi/runtime/-/runtime-1.10.0.tgz",
      "integrity": "sha512-ewvYlk86xUoGI0zQRNq/mC+16R1QeDlKQy21Ki3oSYXNgLb45GV1P6A0M+/s6nyCuNDqe5VpaY84BzXGwVbwFA==",
      "dev": true,
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "tslib": "^2.4.0"
      }
    },
    "node_modules/@unrs/resolver-binding-wasm32-wasi/node_modules/@emnapi/wasi-threads": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/@emnapi/wasi-threads/-/wasi-threads-1.2.1.tgz",
      "integrity": "sha512-uTII7OYF+/Mes/MrcIOYp5yOtSMLBWSIoLPpcgwipoiKbli6k322tcoFsxoIIxPDqW01SQGAgko4EzZi2BNv2w==",
      "dev": true,
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "tslib": "^2.4.0"
      }
    },
    "node_modules/@unrs/resolver-binding-win32-arm64-msvc": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-win32-arm64-msvc/-/resolver-binding-win32-arm64-msvc-1.12.2.tgz",
      "integrity": "sha512-qzNyg3xL0VPQmCaUh+N5jSitce6k+uCBfMDesWRnlULOZaqUkaJ0ybdT+UqlAWJoQjuqfIU/0Ptx9bteN4D82g==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ]
    },
    "node_modules/@unrs/resolver-binding-win32-ia32-msvc": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-win32-ia32-msvc/-/resolver-binding-win32-ia32-msvc-1.12.2.tgz",
      "integrity": "sha512-WD9sY00OfpHVGfsnHZoA8jVT+esS/Bg8z8jzxp5BnDCjjwsuKsPQrzswwpFy4J1AUJbXPRfkpcX0mXrzeXW79g==",
      "cpu": [
        "ia32"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ]
    },
    "node_modules/@unrs/resolver-binding-win32-x64-msvc": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-win32-x64-msvc/-/resolver-binding-win32-x64-msvc-1.12.2.tgz",
      "integrity": "sha512-nAB74NfSNKknqQ1RrYj6uz8FcXEomu/MATJZxh/x+BArzN2U3JbOYC0APYzUIGhVY3m5hRxA8VPNdPBoG8txlA==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ]
    },
    "node_modules/accepts": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/accepts/-/accepts-2.0.0.tgz",
      "integrity": "sha512-5cvg6CtKwfgdmVqY1WIiXKc3Q1bkRqGLi+2W/6ao+6Y7gu/RCwRuAhGEzh5B4KlszSuTLgZYuqFqo5bImjNKng==",
      "license": "MIT",
      "dependencies": {
        "mime-types": "^3.0.0",
        "negotiator": "^1.0.0"
      },
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/ajv": {
      "version": "8.20.0",
      "resolved": "https://registry.npmjs.org/ajv/-/ajv-8.20.0.tgz",
      "integrity": "sha512-Thbli+OlOj+iMPYFBVBfJ3OmCAnaSyNn4M1vz9T6Gka5Jt9ba/HIR56joy65tY6kx/FCF5VXNB819Y7/GUrBGA==",
      "license": "MIT",
      "dependencies": {
        "fast-deep-equal": "^3.1.3",
        "fast-uri": "^3.0.1",
        "json-schema-traverse": "^1.0.0",
        "require-from-string": "^2.0.2"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/epoberezkin"
      }
    },
    "node_modules/ajv-draft-04": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/ajv-draft-04/-/ajv-draft-04-1.0.0.tgz",
      "integrity": "sha512-mv00Te6nmYbRp5DCwclxtt7yV/joXJPGS7nM+97GdxvuttCOfgI3K4U25zboyeX0O+myI8ERluxQe5wljMmVIw==",
      "license": "MIT",
      "peerDependencies": {
        "ajv": "^8.5.0"
      },
      "peerDependenciesMeta": {
        "ajv": {
          "optional": true
        }
      }
    },
    "node_modules/ansi-escapes": {
      "version": "4.3.2",
      "resolved": "https://registry.npmjs.org/ansi-escapes/-/ansi-escapes-4.3.2.tgz",
      "integrity": "sha512-gKXj5ALrKWQLsYG9jlTRmR/xKluxHV+Z9QEwNIgCfM1/uwPMCuzVVnh5mwTd+OuBZcwSIMbqssNWRm1lE51QaQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "type-fest": "^0.21.3"
      },
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/ansi-regex": {
      "version": "6.2.2",
      "resolved": "https://registry.npmjs.org/ansi-regex/-/ansi-regex-6.2.2.tgz",
      "integrity": "sha512-Bq3SmSpyFHaWjPk8If9yc6svM8c56dB5BAtW4Qbw5jHTwwXXcTLoRMkpDJp6VL0XzlWaCHTXrkFURMYmD0sLqg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12"
      },
      "funding": {
        "url": "https://github.com/chalk/ansi-regex?sponsor=1"
      }
    },
    "node_modules/ansi-styles": {
      "version": "4.3.0",
      "resolved": "https://registry.npmjs.org/ansi-styles/-/ansi-styles-4.3.0.tgz",
      "integrity": "sha512-zbB9rCJAT1rbjiVDb2hqKFHNYLxgtk8NURxZ3IZwD3F6NtxbXZQCnnSi1Lkx+IDohdPlFp222wVALIheZJQSEg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "color-convert": "^2.0.1"
      },
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/chalk/ansi-styles?sponsor=1"
      }
    },
    "node_modules/anymatch": {
      "version": "3.1.3",
      "resolved": "https://registry.npmjs.org/anymatch/-/anymatch-3.1.3.tgz",
      "integrity": "sha512-KMReFUr0B4t+D+OBkjR3KYqvocp2XaSzO55UcB6mgQMd3KbcE+mWTyvVV7D/zsdEbNnV6acZUutkiHQXvTr1Rw==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "normalize-path": "^3.0.0",
        "picomatch": "^2.0.4"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/append-field": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/append-field/-/append-field-1.0.0.tgz",
      "integrity": "sha512-klpgFSWLW1ZEs8svjfb7g4qWY0YS5imI82dTg+QahUvJ8YqAY0P10Uk8tTyh9ZGuYEZEMaeJYCF5BFuX552hsw==",
      "license": "MIT"
    },
    "node_modules/argparse": {
      "version": "1.0.10",
      "resolved": "https://registry.npmjs.org/argparse/-/argparse-1.0.10.tgz",
      "integrity": "sha512-o5Roy6tNG4SL/FOkCAN6RzjiakZS25RLYFrcMttJqbdd8BWrnA+fGz57iN5Pb06pvBGvl5gQ0B48dJlslXvoTg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "sprintf-js": "~1.0.2"
      }
    },
    "node_modules/asap": {
      "version": "2.0.6",
      "resolved": "https://registry.npmjs.org/asap/-/asap-2.0.6.tgz",
      "integrity": "sha512-BSHWgDSAiKs50o2Re8ppvp3seVHXSRM44cdSsT9FfNEUUZLOGWVCsiWaRPWM1Znn+mqZ1OfVZ3z3DWEzSp7hRA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/asynckit": {
      "version": "0.4.0",
      "resolved": "https://registry.npmjs.org/asynckit/-/asynckit-0.4.0.tgz",
      "integrity": "sha512-Oei9OH4tRh0YqU3GxhX79dM/mwVgvbZJaSNaRk+bshkj0S5cfHcgYakreBjrHwatXKbz+IoIdYLxrKim2MjW0Q==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/babel-jest": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/babel-jest/-/babel-jest-30.4.1.tgz",
      "integrity": "sha512-fATAbM8piYxkiXQp3RBXmZHxZVNJZAVXXfyeyCN2Tida3+qJ8ea9UxhiJ2y4fLO90ZImKt6k9FlcH2+rLkJGhw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/transform": "30.4.1",
        "@types/babel__core": "^7.20.5",
        "babel-plugin-istanbul": "^7.0.1",
        "babel-preset-jest": "30.4.0",
        "chalk": "^4.1.2",
        "graceful-fs": "^4.2.11",
        "slash": "^3.0.0"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.11.0 || ^8.0.0-0"
      }
    },
    "node_modules/babel-plugin-istanbul": {
      "version": "7.0.1",
      "resolved": "https://registry.npmjs.org/babel-plugin-istanbul/-/babel-plugin-istanbul-7.0.1.tgz",
      "integrity": "sha512-D8Z6Qm8jCvVXtIRkBnqNHX0zJ37rQcFJ9u8WOS6tkYOsRdHBzypCstaxWiu5ZIlqQtviRYbgnRLSoCEvjqcqbA==",
      "dev": true,
      "license": "BSD-3-Clause",
      "workspaces": [
        "test/babel-8"
      ],
      "dependencies": {
        "@babel/helper-plugin-utils": "^7.0.0",
        "@istanbuljs/load-nyc-config": "^1.0.0",
        "@istanbuljs/schema": "^0.1.3",
        "istanbul-lib-instrument": "^6.0.2",
        "test-exclude": "^6.0.0"
      },
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/babel-plugin-jest-hoist": {
      "version": "30.4.0",
      "resolved": "https://registry.npmjs.org/babel-plugin-jest-hoist/-/babel-plugin-jest-hoist-30.4.0.tgz",
      "integrity": "sha512-9EdtWM/sSfXLOGLwSn+GS6pIXyBnL07/8gyJlwFXjWy4DxMOyItqyUT29d4lQiS380EZwYlX7/At4PgBS+m2aA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@types/babel__core": "^7.20.5"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/babel-plugin-polyfill-corejs2": {
      "version": "0.4.17",
      "resolved": "https://registry.npmjs.org/babel-plugin-polyfill-corejs2/-/babel-plugin-polyfill-corejs2-0.4.17.tgz",
      "integrity": "sha512-aTyf30K/rqAsNwN76zYrdtx8obu0E4KoUME29B1xj+B3WxgvWkp943vYQ+z8Mv3lw9xHXMHpvSPOBxzAkIa94w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/compat-data": "^7.28.6",
        "@babel/helper-define-polyfill-provider": "^0.6.8",
        "semver": "^6.3.1"
      },
      "peerDependencies": {
        "@babel/core": "^7.4.0 || ^8.0.0-0 <8.0.0"
      }
    },
    "node_modules/babel-plugin-polyfill-corejs2/node_modules/semver": {
      "version": "6.3.1",
      "resolved": "https://registry.npmjs.org/semver/-/semver-6.3.1.tgz",
      "integrity": "sha512-BR7VvDCVHO+q2xBEWskxS6DJE1qRnb7DxzUrogb71CWoSficBxYsiAGd+Kl0mmq/MprG9yArRkyrQxTO6XjMzA==",
      "dev": true,
      "license": "ISC",
      "bin": {
        "semver": "bin/semver.js"
      }
    },
    "node_modules/babel-plugin-polyfill-corejs3": {
      "version": "0.10.6",
      "resolved": "https://registry.npmjs.org/babel-plugin-polyfill-corejs3/-/babel-plugin-polyfill-corejs3-0.10.6.tgz",
      "integrity": "sha512-b37+KR2i/khY5sKmWNVQAnitvquQbNdWy6lJdsr0kmquCKEEUgMKK4SboVM3HtfnZilfjr4MMQ7vY58FVWDtIA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-define-polyfill-provider": "^0.6.2",
        "core-js-compat": "^3.38.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.4.0 || ^8.0.0-0 <8.0.0"
      }
    },
    "node_modules/babel-plugin-polyfill-regenerator": {
      "version": "0.6.8",
      "resolved": "https://registry.npmjs.org/babel-plugin-polyfill-regenerator/-/babel-plugin-polyfill-regenerator-0.6.8.tgz",
      "integrity": "sha512-M762rNHfSF1EV3SLtnCJXFoQbbIIz0OyRwnCmV0KPC7qosSfCO0QLTSuJX3ayAebubhE6oYBAYPrBA5ljowaZg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-define-polyfill-provider": "^0.6.8"
      },
      "peerDependencies": {
        "@babel/core": "^7.4.0 || ^8.0.0-0 <8.0.0"
      }
    },
    "node_modules/babel-preset-current-node-syntax": {
      "version": "1.2.0",
      "resolved": "https://registry.npmjs.org/babel-preset-current-node-syntax/-/babel-preset-current-node-syntax-1.2.0.tgz",
      "integrity": "sha512-E/VlAEzRrsLEb2+dv8yp3bo4scof3l9nR4lrld+Iy5NyVqgVYUJnDAmunkhPMisRI32Qc4iRiz425d8vM++2fg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/plugin-syntax-async-generators": "^7.8.4",
        "@babel/plugin-syntax-bigint": "^7.8.3",
        "@babel/plugin-syntax-class-properties": "^7.12.13",
        "@babel/plugin-syntax-class-static-block": "^7.14.5",
        "@babel/plugin-syntax-import-attributes": "^7.24.7",
        "@babel/plugin-syntax-import-meta": "^7.10.4",
        "@babel/plugin-syntax-json-strings": "^7.8.3",
        "@babel/plugin-syntax-logical-assignment-operators": "^7.10.4",
        "@babel/plugin-syntax-nullish-coalescing-operator": "^7.8.3",
        "@babel/plugin-syntax-numeric-separator": "^7.10.4",
        "@babel/plugin-syntax-object-rest-spread": "^7.8.3",
        "@babel/plugin-syntax-optional-catch-binding": "^7.8.3",
        "@babel/plugin-syntax-optional-chaining": "^7.8.3",
        "@babel/plugin-syntax-private-property-in-object": "^7.14.5",
        "@babel/plugin-syntax-top-level-await": "^7.14.5"
      },
      "peerDependencies": {
        "@babel/core": "^7.0.0 || ^8.0.0-0"
      }
    },
    "node_modules/babel-preset-jest": {
      "version": "30.4.0",
      "resolved": "https://registry.npmjs.org/babel-preset-jest/-/babel-preset-jest-30.4.0.tgz",
      "integrity": "sha512-lBY4jxsNmCnSiu7kquw8ZC9F4+XLMOKypT3RnNHPvU2Kpd4W0xaPuLr5ZkRyOsvLYAY4yaW1ZwTW4xB7NIiZzg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "babel-plugin-jest-hoist": "30.4.0",
        "babel-preset-current-node-syntax": "^1.2.0"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      },
      "peerDependencies": {
        "@babel/core": "^7.11.0 || ^8.0.0-beta.1"
      }
    },
    "node_modules/balanced-match": {
      "version": "4.0.4",
      "resolved": "https://registry.npmjs.org/balanced-match/-/balanced-match-4.0.4.tgz",
      "integrity": "sha512-BLrgEcRTwX2o6gGxGOCNyMvGSp35YofuYzw9h1IMTRmKqttAZZVU67bdb9Pr2vUHA8+j3i2tJfjO6C6+4myGTA==",
      "license": "MIT",
      "engines": {
        "node": "18 || 20 || >=22"
      }
    },
    "node_modules/baseline-browser-mapping": {
      "version": "2.10.42",
      "resolved": "https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.10.42.tgz",
      "integrity": "sha512-c/jurFrDLyui7o1J86yLkRu4LMsTYcBohveus7/I2Hzdn9KIP2bdJPTue/lR1KH46enoPbD77GKeSYNdyPoD3Q==",
      "dev": true,
      "license": "Apache-2.0",
      "bin": {
        "baseline-browser-mapping": "dist/cli.cjs"
      },
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/bcryptjs": {
      "version": "3.0.3",
      "resolved": "https://registry.npmjs.org/bcryptjs/-/bcryptjs-3.0.3.tgz",
      "integrity": "sha512-GlF5wPWnSa/X5LKM1o0wz0suXIINz1iHRLvTS+sLyi7XPbe5ycmYI3DlZqVGZZtDgl4DmasFg7gOB3JYbphV5g==",
      "license": "BSD-3-Clause",
      "bin": {
        "bcrypt": "bin/bcrypt"
      }
    },
    "node_modules/binary-extensions": {
      "version": "2.3.0",
      "resolved": "https://registry.npmjs.org/binary-extensions/-/binary-extensions-2.3.0.tgz",
      "integrity": "sha512-Ceh+7ox5qe7LJuLHoY0feh3pHuUDHAcRUeyL2VYghZwfpkNIy/+8Ocg0a3UuSoYzavmylwuLWQOf3hl0jjMMIw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/body-parser": {
      "version": "2.3.0",
      "resolved": "https://registry.npmjs.org/body-parser/-/body-parser-2.3.0.tgz",
      "integrity": "sha512-2cGmJupaNgg+QUwVLAucDuWuoMZ6EX9iHDRswZ5lsNYEmwPaRknMPCLZz07yTzVq/83p4o/wzbDZbBrTvGGTIw==",
      "license": "MIT",
      "dependencies": {
        "bytes": "^3.1.2",
        "content-type": "^2.0.0",
        "debug": "^4.4.3",
        "http-errors": "^2.0.1",
        "iconv-lite": "^0.7.2",
        "on-finished": "^2.4.1",
        "qs": "^6.15.2",
        "raw-body": "^3.0.2",
        "type-is": "^2.1.0"
      },
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/express"
      }
    },
    "node_modules/body-parser/node_modules/content-type": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/content-type/-/content-type-2.0.0.tgz",
      "integrity": "sha512-j/O/d7GcZCyNl7/hwZAb606rzqkyvaDctLmckbxLzHvFBzTJHuGEdodATcP3yIRoDrLHkIATJuvzbFlp/ki2cQ==",
      "license": "MIT",
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/express"
      }
    },
    "node_modules/brace-expansion": {
      "version": "5.0.7",
      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.7.tgz",
      "integrity": "sha512-7oFy703dxfY3/NLxC1fh2SUCQ0H9rmAY+5EpDVfXjUTTs+HEwR2nYaqLv+GWcTsumwxPfiz6CzCNkwXwBUwqCA==",
      "license": "MIT",
      "dependencies": {
        "balanced-match": "^4.0.2"
      },
      "engines": {
        "node": "18 || 20 || >=22"
      }
    },
    "node_modules/braces": {
      "version": "3.0.3",
      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.3.tgz",
      "integrity": "sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fill-range": "^7.1.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/browserslist": {
      "version": "4.28.5",
      "resolved": "https://registry.npmjs.org/browserslist/-/browserslist-4.28.5.tgz",
      "integrity": "sha512-Cu2E6QejHWzuDMTkuwgpABFgDfZrXLQq5V13YOACZx4mFAG4IwGTbTfHPMr4WtxlHoXSM8FIuRwYYCz5XiabaQ==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/browserslist"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "baseline-browser-mapping": "^2.10.42",
        "caniuse-lite": "^1.0.30001800",
        "electron-to-chromium": "^1.5.387",
        "node-releases": "^2.0.50",
        "update-browserslist-db": "^1.2.3"
      },
      "bin": {
        "browserslist": "cli.js"
      },
      "engines": {
        "node": "^6 || ^7 || ^8 || ^9 || ^10 || ^11 || ^12 || >=13.7"
      }
    },
    "node_modules/bser": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/bser/-/bser-2.1.1.tgz",
      "integrity": "sha512-gQxTNE/GAfIIrmHLUE3oJyp5FO6HRBfhjnw4/wMmA63ZGDJnWBmgY/lyQBpnDUkGmAhbSe39tx2d/iTOAfglwQ==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "node-int64": "^0.4.0"
      }
    },
    "node_modules/bson": {
      "version": "7.3.1",
      "resolved": "https://registry.npmjs.org/bson/-/bson-7.3.1.tgz",
      "integrity": "sha512-h/C0qe6857pQhcSJHLfsR1uYGj98Ge3wKAD3Ed9KqH3wcVh+BM4Jq4xISD7vs9OPuT07n+q3QQVjslJ286j6ag==",
      "license": "Apache-2.0",
      "engines": {
        "node": ">=20.19.0"
      }
    },
    "node_modules/buffer-equal-constant-time": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/buffer-equal-constant-time/-/buffer-equal-constant-time-1.0.1.tgz",
      "integrity": "sha512-zRpUiDwd/xk6ADqPMATG8vc9VPrkck7T07OIx0gnjmJAnHnTVXNQG3vfvWNuiZIkwu9KrKdA1iJKfsfTVxE6NA==",
      "license": "BSD-3-Clause"
    },
    "node_modules/buffer-from": {
      "version": "1.1.2",
      "resolved": "https://registry.npmjs.org/buffer-from/-/buffer-from-1.1.2.tgz",
      "integrity": "sha512-E+XQCRwSbaaiChtv6k6Dwgc+bx+Bs6vuKJHHl5kox/BaKbhiXzqQOwK4cO22yElGp2OCmjwVhT3HmxgyPGnJfQ==",
      "license": "MIT"
    },
    "node_modules/busboy": {
      "version": "1.6.0",
      "resolved": "https://registry.npmjs.org/busboy/-/busboy-1.6.0.tgz",
      "integrity": "sha512-8SFQbg/0hQ9xy3UNTB0YEnsNBbWfhf7RtnzpL7TkBiTBRfrQ9Fxcnz7VJsleJpyp6rVLvXiuORqjlHi5q+PYuA==",
      "dependencies": {
        "streamsearch": "^1.1.0"
      },
      "engines": {
        "node": ">=10.16.0"
      }
    },
    "node_modules/bytes": {
      "version": "3.1.2",
      "resolved": "https://registry.npmjs.org/bytes/-/bytes-3.1.2.tgz",
      "integrity": "sha512-/Nf7TyzTx6S3yRJObOAV7956r8cr2+Oj8AC5dt8wSP3BQAoeX58NoHyCU8P8zGkNXStjTSi6fzO6F0pBdcYbEg==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/call-bind-apply-helpers": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/call-bind-apply-helpers/-/call-bind-apply-helpers-1.0.2.tgz",
      "integrity": "sha512-Sp1ablJ0ivDkSzjcaJdxEunN5/XvksFJ2sMBFfq6x0ryhQV/2b/KwFe21cMpmHtPOSij8K99/wSfoEuTObmuMQ==",
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "function-bind": "^1.1.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/call-bound": {
      "version": "1.0.4",
      "resolved": "https://registry.npmjs.org/call-bound/-/call-bound-1.0.4.tgz",
      "integrity": "sha512-+ys997U96po4Kx/ABpBCqhA9EuxJaQWDQg7295H4hBphv3IZg0boBKuwYpt4YXp6MZ5AmZQnU/tyMTlRpaSejg==",
      "license": "MIT",
      "dependencies": {
        "call-bind-apply-helpers": "^1.0.2",
        "get-intrinsic": "^1.3.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/call-me-maybe": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/call-me-maybe/-/call-me-maybe-1.0.2.tgz",
      "integrity": "sha512-HpX65o1Hnr9HH25ojC1YGs7HCQLq0GCOibSaWER0eNpgJ/Z1MZv2mTc7+xh6WOPxbRVcmgbv4hGU+uSQ/2xFZQ==",
      "license": "MIT"
    },
    "node_modules/callsites": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/callsites/-/callsites-3.1.0.tgz",
      "integrity": "sha512-P8BjAsXvZS+VIDUI11hHCQEv74YT67YUi5JJFNWIqL235sBmjX4+qx9Muvls5ivyNENctx46xQLQ3aTuE7ssaQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/camelcase": {
      "version": "5.3.1",
      "resolved": "https://registry.npmjs.org/camelcase/-/camelcase-5.3.1.tgz",
      "integrity": "sha512-L28STB170nwWS63UjtlEOE3dldQApaJXZkOI1uMFfzf3rRuPegHaHesyee+YxQ+W6SvRDQV6UrdOdRiR153wJg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/caniuse-lite": {
      "version": "1.0.30001803",
      "resolved": "https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001803.tgz",
      "integrity": "sha512-g/uHREV2ZpK9qMalCsWaxmA6ol+DX8GYhuf3T40RKoP+oL7vhRJh8LNt73PCjpnR6l14FzfPrB5Yux4PKm2meg==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/caniuse-lite"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "CC-BY-4.0"
    },
    "node_modules/chalk": {
      "version": "4.1.2",
      "resolved": "https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz",
      "integrity": "sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-styles": "^4.1.0",
        "supports-color": "^7.1.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/chalk/chalk?sponsor=1"
      }
    },
    "node_modules/chalk/node_modules/has-flag": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/has-flag/-/has-flag-4.0.0.tgz",
      "integrity": "sha512-EykJT/Q1KjTWctppgIAgfSO0tKVuZUjhgMr17kqTumMl6Afv3EISleU7qZUzoXDFTAHTDC4NOoG/ZxU3EvlMPQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/chalk/node_modules/supports-color": {
      "version": "7.2.0",
      "resolved": "https://registry.npmjs.org/supports-color/-/supports-color-7.2.0.tgz",
      "integrity": "sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "has-flag": "^4.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/char-regex": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/char-regex/-/char-regex-1.0.2.tgz",
      "integrity": "sha512-kWWXztvZ5SBQV+eRgKFeh8q5sLuZY2+8WUIzlxWVTg+oGwY14qylx1KbKzHd8P6ZYkAg0xyIDU9JMHhyJMZ1jw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/chokidar": {
      "version": "3.6.0",
      "resolved": "https://registry.npmjs.org/chokidar/-/chokidar-3.6.0.tgz",
      "integrity": "sha512-7VT13fmjotKpGipCW9JEQAusEPE+Ei8nl6/g4FBAmIm0GOOLMua9NDDo/DWp0ZAxCr3cPq5ZpBqmPAQgDda2Pw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "anymatch": "~3.1.2",
        "braces": "~3.0.2",
        "glob-parent": "~5.1.2",
        "is-binary-path": "~2.1.0",
        "is-glob": "~4.0.1",
        "normalize-path": "~3.0.0",
        "readdirp": "~3.6.0"
      },
      "engines": {
        "node": ">= 8.10.0"
      },
      "funding": {
        "url": "https://paulmillr.com/funding/"
      },
      "optionalDependencies": {
        "fsevents": "~2.3.2"
      }
    },
    "node_modules/ci-info": {
      "version": "4.4.0",
      "resolved": "https://registry.npmjs.org/ci-info/-/ci-info-4.4.0.tgz",
      "integrity": "sha512-77PSwercCZU2Fc4sX94eF8k8Pxte6JAwL4/ICZLFjJLqegs7kCuAsqqj/70NQF6TvDpgFjkubQB2FW2ZZddvQg==",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/sibiraj-s"
        }
      ],
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/cjs-module-lexer": {
      "version": "2.2.0",
      "resolved": "https://registry.npmjs.org/cjs-module-lexer/-/cjs-module-lexer-2.2.0.tgz",
      "integrity": "sha512-4bHTS2YuzUvtoLjdy+98ykbNB5jS0+07EvFNXerqZQJ89F7DI6ET7OQo/HJuW6K0aVsKA9hj9/RVb2kQVOrPDQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/cliui": {
      "version": "8.0.1",
      "resolved": "https://registry.npmjs.org/cliui/-/cliui-8.0.1.tgz",
      "integrity": "sha512-BSeNnyus75C4//NQ9gQt1/csTXyo/8Sb+afLAkzAptFuMsod9HFokGNudZpi/oQV73hnVK+sR+5PVRMd+Dr7YQ==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "string-width": "^4.2.0",
        "strip-ansi": "^6.0.1",
        "wrap-ansi": "^7.0.0"
      },
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/cliui/node_modules/ansi-regex": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/ansi-regex/-/ansi-regex-5.0.1.tgz",
      "integrity": "sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/cliui/node_modules/emoji-regex": {
      "version": "8.0.0",
      "resolved": "https://registry.npmjs.org/emoji-regex/-/emoji-regex-8.0.0.tgz",
      "integrity": "sha512-MSjYzcWNOA0ewAHpz0MxpYFvwg6yjy1NG3xteoqz644VCo/RPgnr1/GGt+ic3iJTzQ8Eu3TdM14SawnVUmGE6A==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/cliui/node_modules/string-width": {
      "version": "4.2.3",
      "resolved": "https://registry.npmjs.org/string-width/-/string-width-4.2.3.tgz",
      "integrity": "sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "emoji-regex": "^8.0.0",
        "is-fullwidth-code-point": "^3.0.0",
        "strip-ansi": "^6.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/cliui/node_modules/strip-ansi": {
      "version": "6.0.1",
      "resolved": "https://registry.npmjs.org/strip-ansi/-/strip-ansi-6.0.1.tgz",
      "integrity": "sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-regex": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/cliui/node_modules/wrap-ansi": {
      "version": "7.0.0",
      "resolved": "https://registry.npmjs.org/wrap-ansi/-/wrap-ansi-7.0.0.tgz",
      "integrity": "sha512-YVGIj2kamLSTxw6NsZjoBxfSwsn0ycdesmc4p+Q21c5zPuZ1pl+NfxVdxPtdHvmNVOQ6XSYG4AUtyt/Fi7D16Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-styles": "^4.0.0",
        "string-width": "^4.1.0",
        "strip-ansi": "^6.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/chalk/wrap-ansi?sponsor=1"
      }
    },
    "node_modules/cluster-key-slot": {
      "version": "1.1.2",
      "resolved": "https://registry.npmjs.org/cluster-key-slot/-/cluster-key-slot-1.1.2.tgz",
      "integrity": "sha512-RMr0FhtfXemyinomL4hrWcYJxmX6deFdCxpJzhDttxgO1+bcCnkk+9drydLVDmAMG7NE6aN/fl4F7ucU/90gAA==",
      "license": "Apache-2.0",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/co": {
      "version": "4.6.0",
      "resolved": "https://registry.npmjs.org/co/-/co-4.6.0.tgz",
      "integrity": "sha512-QVb0dM5HvG+uaxitm8wONl7jltx8dqhfU33DcqtOZcLSVIKSDDLDi7+0LbAKiyI8hD9u42m2YxXSkMGWThaecQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "iojs": ">= 1.0.0",
        "node": ">= 0.12.0"
      }
    },
    "node_modules/collect-v8-coverage": {
      "version": "1.0.3",
      "resolved": "https://registry.npmjs.org/collect-v8-coverage/-/collect-v8-coverage-1.0.3.tgz",
      "integrity": "sha512-1L5aqIkwPfiodaMgQunkF1zRhNqifHBmtbbbxcr6yVxxBnliw4TDOW6NxpO8DJLgJ16OT+Y4ztZqP6p/FtXnAw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/color-convert": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/color-convert/-/color-convert-2.0.1.tgz",
      "integrity": "sha512-RRECPsj7iu/xb5oKYcsFHSppFNnsj/52OVTRKb4zP5onXwVF3zVmmToNcOfGC+CRDpfK/U584fMg38ZHCaElKQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "color-name": "~1.1.4"
      },
      "engines": {
        "node": ">=7.0.0"
      }
    },
    "node_modules/color-name": {
      "version": "1.1.4",
      "resolved": "https://registry.npmjs.org/color-name/-/color-name-1.1.4.tgz",
      "integrity": "sha512-dOy+3AuW3a2wNbZHIuMZpTcgjGuLU/uBL/ubcZF9OXbDo8ff4O8yVp5Bf0efS8uEoYo5q4Fx7dY9OgQGXgAsQA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/combined-stream": {
      "version": "1.0.8",
      "resolved": "https://registry.npmjs.org/combined-stream/-/combined-stream-1.0.8.tgz",
      "integrity": "sha512-FQN4MRfuJeHf7cBbBMJFXhKSDq+2kAArBlmRBvcvFE5BB1HZKXtSFASDhdlz9zOYwxh8lDdnvmMOe/+5cdoEdg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "delayed-stream": "~1.0.0"
      },
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/commander": {
      "version": "6.2.0",
      "resolved": "https://registry.npmjs.org/commander/-/commander-6.2.0.tgz",
      "integrity": "sha512-zP4jEKbe8SHzKJYQmq8Y9gYjtO/POJLgIdKgV7B9qNmABVFVc+ctqSX6iXh4mCpJfRBOabiZ2YKPg8ciDw6C+Q==",
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/component-emitter": {
      "version": "1.3.1",
      "resolved": "https://registry.npmjs.org/component-emitter/-/component-emitter-1.3.1.tgz",
      "integrity": "sha512-T0+barUSQRTUQASh8bx02dl+DhF54GtIDY13Y3m9oWTklKbb3Wv974meRpeZ3lp1JpLVECWWNHC4vaG2XHXouQ==",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/concat-map": {
      "version": "0.0.1",
      "resolved": "https://registry.npmjs.org/concat-map/-/concat-map-0.0.1.tgz",
      "integrity": "sha512-/Srv4dswyQNBfohGpz9o6Yb3Gz3SrUDqBH5rTuhGR7ahtlbYKnVxw2bCFMRljaA7EXHaXZ8wsHdodFvbkhKmqg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/concat-stream": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/concat-stream/-/concat-stream-2.0.0.tgz",
      "integrity": "sha512-MWufYdFw53ccGjCA+Ol7XJYpAlW6/prSMzuPOTRnJGcGzuhLn4Scrz7qf6o8bROZ514ltazcIFJZevcfbo0x7A==",
      "engines": [
        "node >= 6.0"
      ],
      "license": "MIT",
      "dependencies": {
        "buffer-from": "^1.0.0",
        "inherits": "^2.0.3",
        "readable-stream": "^3.0.2",
        "typedarray": "^0.0.6"
      }
    },
    "node_modules/content-disposition": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/content-disposition/-/content-disposition-1.1.0.tgz",
      "integrity": "sha512-5jRCH9Z/+DRP7rkvY83B+yGIGX96OYdJmzngqnw2SBSxqCFPd0w2km3s5iawpGX8krnwSGmF0FW5Nhr0Hfai3g==",
      "license": "MIT",
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/express"
      }
    },
    "node_modules/content-type": {
      "version": "1.0.5",
      "resolved": "https://registry.npmjs.org/content-type/-/content-type-1.0.5.tgz",
      "integrity": "sha512-nTjqfcBFEipKdXCv4YDQWCfmcLZKm81ldF0pAopTvyrFGVbcR6P/VAAd5G7N+0tTr8QqiU0tFadD6FK4NtJwOA==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/convert-source-map": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/convert-source-map/-/convert-source-map-2.0.0.tgz",
      "integrity": "sha512-Kvp459HrV2FEJ1CAsi1Ku+MY3kasH19TFykTz2xWmMeq6bk2NU3XXvfJ+Q61m0xktWwt+1HSYf3JZsTms3aRJg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/cookie": {
      "version": "0.7.2",
      "resolved": "https://registry.npmjs.org/cookie/-/cookie-0.7.2.tgz",
      "integrity": "sha512-yki5XnKuf750l50uGTllt6kKILY4nQ1eNIQatoXEByZ5dWgnKqbnqmTrBE5B4N7lrMJKQ2ytWMiTO2o0v6Ew/w==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/cookie-signature": {
      "version": "1.2.2",
      "resolved": "https://registry.npmjs.org/cookie-signature/-/cookie-signature-1.2.2.tgz",
      "integrity": "sha512-D76uU73ulSXrD1UXF4KE2TMxVVwhsnCgfAyTg9k8P6KGZjlXKrOLe4dJQKI3Bxi5wjesZoFXJWElNWBjPZMbhg==",
      "license": "MIT",
      "engines": {
        "node": ">=6.6.0"
      }
    },
    "node_modules/cookiejar": {
      "version": "2.1.4",
      "resolved": "https://registry.npmjs.org/cookiejar/-/cookiejar-2.1.4.tgz",
      "integrity": "sha512-LDx6oHrK+PhzLKJU9j5S7/Y3jM/mUHvD/DeI1WQmJn652iPC5Y4TBzC9l+5OMOXlyTTA+SmVUPm0HQUwpD5Jqw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/core-js-compat": {
      "version": "3.49.0",
      "resolved": "https://registry.npmjs.org/core-js-compat/-/core-js-compat-3.49.0.tgz",
      "integrity": "sha512-VQXt1jr9cBz03b331DFDCCP90b3fanciLkgiOoy8SBHy06gNf+vQ1A3WFLqG7I8TipYIKeYK9wxd0tUrvHcOZA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "browserslist": "^4.28.1"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/core-js"
      }
    },
    "node_modules/cors": {
      "version": "2.8.6",
      "resolved": "https://registry.npmjs.org/cors/-/cors-2.8.6.tgz",
      "integrity": "sha512-tJtZBBHA6vjIAaF6EnIaq6laBBP9aq/Y3ouVJjEfoHbRBcHBAHYcMh/w8LDrk2PvIMMq8gmopa5D4V8RmbrxGw==",
      "license": "MIT",
      "dependencies": {
        "object-assign": "^4",
        "vary": "^1"
      },
      "engines": {
        "node": ">= 0.10"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/express"
      }
    },
    "node_modules/cross-env": {
      "version": "10.1.0",
      "resolved": "https://registry.npmjs.org/cross-env/-/cross-env-10.1.0.tgz",
      "integrity": "sha512-GsYosgnACZTADcmEyJctkJIoqAhHjttw7RsFrVoJNXbsWWqaq6Ym+7kZjq6mS45O0jij6vtiReppKQEtqWy6Dw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@epic-web/invariant": "^1.0.0",
        "cross-spawn": "^7.0.6"
      },
      "bin": {
        "cross-env": "dist/bin/cross-env.js",
        "cross-env-shell": "dist/bin/cross-env-shell.js"
      },
      "engines": {
        "node": ">=20"
      }
    },
    "node_modules/cross-spawn": {
      "version": "7.0.6",
      "resolved": "https://registry.npmjs.org/cross-spawn/-/cross-spawn-7.0.6.tgz",
      "integrity": "sha512-uV2QOWP2nWzsy2aMp8aRibhi9dlzF5Hgh5SHaB9OiTGEyDTiJJyx0uy51QXdyWbtAHNua4XJzUKca3OzKUd3vA==",
      "license": "MIT",
      "dependencies": {
        "path-key": "^3.1.0",
        "shebang-command": "^2.0.0",
        "which": "^2.0.1"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/debug": {
      "version": "4.4.3",
      "resolved": "https://registry.npmjs.org/debug/-/debug-4.4.3.tgz",
      "integrity": "sha512-RGwwWnwQvkVfavKVt22FGLw+xYSdzARwm0ru6DhTVA3umU5hZc28V3kO4stgYryrTlLpuvgI9GiijltAjNbcqA==",
      "license": "MIT",
      "dependencies": {
        "ms": "^2.1.3"
      },
      "engines": {
        "node": ">=6.0"
      },
      "peerDependenciesMeta": {
        "supports-color": {
          "optional": true
        }
      }
    },
    "node_modules/dedent": {
      "version": "1.7.2",
      "resolved": "https://registry.npmjs.org/dedent/-/dedent-1.7.2.tgz",
      "integrity": "sha512-WzMx3mW98SN+zn3hgemf4OzdmyNhhhKz5Ay0pUfQiMQ3e1g+xmTJWp/pKdwKVXhdSkAEGIIzqeuWrL3mV/AXbA==",
      "dev": true,
      "license": "MIT",
      "peerDependencies": {
        "babel-plugin-macros": "^3.1.0"
      },
      "peerDependenciesMeta": {
        "babel-plugin-macros": {
          "optional": true
        }
      }
    },
    "node_modules/deepmerge": {
      "version": "4.3.1",
      "resolved": "https://registry.npmjs.org/deepmerge/-/deepmerge-4.3.1.tgz",
      "integrity": "sha512-3sUqbMEc77XqpdNO7FRyRog+eW3ph+GYCbj+rK+uYyRMuwsVy0rMiVtPn+QJlKFvWP/1PYpapqYn0Me2knFn+A==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/delayed-stream": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/delayed-stream/-/delayed-stream-1.0.0.tgz",
      "integrity": "sha512-ZySD7Nf91aLB0RxL4KGrKHBXl7Eds1DAmEdcoVawXnLD7SDhpNgtuII2aAkg7a7QS41jxPSZ17p4VdGnMHk3MQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.4.0"
      }
    },
    "node_modules/depd": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/depd/-/depd-2.0.0.tgz",
      "integrity": "sha512-g7nH6P6dyDioJogAAGprGpCtVImJhpPk/roCzdb3fIh61/s/nPsfR6onyMwkCAR/OlC3yBC0lESvUoQEAssIrw==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/detect-newline": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/detect-newline/-/detect-newline-3.1.0.tgz",
      "integrity": "sha512-TLz+x/vEXm/Y7P7wn1EJFNLxYpUD4TgMosxY6fAVJUnJMbupHBOncxyWUG9OpTaH9EBD7uFI5LfEgmMOc54DsA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/dezalgo": {
      "version": "1.0.4",
      "resolved": "https://registry.npmjs.org/dezalgo/-/dezalgo-1.0.4.tgz",
      "integrity": "sha512-rXSP0bf+5n0Qonsb+SVVfNfIsimO4HEtmnIpPHY8Q1UCzKlQrDMfdobr8nJOOsRgWCyMRqeSBQzmWUMq7zvVig==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "asap": "^2.0.0",
        "wrappy": "1"
      }
    },
    "node_modules/doctrine": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/doctrine/-/doctrine-3.0.0.tgz",
      "integrity": "sha512-yS+Q5i3hBf7GBkd4KG8a7eBNNWNGLTaEwwYWUijIYM7zrlYDM0BFXHjjPWlWZ1Rg7UaddZeIDmi9jF3HmqiQ2w==",
      "license": "Apache-2.0",
      "dependencies": {
        "esutils": "^2.0.2"
      },
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/dotenv": {
      "version": "17.4.2",
      "resolved": "https://registry.npmjs.org/dotenv/-/dotenv-17.4.2.tgz",
      "integrity": "sha512-nI4U3TottKAcAD9LLud4Cb7b2QztQMUEfHbvhTH09bqXTxnSie8WnjPALV/WMCrJZ6UV/qHJ6L03OqO3LcdYZw==",
      "license": "BSD-2-Clause",
      "engines": {
        "node": ">=12"
      },
      "funding": {
        "url": "https://dotenvx.com"
      }
    },
    "node_modules/dunder-proto": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/dunder-proto/-/dunder-proto-1.0.1.tgz",
      "integrity": "sha512-KIN/nDJBQRcXw0MLVhZE9iQHmG68qAVIBg9CqmUYjmQIhgij9U5MFvrqkUL5FbtyyzZuOeOt0zdeRe4UY7ct+A==",
      "license": "MIT",
      "dependencies": {
        "call-bind-apply-helpers": "^1.0.1",
        "es-errors": "^1.3.0",
        "gopd": "^1.2.0"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/eastasianwidth": {
      "version": "0.2.0",
      "resolved": "https://registry.npmjs.org/eastasianwidth/-/eastasianwidth-0.2.0.tgz",
      "integrity": "sha512-I88TYZWc9XiYHRQ4/3c5rjjfgkjhLyW2luGIheGERbNQ6OY7yTybanSpDXZa8y7VUP9YmDcYa+eyq4ca7iLqWA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/ecdsa-sig-formatter": {
      "version": "1.0.11",
      "resolved": "https://registry.npmjs.org/ecdsa-sig-formatter/-/ecdsa-sig-formatter-1.0.11.tgz",
      "integrity": "sha512-nagl3RYrbNv6kQkeJIpt6NJZy8twLB/2vtz6yN9Z4vRKHN4/QZJIEbqohALSgwKdnksuY3k5Addp5lg8sVoVcQ==",
      "license": "Apache-2.0",
      "dependencies": {
        "safe-buffer": "^5.0.1"
      }
    },
    "node_modules/ee-first": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/ee-first/-/ee-first-1.1.1.tgz",
      "integrity": "sha512-WMwm9LhRUo+WUaRN+vRuETqG89IgZphVSNkdFgeb6sS/E4OrDIN7t48CAewSHXc6C8lefD8KKfr5vY61brQlow==",
      "license": "MIT"
    },
    "node_modules/electron-to-chromium": {
      "version": "1.5.389",
      "resolved": "https://registry.npmjs.org/electron-to-chromium/-/electron-to-chromium-1.5.389.tgz",
      "integrity": "sha512-cEto7aeOqBfU1D+c5py5pE+ooscKE75JifxLBdFUZsqAxRS6y7kebtxAZvICszSl05gPjYHDTjY+lXpyGvpJbg==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/emittery": {
      "version": "0.13.1",
      "resolved": "https://registry.npmjs.org/emittery/-/emittery-0.13.1.tgz",
      "integrity": "sha512-DeWwawk6r5yR9jFgnDKYt4sLS0LmHJJi3ZOnb5/JdbYwj3nW+FxQnHIjhBKz8YLC7oRNPVM9NQ47I3CVx34eqQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12"
      },
      "funding": {
        "url": "https://github.com/sindresorhus/emittery?sponsor=1"
      }
    },
    "node_modules/emoji-regex": {
      "version": "9.2.2",
      "resolved": "https://registry.npmjs.org/emoji-regex/-/emoji-regex-9.2.2.tgz",
      "integrity": "sha512-L18DaJsXSUk2+42pv8mLs5jJT2hqFkFE4j21wOmgbUqsZ2hL72NsUU785g9RXgo3s0ZNgVl42TiHp3ZtOv/Vyg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/encodeurl": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/encodeurl/-/encodeurl-2.0.0.tgz",
      "integrity": "sha512-Q0n9HRi4m6JuGIV1eFlmvJB7ZEVxu93IrMyiMsGC0lrMJMWzRgx6WGquyfQgZVb31vhGgXnfmPNNXmxnOkRBrg==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/error-ex": {
      "version": "1.3.4",
      "resolved": "https://registry.npmjs.org/error-ex/-/error-ex-1.3.4.tgz",
      "integrity": "sha512-sqQamAnR14VgCr1A618A3sGrygcpK+HEbenA/HiEAkkUwcZIIB/tgWqHFxWgOyDh4nB4JCRimh79dR5Ywc9MDQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-arrayish": "^0.2.1"
      }
    },
    "node_modules/es-define-property": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/es-define-property/-/es-define-property-1.0.1.tgz",
      "integrity": "sha512-e3nRfgfUZ4rNGL232gUgX06QNyyez04KdjFrF+LTRoOXmrOgFKDg4BCdsjW8EnT69eqdYGmRpJwiPVYNrCaW3g==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/es-errors": {
      "version": "1.3.0",
      "resolved": "https://registry.npmjs.org/es-errors/-/es-errors-1.3.0.tgz",
      "integrity": "sha512-Zf5H2Kxt2xjTvbJvP2ZWLEICxA6j+hAmMzIlypy4xcBg1vKVnx89Wy0GbS+kf5cwCVFFzdCFh2XSCFNULS6csw==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/es-object-atoms": {
      "version": "1.1.2",
      "resolved": "https://registry.npmjs.org/es-object-atoms/-/es-object-atoms-1.1.2.tgz",
      "integrity": "sha512-HWcBoN6NileqtSydK2FqHbS/LoDd2pqrnQHLyJzBj4kOp/ky2MWMN694xOfkK8/SnUsW2DH7EfyVlydKCsm1Zw==",
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/es-set-tostringtag": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/es-set-tostringtag/-/es-set-tostringtag-2.1.0.tgz",
      "integrity": "sha512-j6vWzfrGVfyXxge+O0x5sh6cvxAog0a/4Rdd2K36zCMV5eJ+/+tOAngRO8cODMNWbVRdVlmGZQL2YS3yR8bIUA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "get-intrinsic": "^1.2.6",
        "has-tostringtag": "^1.0.2",
        "hasown": "^2.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/escalade": {
      "version": "3.2.0",
      "resolved": "https://registry.npmjs.org/escalade/-/escalade-3.2.0.tgz",
      "integrity": "sha512-WUj2qlxaQtO4g6Pq5c29GTcWGDyd8itL8zTlipgECz3JesAiiOKotd8JU6otB3PACgG6xkJUyVhboMS+bje/jA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/escape-html": {
      "version": "1.0.3",
      "resolved": "https://registry.npmjs.org/escape-html/-/escape-html-1.0.3.tgz",
      "integrity": "sha512-NiSupZ4OeuGwr68lGIeym/ksIZMJodUGOSCZ/FSnTxcrekbvqrgdUxlJOMpijaKZVjAJrWrGs/6Jy8OMuyj9ow==",
      "license": "MIT"
    },
    "node_modules/escape-string-regexp": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/escape-string-regexp/-/escape-string-regexp-2.0.0.tgz",
      "integrity": "sha512-UpzcLCXolUWcNu5HtVMHYdXJjArjsF9C0aNnquZYY4uW/Vu0miy5YoWvbV345HauVvcAUnpRuhMMcqTcGOY2+w==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/esprima": {
      "version": "4.0.1",
      "resolved": "https://registry.npmjs.org/esprima/-/esprima-4.0.1.tgz",
      "integrity": "sha512-eGuFFw7Upda+g4p+QHvnW0RyTX/SVeJBDM/gCtMARO0cLuT2HcEKnTPvhjV6aGeqrCB/sbNop0Kszm0jsaWU4A==",
      "dev": true,
      "license": "BSD-2-Clause",
      "bin": {
        "esparse": "bin/esparse.js",
        "esvalidate": "bin/esvalidate.js"
      },
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/esutils": {
      "version": "2.0.3",
      "resolved": "https://registry.npmjs.org/esutils/-/esutils-2.0.3.tgz",
      "integrity": "sha512-kVscqXk4OCp68SZ0dkgEKVi6/8ij300KBWTJq32P/dYeWTSwK41WyTxalN1eRmA5Z9UU/LX9D7FWSmV9SAYx6g==",
      "license": "BSD-2-Clause",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/etag": {
      "version": "1.8.1",
      "resolved": "https://registry.npmjs.org/etag/-/etag-1.8.1.tgz",
      "integrity": "sha512-aIL5Fx7mawVa300al2BnEE4iNvo1qETxLrPI/o05L7z6go7fCw1J6EQmbK4FmJ2AS7kgVF/KEZWufBfdClMcPg==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/execa": {
      "version": "5.1.1",
      "resolved": "https://registry.npmjs.org/execa/-/execa-5.1.1.tgz",
      "integrity": "sha512-8uSpZZocAZRBAPIEINJj3Lo9HyGitllczc27Eh5YYojjMFMn8yHMDMaUHE2Jqfq05D/wucwI4JGURyXt1vchyg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "cross-spawn": "^7.0.3",
        "get-stream": "^6.0.0",
        "human-signals": "^2.1.0",
        "is-stream": "^2.0.0",
        "merge-stream": "^2.0.0",
        "npm-run-path": "^4.0.1",
        "onetime": "^5.1.2",
        "signal-exit": "^3.0.3",
        "strip-final-newline": "^2.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sindresorhus/execa?sponsor=1"
      }
    },
    "node_modules/execa/node_modules/signal-exit": {
      "version": "3.0.7",
      "resolved": "https://registry.npmjs.org/signal-exit/-/signal-exit-3.0.7.tgz",
      "integrity": "sha512-wnD2ZE+l+SPC/uoS0vXeE9L1+0wuaMqKlfz9AMUo38JsyLSBWSFcHR1Rri62LZc12vLr1gb3jl7iwQhgwpAbGQ==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/exit-x": {
      "version": "0.2.2",
      "resolved": "https://registry.npmjs.org/exit-x/-/exit-x-0.2.2.tgz",
      "integrity": "sha512-+I6B/IkJc1o/2tiURyz/ivu/O0nKNEArIUB5O7zBrlDVJr22SCLH3xTeEry428LvFhRzIA1g8izguxJ/gbNcVQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/expect": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/expect/-/expect-30.4.1.tgz",
      "integrity": "sha512-PMARsyh/JtqC20HoGqlFcIlQAyqUtW4PlI1rup1uhYJtKuwAjbvWi3GQMAn+STdHum/dk8xrKfUM1+5SAwpolA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/expect-utils": "30.4.1",
        "@jest/get-type": "30.1.0",
        "jest-matcher-utils": "30.4.1",
        "jest-message-util": "30.4.1",
        "jest-mock": "30.4.1",
        "jest-util": "30.4.1"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/express": {
      "version": "5.2.1",
      "resolved": "https://registry.npmjs.org/express/-/express-5.2.1.tgz",
      "integrity": "sha512-hIS4idWWai69NezIdRt2xFVofaF4j+6INOpJlVOLDO8zXGpUVEVzIYk12UUi2JzjEzWL3IOAxcTubgz9Po0yXw==",
      "license": "MIT",
      "dependencies": {
        "accepts": "^2.0.0",
        "body-parser": "^2.2.1",
        "content-disposition": "^1.0.0",
        "content-type": "^1.0.5",
        "cookie": "^0.7.1",
        "cookie-signature": "^1.2.1",
        "debug": "^4.4.0",
        "depd": "^2.0.0",
        "encodeurl": "^2.0.0",
        "escape-html": "^1.0.3",
        "etag": "^1.8.1",
        "finalhandler": "^2.1.0",
        "fresh": "^2.0.0",
        "http-errors": "^2.0.0",
        "merge-descriptors": "^2.0.0",
        "mime-types": "^3.0.0",
        "on-finished": "^2.4.1",
        "once": "^1.4.0",
        "parseurl": "^1.3.3",
        "proxy-addr": "^2.0.7",
        "qs": "^6.14.0",
        "range-parser": "^1.2.1",
        "router": "^2.2.0",
        "send": "^1.1.0",
        "serve-static": "^2.2.0",
        "statuses": "^2.0.1",
        "type-is": "^2.0.1",
        "vary": "^1.1.2"
      },
      "engines": {
        "node": ">= 18"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/express"
      }
    },
    "node_modules/express-rate-limit": {
      "version": "8.7.0",
      "resolved": "https://registry.npmjs.org/express-rate-limit/-/express-rate-limit-8.7.0.tgz",
      "integrity": "sha512-hOwV7WOxXfjRpAM1DSJWZDXx3GhplwD8IfwuwvogD8i1Qnkgosw/H45s4ZnFAUHDAhPjlY9hLBvJhKmGMyY26g==",
      "license": "MIT",
      "dependencies": {
        "debug": "^4.4.3",
        "ip-address": "^10.2.0"
      },
      "engines": {
        "node": ">= 16"
      },
      "funding": {
        "url": "https://github.com/sponsors/express-rate-limit"
      },
      "peerDependencies": {
        "express": ">= 4.11"
      }
    },
    "node_modules/fast-deep-equal": {
      "version": "3.1.3",
      "resolved": "https://registry.npmjs.org/fast-deep-equal/-/fast-deep-equal-3.1.3.tgz",
      "integrity": "sha512-f3qQ9oQy9j2AhBe/H9VC91wLmKBCCU/gDOnKNAYG5hswO7BLKj09Hc5HYNz9cGI++xlpDCIgDaitVs03ATR84Q==",
      "license": "MIT"
    },
    "node_modules/fast-json-stable-stringify": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/fast-json-stable-stringify/-/fast-json-stable-stringify-2.1.0.tgz",
      "integrity": "sha512-lhd/wF+Lk98HZoTCtlVraHtfh5XYijIjalXck7saUtuanSDyLMxnHhSXEDJqHxD7msR8D0uCmqlkwjCV8xvwHw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/fast-safe-stringify": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/fast-safe-stringify/-/fast-safe-stringify-2.1.1.tgz",
      "integrity": "sha512-W+KJc2dmILlPplD/H4K9l9LcAHAfPtP6BY84uVLXQ6Evcz9Lcg33Y2z1IVblT6xdY54PXYVHEv+0Wpq8Io6zkA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/fast-uri": {
      "version": "3.1.3",
      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.3.tgz",
      "integrity": "sha512-i70LwGWUduXqzicKXWshooq+sWL1K3WUU5rKZNG/0i3a1OSoX3HqhH5WbWwTmqWfor4urUakGPiRQcleRZTwOg==",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/fastify"
        },
        {
          "type": "opencollective",
          "url": "https://opencollective.com/fastify"
        }
      ],
      "license": "BSD-3-Clause"
    },
    "node_modules/fb-watchman": {
      "version": "2.0.2",
      "resolved": "https://registry.npmjs.org/fb-watchman/-/fb-watchman-2.0.2.tgz",
      "integrity": "sha512-p5161BqbuCaSnB8jIbzQHOlpgsPmK5rJVDfDKO91Axs5NC1uu3HRQm6wt9cd9/+GtQQIO53JdGXXoyDpTAsgYA==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "bser": "2.1.1"
      }
    },
    "node_modules/fill-range": {
      "version": "7.1.1",
      "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.1.1.tgz",
      "integrity": "sha512-YsGpe3WHLK8ZYi4tWDg2Jy3ebRz2rXowDxnld4bkQB00cc/1Zw9AWnC0i9ztDJitivtQvaI9KaLyKrc+hBW0yg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "to-regex-range": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/finalhandler": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/finalhandler/-/finalhandler-2.1.1.tgz",
      "integrity": "sha512-S8KoZgRZN+a5rNwqTxlZZePjT/4cnm0ROV70LedRHZ0p8u9fRID0hJUZQpkKLzro8LfmC8sx23bY6tVNxv8pQA==",
      "license": "MIT",
      "dependencies": {
        "debug": "^4.4.0",
        "encodeurl": "^2.0.0",
        "escape-html": "^1.0.3",
        "on-finished": "^2.4.1",
        "parseurl": "^1.3.3",
        "statuses": "^2.0.1"
      },
      "engines": {
        "node": ">= 18.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/express"
      }
    },
    "node_modules/find-up": {
      "version": "4.1.0",
      "resolved": "https://registry.npmjs.org/find-up/-/find-up-4.1.0.tgz",
      "integrity": "sha512-PpOwAdQ/YlXQ2vj8a3h8IipDuYRi3wceVQQGYWxNINccq40Anw7BlsEXCMbt1Zt+OLA6Fq9suIpIWD0OsnISlw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "locate-path": "^5.0.0",
        "path-exists": "^4.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/foreground-child": {
      "version": "3.3.1",
      "resolved": "https://registry.npmjs.org/foreground-child/-/foreground-child-3.3.1.tgz",
      "integrity": "sha512-gIXjKqtFuWEgzFRJA9WCQeSJLZDjgJUOMCMzxtvFq/37KojM1BFGufqsCy0r4qSQmYLsZYMeyRqzIWOMup03sw==",
      "license": "ISC",
      "dependencies": {
        "cross-spawn": "^7.0.6",
        "signal-exit": "^4.0.1"
      },
      "engines": {
        "node": ">=14"
      },
      "funding": {
        "url": "https://github.com/sponsors/isaacs"
      }
    },
    "node_modules/form-data": {
      "version": "4.0.6",
      "resolved": "https://registry.npmjs.org/form-data/-/form-data-4.0.6.tgz",
      "integrity": "sha512-vKatAh4SlVfgbv+YtmhiRjhEMJsYpsG1Y2rMQtR+SVSbytsSD1YGzDIcrAJmdFec88u/+VoGmxnl+80gL1tRCQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "asynckit": "^0.4.0",
        "combined-stream": "^1.0.8",
        "es-set-tostringtag": "^2.1.0",
        "hasown": "^2.0.4",
        "mime-types": "^2.1.35"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/form-data/node_modules/mime-db": {
      "version": "1.52.0",
      "resolved": "https://registry.npmjs.org/mime-db/-/mime-db-1.52.0.tgz",
      "integrity": "sha512-sPU4uV7dYlvtWJxwwxHD0PuihVNiE7TyAbQ5SWxDCB9mUYvOgroQOwYQQOKPJ8CIbE+1ETVlOoK1UC2nU3gYvg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/form-data/node_modules/mime-types": {
      "version": "2.1.35",
      "resolved": "https://registry.npmjs.org/mime-types/-/mime-types-2.1.35.tgz",
      "integrity": "sha512-ZDY+bPm5zTTF+YpCrAU9nK0UgICYPT0QtT1NZWFv4s++TNkcgVaT0g6+4R2uI4MjQjzysHB1zxuWL50hzaeXiw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "mime-db": "1.52.0"
      },
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/formidable": {
      "version": "3.5.4",
      "resolved": "https://registry.npmjs.org/formidable/-/formidable-3.5.4.tgz",
      "integrity": "sha512-YikH+7CUTOtP44ZTnUhR7Ic2UASBPOqmaRkRKxRbywPTe5VxF7RRCck4af9wutiZ/QKM5nME9Bie2fFaPz5Gug==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@paralleldrive/cuid2": "^2.2.2",
        "dezalgo": "^1.0.4",
        "once": "^1.4.0"
      },
      "engines": {
        "node": ">=14.0.0"
      },
      "funding": {
        "url": "https://ko-fi.com/tunnckoCore/commissions"
      }
    },
    "node_modules/forwarded": {
      "version": "0.2.0",
      "resolved": "https://registry.npmjs.org/forwarded/-/forwarded-0.2.0.tgz",
      "integrity": "sha512-buRG0fpBtRHSTCOASe6hD258tEubFoRLb4ZNA6NxMVHNw2gOcwHo9wyablzMzOA5z9xA9L1KNjk/Nt6MT9aYow==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/fresh": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/fresh/-/fresh-2.0.0.tgz",
      "integrity": "sha512-Rx/WycZ60HOaqLKAi6cHRKKI7zxWbJ31MhntmtwMoaTeF7XFH9hhBp8vITaMidfljRQ6eYWCKkaTK+ykVJHP2A==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/fs.realpath": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/fs.realpath/-/fs.realpath-1.0.0.tgz",
      "integrity": "sha512-OO0pH2lK6a0hZnAdau5ItzHPI6pUlvI7jMVnxUQRtw4owF2wk8lOSabtGDCTP4Ggrg2MbGnWO9X8K1t4+fGMDw==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/fsevents": {
      "version": "2.3.3",
      "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz",
      "integrity": "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==",
      "dev": true,
      "hasInstallScript": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": "^8.16.0 || ^10.6.0 || >=11.0.0"
      }
    },
    "node_modules/function-bind": {
      "version": "1.1.2",
      "resolved": "https://registry.npmjs.org/function-bind/-/function-bind-1.1.2.tgz",
      "integrity": "sha512-7XHNxH7qX9xG5mIwxkhumTox/MIRNcOgDrxWsMt2pAr23WHp6MrRlN7FBSFpCpr+oVO0F744iUgR82nJMfG2SA==",
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/gensync": {
      "version": "1.0.0-beta.2",
      "resolved": "https://registry.npmjs.org/gensync/-/gensync-1.0.0-beta.2.tgz",
      "integrity": "sha512-3hN7NaskYvMDLQY55gnW3NQ+mesEAepTqlg+VEbj7zzqEMBVNhzcGYYeqFo/TlYz6eQiFcp1HcsCZO+nGgS8zg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/get-caller-file": {
      "version": "2.0.5",
      "resolved": "https://registry.npmjs.org/get-caller-file/-/get-caller-file-2.0.5.tgz",
      "integrity": "sha512-DyFP3BM/3YHTQOCUL/w0OZHR0lpKeGrxotcHWcqNEdnltqFwXVfhEBQ94eIo34AfQpo0rGki4cyIiftY06h2Fg==",
      "dev": true,
      "license": "ISC",
      "engines": {
        "node": "6.* || 8.* || >= 10.*"
      }
    },
    "node_modules/get-intrinsic": {
      "version": "1.3.0",
      "resolved": "https://registry.npmjs.org/get-intrinsic/-/get-intrinsic-1.3.0.tgz",
      "integrity": "sha512-9fSjSaos/fRIVIp+xSJlE6lfwhES7LNtKaCBIamHsjr2na1BiABJPo0mOjjz8GJDURarmCPGqaiVg5mfjb98CQ==",
      "license": "MIT",
      "dependencies": {
        "call-bind-apply-helpers": "^1.0.2",
        "es-define-property": "^1.0.1",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.1.1",
        "function-bind": "^1.1.2",
        "get-proto": "^1.0.1",
        "gopd": "^1.2.0",
        "has-symbols": "^1.1.0",
        "hasown": "^2.0.2",
        "math-intrinsics": "^1.1.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/get-package-type": {
      "version": "0.1.0",
      "resolved": "https://registry.npmjs.org/get-package-type/-/get-package-type-0.1.0.tgz",
      "integrity": "sha512-pjzuKtY64GYfWizNAJ0fr9VqttZkNiK2iS430LtIHzjBEr6bX8Am2zm4sW4Ro5wjWW5cAlRL1qAMTcXbjNAO2Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8.0.0"
      }
    },
    "node_modules/get-proto": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/get-proto/-/get-proto-1.0.1.tgz",
      "integrity": "sha512-sTSfBjoXBp89JvIKIefqw7U2CCebsc74kiY6awiGogKtoSGbgjYE/G/+l9sF3MWFPNc9IcoOC4ODfKHfxFmp0g==",
      "license": "MIT",
      "dependencies": {
        "dunder-proto": "^1.0.1",
        "es-object-atoms": "^1.0.0"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/get-stream": {
      "version": "6.0.1",
      "resolved": "https://registry.npmjs.org/get-stream/-/get-stream-6.0.1.tgz",
      "integrity": "sha512-ts6Wi+2j3jQjqi70w5AlN8DFnkSwC+MqmxEzdEALB2qXZYV3X/b1CTfgPLGJNMeAWxdPfU8FO1ms3NUfaHCPYg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/glob": {
      "version": "10.5.0",
      "resolved": "https://registry.npmjs.org/glob/-/glob-10.5.0.tgz",
      "integrity": "sha512-DfXN8DfhJ7NH3Oe7cFmu3NCu1wKbkReJ8TorzSAFbSKrlNaQSKfIzqYqVY8zlbs2NLBbWpRiU52GX2PbaBVNkg==",
      "deprecated": "Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "foreground-child": "^3.1.0",
        "jackspeak": "^3.1.2",
        "minimatch": "^9.0.4",
        "minipass": "^7.1.2",
        "package-json-from-dist": "^1.0.0",
        "path-scurry": "^1.11.1"
      },
      "bin": {
        "glob": "dist/esm/bin.mjs"
      },
      "funding": {
        "url": "https://github.com/sponsors/isaacs"
      }
    },
    "node_modules/glob-parent": {
      "version": "5.1.2",
      "resolved": "https://registry.npmjs.org/glob-parent/-/glob-parent-5.1.2.tgz",
      "integrity": "sha512-AOIgSQCepiJYwP3ARnGx+5VnTu2HBYdzbGP45eLw1vr3zB3vZLeyed1sC9hnbcOc9/SrMyM5RPQrkGz4aS9Zow==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/glob/node_modules/balanced-match": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/balanced-match/-/balanced-match-1.0.2.tgz",
      "integrity": "sha512-3oSeUO0TMV67hN1AmbXsK4yaqU7tjiHlbxRDZOpH0KW9+CeX4bRAaX0Anxt0tx2MrpRpWwQaPwIlISEJhYU5Pw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/glob/node_modules/brace-expansion": {
      "version": "2.1.2",
      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-2.1.2.tgz",
      "integrity": "sha512-w5JZcKgdhDOgOwm8H+KgbosopHMuGcl6qbulwjtz3SM7I7P3yW1eAjzMPLrIE+NQ9vjgANKHWeMHnrT0OXW1oA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "balanced-match": "^1.0.0"
      }
    },
    "node_modules/glob/node_modules/minimatch": {
      "version": "9.0.9",
      "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-9.0.9.tgz",
      "integrity": "sha512-OBwBN9AL4dqmETlpS2zasx+vTeWclWzkblfZk7KTA5j3jeOONz/tRCnZomUyvNg83wL5Zv9Ss6HMJXAgL8R2Yg==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "brace-expansion": "^2.0.2"
      },
      "engines": {
        "node": ">=16 || 14 >=14.17"
      },
      "funding": {
        "url": "https://github.com/sponsors/isaacs"
      }
    },
    "node_modules/gopd": {
      "version": "1.2.0",
      "resolved": "https://registry.npmjs.org/gopd/-/gopd-1.2.0.tgz",
      "integrity": "sha512-ZUKRh6/kUFoAiTAtTYPZJ3hw9wNxx+BIBOijnlG9PnrJsCcSjs1wyyD6vJpaYtgnzDrKYRSqf3OO6Rfa93xsRg==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/graceful-fs": {
      "version": "4.2.11",
      "resolved": "https://registry.npmjs.org/graceful-fs/-/graceful-fs-4.2.11.tgz",
      "integrity": "sha512-RbJ5/jmFcNNCcDV5o9eTnBLJ/HszWV0P73bc+Ff4nS/rJj+YaS6IGyiOL0VoBYX+l1Wrl3k63h/KrH+nhJ0XvQ==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/has-flag": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/has-flag/-/has-flag-3.0.0.tgz",
      "integrity": "sha512-sKJf1+ceQBr4SMkvQnBDNDtf4TXpVhVGateu0t918bl30FnbE2m4vNLX+VWe/dpjlb+HugGYzW7uQXH98HPEYw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/has-symbols": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/has-symbols/-/has-symbols-1.1.0.tgz",
      "integrity": "sha512-1cDNdwJ2Jaohmb3sg4OmKaMBwuC48sYni5HUw2DvsC8LjGTLK9h+eb1X6RyuOHe4hT0ULCW68iomhjUoKUqlPQ==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/has-tostringtag": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/has-tostringtag/-/has-tostringtag-1.0.2.tgz",
      "integrity": "sha512-NqADB8VjPFLM2V0VvHUewwwsw0ZWBaIdgo+ieHtK3hasLz4qeCRjYcqfB6AQrBggRKppKF8L52/VqdVsO47Dlw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "has-symbols": "^1.0.3"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/hasown": {
      "version": "2.0.4",
      "resolved": "https://registry.npmjs.org/hasown/-/hasown-2.0.4.tgz",
      "integrity": "sha512-T2UbfbBEF32wiepXIsMlTW9+dDYC6wMh/t/vYA4tuOMKqWz/n3vr1NFSxQiyP+zk2mXsoMA/i/7qV6LKut1t1A==",
      "license": "MIT",
      "dependencies": {
        "function-bind": "^1.1.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/helmet": {
      "version": "8.3.0",
      "resolved": "https://registry.npmjs.org/helmet/-/helmet-8.3.0.tgz",
      "integrity": "sha512-Qgpiaws3Sm30Av8Eah6sjMCZZwjlBu+E68rhpCWBshY1lb09HtLwj5GviX0OyQIn+ulUS0iX0AxN5n3tLZzz1w==",
      "license": "MIT",
      "engines": {
        "node": ">=18.0.0"
      },
      "funding": {
        "url": "https://github.com/sponsors/EvanHahn"
      }
    },
    "node_modules/html-escaper": {
      "version": "2.0.2",
      "resolved": "https://registry.npmjs.org/html-escaper/-/html-escaper-2.0.2.tgz",
      "integrity": "sha512-H2iMtd0I4Mt5eYiapRdIDjp+XzelXQ0tFE4JS7YFwFevXXMmOp9myNrUvCg0D6ws8iqkRPBfKHgbwig1SmlLfg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/http-errors": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/http-errors/-/http-errors-2.0.1.tgz",
      "integrity": "sha512-4FbRdAX+bSdmo4AUFuS0WNiPz8NgFt+r8ThgNWmlrjQjt1Q7ZR9+zTlce2859x4KSXrwIsaeTqDoKQmtP8pLmQ==",
      "license": "MIT",
      "dependencies": {
        "depd": "~2.0.0",
        "inherits": "~2.0.4",
        "setprototypeof": "~1.2.0",
        "statuses": "~2.0.2",
        "toidentifier": "~1.0.1"
      },
      "engines": {
        "node": ">= 0.8"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/express"
      }
    },
    "node_modules/human-signals": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/human-signals/-/human-signals-2.1.0.tgz",
      "integrity": "sha512-B4FFZ6q/T2jhhksgkbEW3HBvWIfDW85snkQgawt07S7J5QXTk6BkNV+0yAeZrM5QpMAdYlocGoljn0sJ/WQkFw==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=10.17.0"
      }
    },
    "node_modules/iconv-lite": {
      "version": "0.7.3",
      "resolved": "https://registry.npmjs.org/iconv-lite/-/iconv-lite-0.7.3.tgz",
      "integrity": "sha512-IKXpvIzjnC9XTAUbVBcMfGS0EPaIXtW6v+zr+RRp+hqULEpo0owZax6wyRwPOJbWbzjYspQwusTsfVr0ifh4uQ==",
      "license": "MIT",
      "dependencies": {
        "safer-buffer": ">= 2.1.2 < 3.0.0"
      },
      "engines": {
        "node": ">=0.10.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/express"
      }
    },
    "node_modules/ignore-by-default": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/ignore-by-default/-/ignore-by-default-1.0.1.tgz",
      "integrity": "sha512-Ius2VYcGNk7T90CppJqcIkS5ooHUZyIQK+ClZfMfMNFEF9VSE73Fq+906u/CWu92x4gzZMWOwfFYckPObzdEbA==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/import-local": {
      "version": "3.2.0",
      "resolved": "https://registry.npmjs.org/import-local/-/import-local-3.2.0.tgz",
      "integrity": "sha512-2SPlun1JUPWoM6t3F0dw0FkCF/jWY8kttcY4f599GLTSjh2OCuuhdTkJQsEcZzBqbXZGKMK2OqW1oZsjtf/gQA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "pkg-dir": "^4.2.0",
        "resolve-cwd": "^3.0.0"
      },
      "bin": {
        "import-local-fixture": "fixtures/cli.js"
      },
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/imurmurhash": {
      "version": "0.1.4",
      "resolved": "https://registry.npmjs.org/imurmurhash/-/imurmurhash-0.1.4.tgz",
      "integrity": "sha512-JmXMZ6wuvDmLiHEml9ykzqO6lwFbof0GG4IkcGaENdCRDDmMVnny7s5HsIgHCbaq0w2MyPhDqkhTUgS2LU2PHA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.8.19"
      }
    },
    "node_modules/inflight": {
      "version": "1.0.6",
      "resolved": "https://registry.npmjs.org/inflight/-/inflight-1.0.6.tgz",
      "integrity": "sha512-k92I/b08q4wvFscXCLvqfsHCrjrF7yiXsQuIVvVE7N82W3+aqpzuUdBbfhWcy/FZR3/4IgflMgKLOsvPDrGCJA==",
      "deprecated": "This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "once": "^1.3.0",
        "wrappy": "1"
      }
    },
    "node_modules/inherits": {
      "version": "2.0.4",
      "resolved": "https://registry.npmjs.org/inherits/-/inherits-2.0.4.tgz",
      "integrity": "sha512-k/vGaX4/Yla3WzyMCvTQOXYeIHvqOKtnqBduzTHpzpQZzAskKMhZ2K+EnBiSM9zGSoIFeMpXKxa4dYeZIQqewQ==",
      "license": "ISC"
    },
    "node_modules/ip-address": {
      "version": "10.7.2",
      "resolved": "https://registry.npmjs.org/ip-address/-/ip-address-10.7.2.tgz",
      "integrity": "sha512-7H/2gFSIitxc0hG3nOI1glS8QLo/EHBFFLk8vEUjXY/xu0AdL8jZ9U1IzO2PUm0d2D/ofQcAifb0g6OBkt8U7w==",
      "license": "MIT",
      "engines": {
        "node": ">= 12"
      }
    },
    "node_modules/ipaddr.js": {
      "version": "1.9.1",
      "resolved": "https://registry.npmjs.org/ipaddr.js/-/ipaddr.js-1.9.1.tgz",
      "integrity": "sha512-0KI/607xoxSToH7GjN1FfSbLoU0+btTicjsQSWQlh/hZykN8KpmMf7uYwPW3R+akZ6R/w18ZlXSHBYXiYUPO3g==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.10"
      }
    },
    "node_modules/is-arrayish": {
      "version": "0.2.1",
      "resolved": "https://registry.npmjs.org/is-arrayish/-/is-arrayish-0.2.1.tgz",
      "integrity": "sha512-zz06S8t0ozoDXMG+ube26zeCTNXcKIPJZJi8hBrF4idCLms4CG9QtK7qBl1boi5ODzFpjswb5JPmHCbMpjaYzg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/is-binary-path": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/is-binary-path/-/is-binary-path-2.1.0.tgz",
      "integrity": "sha512-ZMERYes6pDydyuGidse7OsHxtbI7WVeUEozgR/g7rd0xUimYNlvZRE/K2MgZTjWy725IfelLeVcEM97mmtRGXw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "binary-extensions": "^2.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/is-core-module": {
      "version": "2.16.2",
      "resolved": "https://registry.npmjs.org/is-core-module/-/is-core-module-2.16.2.tgz",
      "integrity": "sha512-evOr8xfXKxE6qSR0hSXL2r3sd7ALj8+7jQEUvPYcm5sgZFdJ+AYzT6yNmJenvIYQBgIGwfwz08sL8zoL7yq2BA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "hasown": "^2.0.3"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-extglob": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/is-extglob/-/is-extglob-2.1.1.tgz",
      "integrity": "sha512-SbKbANkN603Vi4jEZv49LeVJMn4yGwsbzZworEoyEiutsN3nJYdbO36zfhGJ6QEDpOZIFkDtnq5JRxmvl3jsoQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-fullwidth-code-point": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/is-fullwidth-code-point/-/is-fullwidth-code-point-3.0.0.tgz",
      "integrity": "sha512-zymm5+u+sCsSWyD9qNaejV3DFvhCKclKdizYaJUuHA83RLjb7nSuGnddCHGv0hk+KY7BMAlsWeK4Ueg6EV6XQg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/is-generator-fn": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/is-generator-fn/-/is-generator-fn-2.1.0.tgz",
      "integrity": "sha512-cTIB4yPYL/Grw0EaSzASzg6bBy9gqCofvWN8okThAYIxKJZC+udlRAmGbM0XLeniEJSs8uEgHPGuHSe1XsOLSQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/is-glob": {
      "version": "4.0.3",
      "resolved": "https://registry.npmjs.org/is-glob/-/is-glob-4.0.3.tgz",
      "integrity": "sha512-xelSayHH36ZgE7ZWhli7pW34hNbNl8Ojv5KVmkJD4hBdD3th8Tfk9vYasLM+mXWOZhFkgZfxhLSnrwRr4elSSg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-extglob": "^2.1.1"
      },
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-number": {
      "version": "7.0.0",
      "resolved": "https://registry.npmjs.org/is-number/-/is-number-7.0.0.tgz",
      "integrity": "sha512-41Cifkg6e8TylSpdtTpeLVMqvSBEVzTttHvERD741+pnZ8ANv0004MRL43QKPDlK9cGvNp6NZWZUBlbGXYxxng==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.12.0"
      }
    },
    "node_modules/is-promise": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/is-promise/-/is-promise-4.0.0.tgz",
      "integrity": "sha512-hvpoI6korhJMnej285dSg6nu1+e6uxs7zG3BYAm5byqDsgJNWwxzM6z6iZiAgQR4TJ30JmBTOwqZUw3WlyH3AQ==",
      "license": "MIT"
    },
    "node_modules/is-stream": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/is-stream/-/is-stream-2.0.1.tgz",
      "integrity": "sha512-hFoiJiTl63nn+kstHGBtewWSKnQLpyb155KHheA1l39uvtO9nWIop1p3udqPcUd/xbF1VLMO4n7OI6p7RbngDg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/isexe": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/isexe/-/isexe-2.0.0.tgz",
      "integrity": "sha512-RHxMLp9lnKHGHRng9QFhRCMbYAcVpn69smSGcq3f36xjgVVWThj4qqLbTLlq7Ssj8B+fIQ1EuCEGI2lKsyQeIw==",
      "license": "ISC"
    },
    "node_modules/istanbul-lib-coverage": {
      "version": "3.2.2",
      "resolved": "https://registry.npmjs.org/istanbul-lib-coverage/-/istanbul-lib-coverage-3.2.2.tgz",
      "integrity": "sha512-O8dpsF+r0WV/8MNRKfnmrtCWhuKjxrq2w+jpzBL5UZKTi2LeVWnWOmWRxFlesJONmc+wLAGvKQZEOanko0LFTg==",
      "dev": true,
      "license": "BSD-3-Clause",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/istanbul-lib-instrument": {
      "version": "6.0.3",
      "resolved": "https://registry.npmjs.org/istanbul-lib-instrument/-/istanbul-lib-instrument-6.0.3.tgz",
      "integrity": "sha512-Vtgk7L/R2JHyyGW07spoFlB8/lpjiOLTjMdms6AFMraYt3BaJauod/NGrfnVG/y4Ix1JEuMRPDPEj2ua+zz1/Q==",
      "dev": true,
      "license": "BSD-3-Clause",
      "dependencies": {
        "@babel/core": "^7.23.9",
        "@babel/parser": "^7.23.9",
        "@istanbuljs/schema": "^0.1.3",
        "istanbul-lib-coverage": "^3.2.0",
        "semver": "^7.5.4"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/istanbul-lib-report": {
      "version": "3.0.1",
      "resolved": "https://registry.npmjs.org/istanbul-lib-report/-/istanbul-lib-report-3.0.1.tgz",
      "integrity": "sha512-GCfE1mtsHGOELCU8e/Z7YWzpmybrx/+dSTfLrvY8qRmaY6zXTKWn6WQIjaAFw069icm6GVMNkgu0NzI4iPZUNw==",
      "dev": true,
      "license": "BSD-3-Clause",
      "dependencies": {
        "istanbul-lib-coverage": "^3.0.0",
        "make-dir": "^4.0.0",
        "supports-color": "^7.1.0"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/istanbul-lib-report/node_modules/has-flag": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/has-flag/-/has-flag-4.0.0.tgz",
      "integrity": "sha512-EykJT/Q1KjTWctppgIAgfSO0tKVuZUjhgMr17kqTumMl6Afv3EISleU7qZUzoXDFTAHTDC4NOoG/ZxU3EvlMPQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/istanbul-lib-report/node_modules/supports-color": {
      "version": "7.2.0",
      "resolved": "https://registry.npmjs.org/supports-color/-/supports-color-7.2.0.tgz",
      "integrity": "sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "has-flag": "^4.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/istanbul-lib-source-maps": {
      "version": "5.0.6",
      "resolved": "https://registry.npmjs.org/istanbul-lib-source-maps/-/istanbul-lib-source-maps-5.0.6.tgz",
      "integrity": "sha512-yg2d+Em4KizZC5niWhQaIomgf5WlL4vOOjZ5xGCmF8SnPE/mDWWXgvRExdcpCgh9lLRRa1/fSYp2ymmbJ1pI+A==",
      "dev": true,
      "license": "BSD-3-Clause",
      "dependencies": {
        "@jridgewell/trace-mapping": "^0.3.23",
        "debug": "^4.1.1",
        "istanbul-lib-coverage": "^3.0.0"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/istanbul-reports": {
      "version": "3.2.0",
      "resolved": "https://registry.npmjs.org/istanbul-reports/-/istanbul-reports-3.2.0.tgz",
      "integrity": "sha512-HGYWWS/ehqTV3xN10i23tkPkpH46MLCIMFNCaaKNavAXTF1RkqxawEPtnjnGZ6XKSInBKkiOA5BKS+aZiY3AvA==",
      "dev": true,
      "license": "BSD-3-Clause",
      "dependencies": {
        "html-escaper": "^2.0.0",
        "istanbul-lib-report": "^3.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/jackspeak": {
      "version": "3.4.3",
      "resolved": "https://registry.npmjs.org/jackspeak/-/jackspeak-3.4.3.tgz",
      "integrity": "sha512-OGlZQpz2yfahA/Rd1Y8Cd9SIEsqvXkLVoSw/cgwhnhFMDbsQFeZYoJJ7bIZBS9BcamUW96asq/npPWugM+RQBw==",
      "dev": true,
      "license": "BlueOak-1.0.0",
      "dependencies": {
        "@isaacs/cliui": "^8.0.2"
      },
      "funding": {
        "url": "https://github.com/sponsors/isaacs"
      },
      "optionalDependencies": {
        "@pkgjs/parseargs": "^0.11.0"
      }
    },
    "node_modules/jest": {
      "version": "30.4.2",
      "resolved": "https://registry.npmjs.org/jest/-/jest-30.4.2.tgz",
      "integrity": "sha512-Yi1jqNC/Oq0N4hBgNH/YvBpP1P57QqundgytzYqy3yqAa7NZPNjSoi4SGbRAXDMdBzNE6xBCi5U7RgfrvMEUVQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/core": "30.4.2",
        "@jest/types": "30.4.1",
        "import-local": "^3.2.0",
        "jest-cli": "30.4.2"
      },
      "bin": {
        "jest": "bin/jest.js"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      },
      "peerDependencies": {
        "node-notifier": "^8.0.1 || ^9.0.0 || ^10.0.0"
      },
      "peerDependenciesMeta": {
        "node-notifier": {
          "optional": true
        }
      }
    },
    "node_modules/jest-changed-files": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/jest-changed-files/-/jest-changed-files-30.4.1.tgz",
      "integrity": "sha512-IuctmYrxi21iOSOaIXpJWalHyPAsVv0GeBHKDn8C1CA4W5htHn7INL+wdnL4Bo0+olEndvAFkmb++tIQJG+vvg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "execa": "^5.1.1",
        "jest-util": "30.4.1",
        "p-limit": "^3.1.0"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/jest-circus": {
      "version": "30.4.2",
      "resolved": "https://registry.npmjs.org/jest-circus/-/jest-circus-30.4.2.tgz",
      "integrity": "sha512-rvHH7VlY6LgbJXJTQ87GW62g1FntOtbhh0zT+v04kC+pgL6aBKyYINXxWukCpj3dcIBMw5/XUbtDS9dU9JTXeQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/environment": "30.4.1",
        "@jest/expect": "30.4.1",
        "@jest/test-result": "30.4.1",
        "@jest/types": "30.4.1",
        "@types/node": "*",
        "chalk": "^4.1.2",
        "co": "^4.6.0",
        "dedent": "^1.6.0",
        "is-generator-fn": "^2.1.0",
        "jest-each": "30.4.1",
        "jest-matcher-utils": "30.4.1",
        "jest-message-util": "30.4.1",
        "jest-runtime": "30.4.2",
        "jest-snapshot": "30.4.1",
        "jest-util": "30.4.1",
        "p-limit": "^3.1.0",
        "pretty-format": "30.4.1",
        "pure-rand": "^7.0.0",
        "slash": "^3.0.0",
        "stack-utils": "^2.0.6"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/jest-cli": {
      "version": "30.4.2",
      "resolved": "https://registry.npmjs.org/jest-cli/-/jest-cli-30.4.2.tgz",
      "integrity": "sha512-jfA2ocvVHMXS2QijrJ0d31ektP+d/W0T5RpcTX2Pq+3sVqHlsXVCM2+FmwpL+bdY8OfHpIg9xMxLF17Zg0U49Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/core": "30.4.2",
        "@jest/test-result": "30.4.1",
        "@jest/types": "30.4.1",
        "chalk": "^4.1.2",
        "exit-x": "^0.2.2",
        "import-local": "^3.2.0",
        "jest-config": "30.4.2",
        "jest-util": "30.4.1",
        "jest-validate": "30.4.1",
        "yargs": "^17.7.2"
      },
      "bin": {
        "jest": "bin/jest.js"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      },
      "peerDependencies": {
        "node-notifier": "^8.0.1 || ^9.0.0 || ^10.0.0"
      },
      "peerDependenciesMeta": {
        "node-notifier": {
          "optional": true
        }
      }
    },
    "node_modules/jest-config": {
      "version": "30.4.2",
      "resolved": "https://registry.npmjs.org/jest-config/-/jest-config-30.4.2.tgz",
      "integrity": "sha512-rNHAShJQqQwFNoL0hbf3BphSBOWnpOUAKvidLS/AjNVLPfoj5mSf4jQMfW3cYOs6hXeZC7nF7mDHaBnbxELOzg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/core": "^7.27.4",
        "@jest/get-type": "30.1.0",
        "@jest/pattern": "30.4.0",
        "@jest/test-sequencer": "30.4.1",
        "@jest/types": "30.4.1",
        "babel-jest": "30.4.1",
        "chalk": "^4.1.2",
        "ci-info": "^4.2.0",
        "deepmerge": "^4.3.1",
        "glob": "^10.5.0",
        "graceful-fs": "^4.2.11",
        "jest-circus": "30.4.2",
        "jest-docblock": "30.4.0",
        "jest-environment-node": "30.4.1",
        "jest-regex-util": "30.4.0",
        "jest-resolve": "30.4.1",
        "jest-runner": "30.4.2",
        "jest-util": "30.4.1",
        "jest-validate": "30.4.1",
        "parse-json": "^5.2.0",
        "pretty-format": "30.4.1",
        "slash": "^3.0.0",
        "strip-json-comments": "^3.1.1"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      },
      "peerDependencies": {
        "@types/node": "*",
        "esbuild-register": ">=3.4.0",
        "ts-node": ">=9.0.0"
      },
      "peerDependenciesMeta": {
        "@types/node": {
          "optional": true
        },
        "esbuild-register": {
          "optional": true
        },
        "ts-node": {
          "optional": true
        }
      }
    },
    "node_modules/jest-diff": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/jest-diff/-/jest-diff-30.4.1.tgz",
      "integrity": "sha512-CRpFK0RtLriVDGcPPAnR6HMVI8bSR2jnUIgralhauzYQZIb4RH9AtEInTuQr65LmmGggGcRT6HIASxwqsVsmlA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/diff-sequences": "30.4.0",
        "@jest/get-type": "30.1.0",
        "chalk": "^4.1.2",
        "pretty-format": "30.4.1"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/jest-docblock": {
      "version": "30.4.0",
      "resolved": "https://registry.npmjs.org/jest-docblock/-/jest-docblock-30.4.0.tgz",
      "integrity": "sha512-ZPMabUZCx5MpbZ2eBYSvZ0J8fvo3dR9oM+eeUpb3aKNQFuS2tu3Duw1TNlMoP8k3WQgKGJuhcMFvwcVuq6T7oA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "detect-newline": "^3.1.0"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/jest-each": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/jest-each/-/jest-each-30.4.1.tgz",
      "integrity": "sha512-/8MJbH6fuj48TstjrMf+u/pd06Qezz5xOXvZA6442heNOWr8bdeoGZX2d9fCn028CoMgYmroH9//zky5GfyYmA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/get-type": "30.1.0",
        "@jest/types": "30.4.1",
        "chalk": "^4.1.2",
        "jest-util": "30.4.1",
        "pretty-format": "30.4.1"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/jest-environment-node": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/jest-environment-node/-/jest-environment-node-30.4.1.tgz",
      "integrity": "sha512-4FZYVOk85hz2AyT6BbarKy9u37g6DbrDyCdFhsnDdXqyrueYQvB+0zO4f/kqLCRD0BsPRXPMNJeQwihKZV8naw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/environment": "30.4.1",
        "@jest/fake-timers": "30.4.1",
        "@jest/types": "30.4.1",
        "@types/node": "*",
        "jest-mock": "30.4.1",
        "jest-util": "30.4.1",
        "jest-validate": "30.4.1"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/jest-haste-map": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/jest-haste-map/-/jest-haste-map-30.4.1.tgz",
      "integrity": "sha512-rFrcONd8jeFsyw+Z9CrScJgglRf2+NFmNam8dKu7n+SoHqNYT47mn0DdEcVUZJpvh7Iz6/si7f7yUH7GJHVgnw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/types": "30.4.1",
        "@types/node": "*",
        "anymatch": "^3.1.3",
        "fb-watchman": "^2.0.2",
        "graceful-fs": "^4.2.11",
        "jest-regex-util": "30.4.0",
        "jest-util": "30.4.1",
        "jest-worker": "30.4.1",
        "picomatch": "^4.0.3",
        "walker": "^1.0.8"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      },
      "optionalDependencies": {
        "fsevents": "^2.3.3"
      }
    },
    "node_modules/jest-haste-map/node_modules/picomatch": {
      "version": "4.0.5",
      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-4.0.5.tgz",
      "integrity": "sha512-RvwwcruNjI1ncT5xRakeyS9Lf8lcItv34KD+aif+VH9kduAyfYBipGh12274xtenIPZ119/R9BdTBa8gAwSh0A==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/jest-leak-detector": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/jest-leak-detector/-/jest-leak-detector-30.4.1.tgz",
      "integrity": "sha512-IpmyiioeHxiWDhesHnUFmOxcTzwCwKpgACgWajtAP+nYQXiY7DakTxB6Bx9JFiRMljr0AX1PvnQdaU1KFoz6NQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/get-type": "30.1.0",
        "pretty-format": "30.4.1"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/jest-matcher-utils": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/jest-matcher-utils/-/jest-matcher-utils-30.4.1.tgz",
      "integrity": "sha512-zvYfX5CaeEkFrrLS9suWe9rvJrm9J1Iv3ua8kIBv9GEPzcnsfBf0bob37la7s67fs0nlBC3EuvkOLnXQKxtx4A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/get-type": "30.1.0",
        "chalk": "^4.1.2",
        "jest-diff": "30.4.1",
        "pretty-format": "30.4.1"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/jest-message-util": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/jest-message-util/-/jest-message-util-30.4.1.tgz",
      "integrity": "sha512-kwCKIvq0MCW1HzLoGola9Te6JUdzgV0loyKJ3Qghrkz9i5/RRIHsL95BMQc2HBBhlBKC4j22K9p11TGHH8RBpQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/code-frame": "^7.27.1",
        "@jest/types": "30.4.1",
        "@types/stack-utils": "^2.0.3",
        "chalk": "^4.1.2",
        "graceful-fs": "^4.2.11",
        "jest-util": "30.4.1",
        "picomatch": "^4.0.3",
        "pretty-format": "30.4.1",
        "slash": "^3.0.0",
        "stack-utils": "^2.0.6"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/jest-message-util/node_modules/picomatch": {
      "version": "4.0.5",
      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-4.0.5.tgz",
      "integrity": "sha512-RvwwcruNjI1ncT5xRakeyS9Lf8lcItv34KD+aif+VH9kduAyfYBipGh12274xtenIPZ119/R9BdTBa8gAwSh0A==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/jest-mock": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/jest-mock/-/jest-mock-30.4.1.tgz",
      "integrity": "sha512-/i8SVb8/NSB7RfNi8gfqu8gxLV23KaL5EpAttyb9iz8qWRIqXRLflycz/32wXsYkOnaUlx8NAKnJYtpsmXUmfw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/types": "30.4.1",
        "@types/node": "*",
        "jest-util": "30.4.1"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/jest-pnp-resolver": {
      "version": "1.2.3",
      "resolved": "https://registry.npmjs.org/jest-pnp-resolver/-/jest-pnp-resolver-1.2.3.tgz",
      "integrity": "sha512-+3NpwQEnRoIBtx4fyhblQDPgJI0H1IEIkX7ShLUjPGA7TtUTvI1oiKi3SR4oBR0hQhQR80l4WAe5RrXBwWMA8w==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      },
      "peerDependencies": {
        "jest-resolve": "*"
      },
      "peerDependenciesMeta": {
        "jest-resolve": {
          "optional": true
        }
      }
    },
    "node_modules/jest-regex-util": {
      "version": "30.4.0",
      "resolved": "https://registry.npmjs.org/jest-regex-util/-/jest-regex-util-30.4.0.tgz",
      "integrity": "sha512-mWlvLviKIgIQ8VCuM1xRdD0TWp3zlzionlmDBjuXVBs+VkmXq6FgW9T4Emr7oGz/Rk6feDCGyiugolcQEyp3mg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/jest-resolve": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/jest-resolve/-/jest-resolve-30.4.1.tgz",
      "integrity": "sha512-Zry8Yq/yJcNAZ7dJ5F2heic8AheXvbFZ7XI5V+h28nrYZ7Qoyy4dItq8OodjnYD270mvX+ZudmrNV9cysqhW5Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "chalk": "^4.1.2",
        "graceful-fs": "^4.2.11",
        "jest-haste-map": "30.4.1",
        "jest-pnp-resolver": "^1.2.3",
        "jest-util": "30.4.1",
        "jest-validate": "30.4.1",
        "slash": "^3.0.0",
        "unrs-resolver": "^1.7.11"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/jest-resolve-dependencies": {
      "version": "30.4.2",
      "resolved": "https://registry.npmjs.org/jest-resolve-dependencies/-/jest-resolve-dependencies-30.4.2.tgz",
      "integrity": "sha512-gDiVh1I+GxYzz9oXlyw+1wv6VOYX1WYxMOfjsA3iGKePV2oxmbHhwxfkALxNxYy1ciw6APWwkW2zZONwP97aEQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "jest-regex-util": "30.4.0",
        "jest-snapshot": "30.4.1"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/jest-runner": {
      "version": "30.4.2",
      "resolved": "https://registry.npmjs.org/jest-runner/-/jest-runner-30.4.2.tgz",
      "integrity": "sha512-2dw0PslVYXxffXGpLo+Ejad+KcI1Qkjn7f4X4619gf21oCUmL+SPfjqIa/losUem3yEOvfNZe/F1HWUcNpODcg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/console": "30.4.1",
        "@jest/environment": "30.4.1",
        "@jest/test-result": "30.4.1",
        "@jest/transform": "30.4.1",
        "@jest/types": "30.4.1",
        "@types/node": "*",
        "chalk": "^4.1.2",
        "emittery": "^0.13.1",
        "exit-x": "^0.2.2",
        "graceful-fs": "^4.2.11",
        "jest-docblock": "30.4.0",
        "jest-environment-node": "30.4.1",
        "jest-haste-map": "30.4.1",
        "jest-leak-detector": "30.4.1",
        "jest-message-util": "30.4.1",
        "jest-resolve": "30.4.1",
        "jest-runtime": "30.4.2",
        "jest-util": "30.4.1",
        "jest-watcher": "30.4.1",
        "jest-worker": "30.4.1",
        "p-limit": "^3.1.0",
        "source-map-support": "0.5.13"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/jest-runtime": {
      "version": "30.4.2",
      "resolved": "https://registry.npmjs.org/jest-runtime/-/jest-runtime-30.4.2.tgz",
      "integrity": "sha512-3/5e8iPz2k/VLqlr8DgTftYyLUv8Su3FkCAO2/Od81UsUTpSxOrS6O5x5KkoQwyUjmpYyDJKeyAvg2T2nvpNkQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/environment": "30.4.1",
        "@jest/fake-timers": "30.4.1",
        "@jest/globals": "30.4.1",
        "@jest/source-map": "30.0.1",
        "@jest/test-result": "30.4.1",
        "@jest/transform": "30.4.1",
        "@jest/types": "30.4.1",
        "@types/node": "*",
        "chalk": "^4.1.2",
        "cjs-module-lexer": "^2.1.0",
        "collect-v8-coverage": "^1.0.2",
        "glob": "^10.5.0",
        "graceful-fs": "^4.2.11",
        "jest-haste-map": "30.4.1",
        "jest-message-util": "30.4.1",
        "jest-mock": "30.4.1",
        "jest-regex-util": "30.4.0",
        "jest-resolve": "30.4.1",
        "jest-snapshot": "30.4.1",
        "jest-util": "30.4.1",
        "slash": "^3.0.0",
        "strip-bom": "^4.0.0"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/jest-snapshot": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/jest-snapshot/-/jest-snapshot-30.4.1.tgz",
      "integrity": "sha512-tEOkkfOMppUyeiHwjZswOQ3lcnoTnws/q5FnGIaeIh/jmoU0ZlgMYRR8sTlTj+nNGCoJ0RDq6SfxGxCsyMTPmw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/core": "^7.27.4",
        "@babel/generator": "^7.27.5",
        "@babel/plugin-syntax-jsx": "^7.27.1",
        "@babel/plugin-syntax-typescript": "^7.27.1",
        "@babel/types": "^7.27.3",
        "@jest/expect-utils": "30.4.1",
        "@jest/get-type": "30.1.0",
        "@jest/snapshot-utils": "30.4.1",
        "@jest/transform": "30.4.1",
        "@jest/types": "30.4.1",
        "babel-preset-current-node-syntax": "^1.2.0",
        "chalk": "^4.1.2",
        "expect": "30.4.1",
        "graceful-fs": "^4.2.11",
        "jest-diff": "30.4.1",
        "jest-matcher-utils": "30.4.1",
        "jest-message-util": "30.4.1",
        "jest-util": "30.4.1",
        "pretty-format": "30.4.1",
        "semver": "^7.7.2",
        "synckit": "^0.11.8"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/jest-util": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/jest-util/-/jest-util-30.4.1.tgz",
      "integrity": "sha512-vjQb1sACEiv13DKJMDToJpzVW0joCsIQrmbg0fi7CyOOt+g9jTuQl2A216pWRBYhOVt53XbL/2LbMKg1BECWOw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/types": "30.4.1",
        "@types/node": "*",
        "chalk": "^4.1.2",
        "ci-info": "^4.2.0",
        "graceful-fs": "^4.2.11",
        "picomatch": "^4.0.3"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/jest-util/node_modules/picomatch": {
      "version": "4.0.5",
      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-4.0.5.tgz",
      "integrity": "sha512-RvwwcruNjI1ncT5xRakeyS9Lf8lcItv34KD+aif+VH9kduAyfYBipGh12274xtenIPZ119/R9BdTBa8gAwSh0A==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/jest-validate": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/jest-validate/-/jest-validate-30.4.1.tgz",
      "integrity": "sha512-PDWi4SOwLnwqNDfHZjOcsEFyZ4fc/2W2gVL3DEoyqnB6jCQMLRtfBong8s6omIw3lI0HWOus12xfnFmQtjW3fw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/get-type": "30.1.0",
        "@jest/types": "30.4.1",
        "camelcase": "^6.3.0",
        "chalk": "^4.1.2",
        "leven": "^3.1.0",
        "pretty-format": "30.4.1"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/jest-validate/node_modules/camelcase": {
      "version": "6.3.0",
      "resolved": "https://registry.npmjs.org/camelcase/-/camelcase-6.3.0.tgz",
      "integrity": "sha512-Gmy6FhYlCY7uOElZUSbxo2UCDH8owEk996gkbrpsgGtrJLM3J7jGxl9Ic7Qwwj4ivOE5AWZWRMecDdF7hqGjFA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/jest-watcher": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/jest-watcher/-/jest-watcher-30.4.1.tgz",
      "integrity": "sha512-/l9UonmvCwjHH7d2h3iAwIloLc1H0S8mJZ/LNK3i86hqwPAz8otUJjP9MfYtz9Tt77Su5FD2xGjZn8d31IZHlw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/test-result": "30.4.1",
        "@jest/types": "30.4.1",
        "@types/node": "*",
        "ansi-escapes": "^4.3.2",
        "chalk": "^4.1.2",
        "emittery": "^0.13.1",
        "jest-util": "30.4.1",
        "string-length": "^4.0.2"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/jest-worker": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/jest-worker/-/jest-worker-30.4.1.tgz",
      "integrity": "sha512-SHynN/q/QD++iNyvMdy+WMmbCGk8jIsNcRxycXbWubSOhvo6T+j2afcfUSl+3hYsiBebOTo0cT7c2H7CXugu1g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@types/node": "*",
        "@ungap/structured-clone": "^1.3.0",
        "jest-util": "30.4.1",
        "merge-stream": "^2.0.0",
        "supports-color": "^8.1.1"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/jest-worker/node_modules/has-flag": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/has-flag/-/has-flag-4.0.0.tgz",
      "integrity": "sha512-EykJT/Q1KjTWctppgIAgfSO0tKVuZUjhgMr17kqTumMl6Afv3EISleU7qZUzoXDFTAHTDC4NOoG/ZxU3EvlMPQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/jest-worker/node_modules/supports-color": {
      "version": "8.1.1",
      "resolved": "https://registry.npmjs.org/supports-color/-/supports-color-8.1.1.tgz",
      "integrity": "sha512-MpUEN2OodtUzxvKQl72cUF7RQ5EiHsGvSsVG0ia9c5RbWGL2CI4C7EpPS8UTBIplnlzZiNuV56w+FuNxy3ty2Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "has-flag": "^4.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/chalk/supports-color?sponsor=1"
      }
    },
    "node_modules/js-tokens": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/js-tokens/-/js-tokens-4.0.0.tgz",
      "integrity": "sha512-RdJUflcE3cUzKiMqQgsCu06FPu9UdIJO0beYbPhHN4k6apgJtifcoCtT9bcxOpYBtpD2kCM6Sbzg4CausW/PKQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/js-yaml": {
      "version": "3.15.0",
      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-3.15.0.tgz",
      "integrity": "sha512-ttBQIIQPDeLjpPOohtUdXuXUVoA2uIB6fEH9HyJ7234s5mBJ5wTx20njxplLZQgLaOfpmPQA7X2t5AX6tIPbog==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "argparse": "^1.0.7",
        "esprima": "^4.0.0"
      },
      "bin": {
        "js-yaml": "bin/js-yaml.js"
      }
    },
    "node_modules/jsesc": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/jsesc/-/jsesc-3.1.0.tgz",
      "integrity": "sha512-/sM3dO2FOzXjKQhJuo0Q173wf2KOo8t4I8vHy6lF9poUp7bKT0/NHE8fPX23PwfhnykfqnC2xRxOnVw5XuGIaA==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "jsesc": "bin/jsesc"
      },
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/json-parse-even-better-errors": {
      "version": "2.3.1",
      "resolved": "https://registry.npmjs.org/json-parse-even-better-errors/-/json-parse-even-better-errors-2.3.1.tgz",
      "integrity": "sha512-xyFwyhro/JEof6Ghe2iz2NcXoj2sloNsWr/XsERDK/oiPCfaNhl5ONfp+jQdAZRQQ0IJWNzH9zIZF7li91kh2w==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/json-schema-traverse": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/json-schema-traverse/-/json-schema-traverse-1.0.0.tgz",
      "integrity": "sha512-NM8/P9n3XjXhIZn1lLhkFaACTOURQXjWhV4BA/RnOv8xvgqtqpAX9IO4mRQxSx1Rlo4tqzeqb0sOlruaOy3dug==",
      "license": "MIT"
    },
    "node_modules/json5": {
      "version": "2.2.3",
      "resolved": "https://registry.npmjs.org/json5/-/json5-2.2.3.tgz",
      "integrity": "sha512-XmOWe7eyHYH14cLdVPoyg+GOH3rYX++KpzrylJwSW98t3Nk+U8XOl8FWKOgwtzdb8lXGf6zYwDUzeHMWfxasyg==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "json5": "lib/cli.js"
      },
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/jsonwebtoken": {
      "version": "9.0.3",
      "resolved": "https://registry.npmjs.org/jsonwebtoken/-/jsonwebtoken-9.0.3.tgz",
      "integrity": "sha512-MT/xP0CrubFRNLNKvxJ2BYfy53Zkm++5bX9dtuPbqAeQpTVe0MQTFhao8+Cp//EmJp244xt6Drw/GVEGCUj40g==",
      "license": "MIT",
      "dependencies": {
        "jws": "^4.0.1",
        "lodash.includes": "^4.3.0",
        "lodash.isboolean": "^3.0.3",
        "lodash.isinteger": "^4.0.4",
        "lodash.isnumber": "^3.0.3",
        "lodash.isplainobject": "^4.0.6",
        "lodash.isstring": "^4.0.1",
        "lodash.once": "^4.0.0",
        "ms": "^2.1.1",
        "semver": "^7.5.4"
      },
      "engines": {
        "node": ">=12",
        "npm": ">=6"
      }
    },
    "node_modules/jwa": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/jwa/-/jwa-2.0.1.tgz",
      "integrity": "sha512-hRF04fqJIP8Abbkq5NKGN0Bbr3JxlQ+qhZufXVr0DvujKy93ZCbXZMHDL4EOtodSbCWxOqR8MS1tXA5hwqCXDg==",
      "license": "MIT",
      "dependencies": {
        "buffer-equal-constant-time": "^1.0.1",
        "ecdsa-sig-formatter": "1.0.11",
        "safe-buffer": "^5.0.1"
      }
    },
    "node_modules/jws": {
      "version": "4.0.1",
      "resolved": "https://registry.npmjs.org/jws/-/jws-4.0.1.tgz",
      "integrity": "sha512-EKI/M/yqPncGUUh44xz0PxSidXFr/+r0pA70+gIYhjv+et7yxM+s29Y+VGDkovRofQem0fs7Uvf4+YmAdyRduA==",
      "license": "MIT",
      "dependencies": {
        "jwa": "^2.0.1",
        "safe-buffer": "^5.0.1"
      }
    },
    "node_modules/kareem": {
      "version": "3.3.0",
      "resolved": "https://registry.npmjs.org/kareem/-/kareem-3.3.0.tgz",
      "integrity": "sha512-kpSuLD3/7RenBnjnJdOHXCKC8dTd1JzeOiJhN0necWWci6cC+qX+VuwPnMVgb+a4+KNJSfgqahpnfWaeDXCimw==",
      "license": "Apache-2.0",
      "engines": {
        "node": ">=18.0.0"
      }
    },
    "node_modules/leven": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/leven/-/leven-3.1.0.tgz",
      "integrity": "sha512-qsda+H8jTaUaN/x5vzW2rzc+8Rw4TAQ/4KjB46IwK5VH+IlVeeeje/EoZRpiXvIqjFgK84QffqPztGI3VBLG1A==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/lines-and-columns": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/lines-and-columns/-/lines-and-columns-1.2.4.tgz",
      "integrity": "sha512-7ylylesZQ/PV29jhEDl3Ufjo6ZX7gCqJr5F7PKrqc93v7fzSymt1BpwEU8nAUXs8qzzvqhbjhK5QZg6Mt/HkBg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/locate-path": {
      "version": "5.0.0",
      "resolved": "https://registry.npmjs.org/locate-path/-/locate-path-5.0.0.tgz",
      "integrity": "sha512-t7hw9pI+WvuwNJXwk5zVHpyhIqzg2qTlklJOf0mVxGSbe3Fp2VieZcduNYjaLDoy6p9uGpQEGWG87WpMKlNq8g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "p-locate": "^4.1.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/lodash.debounce": {
      "version": "4.0.8",
      "resolved": "https://registry.npmjs.org/lodash.debounce/-/lodash.debounce-4.0.8.tgz",
      "integrity": "sha512-FT1yDzDYEoYWhnSGnpE/4Kj1fLZkDFyqRb7fNt6FdYOSxlUWAtp42Eh6Wb0rGIv/m9Bgo7x4GhQbm5Ys4SG5ow==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/lodash.includes": {
      "version": "4.3.0",
      "resolved": "https://registry.npmjs.org/lodash.includes/-/lodash.includes-4.3.0.tgz",
      "integrity": "sha512-W3Bx6mdkRTGtlJISOvVD/lbqjTlPPUDTMnlXZFnVwi9NKJ6tiAk6LVdlhZMm17VZisqhKcgzpO5Wz91PCt5b0w==",
      "license": "MIT"
    },
    "node_modules/lodash.isboolean": {
      "version": "3.0.3",
      "resolved": "https://registry.npmjs.org/lodash.isboolean/-/lodash.isboolean-3.0.3.tgz",
      "integrity": "sha512-Bz5mupy2SVbPHURB98VAcw+aHh4vRV5IPNhILUCsOzRmsTmSQ17jIuqopAentWoehktxGd9e/hbIXq980/1QJg==",
      "license": "MIT"
    },
    "node_modules/lodash.isinteger": {
      "version": "4.0.4",
      "resolved": "https://registry.npmjs.org/lodash.isinteger/-/lodash.isinteger-4.0.4.tgz",
      "integrity": "sha512-DBwtEWN2caHQ9/imiNeEA5ys1JoRtRfY3d7V9wkqtbycnAmTvRRmbHKDV4a0EYc678/dia0jrte4tjYwVBaZUA==",
      "license": "MIT"
    },
    "node_modules/lodash.isnumber": {
      "version": "3.0.3",
      "resolved": "https://registry.npmjs.org/lodash.isnumber/-/lodash.isnumber-3.0.3.tgz",
      "integrity": "sha512-QYqzpfwO3/CWf3XP+Z+tkQsfaLL/EnUlXWVkIk5FUPc4sBdTehEqZONuyRt2P67PXAk+NXmTBcc97zw9t1FQrw==",
      "license": "MIT"
    },
    "node_modules/lodash.isplainobject": {
      "version": "4.0.6",
      "resolved": "https://registry.npmjs.org/lodash.isplainobject/-/lodash.isplainobject-4.0.6.tgz",
      "integrity": "sha512-oSXzaWypCMHkPC3NvBEaPHf0KsA5mvPrOPgQWDsbg8n7orZ290M0BmC/jgRZ4vcJ6DTAhjrsSYgdsW/F+MFOBA==",
      "license": "MIT"
    },
    "node_modules/lodash.isstring": {
      "version": "4.0.1",
      "resolved": "https://registry.npmjs.org/lodash.isstring/-/lodash.isstring-4.0.1.tgz",
      "integrity": "sha512-0wJxfxH1wgO3GrbuP+dTTk7op+6L41QCXbGINEmD+ny/G/eCqGzxyCsh7159S+mgDDcoarnBw6PC1PS5+wUGgw==",
      "license": "MIT"
    },
    "node_modules/lodash.mergewith": {
      "version": "4.6.2",
      "resolved": "https://registry.npmjs.org/lodash.mergewith/-/lodash.mergewith-4.6.2.tgz",
      "integrity": "sha512-GK3g5RPZWTRSeLSpgP8Xhra+pnjBC56q9FZYe1d5RN3TJ35dbkGy3YqBSMbyCrlbi+CM9Z3Jk5yTL7RCsqboyQ==",
      "license": "MIT"
    },
    "node_modules/lodash.once": {
      "version": "4.1.1",
      "resolved": "https://registry.npmjs.org/lodash.once/-/lodash.once-4.1.1.tgz",
      "integrity": "sha512-Sb487aTOCr9drQVL8pIxOzVhafOjZN9UU54hiN8PU3uAiSV7lx1yYNpbNmex2PK6dSJoNTSJUUswT651yww3Mg==",
      "license": "MIT"
    },
    "node_modules/lru-cache": {
      "version": "5.1.1",
      "resolved": "https://registry.npmjs.org/lru-cache/-/lru-cache-5.1.1.tgz",
      "integrity": "sha512-KpNARQA3Iwv+jTA0utUVVbrh+Jlrr1Fv0e56GGzAFOXN7dk/FviaDW8LHmK52DlcH4WP2n6gI8vN1aesBFgo9w==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "yallist": "^3.0.2"
      }
    },
    "node_modules/make-dir": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/make-dir/-/make-dir-4.0.0.tgz",
      "integrity": "sha512-hXdUTZYIVOt1Ex//jAQi+wTZZpUpwBj/0QsOzqegb3rGMMeJiSEu5xLHnYfBrRV4RH2+OCSOO95Is/7x1WJ4bw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "semver": "^7.5.3"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/makeerror": {
      "version": "1.0.12",
      "resolved": "https://registry.npmjs.org/makeerror/-/makeerror-1.0.12.tgz",
      "integrity": "sha512-JmqCvUhmt43madlpFzG4BQzG2Z3m6tvQDNKdClZnO3VbIudJYmxsT0FNJMeiB2+JTSlTQTSbU8QdesVmwJcmLg==",
      "dev": true,
      "license": "BSD-3-Clause",
      "dependencies": {
        "tmpl": "1.0.5"
      }
    },
    "node_modules/math-intrinsics": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/math-intrinsics/-/math-intrinsics-1.1.0.tgz",
      "integrity": "sha512-/IXtbwEk5HTPyEwyKX6hGkYXxM9nbj64B+ilVJnC/R6B0pH5G4V3b0pVbL7DBj4tkhBAppbQUlf6F6Xl9LHu1g==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/media-typer": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/media-typer/-/media-typer-1.1.0.tgz",
      "integrity": "sha512-aisnrDP4GNe06UcKFnV5bfMNPBUw4jsLGaWwWfnH3v02GnBuXX2MCVn5RbrWo0j3pczUilYblq7fQ7Nw2t5XKw==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/memory-pager": {
      "version": "1.5.0",
      "resolved": "https://registry.npmjs.org/memory-pager/-/memory-pager-1.5.0.tgz",
      "integrity": "sha512-ZS4Bp4r/Zoeq6+NLJpP+0Zzm0pR8whtGPf1XExKLJBAczGMnSi3It14OiNCStjQjM6NU1okjQGSxgEZN8eBYKg==",
      "license": "MIT"
    },
    "node_modules/merge-descriptors": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/merge-descriptors/-/merge-descriptors-2.0.0.tgz",
      "integrity": "sha512-Snk314V5ayFLhp3fkUREub6WtjBfPdCPY1Ln8/8munuLuiYhsABgBVWsozAG+MWMbVEvcdcpbi9R7ww22l9Q3g==",
      "license": "MIT",
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/merge-stream": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/merge-stream/-/merge-stream-2.0.0.tgz",
      "integrity": "sha512-abv/qOcuPfk3URPfDzmZU1LKmuw8kT+0nIHvKrKgFrwifol/doWcdA4ZqsWQ8ENrFKkd67Mfpo/LovbIUsbt3w==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/methods": {
      "version": "1.1.2",
      "resolved": "https://registry.npmjs.org/methods/-/methods-1.1.2.tgz",
      "integrity": "sha512-iclAHeNqNm68zFtnZ0e+1L2yUIdvzNoauKU4WBA3VvH/vPFieF7qfRlwUZU+DA9P9bPXIS90ulxoUoCH23sV2w==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/mime": {
      "version": "2.6.0",
      "resolved": "https://registry.npmjs.org/mime/-/mime-2.6.0.tgz",
      "integrity": "sha512-USPkMeET31rOMiarsBNIHZKLGgvKc/LrjofAnBlOttf5ajRvqiRA8QsenbcooctK6d6Ts6aqZXBA+XbkKthiQg==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "mime": "cli.js"
      },
      "engines": {
        "node": ">=4.0.0"
      }
    },
    "node_modules/mime-db": {
      "version": "1.54.0",
      "resolved": "https://registry.npmjs.org/mime-db/-/mime-db-1.54.0.tgz",
      "integrity": "sha512-aU5EJuIN2WDemCcAp2vFBfp/m4EAhWJnUNSSw0ixs7/kXbd6Pg64EmwJkNdFhB8aWt1sH2CTXrLxo/iAGV3oPQ==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/mime-types": {
      "version": "3.0.2",
      "resolved": "https://registry.npmjs.org/mime-types/-/mime-types-3.0.2.tgz",
      "integrity": "sha512-Lbgzdk0h4juoQ9fCKXW4by0UJqj+nOOrI9MJ1sSj4nI8aI2eo1qmvQEie4VD1glsS250n15LsWsYtCugiStS5A==",
      "license": "MIT",
      "dependencies": {
        "mime-db": "^1.54.0"
      },
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/express"
      }
    },
    "node_modules/mimic-fn": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/mimic-fn/-/mimic-fn-2.1.0.tgz",
      "integrity": "sha512-OqbOk5oEQeAZ8WXWydlu9HJjz9WVdEIvamMCcXmuqUYjTknH/sqsWvhQ3vgwKFRR1HpjvNBKQ37nbJgYzGqGcg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/minimatch": {
      "version": "10.2.5",
      "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-10.2.5.tgz",
      "integrity": "sha512-MULkVLfKGYDFYejP07QOurDLLQpcjk7Fw+7jXS2R2czRQzR56yHRveU5NDJEOviH+hETZKSkIk5c+T23GjFUMg==",
      "license": "BlueOak-1.0.0",
      "dependencies": {
        "brace-expansion": "^5.0.5"
      },
      "engines": {
        "node": "18 || 20 || >=22"
      },
      "funding": {
        "url": "https://github.com/sponsors/isaacs"
      }
    },
    "node_modules/minipass": {
      "version": "7.1.3",
      "resolved": "https://registry.npmjs.org/minipass/-/minipass-7.1.3.tgz",
      "integrity": "sha512-tEBHqDnIoM/1rXME1zgka9g6Q2lcoCkxHLuc7ODJ5BxbP5d4c2Z5cGgtXAku59200Cx7diuHTOYfSBD8n6mm8A==",
      "license": "BlueOak-1.0.0",
      "engines": {
        "node": ">=16 || 14 >=14.17"
      }
    },
    "node_modules/mongodb": {
      "version": "7.2.0",
      "resolved": "https://registry.npmjs.org/mongodb/-/mongodb-7.2.0.tgz",
      "integrity": "sha512-F/2+BMZtLVhY30ioZp0dAmZ+IRZMBqI+nrv6t5+9/1AIwCa8sMRC3jBf81lpxMhnZgqq8CoUD503Z1oZWq1/sw==",
      "license": "Apache-2.0",
      "dependencies": {
        "@mongodb-js/saslprep": "^1.3.0",
        "bson": "^7.2.0",
        "mongodb-connection-string-url": "^7.0.0"
      },
      "engines": {
        "node": ">=20.19.0"
      },
      "peerDependencies": {
        "@aws-sdk/credential-providers": "^3.806.0",
        "@mongodb-js/zstd": "^7.0.0",
        "gcp-metadata": "^7.0.1",
        "kerberos": "^7.0.0",
        "mongodb-client-encryption": ">=7.0.0 <7.1.0",
        "snappy": "^7.3.2",
        "socks": "^2.8.6"
      },
      "peerDependenciesMeta": {
        "@aws-sdk/credential-providers": {
          "optional": true
        },
        "@mongodb-js/zstd": {
          "optional": true
        },
        "gcp-metadata": {
          "optional": true
        },
        "kerberos": {
          "optional": true
        },
        "mongodb-client-encryption": {
          "optional": true
        },
        "snappy": {
          "optional": true
        },
        "socks": {
          "optional": true
        }
      }
    },
    "node_modules/mongodb-connection-string-url": {
      "version": "7.0.1",
      "resolved": "https://registry.npmjs.org/mongodb-connection-string-url/-/mongodb-connection-string-url-7.0.1.tgz",
      "integrity": "sha512-h0AZ9A7IDVwwHyMxmdMXKy+9oNlF0zFoahHiX3vQ8e3KFcSP3VmsmfvtRSuLPxmyv2vjIDxqty8smTgie/SNRQ==",
      "license": "Apache-2.0",
      "dependencies": {
        "@types/whatwg-url": "^13.0.0",
        "whatwg-url": "^14.1.0"
      },
      "engines": {
        "node": ">=20.19.0"
      }
    },
    "node_modules/mongoose": {
      "version": "9.7.4",
      "resolved": "https://registry.npmjs.org/mongoose/-/mongoose-9.7.4.tgz",
      "integrity": "sha512-nuSYGUWWzNd4EAbGYxE469wPTL+kmxb5+91YvCvMkJ08rvNRht/usZUU3LuFuk7rDutF2QWBZHPHuzM8TxXApA==",
      "license": "MIT",
      "dependencies": {
        "@standard-schema/spec": "^1.1.0",
        "kareem": "3.3.0",
        "mongodb": "~7.2",
        "mpath": "0.9.0",
        "mquery": "6.0.0",
        "ms": "2.1.3",
        "sift": "17.1.3"
      },
      "engines": {
        "node": ">=20.19.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/mongoose"
      }
    },
    "node_modules/mpath": {
      "version": "0.9.0",
      "resolved": "https://registry.npmjs.org/mpath/-/mpath-0.9.0.tgz",
      "integrity": "sha512-ikJRQTk8hw5DEoFVxHG1Gn9T/xcjtdnOKIU1JTmGjZZlg9LST2mBLmcX3/ICIbgJydT2GOc15RnNy5mHmzfSew==",
      "license": "MIT",
      "engines": {
        "node": ">=4.0.0"
      }
    },
    "node_modules/mquery": {
      "version": "6.0.0",
      "resolved": "https://registry.npmjs.org/mquery/-/mquery-6.0.0.tgz",
      "integrity": "sha512-b2KQNsmgtkscfeDgkYMcWGn9vZI9YoXh802VDEwE6qc50zxBFQ0Oo8ROkawbPAsXCY1/Z1yp0MagqsZStPWJjw==",
      "license": "MIT",
      "engines": {
        "node": ">=20.19.0"
      }
    },
    "node_modules/ms": {
      "version": "2.1.3",
      "resolved": "https://registry.npmjs.org/ms/-/ms-2.1.3.tgz",
      "integrity": "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==",
      "license": "MIT"
    },
    "node_modules/multer": {
      "version": "2.2.0",
      "resolved": "https://registry.npmjs.org/multer/-/multer-2.2.0.tgz",
      "integrity": "sha512-6rdyFg2kLrMh9Jee7/BMPuV9lEAd7lLW2YUpF9/YxR7njyoUwwQ0ZPh3TaIY50Sw6vlyD2HW3wGOkTS4P79xrQ==",
      "license": "MIT",
      "dependencies": {
        "append-field": "^1.0.0",
        "busboy": "^1.6.0",
        "concat-stream": "^2.0.0",
        "type-is": "^1.6.18"
      },
      "engines": {
        "node": ">= 10.16.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/express"
      }
    },
    "node_modules/multer/node_modules/media-typer": {
      "version": "0.3.0",
      "resolved": "https://registry.npmjs.org/media-typer/-/media-typer-0.3.0.tgz",
      "integrity": "sha512-dq+qelQ9akHpcOl/gUVRTxVIOkAJ1wR3QAvb4RsVjS8oVoFjDGTc679wJYmUmknUF5HwMLOgb5O+a3KxfWapPQ==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/multer/node_modules/mime-db": {
      "version": "1.52.0",
      "resolved": "https://registry.npmjs.org/mime-db/-/mime-db-1.52.0.tgz",
      "integrity": "sha512-sPU4uV7dYlvtWJxwwxHD0PuihVNiE7TyAbQ5SWxDCB9mUYvOgroQOwYQQOKPJ8CIbE+1ETVlOoK1UC2nU3gYvg==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/multer/node_modules/mime-types": {
      "version": "2.1.35",
      "resolved": "https://registry.npmjs.org/mime-types/-/mime-types-2.1.35.tgz",
      "integrity": "sha512-ZDY+bPm5zTTF+YpCrAU9nK0UgICYPT0QtT1NZWFv4s++TNkcgVaT0g6+4R2uI4MjQjzysHB1zxuWL50hzaeXiw==",
      "license": "MIT",
      "dependencies": {
        "mime-db": "1.52.0"
      },
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/multer/node_modules/type-is": {
      "version": "1.6.18",
      "resolved": "https://registry.npmjs.org/type-is/-/type-is-1.6.18.tgz",
      "integrity": "sha512-TkRKr9sUTxEH8MdfuCSP7VizJyzRNMjj2J2do2Jr3Kym598JVdEksuzPQCnlFPW4ky9Q+iA+ma9BGm06XQBy8g==",
      "license": "MIT",
      "dependencies": {
        "media-typer": "0.3.0",
        "mime-types": "~2.1.24"
      },
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/napi-postinstall": {
      "version": "0.3.4",
      "resolved": "https://registry.npmjs.org/napi-postinstall/-/napi-postinstall-0.3.4.tgz",
      "integrity": "sha512-PHI5f1O0EP5xJ9gQmFGMS6IZcrVvTjpXjz7Na41gTE7eE2hK11lg04CECCYEEjdc17EV4DO+fkGEtt7TpTaTiQ==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "napi-postinstall": "lib/cli.js"
      },
      "engines": {
        "node": "^12.20.0 || ^14.18.0 || >=16.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/napi-postinstall"
      }
    },
    "node_modules/natural-compare": {
      "version": "1.4.0",
      "resolved": "https://registry.npmjs.org/natural-compare/-/natural-compare-1.4.0.tgz",
      "integrity": "sha512-OWND8ei3VtNC9h7V60qff3SVobHr996CTwgxubgyQYEpg290h9J0buyECNNJexkFm5sOajh5G116RYA1c8ZMSw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/negotiator": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/negotiator/-/negotiator-1.0.0.tgz",
      "integrity": "sha512-8Ofs/AUQh8MaEcrlq5xOX0CQ9ypTF5dl78mjlMNfOK08fzpgTHQRQPBxcPlEtIw0yRpws+Zo/3r+5WRby7u3Gg==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.6"
      }
    },
    "node_modules/node-int64": {
      "version": "0.4.0",
      "resolved": "https://registry.npmjs.org/node-int64/-/node-int64-0.4.0.tgz",
      "integrity": "sha512-O5lz91xSOeoXP6DulyHfllpq+Eg00MWitZIbtPfoSEvqIHdl5gfcY6hYzDWnj0qD5tz52PI08u9qUvSVeUBeHw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/node-releases": {
      "version": "2.0.50",
      "resolved": "https://registry.npmjs.org/node-releases/-/node-releases-2.0.50.tgz",
      "integrity": "sha512-J6l92tKHX6w8Jy5nO1Vuc01NoIiRGi/d6qBKVxh+IQ8Cr3b6HbVNfKiF8ZpFKufTwpwxMmce2W3iQZ861ZRyTg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/nodemon": {
      "version": "3.1.14",
      "resolved": "https://registry.npmjs.org/nodemon/-/nodemon-3.1.14.tgz",
      "integrity": "sha512-jakjZi93UtB3jHMWsXL68FXSAosbLfY0In5gtKq3niLSkrWznrVBzXFNOEMJUfc9+Ke7SHWoAZsiMkNP3vq6Jw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "chokidar": "^3.5.2",
        "debug": "^4",
        "ignore-by-default": "^1.0.1",
        "minimatch": "^10.2.1",
        "pstree.remy": "^1.1.8",
        "semver": "^7.5.3",
        "simple-update-notifier": "^2.0.0",
        "supports-color": "^5.5.0",
        "touch": "^3.1.0",
        "undefsafe": "^2.0.5"
      },
      "bin": {
        "nodemon": "bin/nodemon.js"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/nodemon"
      }
    },
    "node_modules/normalize-path": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/normalize-path/-/normalize-path-3.0.0.tgz",
      "integrity": "sha512-6eZs5Ls3WtCisHWp9S2GUy8dqkpGi4BVSz3GaqiE6ezub0512ESztXUwUB6C6IKbQkY2Pnb/mD4WYojCRwcwLA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/npm-run-path": {
      "version": "4.0.1",
      "resolved": "https://registry.npmjs.org/npm-run-path/-/npm-run-path-4.0.1.tgz",
      "integrity": "sha512-S48WzZW777zhNIrn7gxOlISNAqi9ZC/uQFnRdbeIHhZhCA6UqpkOT8T1G7BvfdgP4Er8gF4sUbaS0i7QvIfCWw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "path-key": "^3.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/object-assign": {
      "version": "4.1.1",
      "resolved": "https://registry.npmjs.org/object-assign/-/object-assign-4.1.1.tgz",
      "integrity": "sha512-rJgTQnkUnH1sFw8yT6VSU3zD3sWmu6sZhIseY8VX+GRu3P6F7Fu+JNDoXfklElbLJSnc3FUQHVe4cU5hj+BcUg==",
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/object-inspect": {
      "version": "1.13.4",
      "resolved": "https://registry.npmjs.org/object-inspect/-/object-inspect-1.13.4.tgz",
      "integrity": "sha512-W67iLl4J2EXEGTbfeHCffrjDfitvLANg0UlX3wFUUSTx92KXRFegMHUVgSqE+wvhAbi4WqjGg9czysTV2Epbew==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/on-finished": {
      "version": "2.4.1",
      "resolved": "https://registry.npmjs.org/on-finished/-/on-finished-2.4.1.tgz",
      "integrity": "sha512-oVlzkg3ENAhCk2zdv7IJwd/QUD4z2RxRwpkcGY8psCVcCYZNq4wYnVWALHM+brtuJjePWiYF/ClmuDr8Ch5+kg==",
      "license": "MIT",
      "dependencies": {
        "ee-first": "1.1.1"
      },
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/once": {
      "version": "1.4.0",
      "resolved": "https://registry.npmjs.org/once/-/once-1.4.0.tgz",
      "integrity": "sha512-lNaJgI+2Q5URQBkccEKHTQOPaXdUxnZZElQTZY0MFUAuaEqe1E+Nyvgdz/aIyNi6Z9MzO5dv1H8n58/GELp3+w==",
      "license": "ISC",
      "dependencies": {
        "wrappy": "1"
      }
    },
    "node_modules/onetime": {
      "version": "5.1.2",
      "resolved": "https://registry.npmjs.org/onetime/-/onetime-5.1.2.tgz",
      "integrity": "sha512-kbpaSSGJTWdAY5KPVeMOKXSrPtr8C8C7wodJbcsd51jRnmD+GZu8Y0VoU6Dm5Z4vWr0Ig/1NKuWRKf7j5aaYSg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "mimic-fn": "^2.1.0"
      },
      "engines": {
        "node": ">=6"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/p-limit": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/p-limit/-/p-limit-3.1.0.tgz",
      "integrity": "sha512-TYOanM3wGwNGsZN2cVTYPArw454xnXj5qmWF1bEoAc4+cU/ol7GVh7odevjp1FNHduHc3KZMcFduxU5Xc6uJRQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "yocto-queue": "^0.1.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/p-locate": {
      "version": "4.1.0",
      "resolved": "https://registry.npmjs.org/p-locate/-/p-locate-4.1.0.tgz",
      "integrity": "sha512-R79ZZ/0wAxKGu3oYMlz8jy/kbhsNrS7SKZ7PxEHBgJ5+F2mtFW2fK2cOtBh1cHYkQsbzFV7I+EoRKe6Yt0oK7A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "p-limit": "^2.2.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/p-locate/node_modules/p-limit": {
      "version": "2.3.0",
      "resolved": "https://registry.npmjs.org/p-limit/-/p-limit-2.3.0.tgz",
      "integrity": "sha512-//88mFWSJx8lxCzwdAABTJL2MyWB12+eIY7MDL2SqLmAkeKU9qxRvWuSyTjm3FUmpBEMuFfckAIqEaVGUDxb6w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "p-try": "^2.0.0"
      },
      "engines": {
        "node": ">=6"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/p-try": {
      "version": "2.2.0",
      "resolved": "https://registry.npmjs.org/p-try/-/p-try-2.2.0.tgz",
      "integrity": "sha512-R4nPAVTAU0B9D35/Gk3uJf/7XYbQcyohSKdvAxIRSNghFl4e71hVoGnBNQz9cWaXxO2I10KTC+3jMdvvoKw6dQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/package-json-from-dist": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/package-json-from-dist/-/package-json-from-dist-1.0.1.tgz",
      "integrity": "sha512-UEZIS3/by4OC8vL3P2dTXRETpebLI2NiI5vIrjaD/5UtrkFX/tNbwjTSRAGC/+7CAo2pIcBaRgWmcBBHcsaCIw==",
      "license": "BlueOak-1.0.0"
    },
    "node_modules/parse-json": {
      "version": "5.2.0",
      "resolved": "https://registry.npmjs.org/parse-json/-/parse-json-5.2.0.tgz",
      "integrity": "sha512-ayCKvm/phCGxOkYRSCM82iDwct8/EonSEgCSxWxD7ve6jHggsFl4fZVQBPRNgQoKiuV/odhFrGzQXZwbifC8Rg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/code-frame": "^7.0.0",
        "error-ex": "^1.3.1",
        "json-parse-even-better-errors": "^2.3.0",
        "lines-and-columns": "^1.1.6"
      },
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/parseurl": {
      "version": "1.3.3",
      "resolved": "https://registry.npmjs.org/parseurl/-/parseurl-1.3.3.tgz",
      "integrity": "sha512-CiyeOxFT/JZyN5m0z9PfXw4SCBJ6Sygz1Dpl0wqjlhDEGGBP1GnsUVEL0p63hoG1fcj3fHynXi9NYO4nWOL+qQ==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/path-exists": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/path-exists/-/path-exists-4.0.0.tgz",
      "integrity": "sha512-ak9Qy5Q7jYb2Wwcey5Fpvg2KoAc/ZIhLSLOSBmRmygPsGwkVVt0fZa0qrtMz+m6tJTAHfZQ8FnmB4MG4LWy7/w==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/path-is-absolute": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/path-is-absolute/-/path-is-absolute-1.0.1.tgz",
      "integrity": "sha512-AVbw3UJ2e9bq64vSaS9Am0fje1Pa8pbGqTTsmXfaIiMpnr5DlDhfJOuLj9Sf95ZPVDAUerDfEk88MPmPe7UCQg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/path-key": {
      "version": "3.1.1",
      "resolved": "https://registry.npmjs.org/path-key/-/path-key-3.1.1.tgz",
      "integrity": "sha512-ojmeN0qd+y0jszEtoY48r0Peq5dwMEkIlCOu6Q5f41lfkswXuKtYrhgoTpLnyIcHm24Uhqx+5Tqm2InSwLhE6Q==",
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/path-parse": {
      "version": "1.0.7",
      "resolved": "https://registry.npmjs.org/path-parse/-/path-parse-1.0.7.tgz",
      "integrity": "sha512-LDJzPVEEEPR+y48z93A0Ed0yXb8pAByGWo/k5YYdYgpY2/2EsOsksJrq7lOHxryrVOn1ejG6oAp8ahvOIQD8sw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/path-scurry": {
      "version": "1.11.1",
      "resolved": "https://registry.npmjs.org/path-scurry/-/path-scurry-1.11.1.tgz",
      "integrity": "sha512-Xa4Nw17FS9ApQFJ9umLiJS4orGjm7ZzwUrwamcGQuHSzDyth9boKDaycYdDcZDuqYATXw4HFXgaqWTctW/v1HA==",
      "dev": true,
      "license": "BlueOak-1.0.0",
      "dependencies": {
        "lru-cache": "^10.2.0",
        "minipass": "^5.0.0 || ^6.0.2 || ^7.0.0"
      },
      "engines": {
        "node": ">=16 || 14 >=14.18"
      },
      "funding": {
        "url": "https://github.com/sponsors/isaacs"
      }
    },
    "node_modules/path-scurry/node_modules/lru-cache": {
      "version": "10.4.3",
      "resolved": "https://registry.npmjs.org/lru-cache/-/lru-cache-10.4.3.tgz",
      "integrity": "sha512-JNAzZcXrCt42VGLuYz0zfAzDfAvJWW6AfYlDBQyDV5DClI2m5sAmK+OIO7s59XfsRsWHp02jAJrRadPRGTt6SQ==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/path-to-regexp": {
      "version": "8.4.2",
      "resolved": "https://registry.npmjs.org/path-to-regexp/-/path-to-regexp-8.4.2.tgz",
      "integrity": "sha512-qRcuIdP69NPm4qbACK+aDogI5CBDMi1jKe0ry5rSQJz8JVLsC7jV8XpiJjGRLLol3N+R5ihGYcrPLTno6pAdBA==",
      "license": "MIT",
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/express"
      }
    },
    "node_modules/picocolors": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/picocolors/-/picocolors-1.1.1.tgz",
      "integrity": "sha512-xceH2snhtb5M9liqDsmEw56le376mTZkEX/jEb/RxNFyegNul7eNslCXP9FDj/Lcu0X8KEyMceP2ntpaHrDEVA==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/picomatch": {
      "version": "2.3.2",
      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-2.3.2.tgz",
      "integrity": "sha512-V7+vQEJ06Z+c5tSye8S+nHUfI51xoXIXjHQ99cQtKUkQqqO1kO/KCJUfZXuB47h/YBlDhah2H3hdUGXn8ie0oA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8.6"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/pirates": {
      "version": "4.0.7",
      "resolved": "https://registry.npmjs.org/pirates/-/pirates-4.0.7.tgz",
      "integrity": "sha512-TfySrs/5nm8fQJDcBDuUng3VOUKsd7S+zqvbOTiGXHfxX4wK31ard+hoNuvkicM/2YFzlpDgABOevKSsB4G/FA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/pkg-dir": {
      "version": "4.2.0",
      "resolved": "https://registry.npmjs.org/pkg-dir/-/pkg-dir-4.2.0.tgz",
      "integrity": "sha512-HRDzbaKjC+AOWVXxAU/x54COGeIv9eb+6CkDSQoNTt4XyWoIJvuPsXizxu/Fr23EiekbtZwmh1IcIG/l/a10GQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "find-up": "^4.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/pretty-format": {
      "version": "30.4.1",
      "resolved": "https://registry.npmjs.org/pretty-format/-/pretty-format-30.4.1.tgz",
      "integrity": "sha512-K6KiKMHTL4jjX4u3Kir2EW07nRfcqVTXIImx50wbjHQTcZPgg+gjVeNTIT3l3L1Rd4UefxfogquC9J37SoFyyw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jest/schemas": "30.4.1",
        "ansi-styles": "^5.2.0",
        "react-is-18": "npm:react-is@^18.3.1",
        "react-is-19": "npm:react-is@^19.2.5"
      },
      "engines": {
        "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
      }
    },
    "node_modules/pretty-format/node_modules/ansi-styles": {
      "version": "5.2.0",
      "resolved": "https://registry.npmjs.org/ansi-styles/-/ansi-styles-5.2.0.tgz",
      "integrity": "sha512-Cxwpt2SfTzTtXcfOlzGEee8O+c+MmUgGrNiBcXnuWxuFJHe6a5Hz7qwhwe5OgaSYI0IJvkLqWX1ASG+cJOkEiA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/chalk/ansi-styles?sponsor=1"
      }
    },
    "node_modules/proxy-addr": {
      "version": "2.0.7",
      "resolved": "https://registry.npmjs.org/proxy-addr/-/proxy-addr-2.0.7.tgz",
      "integrity": "sha512-llQsMLSUDUPT44jdrU/O37qlnifitDP+ZwrmmZcoSKyLKvtZxpyV0n2/bD/N4tBAAZ/gJEdZU7KMraoK1+XYAg==",
      "license": "MIT",
      "dependencies": {
        "forwarded": "0.2.0",
        "ipaddr.js": "1.9.1"
      },
      "engines": {
        "node": ">= 0.10"
      }
    },
    "node_modules/pstree.remy": {
      "version": "1.1.8",
      "resolved": "https://registry.npmjs.org/pstree.remy/-/pstree.remy-1.1.8.tgz",
      "integrity": "sha512-77DZwxQmxKnu3aR542U+X8FypNzbfJ+C5XQDk3uWjWxn6151aIMGthWYRXTqT1E5oJvg+ljaa2OJi+VfvCOQ8w==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/punycode": {
      "version": "2.3.1",
      "resolved": "https://registry.npmjs.org/punycode/-/punycode-2.3.1.tgz",
      "integrity": "sha512-vYt7UD1U9Wg6138shLtLOvdAu+8DsC/ilFtEVHcH+wydcSpNE20AfSOduf6MkRFahL5FY7X1oU7nKVZFtfq8Fg==",
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/pure-rand": {
      "version": "7.0.1",
      "resolved": "https://registry.npmjs.org/pure-rand/-/pure-rand-7.0.1.tgz",
      "integrity": "sha512-oTUZM/NAZS8p7ANR3SHh30kXB+zK2r2BPcEn/awJIbOvq82WoMN4p62AWWp3Hhw50G0xMsw1mhIBLqHw64EcNQ==",
      "dev": true,
      "funding": [
        {
          "type": "individual",
          "url": "https://github.com/sponsors/dubzzz"
        },
        {
          "type": "opencollective",
          "url": "https://opencollective.com/fast-check"
        }
      ],
      "license": "MIT"
    },
    "node_modules/qs": {
      "version": "6.15.3",
      "resolved": "https://registry.npmjs.org/qs/-/qs-6.15.3.tgz",
      "integrity": "sha512-O9gl3zCl5h5blw1KGUzQKhA5oUXSl8rwUIM5o0S3nCXMliSvy5Dzx7/DJcI+SwgICv+IneSZwhBh1oSyEHA71A==",
      "license": "BSD-3-Clause",
      "dependencies": {
        "es-define-property": "^1.0.1",
        "side-channel": "^1.1.1"
      },
      "engines": {
        "node": ">=0.6"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/range-parser": {
      "version": "1.3.0",
      "resolved": "https://registry.npmjs.org/range-parser/-/range-parser-1.3.0.tgz",
      "integrity": "sha512-hek2mFQpPuI4E1BBKrSto+BU3e3x4xuarsbiwr3+lf7p44juvFMV0XFWQAP3xUyqXA4RrXLIoaSUGbSt056ZMw==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.6"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/express"
      }
    },
    "node_modules/raw-body": {
      "version": "3.0.2",
      "resolved": "https://registry.npmjs.org/raw-body/-/raw-body-3.0.2.tgz",
      "integrity": "sha512-K5zQjDllxWkf7Z5xJdV0/B0WTNqx6vxG70zJE4N0kBs4LovmEYWJzQGxC9bS9RAKu3bgM40lrd5zoLJ12MQ5BA==",
      "license": "MIT",
      "dependencies": {
        "bytes": "~3.1.2",
        "http-errors": "~2.0.1",
        "iconv-lite": "~0.7.0",
        "unpipe": "~1.0.0"
      },
      "engines": {
        "node": ">= 0.10"
      }
    },
    "node_modules/react-is-18": {
      "name": "react-is",
      "version": "18.3.1",
      "resolved": "https://registry.npmjs.org/react-is/-/react-is-18.3.1.tgz",
      "integrity": "sha512-/LLMVyas0ljjAtoYiPqYiL8VWXzUUdThrmU5+n20DZv+a+ClRoevUzw5JxU+Ieh5/c87ytoTBV9G1FiKfNJdmg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/react-is-19": {
      "name": "react-is",
      "version": "19.2.7",
      "resolved": "https://registry.npmjs.org/react-is/-/react-is-19.2.7.tgz",
      "integrity": "sha512-kZFnouyVv7eP/Phmrlo9FK+zcAdriZJvzxXHF1Sl1P377WSGe2G/JxVolhTrB/jeV47lKImhNUsijjHAAbcl/A==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/readable-stream": {
      "version": "3.6.2",
      "resolved": "https://registry.npmjs.org/readable-stream/-/readable-stream-3.6.2.tgz",
      "integrity": "sha512-9u/sniCrY3D5WdsERHzHE4G2YCXqoG5FTHUiCC4SIbr6XcLZBY05ya9EKjYek9O5xOAwjGq+1JdGBAS7Q9ScoA==",
      "license": "MIT",
      "dependencies": {
        "inherits": "^2.0.3",
        "string_decoder": "^1.1.1",
        "util-deprecate": "^1.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/readdirp": {
      "version": "3.6.0",
      "resolved": "https://registry.npmjs.org/readdirp/-/readdirp-3.6.0.tgz",
      "integrity": "sha512-hOS089on8RduqdbhvQ5Z37A0ESjsqz6qnRcffsMU3495FuTdqSm+7bhJ29JvIOsBDEEnan5DPu9t3To9VRlMzA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "picomatch": "^2.2.1"
      },
      "engines": {
        "node": ">=8.10.0"
      }
    },
    "node_modules/redis": {
      "version": "5.12.1",
      "resolved": "https://registry.npmjs.org/redis/-/redis-5.12.1.tgz",
      "integrity": "sha512-LDsoVvb/CpoV9EN3FXvgvSHNJWuCIzl9MiO3ppOevuGLpSGJhwfQjpEwfFJcQvNSddHADDdZaWx0HnmMxRXG7g==",
      "license": "MIT",
      "dependencies": {
        "@redis/bloom": "5.12.1",
        "@redis/client": "5.12.1",
        "@redis/json": "5.12.1",
        "@redis/search": "5.12.1",
        "@redis/time-series": "5.12.1"
      },
      "engines": {
        "node": ">= 18.19.0"
      }
    },
    "node_modules/regenerate": {
      "version": "1.4.2",
      "resolved": "https://registry.npmjs.org/regenerate/-/regenerate-1.4.2.tgz",
      "integrity": "sha512-zrceR/XhGYU/d/opr2EKO7aRHUeiBI8qjtfHqADTwZd6Szfy16la6kqD0MIUs5z5hx6AaKa+PixpPrR289+I0A==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/regenerate-unicode-properties": {
      "version": "10.2.2",
      "resolved": "https://registry.npmjs.org/regenerate-unicode-properties/-/regenerate-unicode-properties-10.2.2.tgz",
      "integrity": "sha512-m03P+zhBeQd1RGnYxrGyDAPpWX/epKirLrp8e3qevZdVkKtnCrjjWczIbYc8+xd6vcTStVlqfycTx1KR4LOr0g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "regenerate": "^1.4.2"
      },
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/regexpu-core": {
      "version": "6.4.0",
      "resolved": "https://registry.npmjs.org/regexpu-core/-/regexpu-core-6.4.0.tgz",
      "integrity": "sha512-0ghuzq67LI9bLXpOX/ISfve/Mq33a4aFRzoQYhnnok1JOFpmE/A2TBGkNVenOGEeSBCjIiWcc6MVOG5HEQv0sA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "regenerate": "^1.4.2",
        "regenerate-unicode-properties": "^10.2.2",
        "regjsgen": "^0.8.0",
        "regjsparser": "^0.13.0",
        "unicode-match-property-ecmascript": "^2.0.0",
        "unicode-match-property-value-ecmascript": "^2.2.1"
      },
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/regjsgen": {
      "version": "0.8.0",
      "resolved": "https://registry.npmjs.org/regjsgen/-/regjsgen-0.8.0.tgz",
      "integrity": "sha512-RvwtGe3d7LvWiDQXeQw8p5asZUmfU1G/l6WbUXeHta7Y2PEIvBTwH6E2EfmYUK8pxcxEdEmaomqyp0vZZ7C+3Q==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/regjsparser": {
      "version": "0.13.2",
      "resolved": "https://registry.npmjs.org/regjsparser/-/regjsparser-0.13.2.tgz",
      "integrity": "sha512-NgRBy2Nx/bE+9F27nVHnqcN5HjyLmecqsqx2PJHu3/IEtADD4WuxuXIVExD5PoSDFVrl78dOonfcOe5O+5nbzQ==",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "jsesc": "~3.1.0"
      },
      "bin": {
        "regjsparser": "bin/parser"
      }
    },
    "node_modules/require-directory": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/require-directory/-/require-directory-2.1.1.tgz",
      "integrity": "sha512-fGxEI7+wsG9xrvdjsrlmL22OMTTiHRwAMroiEeMgq8gzoLC/PQr7RsRDSTLUg/bZAZtF+TVIkHc6/4RIKrui+Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/require-from-string": {
      "version": "2.0.2",
      "resolved": "https://registry.npmjs.org/require-from-string/-/require-from-string-2.0.2.tgz",
      "integrity": "sha512-Xf0nWe6RseziFMu+Ap9biiUbmplq6S9/p+7w7YXP/JBHhrUDDUhwa+vANyubuqfZWTveU//DYVGsDG7RKL/vEw==",
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/resolve": {
      "version": "1.22.12",
      "resolved": "https://registry.npmjs.org/resolve/-/resolve-1.22.12.tgz",
      "integrity": "sha512-TyeJ1zif53BPfHootBGwPRYT1RUt6oGWsaQr8UyZW/eAm9bKoijtvruSDEmZHm92CwS9nj7/fWttqPCgzep8CA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "is-core-module": "^2.16.1",
        "path-parse": "^1.0.7",
        "supports-preserve-symlinks-flag": "^1.0.0"
      },
      "bin": {
        "resolve": "bin/resolve"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/resolve-cwd": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/resolve-cwd/-/resolve-cwd-3.0.0.tgz",
      "integrity": "sha512-OrZaX2Mb+rJCpH/6CpSqt9xFVpN++x01XnN2ie9g6P5/3xelLAkXWVADpdz1IHD/KFfEXyE6V0U01OQ3UO2rEg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "resolve-from": "^5.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/resolve-from": {
      "version": "5.0.0",
      "resolved": "https://registry.npmjs.org/resolve-from/-/resolve-from-5.0.0.tgz",
      "integrity": "sha512-qYg9KP24dD5qka9J47d0aVky0N+b4fTU89LN9iDnjB5waksiC49rvMB0PrUJQGoTmH50XPiqOvAjDfaijGxYZw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/router": {
      "version": "2.2.0",
      "resolved": "https://registry.npmjs.org/router/-/router-2.2.0.tgz",
      "integrity": "sha512-nLTrUKm2UyiL7rlhapu/Zl45FwNgkZGaCpZbIHajDYgwlJCOzLSk+cIPAnsEqV955GjILJnKbdQC1nVPz+gAYQ==",
      "license": "MIT",
      "dependencies": {
        "debug": "^4.4.0",
        "depd": "^2.0.0",
        "is-promise": "^4.0.0",
        "parseurl": "^1.3.3",
        "path-to-regexp": "^8.0.0"
      },
      "engines": {
        "node": ">= 18"
      }
    },
    "node_modules/safe-buffer": {
      "version": "5.2.1",
      "resolved": "https://registry.npmjs.org/safe-buffer/-/safe-buffer-5.2.1.tgz",
      "integrity": "sha512-rp3So07KcdmmKbGvgaNxQSJr7bGVSVk5S9Eq1F+ppbRo70+YeaDxkw5Dd8NPN+GD6bjnYm2VuPuCXmpuYvmCXQ==",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT"
    },
    "node_modules/safer-buffer": {
      "version": "2.1.2",
      "resolved": "https://registry.npmjs.org/safer-buffer/-/safer-buffer-2.1.2.tgz",
      "integrity": "sha512-YZo3K82SD7Riyi0E1EQPojLz7kpepnSQI9IyPbHHg1XXXevb5dJI7tpyN2ADxGcQbHG7vcyRHk0cbwqcQriUtg==",
      "license": "MIT"
    },
    "node_modules/semver": {
      "version": "7.8.5",
      "resolved": "https://registry.npmjs.org/semver/-/semver-7.8.5.tgz",
      "integrity": "sha512-Y7/KDsb8LjooZpwaqGyulO6DQlksgCncchHGk+sZIY4SBvUocMBEFH5Ur1fI4dV+Jvl0w6cjvucaIi40puRioA==",
      "license": "ISC",
      "bin": {
        "semver": "bin/semver.js"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/send": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/send/-/send-1.2.1.tgz",
      "integrity": "sha512-1gnZf7DFcoIcajTjTwjwuDjzuz4PPcY2StKPlsGAQ1+YH20IRVrBaXSWmdjowTJ6u8Rc01PoYOGHXfP1mYcZNQ==",
      "license": "MIT",
      "dependencies": {
        "debug": "^4.4.3",
        "encodeurl": "^2.0.0",
        "escape-html": "^1.0.3",
        "etag": "^1.8.1",
        "fresh": "^2.0.0",
        "http-errors": "^2.0.1",
        "mime-types": "^3.0.2",
        "ms": "^2.1.3",
        "on-finished": "^2.4.1",
        "range-parser": "^1.2.1",
        "statuses": "^2.0.2"
      },
      "engines": {
        "node": ">= 18"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/express"
      }
    },
    "node_modules/serve-static": {
      "version": "2.2.1",
      "resolved": "https://registry.npmjs.org/serve-static/-/serve-static-2.2.1.tgz",
      "integrity": "sha512-xRXBn0pPqQTVQiC8wyQrKs2MOlX24zQ0POGaj0kultvoOCstBQM5yvOhAVSUwOMjQtTvsPWoNCHfPGwaaQJhTw==",
      "license": "MIT",
      "dependencies": {
        "encodeurl": "^2.0.0",
        "escape-html": "^1.0.3",
        "parseurl": "^1.3.3",
        "send": "^1.2.0"
      },
      "engines": {
        "node": ">= 18"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/express"
      }
    },
    "node_modules/setprototypeof": {
      "version": "1.2.0",
      "resolved": "https://registry.npmjs.org/setprototypeof/-/setprototypeof-1.2.0.tgz",
      "integrity": "sha512-E5LDX7Wrp85Kil5bhZv46j8jOeboKq5JMmYM3gVGdGH8xFpPWXUMsNrlODCrkoxMEeNi/XZIwuRvY4XNwYMJpw==",
      "license": "ISC"
    },
    "node_modules/shebang-command": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/shebang-command/-/shebang-command-2.0.0.tgz",
      "integrity": "sha512-kHxr2zZpYtdmrN1qDjrrX/Z1rR1kG8Dx+gkpK1G4eXmvXswmcE1hTWBWYUzlraYw1/yZp6YuDY77YtvbN0dmDA==",
      "license": "MIT",
      "dependencies": {
        "shebang-regex": "^3.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/shebang-regex": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/shebang-regex/-/shebang-regex-3.0.0.tgz",
      "integrity": "sha512-7++dFhtcx3353uBaq8DDR4NuxBetBzC7ZQOhmTQInHEd6bSrXdiEyzCvG07Z44UYdLShWUyXt5M/yhz8ekcb1A==",
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/side-channel": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/side-channel/-/side-channel-1.1.1.tgz",
      "integrity": "sha512-6x6dK6zJdpTzF4sQeNYxwtvBzf6Eg4GtlesS94HOvTudUeyK2WXAaIfmDgsyslYrRBeFIlsi54AYsFGUuhmvrQ==",
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "object-inspect": "^1.13.4",
        "side-channel-list": "^1.0.1",
        "side-channel-map": "^1.0.1",
        "side-channel-weakmap": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/side-channel-list": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/side-channel-list/-/side-channel-list-1.0.1.tgz",
      "integrity": "sha512-mjn/0bi/oUURjc5Xl7IaWi/OJJJumuoJFQJfDDyO46+hBWsfaVM65TBHq2eoZBhzl9EchxOijpkbRC8SVBQU0w==",
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "object-inspect": "^1.13.4"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/side-channel-map": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/side-channel-map/-/side-channel-map-1.0.1.tgz",
      "integrity": "sha512-VCjCNfgMsby3tTdo02nbjtM/ewra6jPHmpThenkTYh8pG9ucZ/1P8So4u4FGBek/BjpOVsDCMoLA/iuBKIFXRA==",
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.2",
        "es-errors": "^1.3.0",
        "get-intrinsic": "^1.2.5",
        "object-inspect": "^1.13.3"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/side-channel-weakmap": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/side-channel-weakmap/-/side-channel-weakmap-1.0.2.tgz",
      "integrity": "sha512-WPS/HvHQTYnHisLo9McqBHOJk2FkHO/tlpvldyrnem4aeQp4hai3gythswg6p01oSoTl58rcpiFAjF2br2Ak2A==",
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.2",
        "es-errors": "^1.3.0",
        "get-intrinsic": "^1.2.5",
        "object-inspect": "^1.13.3",
        "side-channel-map": "^1.0.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/sift": {
      "version": "17.1.3",
      "resolved": "https://registry.npmjs.org/sift/-/sift-17.1.3.tgz",
      "integrity": "sha512-Rtlj66/b0ICeFzYTuNvX/EF1igRbbnGSvEyT79McoZa/DeGhMyC5pWKOEsZKnpkqtSeovd5FL/bjHWC3CIIvCQ==",
      "license": "MIT"
    },
    "node_modules/signal-exit": {
      "version": "4.1.0",
      "resolved": "https://registry.npmjs.org/signal-exit/-/signal-exit-4.1.0.tgz",
      "integrity": "sha512-bzyZ1e88w9O1iNJbKnOlvYTrWPDl46O1bG0D3XInv+9tkPrxrN8jUUTiFlDkkmKWgn1M6CfIA13SuGqOa9Korw==",
      "license": "ISC",
      "engines": {
        "node": ">=14"
      },
      "funding": {
        "url": "https://github.com/sponsors/isaacs"
      }
    },
    "node_modules/simple-update-notifier": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/simple-update-notifier/-/simple-update-notifier-2.0.0.tgz",
      "integrity": "sha512-a2B9Y0KlNXl9u/vsW6sTIu9vGEpfKu2wRV6l1H3XEas/0gUIzGzBoP/IouTcUQbm9JWZLH3COxyn03TYlFax6w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "semver": "^7.5.3"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/slash": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/slash/-/slash-3.0.0.tgz",
      "integrity": "sha512-g9Q1haeby36OSStwb4ntCGGGaKsaVSjQ68fBxoQcutl5fS1vuY18H3wSt3jFyFtrkx+Kz0V1G85A4MyAdDMi2Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/source-map": {
      "version": "0.6.1",
      "resolved": "https://registry.npmjs.org/source-map/-/source-map-0.6.1.tgz",
      "integrity": "sha512-UjgapumWlbMhkBgzT7Ykc5YXUT46F0iKu8SGXq0bcwP5dz/h0Plj6enJqjz1Zbq2l5WaqYnrVbwWOWMyF3F47g==",
      "dev": true,
      "license": "BSD-3-Clause",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/source-map-support": {
      "version": "0.5.13",
      "resolved": "https://registry.npmjs.org/source-map-support/-/source-map-support-0.5.13.tgz",
      "integrity": "sha512-SHSKFHadjVA5oR4PPqhtAVdcBWwRYVd6g6cAXnIbRiIwc2EhPrTuKUBdSLvlEKyIP3GCf89fltvcZiP9MMFA1w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "buffer-from": "^1.0.0",
        "source-map": "^0.6.0"
      }
    },
    "node_modules/sparse-bitfield": {
      "version": "3.0.3",
      "resolved": "https://registry.npmjs.org/sparse-bitfield/-/sparse-bitfield-3.0.3.tgz",
      "integrity": "sha512-kvzhi7vqKTfkh0PZU+2D2PIllw2ymqJKujUcyPMd9Y75Nv4nPbGJZXNhxsgdQab2BmlDct1YnfQCguEvHr7VsQ==",
      "license": "MIT",
      "dependencies": {
        "memory-pager": "^1.0.2"
      }
    },
    "node_modules/sprintf-js": {
      "version": "1.0.3",
      "resolved": "https://registry.npmjs.org/sprintf-js/-/sprintf-js-1.0.3.tgz",
      "integrity": "sha512-D9cPgkvLlV3t3IzL0D0YLvGA9Ahk4PcvVwUbN0dSGr1aP0Nrt4AEnTUbuGvquEC0mA64Gqt1fzirlRs5ibXx8g==",
      "dev": true,
      "license": "BSD-3-Clause"
    },
    "node_modules/stack-utils": {
      "version": "2.0.6",
      "resolved": "https://registry.npmjs.org/stack-utils/-/stack-utils-2.0.6.tgz",
      "integrity": "sha512-XlkWvfIm6RmsWtNJx+uqtKLS8eqFbxUg0ZzLXqY0caEy9l7hruX8IpiDnjsLavoBgqCCR71TqWO8MaXYheJ3RQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "escape-string-regexp": "^2.0.0"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/statuses": {
      "version": "2.0.2",
      "resolved": "https://registry.npmjs.org/statuses/-/statuses-2.0.2.tgz",
      "integrity": "sha512-DvEy55V3DB7uknRo+4iOGT5fP1slR8wQohVdknigZPMpMstaKJQWhwiYBACJE3Ul2pTnATihhBYnRhZQHGBiRw==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/streamsearch": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/streamsearch/-/streamsearch-1.1.0.tgz",
      "integrity": "sha512-Mcc5wHehp9aXz1ax6bZUyY5afg9u2rv5cqQI3mRrYkGC8rW2hM02jWuwjtL++LS5qinSyhj2QfLyNsuc+VsExg==",
      "engines": {
        "node": ">=10.0.0"
      }
    },
    "node_modules/string_decoder": {
      "version": "1.3.0",
      "resolved": "https://registry.npmjs.org/string_decoder/-/string_decoder-1.3.0.tgz",
      "integrity": "sha512-hkRX8U1WjJFd8LsDJ2yQ/wWWxaopEsABU1XfkM8A+j0+85JAGppt16cr1Whg6KIbb4okU6Mql6BOj+uup/wKeA==",
      "license": "MIT",
      "dependencies": {
        "safe-buffer": "~5.2.0"
      }
    },
    "node_modules/string-length": {
      "version": "4.0.2",
      "resolved": "https://registry.npmjs.org/string-length/-/string-length-4.0.2.tgz",
      "integrity": "sha512-+l6rNN5fYHNhZZy41RXsYptCjA2Igmq4EG7kZAYFQI1E1VTXarr6ZPXBg6eq7Y6eK4FEhY6AJlyuFIb/v/S0VQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "char-regex": "^1.0.2",
        "strip-ansi": "^6.0.0"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/string-length/node_modules/ansi-regex": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/ansi-regex/-/ansi-regex-5.0.1.tgz",
      "integrity": "sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/string-length/node_modules/strip-ansi": {
      "version": "6.0.1",
      "resolved": "https://registry.npmjs.org/strip-ansi/-/strip-ansi-6.0.1.tgz",
      "integrity": "sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-regex": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/string-width": {
      "version": "5.1.2",
      "resolved": "https://registry.npmjs.org/string-width/-/string-width-5.1.2.tgz",
      "integrity": "sha512-HnLOCR3vjcY8beoNLtcjZ5/nxn2afmME6lhrDrebokqMap+XbeW8n9TXpPDOqdGK5qcI3oT0GKTW6wC7EMiVqA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "eastasianwidth": "^0.2.0",
        "emoji-regex": "^9.2.2",
        "strip-ansi": "^7.0.1"
      },
      "engines": {
        "node": ">=12"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/string-width-cjs": {
      "name": "string-width",
      "version": "4.2.3",
      "resolved": "https://registry.npmjs.org/string-width/-/string-width-4.2.3.tgz",
      "integrity": "sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "emoji-regex": "^8.0.0",
        "is-fullwidth-code-point": "^3.0.0",
        "strip-ansi": "^6.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/string-width-cjs/node_modules/ansi-regex": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/ansi-regex/-/ansi-regex-5.0.1.tgz",
      "integrity": "sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/string-width-cjs/node_modules/emoji-regex": {
      "version": "8.0.0",
      "resolved": "https://registry.npmjs.org/emoji-regex/-/emoji-regex-8.0.0.tgz",
      "integrity": "sha512-MSjYzcWNOA0ewAHpz0MxpYFvwg6yjy1NG3xteoqz644VCo/RPgnr1/GGt+ic3iJTzQ8Eu3TdM14SawnVUmGE6A==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/string-width-cjs/node_modules/strip-ansi": {
      "version": "6.0.1",
      "resolved": "https://registry.npmjs.org/strip-ansi/-/strip-ansi-6.0.1.tgz",
      "integrity": "sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-regex": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/strip-ansi": {
      "version": "7.2.0",
      "resolved": "https://registry.npmjs.org/strip-ansi/-/strip-ansi-7.2.0.tgz",
      "integrity": "sha512-yDPMNjp4WyfYBkHnjIRLfca1i6KMyGCtsVgoKe/z1+6vukgaENdgGBZt+ZmKPc4gavvEZ5OgHfHdrazhgNyG7w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-regex": "^6.2.2"
      },
      "engines": {
        "node": ">=12"
      },
      "funding": {
        "url": "https://github.com/chalk/strip-ansi?sponsor=1"
      }
    },
    "node_modules/strip-ansi-cjs": {
      "name": "strip-ansi",
      "version": "6.0.1",
      "resolved": "https://registry.npmjs.org/strip-ansi/-/strip-ansi-6.0.1.tgz",
      "integrity": "sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-regex": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/strip-ansi-cjs/node_modules/ansi-regex": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/ansi-regex/-/ansi-regex-5.0.1.tgz",
      "integrity": "sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/strip-bom": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/strip-bom/-/strip-bom-4.0.0.tgz",
      "integrity": "sha512-3xurFv5tEgii33Zi8Jtp55wEIILR9eh34FAW00PZf+JnSsTmV/ioewSgQl97JHvgjoRGwPShsWm+IdrxB35d0w==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/strip-final-newline": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/strip-final-newline/-/strip-final-newline-2.0.0.tgz",
      "integrity": "sha512-BrpvfNAE3dcvq7ll3xVumzjKjZQ5tI1sEUIKr3Uoks0XUl45St3FlatVqef9prk4jRDzhW6WZg+3bk93y6pLjA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/strip-json-comments": {
      "version": "3.1.1",
      "resolved": "https://registry.npmjs.org/strip-json-comments/-/strip-json-comments-3.1.1.tgz",
      "integrity": "sha512-6fPc+R4ihwqP6N/aIv2f1gMH8lOVtWQHoqC4yK6oSDVVocumAsfCqjkXnqiYMhmMwS/mEHLp7Vehlt3ql6lEig==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/superagent": {
      "version": "10.3.0",
      "resolved": "https://registry.npmjs.org/superagent/-/superagent-10.3.0.tgz",
      "integrity": "sha512-B+4Ik7ROgVKrQsXTV0Jwp2u+PXYLSlqtDAhYnkkD+zn3yg8s/zjA2MeGayPoY/KICrbitwneDHrjSotxKL+0XQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "component-emitter": "^1.3.1",
        "cookiejar": "^2.1.4",
        "debug": "^4.3.7",
        "fast-safe-stringify": "^2.1.1",
        "form-data": "^4.0.5",
        "formidable": "^3.5.4",
        "methods": "^1.1.2",
        "mime": "2.6.0",
        "qs": "^6.14.1"
      },
      "engines": {
        "node": ">=14.18.0"
      }
    },
    "node_modules/supertest": {
      "version": "7.2.2",
      "resolved": "https://registry.npmjs.org/supertest/-/supertest-7.2.2.tgz",
      "integrity": "sha512-oK8WG9diS3DlhdUkcFn4tkNIiIbBx9lI2ClF8K+b2/m8Eyv47LSawxUzZQSNKUrVb2KsqeTDCcjAAVPYaSLVTA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "cookie-signature": "^1.2.2",
        "methods": "^1.1.2",
        "superagent": "^10.3.0"
      },
      "engines": {
        "node": ">=14.18.0"
      }
    },
    "node_modules/supports-color": {
      "version": "5.5.0",
      "resolved": "https://registry.npmjs.org/supports-color/-/supports-color-5.5.0.tgz",
      "integrity": "sha512-QjVjwdXIt408MIiAqCX4oUKsgU2EqAGzs2Ppkm4aQYbjm+ZEWEcW4SfFNTr4uMNZma0ey4f5lgLrkB0aX0QMow==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "has-flag": "^3.0.0"
      },
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/supports-preserve-symlinks-flag": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/supports-preserve-symlinks-flag/-/supports-preserve-symlinks-flag-1.0.0.tgz",
      "integrity": "sha512-ot0WnXS9fgdkgIcePe6RHNk1WA8+muPa6cSjeR3V8K27q9BB1rTE3R1p7Hv0z1ZyAc8s6Vvv8DIyWf681MAt0w==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/swagger-jsdoc": {
      "version": "6.3.0",
      "resolved": "https://registry.npmjs.org/swagger-jsdoc/-/swagger-jsdoc-6.3.0.tgz",
      "integrity": "sha512-I+iQjVGV3t28pOkQUJv2MncthvOtkEactOn8R76SvSYhxgtIn7FoqfDHwQaN+GBnQdXQLrhgDXseKitmJcHMsA==",
      "license": "MIT",
      "dependencies": {
        "@apidevtools/swagger-parser": "^12.1.0",
        "commander": "6.2.0",
        "doctrine": "3.0.0",
        "glob": "11.1.0",
        "lodash.mergewith": "^4.6.2",
        "yaml": "2.0.0-1"
      },
      "bin": {
        "swagger-jsdoc": "bin/swagger-jsdoc.js"
      },
      "engines": {
        "node": ">=20.0.0"
      }
    },
    "node_modules/swagger-jsdoc/node_modules/@isaacs/cliui": {
      "version": "9.0.0",
      "resolved": "https://registry.npmjs.org/@isaacs/cliui/-/cliui-9.0.0.tgz",
      "integrity": "sha512-AokJm4tuBHillT+FpMtxQ60n8ObyXBatq7jD2/JA9dxbDDokKQm8KMht5ibGzLVU9IJDIKK4TPKgMHEYMn3lMg==",
      "license": "BlueOak-1.0.0",
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/swagger-jsdoc/node_modules/glob": {
      "version": "11.1.0",
      "resolved": "https://registry.npmjs.org/glob/-/glob-11.1.0.tgz",
      "integrity": "sha512-vuNwKSaKiqm7g0THUBu2x7ckSs3XJLXE+2ssL7/MfTGPLLcrJQ/4Uq1CjPTtO5cCIiRxqvN6Twy1qOwhL0Xjcw==",
      "deprecated": "Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me",
      "license": "BlueOak-1.0.0",
      "dependencies": {
        "foreground-child": "^3.3.1",
        "jackspeak": "^4.1.1",
        "minimatch": "^10.1.1",
        "minipass": "^7.1.2",
        "package-json-from-dist": "^1.0.0",
        "path-scurry": "^2.0.0"
      },
      "bin": {
        "glob": "dist/esm/bin.mjs"
      },
      "engines": {
        "node": "20 || >=22"
      },
      "funding": {
        "url": "https://github.com/sponsors/isaacs"
      }
    },
    "node_modules/swagger-jsdoc/node_modules/jackspeak": {
      "version": "4.2.3",
      "resolved": "https://registry.npmjs.org/jackspeak/-/jackspeak-4.2.3.tgz",
      "integrity": "sha512-ykkVRwrYvFm1nb2AJfKKYPr0emF6IiXDYUaFx4Zn9ZuIH7MrzEZ3sD5RlqGXNRpHtvUHJyOnCEFxOlNDtGo7wg==",
      "license": "BlueOak-1.0.0",
      "dependencies": {
        "@isaacs/cliui": "^9.0.0"
      },
      "engines": {
        "node": "20 || >=22"
      },
      "funding": {
        "url": "https://github.com/sponsors/isaacs"
      }
    },
    "node_modules/swagger-jsdoc/node_modules/lru-cache": {
      "version": "11.5.2",
      "resolved": "https://registry.npmjs.org/lru-cache/-/lru-cache-11.5.2.tgz",
      "integrity": "sha512-4pfM1Ff0x50o0tQwb5ucw/RzNyD0/YJME6IVcStalZuMWxdt3sR3huStTtxz4PUmvZfRguvDejasvQ2kifR11g==",
      "license": "BlueOak-1.0.0",
      "engines": {
        "node": "20 || >=22"
      }
    },
    "node_modules/swagger-jsdoc/node_modules/path-scurry": {
      "version": "2.0.2",
      "resolved": "https://registry.npmjs.org/path-scurry/-/path-scurry-2.0.2.tgz",
      "integrity": "sha512-3O/iVVsJAPsOnpwWIeD+d6z/7PmqApyQePUtCndjatj/9I5LylHvt5qluFaBT3I5h3r1ejfR056c+FCv+NnNXg==",
      "license": "BlueOak-1.0.0",
      "dependencies": {
        "lru-cache": "^11.0.0",
        "minipass": "^7.1.2"
      },
      "engines": {
        "node": "18 || 20 || >=22"
      },
      "funding": {
        "url": "https://github.com/sponsors/isaacs"
      }
    },
    "node_modules/swagger-ui-dist": {
      "version": "5.32.8",
      "resolved": "https://registry.npmjs.org/swagger-ui-dist/-/swagger-ui-dist-5.32.8.tgz",
      "integrity": "sha512-dgMdWXIgnI4zX4OPhKEdWnlDODbgm8W3AX0Ivn/BBqcUh6xZsBxhZMnvk6DJyRz1BTrj8dPxtarmEGgkz30oyA==",
      "license": "Apache-2.0",
      "dependencies": {
        "@scarf/scarf": "=1.4.0"
      }
    },
    "node_modules/swagger-ui-express": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/swagger-ui-express/-/swagger-ui-express-5.0.1.tgz",
      "integrity": "sha512-SrNU3RiBGTLLmFU8GIJdOdanJTl4TOmT27tt3bWWHppqYmAZ6IDuEuBvMU6nZq0zLEe6b/1rACXCgLZqO6ZfrA==",
      "license": "MIT",
      "dependencies": {
        "swagger-ui-dist": ">=5.0.0"
      },
      "engines": {
        "node": ">= v0.10.32"
      },
      "peerDependencies": {
        "express": ">=4.0.0 || >=5.0.0-beta"
      }
    },
    "node_modules/synckit": {
      "version": "0.11.13",
      "resolved": "https://registry.npmjs.org/synckit/-/synckit-0.11.13.tgz",
      "integrity": "sha512-eNRKgb3z66Yp3D2CixVujOUvXLFUTij/zVnV8KRyvFdQwpz7I5DS8UfRkTeLzb64u+dkzDSdelE24izu+zSSUg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@pkgr/core": "^0.3.6"
      },
      "engines": {
        "node": "^14.18.0 || >=16.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/synckit"
      }
    },
    "node_modules/test-exclude": {
      "version": "6.0.0",
      "resolved": "https://registry.npmjs.org/test-exclude/-/test-exclude-6.0.0.tgz",
      "integrity": "sha512-cAGWPIyOHU6zlmg88jwm7VRyXnMN7iV68OGAbYDk/Mh/xC/pzVPlQtY6ngoIH/5/tciuhGfvESU8GrHrcxD56w==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "@istanbuljs/schema": "^0.1.2",
        "glob": "^7.1.4",
        "minimatch": "^3.0.4"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/test-exclude/node_modules/balanced-match": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/balanced-match/-/balanced-match-1.0.2.tgz",
      "integrity": "sha512-3oSeUO0TMV67hN1AmbXsK4yaqU7tjiHlbxRDZOpH0KW9+CeX4bRAaX0Anxt0tx2MrpRpWwQaPwIlISEJhYU5Pw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/test-exclude/node_modules/brace-expansion": {
      "version": "1.1.16",
      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.16.tgz",
      "integrity": "sha512-IDw48K2/2kRkg9LdJxurvq3lV3aBgq0REY89duEqFRthjlPdXHKMj7EnQOXVckxzgisinf3nHfrcE2FufFLXMw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "balanced-match": "^1.0.0",
        "concat-map": "0.0.1"
      }
    },
    "node_modules/test-exclude/node_modules/glob": {
      "version": "7.2.3",
      "resolved": "https://registry.npmjs.org/glob/-/glob-7.2.3.tgz",
      "integrity": "sha512-nFR0zLpU2YCaRxwoCJvL6UvCH2JFyFVIvwTLsIf21AuHlMskA1hhTdk+LlYJtOlYt9v6dvszD2BGRqBL+iQK9Q==",
      "deprecated": "Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "fs.realpath": "^1.0.0",
        "inflight": "^1.0.4",
        "inherits": "2",
        "minimatch": "^3.1.1",
        "once": "^1.3.0",
        "path-is-absolute": "^1.0.0"
      },
      "engines": {
        "node": "*"
      },
      "funding": {
        "url": "https://github.com/sponsors/isaacs"
      }
    },
    "node_modules/test-exclude/node_modules/minimatch": {
      "version": "3.1.5",
      "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-3.1.5.tgz",
      "integrity": "sha512-VgjWUsnnT6n+NUk6eZq77zeFdpW2LWDzP6zFGrCbHXiYNul5Dzqk2HHQ5uFH2DNW5Xbp8+jVzaeNt94ssEEl4w==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "brace-expansion": "^1.1.7"
      },
      "engines": {
        "node": "*"
      }
    },
    "node_modules/tmpl": {
      "version": "1.0.5",
      "resolved": "https://registry.npmjs.org/tmpl/-/tmpl-1.0.5.tgz",
      "integrity": "sha512-3f0uOEAQwIqGuWW2MVzYg8fV/QNnc/IpuJNG837rLuczAaLVHslWHZQj4IGiEl5Hs3kkbhwL9Ab7Hrsmuj+Smw==",
      "dev": true,
      "license": "BSD-3-Clause"
    },
    "node_modules/to-regex-range": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/to-regex-range/-/to-regex-range-5.0.1.tgz",
      "integrity": "sha512-65P7iz6X5yEr1cwcgvQxbbIw7Uk3gOy5dIdtZ4rDveLqhrdJP+Li/Hx6tyK0NEb+2GCyneCMJiGqrADCSNk8sQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-number": "^7.0.0"
      },
      "engines": {
        "node": ">=8.0"
      }
    },
    "node_modules/toidentifier": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/toidentifier/-/toidentifier-1.0.1.tgz",
      "integrity": "sha512-o5sSPKEkg/DIQNmH43V0/uerLrpzVedkUh8tGNvaeXpfpuwjKenlSox/2O/BTlZUtEe+JG7s5YhEz608PlAHRA==",
      "license": "MIT",
      "engines": {
        "node": ">=0.6"
      }
    },
    "node_modules/touch": {
      "version": "3.1.1",
      "resolved": "https://registry.npmjs.org/touch/-/touch-3.1.1.tgz",
      "integrity": "sha512-r0eojU4bI8MnHr8c5bNo7lJDdI2qXlWWJk6a9EAFG7vbhTjElYhBVS3/miuE0uOuoLdb8Mc/rVfsmm6eo5o9GA==",
      "dev": true,
      "license": "ISC",
      "bin": {
        "nodetouch": "bin/nodetouch.js"
      }
    },
    "node_modules/tr46": {
      "version": "5.1.1",
      "resolved": "https://registry.npmjs.org/tr46/-/tr46-5.1.1.tgz",
      "integrity": "sha512-hdF5ZgjTqgAntKkklYw0R03MG2x/bSzTtkxmIRw/sTNV8YXsCJ1tfLAX23lhxhHJlEf3CRCOCGGWw3vI3GaSPw==",
      "license": "MIT",
      "dependencies": {
        "punycode": "^2.3.1"
      },
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/tslib": {
      "version": "2.8.1",
      "resolved": "https://registry.npmjs.org/tslib/-/tslib-2.8.1.tgz",
      "integrity": "sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w==",
      "dev": true,
      "license": "0BSD",
      "optional": true
    },
    "node_modules/type-detect": {
      "version": "4.0.8",
      "resolved": "https://registry.npmjs.org/type-detect/-/type-detect-4.0.8.tgz",
      "integrity": "sha512-0fr/mIH1dlO+x7TlcMy+bIDqKPsw/70tVyeHW787goQjhmqaZe10uwLujubK9q9Lg6Fiho1KUKDYz0Z7k7g5/g==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/type-fest": {
      "version": "0.21.3",
      "resolved": "https://registry.npmjs.org/type-fest/-/type-fest-0.21.3.tgz",
      "integrity": "sha512-t0rzBq87m3fVcduHDUFhKmyyX+9eo6WQjZvf51Ea/M0Q7+T374Jp1aUiyUl0GKxp8M/OETVHSDvmkyPgvX+X2w==",
      "dev": true,
      "license": "(MIT OR CC0-1.0)",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/type-is": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/type-is/-/type-is-2.1.0.tgz",
      "integrity": "sha512-faYHw0anBbc/kWF3zFTEnxSFOAGUX9GFbOBthvDdLsIlEoWOFOtS0zgCiQYwIskL9iGXZL3kAXD8OoZ4GmMATA==",
      "license": "MIT",
      "dependencies": {
        "content-type": "^2.0.0",
        "media-typer": "^1.1.0",
        "mime-types": "^3.0.0"
      },
      "engines": {
        "node": ">= 18"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/express"
      }
    },
    "node_modules/type-is/node_modules/content-type": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/content-type/-/content-type-2.0.0.tgz",
      "integrity": "sha512-j/O/d7GcZCyNl7/hwZAb606rzqkyvaDctLmckbxLzHvFBzTJHuGEdodATcP3yIRoDrLHkIATJuvzbFlp/ki2cQ==",
      "license": "MIT",
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/express"
      }
    },
    "node_modules/typedarray": {
      "version": "0.0.6",
      "resolved": "https://registry.npmjs.org/typedarray/-/typedarray-0.0.6.tgz",
      "integrity": "sha512-/aCDEGatGvZ2BIk+HmLf4ifCJFwvKFNb9/JeZPMulfgFracn9QFcAf5GO8B/mweUjSoblS5In0cWhqpfs/5PQA==",
      "license": "MIT"
    },
    "node_modules/undefsafe": {
      "version": "2.0.5",
      "resolved": "https://registry.npmjs.org/undefsafe/-/undefsafe-2.0.5.tgz",
      "integrity": "sha512-WxONCrssBM8TSPRqN5EmsjVrsv4A8X12J4ArBiiayv3DyyG3ZlIg6yysuuSYdZsVz3TKcTg2fd//Ujd4CHV1iA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/undici-types": {
      "version": "8.3.0",
      "resolved": "https://registry.npmjs.org/undici-types/-/undici-types-8.3.0.tgz",
      "integrity": "sha512-j375ScV60dom+YkPFIfTLcOiPxkN/buHz5GobjLhixFuANaNs3C9l4GmrWqejgXWJ7BbJcFYpTEUkS1Ge8bpZQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/unicode-canonical-property-names-ecmascript": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/unicode-canonical-property-names-ecmascript/-/unicode-canonical-property-names-ecmascript-2.0.1.tgz",
      "integrity": "sha512-dA8WbNeb2a6oQzAQ55YlT5vQAWGV9WXOsi3SskE3bcCdM0P4SDd+24zS/OCacdRq5BkdsRj9q3Pg6YyQoxIGqg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/unicode-match-property-ecmascript": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/unicode-match-property-ecmascript/-/unicode-match-property-ecmascript-2.0.0.tgz",
      "integrity": "sha512-5kaZCrbp5mmbz5ulBkDkbY0SsPOjKqVS35VpL9ulMPfSl0J0Xsm+9Evphv9CoIZFwre7aJoa94AY6seMKGVN5Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "unicode-canonical-property-names-ecmascript": "^2.0.0",
        "unicode-property-aliases-ecmascript": "^2.0.0"
      },
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/unicode-match-property-value-ecmascript": {
      "version": "2.2.1",
      "resolved": "https://registry.npmjs.org/unicode-match-property-value-ecmascript/-/unicode-match-property-value-ecmascript-2.2.1.tgz",
      "integrity": "sha512-JQ84qTuMg4nVkx8ga4A16a1epI9H6uTXAknqxkGF/aFfRLw1xC/Bp24HNLaZhHSkWd3+84t8iXnp1J0kYcZHhg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/unicode-property-aliases-ecmascript": {
      "version": "2.2.0",
      "resolved": "https://registry.npmjs.org/unicode-property-aliases-ecmascript/-/unicode-property-aliases-ecmascript-2.2.0.tgz",
      "integrity": "sha512-hpbDzxUY9BFwX+UeBnxv3Sh1q7HFxj48DTmXchNgRa46lO8uj3/1iEn3MiNUYTg1g9ctIqXCCERn8gYZhHC5lQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/unpipe": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/unpipe/-/unpipe-1.0.0.tgz",
      "integrity": "sha512-pjy2bYhSsufwWlKwPc+l3cN7+wuJlK6uz0YdJEOlQDbl6jo/YlPi4mb8agUkVC8BF7V8NuzeyPNqRksA3hztKQ==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/unrs-resolver": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/unrs-resolver/-/unrs-resolver-1.12.2.tgz",
      "integrity": "sha512-dmlRxBJJayXjqTwC+JtF1HhJmgf3ftQ3YejFcZrf4+KKtJv0qDsK1pjqaaVjG7wJ5NJ6UVP1OqRMQ71Z4C3rxQ==",
      "dev": true,
      "hasInstallScript": true,
      "license": "MIT",
      "dependencies": {
        "napi-postinstall": "^0.3.4"
      },
      "funding": {
        "url": "https://opencollective.com/unrs-resolver"
      },
      "optionalDependencies": {
        "@unrs/resolver-binding-android-arm-eabi": "1.12.2",
        "@unrs/resolver-binding-android-arm64": "1.12.2",
        "@unrs/resolver-binding-darwin-arm64": "1.12.2",
        "@unrs/resolver-binding-darwin-x64": "1.12.2",
        "@unrs/resolver-binding-freebsd-x64": "1.12.2",
        "@unrs/resolver-binding-linux-arm-gnueabihf": "1.12.2",
        "@unrs/resolver-binding-linux-arm-musleabihf": "1.12.2",
        "@unrs/resolver-binding-linux-arm64-gnu": "1.12.2",
        "@unrs/resolver-binding-linux-arm64-musl": "1.12.2",
        "@unrs/resolver-binding-linux-loong64-gnu": "1.12.2",
        "@unrs/resolver-binding-linux-loong64-musl": "1.12.2",
        "@unrs/resolver-binding-linux-ppc64-gnu": "1.12.2",
        "@unrs/resolver-binding-linux-riscv64-gnu": "1.12.2",
        "@unrs/resolver-binding-linux-riscv64-musl": "1.12.2",
        "@unrs/resolver-binding-linux-s390x-gnu": "1.12.2",
        "@unrs/resolver-binding-linux-x64-gnu": "1.12.2",
        "@unrs/resolver-binding-linux-x64-musl": "1.12.2",
        "@unrs/resolver-binding-openharmony-arm64": "1.12.2",
        "@unrs/resolver-binding-wasm32-wasi": "1.12.2",
        "@unrs/resolver-binding-win32-arm64-msvc": "1.12.2",
        "@unrs/resolver-binding-win32-ia32-msvc": "1.12.2",
        "@unrs/resolver-binding-win32-x64-msvc": "1.12.2"
      }
    },
    "node_modules/update-browserslist-db": {
      "version": "1.2.3",
      "resolved": "https://registry.npmjs.org/update-browserslist-db/-/update-browserslist-db-1.2.3.tgz",
      "integrity": "sha512-Js0m9cx+qOgDxo0eMiFGEueWztz+d4+M3rGlmKPT+T4IS/jP4ylw3Nwpu6cpTTP8R1MAC1kF4VbdLt3ARf209w==",
      "dev": true,
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/browserslist"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "escalade": "^3.2.0",
        "picocolors": "^1.1.1"
      },
      "bin": {
        "update-browserslist-db": "cli.js"
      },
      "peerDependencies": {
        "browserslist": ">= 4.21.0"
      }
    },
    "node_modules/util-deprecate": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/util-deprecate/-/util-deprecate-1.0.2.tgz",
      "integrity": "sha512-EPD5q1uXyFxJpCrLnCc1nHnq3gOa6DZBocAIiI2TaSCA7VCJ1UJDMagCzIkXNsUYfD1daK//LTEQ8xiIbrHtcw==",
      "license": "MIT"
    },
    "node_modules/v8-to-istanbul": {
      "version": "9.3.0",
      "resolved": "https://registry.npmjs.org/v8-to-istanbul/-/v8-to-istanbul-9.3.0.tgz",
      "integrity": "sha512-kiGUalWN+rgBJ/1OHZsBtU4rXZOfj/7rKQxULKlIzwzQSvMJUUNgPwJEEh7gU6xEVxC0ahoOBvN2YI8GH6FNgA==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "@jridgewell/trace-mapping": "^0.3.12",
        "@types/istanbul-lib-coverage": "^2.0.1",
        "convert-source-map": "^2.0.0"
      },
      "engines": {
        "node": ">=10.12.0"
      }
    },
    "node_modules/vary": {
      "version": "1.1.2",
      "resolved": "https://registry.npmjs.org/vary/-/vary-1.1.2.tgz",
      "integrity": "sha512-BNGbWLfd0eUPabhkXUVm0j8uuvREyTh5ovRa/dyow/BqAbZJyC+5fU+IzQOzmAKzYqYRAISoRhdQr3eIZ/PXqg==",
      "license": "MIT",
      "engines": {
        "node": ">= 0.8"
      }
    },
    "node_modules/walker": {
      "version": "1.0.8",
      "resolved": "https://registry.npmjs.org/walker/-/walker-1.0.8.tgz",
      "integrity": "sha512-ts/8E8l5b7kY0vlWLewOkDXMmPdLcVV4GmOQLyxuSswIJsweeFZtAsMF7k1Nszz+TYBQrlYRmzOnr398y1JemQ==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "makeerror": "1.0.12"
      }
    },
    "node_modules/webidl-conversions": {
      "version": "7.0.0",
      "resolved": "https://registry.npmjs.org/webidl-conversions/-/webidl-conversions-7.0.0.tgz",
      "integrity": "sha512-VwddBukDzu71offAQR975unBIGqfKZpM+8ZX6ySk8nYhVoo5CYaZyzt3YBvYtRtO+aoGlqxPg/B87NGVZ/fu6g==",
      "license": "BSD-2-Clause",
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/whatwg-url": {
      "version": "14.2.0",
      "resolved": "https://registry.npmjs.org/whatwg-url/-/whatwg-url-14.2.0.tgz",
      "integrity": "sha512-De72GdQZzNTUBBChsXueQUnPKDkg/5A5zp7pFDuQAj5UFoENpiACU0wlCvzpAGnTkj++ihpKwKyYewn/XNUbKw==",
      "license": "MIT",
      "dependencies": {
        "tr46": "^5.1.0",
        "webidl-conversions": "^7.0.0"
      },
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/which": {
      "version": "2.0.2",
      "resolved": "https://registry.npmjs.org/which/-/which-2.0.2.tgz",
      "integrity": "sha512-BLI3Tl1TW3Pvl70l3yq3Y64i+awpwXqsGBYWkkqMtnbXgrMD+yj7rhW0kuEDxzJaYXGjEW5ogapKNMEKNMjibA==",
      "license": "ISC",
      "dependencies": {
        "isexe": "^2.0.0"
      },
      "bin": {
        "node-which": "bin/node-which"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/wrap-ansi": {
      "version": "8.1.0",
      "resolved": "https://registry.npmjs.org/wrap-ansi/-/wrap-ansi-8.1.0.tgz",
      "integrity": "sha512-si7QWI6zUMq56bESFvagtmzMdGOtoxfR+Sez11Mobfc7tm+VkUckk9bW2UeffTGVUbOksxmSw0AA2gs8g71NCQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-styles": "^6.1.0",
        "string-width": "^5.0.1",
        "strip-ansi": "^7.0.1"
      },
      "engines": {
        "node": ">=12"
      },
      "funding": {
        "url": "https://github.com/chalk/wrap-ansi?sponsor=1"
      }
    },
    "node_modules/wrap-ansi-cjs": {
      "name": "wrap-ansi",
      "version": "7.0.0",
      "resolved": "https://registry.npmjs.org/wrap-ansi/-/wrap-ansi-7.0.0.tgz",
      "integrity": "sha512-YVGIj2kamLSTxw6NsZjoBxfSwsn0ycdesmc4p+Q21c5zPuZ1pl+NfxVdxPtdHvmNVOQ6XSYG4AUtyt/Fi7D16Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-styles": "^4.0.0",
        "string-width": "^4.1.0",
        "strip-ansi": "^6.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/chalk/wrap-ansi?sponsor=1"
      }
    },
    "node_modules/wrap-ansi-cjs/node_modules/ansi-regex": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/ansi-regex/-/ansi-regex-5.0.1.tgz",
      "integrity": "sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/wrap-ansi-cjs/node_modules/emoji-regex": {
      "version": "8.0.0",
      "resolved": "https://registry.npmjs.org/emoji-regex/-/emoji-regex-8.0.0.tgz",
      "integrity": "sha512-MSjYzcWNOA0ewAHpz0MxpYFvwg6yjy1NG3xteoqz644VCo/RPgnr1/GGt+ic3iJTzQ8Eu3TdM14SawnVUmGE6A==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/wrap-ansi-cjs/node_modules/string-width": {
      "version": "4.2.3",
      "resolved": "https://registry.npmjs.org/string-width/-/string-width-4.2.3.tgz",
      "integrity": "sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "emoji-regex": "^8.0.0",
        "is-fullwidth-code-point": "^3.0.0",
        "strip-ansi": "^6.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/wrap-ansi-cjs/node_modules/strip-ansi": {
      "version": "6.0.1",
      "resolved": "https://registry.npmjs.org/strip-ansi/-/strip-ansi-6.0.1.tgz",
      "integrity": "sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-regex": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/wrap-ansi/node_modules/ansi-styles": {
      "version": "6.2.3",
      "resolved": "https://registry.npmjs.org/ansi-styles/-/ansi-styles-6.2.3.tgz",
      "integrity": "sha512-4Dj6M28JB+oAH8kFkTLUo+a2jwOFkuqb3yucU0CANcRRUbxS0cP0nZYCGjcc3BNXwRIsUVmDGgzawme7zvJHvg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12"
      },
      "funding": {
        "url": "https://github.com/chalk/ansi-styles?sponsor=1"
      }
    },
    "node_modules/wrappy": {
      "version": "1.0.2",
      "resolved": "https://registry.npmjs.org/wrappy/-/wrappy-1.0.2.tgz",
      "integrity": "sha512-l4Sp/DRseor9wL6EvV2+TuQn63dMkPjZ/sp9XkghTEbV9KlPS1xUsZ3u7/IQO4wxtcFB4bgpQPRcR3QCvezPcQ==",
      "license": "ISC"
    },
    "node_modules/write-file-atomic": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/write-file-atomic/-/write-file-atomic-5.0.1.tgz",
      "integrity": "sha512-+QU2zd6OTD8XWIJCbffaiQeH9U73qIqafo1x6V1snCWYGJf6cVE0cDR4D8xRzcEnfI21IFrUPzPGtcPf8AC+Rw==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "imurmurhash": "^0.1.4",
        "signal-exit": "^4.0.1"
      },
      "engines": {
        "node": "^14.17.0 || ^16.13.0 || >=18.0.0"
      }
    },
    "node_modules/y18n": {
      "version": "5.0.8",
      "resolved": "https://registry.npmjs.org/y18n/-/y18n-5.0.8.tgz",
      "integrity": "sha512-0pfFzegeDWJHJIAmTLRP2DwHjdF5s7jo9tuztdQxAhINCdvS+3nGINqPd00AphqJR/0LhANUS6/+7SCb98YOfA==",
      "dev": true,
      "license": "ISC",
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/yallist": {
      "version": "3.1.1",
      "resolved": "https://registry.npmjs.org/yallist/-/yallist-3.1.1.tgz",
      "integrity": "sha512-a4UGQaWPH59mOXUYnAG2ewncQS4i4F43Tv3JoAM+s2VDAmS9NsK8GpDMLrCHPksFT7h3K6TOoUNn2pb7RoXx4g==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/yaml": {
      "version": "2.0.0-1",
      "resolved": "https://registry.npmjs.org/yaml/-/yaml-2.0.0-1.tgz",
      "integrity": "sha512-W7h5dEhywMKenDJh2iX/LABkbFnBxasD27oyXWDS/feDsxiw0dD5ncXdYXgkvAsXIY2MpW/ZKkr9IU30DBdMNQ==",
      "license": "ISC",
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/yargs": {
      "version": "17.7.3",
      "resolved": "https://registry.npmjs.org/yargs/-/yargs-17.7.3.tgz",
      "integrity": "sha512-GZtjxm/J/4TSxuL3FNYjCmLktBTnIw/rVmKSIyKeYAZpmJB2ig9VauCC5xsa82GNKVKDAqpOn3KVzNt0zmrU0g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "cliui": "^8.0.1",
        "escalade": "^3.1.1",
        "get-caller-file": "^2.0.5",
        "require-directory": "^2.1.1",
        "string-width": "^4.2.3",
        "y18n": "^5.0.5",
        "yargs-parser": "^21.1.1"
      },
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/yargs-parser": {
      "version": "21.1.1",
      "resolved": "https://registry.npmjs.org/yargs-parser/-/yargs-parser-21.1.1.tgz",
      "integrity": "sha512-tVpsJW7DdjecAiFpbIB1e3qxIQsE6NoPc5/eTdrbbIC4h0LVsWhnoa3g+m2HclBIujHzsxZ4VJVA+GUuc2/LBw==",
      "dev": true,
      "license": "ISC",
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/yargs/node_modules/ansi-regex": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/ansi-regex/-/ansi-regex-5.0.1.tgz",
      "integrity": "sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/yargs/node_modules/emoji-regex": {
      "version": "8.0.0",
      "resolved": "https://registry.npmjs.org/emoji-regex/-/emoji-regex-8.0.0.tgz",
      "integrity": "sha512-MSjYzcWNOA0ewAHpz0MxpYFvwg6yjy1NG3xteoqz644VCo/RPgnr1/GGt+ic3iJTzQ8Eu3TdM14SawnVUmGE6A==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/yargs/node_modules/string-width": {
      "version": "4.2.3",
      "resolved": "https://registry.npmjs.org/string-width/-/string-width-4.2.3.tgz",
      "integrity": "sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "emoji-regex": "^8.0.0",
        "is-fullwidth-code-point": "^3.0.0",
        "strip-ansi": "^6.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/yargs/node_modules/strip-ansi": {
      "version": "6.0.1",
      "resolved": "https://registry.npmjs.org/strip-ansi/-/strip-ansi-6.0.1.tgz",
      "integrity": "sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-regex": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/yocto-queue": {
      "version": "0.1.0",
      "resolved": "https://registry.npmjs.org/yocto-queue/-/yocto-queue-0.1.0.tgz",
      "integrity": "sha512-rVksvsnNCdJ/ohGc6xgPwyN8eheCxsiLM8mxuE/t/mOVqJewPuO1miLpTHQiRgTKCLexL4MeAFVagts7HmNZ2Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    }
  }
}
```

---

## backend/.env.example
`dotenv` · 13 lines · 513 bytes · path `backend/.env.example`

```dotenv
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/ikmb-dashboard
# Generate a private value with: openssl rand -hex 32
JWT_SECRET=
ML_API_URL=http://127.0.0.1:8000
CORS_ORIGIN=http://localhost:8080,http://localhost:3000
# Optional AI assistant key. Leave empty to disable provider-backed responses.
GEMINI_API_KEY=
# OpenWeb Ninja key from https://app.openwebninja.com/api/jsearch
# For Docker Compose, set this in the project-root .env instead.
JSEARCH_API_KEY=
REDIS_URL=redis://127.0.0.1:6379
TZ=Asia/Kuala_Lumpur
```

---

## src/components/dashboard/StudentDashboardClient.jsx
`jsx` · 1403 lines · 64876 bytes · path `src/components/dashboard/StudentDashboardClient.jsx`

```jsx
"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { getClientUser, getClientToken } from "@/lib/client-auth";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Radar } from "react-chartjs-2";
import Sidebar from "../Sidebar";
import JobCard from "../JobCard";
import { SectionCard, SkeletonList, EmptyState, Badge, PillTabs } from "@/components/ui/dashboard-kit";
import MergedLaporanTab from "./MergedLaporanTab";
import { calculateEmployability } from "@/lib/heuristics";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

const careerMapping = {
  ITW: [
    {
      title: "Juruteknik Kimpalan 6G",
      company: "Sapuran Energy",
      match: "95%",
      icon: "ph-fill ph-fire",
    },
    {
      title: "Welding Inspector",
      company: "SGS Malaysia",
      match: "88%",
      icon: "ph-fill ph-magnifying-glass",
    },
  ],
  DFK: [
    {
      title: "Cloud Engineer",
      company: "AWS Malaysia",
      match: "94%",
      icon: "ph-fill ph-cloud",
    },
    {
      title: "DevOps Engineer",
      company: "Maxis",
      match: "85%",
      icon: "ph-fill ph-terminal-window",
    },
  ],
  DGA: [
    {
      title: "Service Advisor",
      company: "Perodua",
      match: "92%",
      icon: "ph-fill ph-wrench",
    },
    {
      title: "Diagnostic Tech",
      company: "Tan Chong",
      match: "88%",
      icon: "ph-fill ph-engine",
    },
  ],
  SLR: [
    {
      title: "CAD Drafter",
      company: "Dyson",
      match: "96%",
      icon: "ph-fill ph-pencil-circle",
    },
    {
      title: "Design Engineer",
      company: "Proton",
      match: "89%",
      icon: "ph-fill ph-compass-tool",
    },
  ],
  DCG: [
    {
      title: "Chargeman A0",
      company: "TNB",
      match: "94%",
      icon: "ph-fill ph-lightning",
    },
    {
      title: "Industrial Electrician",
      company: "Intel",
      match: "89%",
      icon: "ph-fill ph-plugs-connected",
    },
  ],
  SED: [
    {
      title: "Wireman PW4",
      company: "Kontraktor Berdaftar",
      match: "91%",
      icon: "ph-fill ph-files",
    },
    {
      title: "Maintenance",
      company: "Panasonic",
      match: "87%",
      icon: "ph-fill ph-gear",
    },
  ],
  PPU: [
    {
      title: "HVAC Technician",
      company: "Daikin",
      match: "93%",
      icon: "ph-fill ph-thermometer-cold",
    },
    {
      title: "ACMV Supervisor",
      company: "Bina Puri",
      match: "86%",
      icon: "ph-fill ph-fan",
    },
  ],
};

const getFullCourseName = (code) => {
  const names = {
    ITW: "Diploma Kimpalan",
    DFK: "Diploma Komputasi Awan",
    DGA: "Diploma Automotif",
    SLR: "Sijil Lukisan Rekabentuk",
    DCG: "Diploma Elektrik Industri",
    SED: "Sijil Elektrik Domestik",
    PPU: "Diploma Penyejukan Udara",
  };
  return names[code] || code;
};

const initialSkillGap = {
  chart: {
    labels: [
      "PLO 1",
      "PLO 2",
      "PLO 3",
      "PLO 4",
      "PLO 5",
      "PLO 6",
      "PLO 7",
      "PLO 8",
      "PLO 9",
    ],
    current: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    target: [80, 80, 80, 80, 80, 80, 80, 80, 80],
  },
  insight: {
    weakestSkill: "-",
    message:
      "Pilih pelajar untuk melihat analisis jurang skill daripada database.",
  },
  student: null,
};

export default function StudentDashboardClient() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [skillGap, setSkillGap] = useState(initialSkillGap);
  const [isLoading, setIsLoading] = useState(true);

  const [customCerts, setCustomCerts] = useState([]);
  const [newCert, setNewCert] = useState({ name: "", issuer: "" });
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploadingCert, setIsUploadingCert] = useState(false);

  const [activeTab, setActiveTab] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [careerView, setCareerView] = useState("auto");
  const [manualQuery, setManualQuery] = useState("");
  const [manualLocation, setManualLocation] = useState("Malaysia");
  const [manualEmploymentType, setManualEmploymentType] = useState("INTERN");
  const [manualDatePosted, setManualDatePosted] = useState("all");
  const [manualJobs, setManualJobs] = useState([]);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualSearched, setManualSearched] = useState(false);
  const [manualCursor, setManualCursor] = useState(null);
  const [lastManualSearch, setLastManualSearch] = useState(null);
  const [manualFailedPage, setManualFailedPage] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [recentOpen, setRecentOpen] = useState(false);
  const [recentIndex, setRecentIndex] = useState(-1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [careerResetAt, setCareerResetAt] = useState(null);
  const [detailsJobId, setDetailsJobId] = useState(null);
  const [jobDetails, setJobDetails] = useState(null);
  const [savedJobs, setSavedJobs] = useState([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState("");
  const [savedRetry, setSavedRetry] = useState(0);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savingIds, setSavingIds] = useState([]);
  const saveRequests = useRef(new Map());
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [pathway, setPathway] = useState(null);
  const [pathwayJobs, setPathwayJobs] = useState([]);
  const [pathwayLoading, setPathwayLoading] = useState(false);
  const [pathwayError, setPathwayError] = useState("");
  const [pathwayWarning, setPathwayWarning] = useState("");
  const [pathwayRetry, setPathwayRetry] = useState(0);
  const manualRequest = useRef(null);
  const historyRequest = useRef(null);
  const detailsRequest = useRef(null);
  const careerJobs = useMemo(() => careerView === "saved" ? savedJobs : careerView === "manual" ? manualJobs : pathwayJobs, [careerView, savedJobs, manualJobs, pathwayJobs]);
  const visibleRecentSearches = useMemo(() => recentSearches.filter((keyword) => keyword.toLowerCase().includes(manualQuery.trim().toLowerCase())), [recentSearches, manualQuery]);

  useEffect(() => () => {
    manualRequest.current?.abort();
    historyRequest.current?.abort();
    detailsRequest.current?.abort();
    for (const controller of saveRequests.current.values()) controller.abort();
  }, []);

  useEffect(() => {
    setRecentSearches([]);
    setRecentOpen(false);
    setJobDetails(null); setDetailsJobId(null);
    setDetailsLoading(false);
    setDetailsError("");
    setManualCursor(null);
    setLastManualSearch(null);
    setManualFailedPage(false);
    setManualError("");
    setHistoryError("");
    setManualJobs([]);
    setManualLoading(false);
    manualRequest.current?.abort();
    historyRequest.current?.abort();
    detailsRequest.current?.abort();
  }, [selectedStudentId]);

  useEffect(() => {
    if (!careerResetAt) return;
    const timeout = setTimeout(() => {
      manualRequest.current?.abort();
      historyRequest.current?.abort();
      detailsRequest.current?.abort();
      setManualJobs([]);
      setPathwayJobs([]);
      setRecentSearches([]);
      setRecentOpen(false);
      setManualCursor(null);
      setLastManualSearch(null);
      setManualFailedPage(false);
      setJobDetails(null); setDetailsJobId(null);
      setDetailsError("");
      setHistoryError("");
      setManualLoading(false);
      setHistoryLoading(false);
      setDetailsLoading(false);
      setManualError("Carian harian telah ditetapkan semula pada 8 pagi. Mulakan carian baharu.");
      setCareerResetAt(null);
      setPathwayRetry((value) => value + 1);
    }, Math.max(0, careerResetAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [careerResetAt]);

  useEffect(() => {
    setSavedJobs([]);
    setSavingIds([]);
    setSaveMessage("");
    setSaveError("");
    for (const controller of saveRequests.current.values()) controller.abort();
    saveRequests.current.clear();
  }, [user?.studentId, user?.role]);

  useEffect(() => {
    if (user?.role !== "user" || !user?.studentId) return;
    const controller = new AbortController();
    setSavedLoading(true);
    setSavedError("");
    async function loadSavedJobs() {
      try {
        const res = await fetch("/api/careers/saved-jobs", { signal: controller.signal });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || "Jawatan disimpan tidak dapat dimuatkan.");
        if (!controller.signal.aborted) setSavedJobs(data.jobs);
      } catch (error) {
        if (!controller.signal.aborted) setSavedError(error.message);
      } finally {
        if (!controller.signal.aborted) setSavedLoading(false);
      }
    }
    loadSavedJobs();
    return () => controller.abort();
  }, [user?.studentId, user?.role, savedRetry]);

  const toggleSavedJob = async (job) => {
    if (savedLoading || savedError || saveRequests.current.has(job.jobId)) return;
    const removing = savedJobs.some((saved) => saved.jobId === job.jobId);
    const controller = new AbortController();
    saveRequests.current.set(job.jobId, controller);
    setSavingIds((ids) => [...ids, job.jobId]);
    setSaveMessage("");
    setSaveError("");
    try {
      const url = `/api/careers/saved-jobs${removing ? `?${new URLSearchParams({ job_id: job.jobId })}` : ""}`;
      const res = await fetch(url, {
        method: removing ? "DELETE" : "POST",
        ...(removing ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job }) }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Jawatan tidak dapat disimpan. Sila cuba lagi.");
      if (controller.signal.aborted) return;
      setSavedJobs((jobs) => removing ? jobs.filter((saved) => saved.jobId !== job.jobId) : [data.job, ...jobs.filter((saved) => saved.jobId !== job.jobId)]);
      setSaveMessage(removing ? "Jawatan dikeluarkan daripada simpanan." : "Jawatan berjaya disimpan.");
    } catch (error) {
      if (!controller.signal.aborted) setSaveError(error.message);
    } finally {
      if (!controller.signal.aborted) {
        saveRequests.current.delete(job.jobId);
        setSavingIds((ids) => ids.filter((id) => id !== job.jobId));
      }
    }
  };

  const toggleJobDetails = (job) => {
    if (detailsJobId !== job.jobId) { loadJobDetails(job); return; }
    detailsRequest.current?.abort();
    setDetailsJobId(null);
    setJobDetails(null);
    setDetailsError("");
    setDetailsLoading(false);
  };

  const loadRecentSearches = async () => {
    historyRequest.current?.abort();
    const controller = new AbortController();
    historyRequest.current = controller;
    setRecentOpen(true);
    setRecentIndex(-1);
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const params = new URLSearchParams(selectedStudentId ? { studentId: selectedStudentId } : {});
      const res = await fetch(`/api/careers/history?${params}`, { signal: controller.signal });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Sejarah carian tidak tersedia.");
      if (controller.signal.aborted) return;
      if (data.resetAt <= Date.now()) throw new Error("Sejarah harian telah ditetapkan semula.");
      setRecentSearches(data.keywords);
      setCareerResetAt(data.resetAt);
    } catch (error) {
      if (!controller.signal.aborted) { setRecentSearches([]); setHistoryError(error.message); }
    } finally {
      if (!controller.signal.aborted) setHistoryLoading(false);
    }
  };

  const loadJobDetails = async (job) => {
    detailsRequest.current?.abort();
    const controller = new AbortController();
    detailsRequest.current = controller;
    setJobDetails(null); setDetailsJobId(null);
    setDetailsError("");
    setDetailsLoading(true);
    setDetailsJobId(job.jobId);
    try {
      const params = new URLSearchParams({ job_id: job.jobId, ...(selectedStudentId ? { studentId: selectedStudentId } : {}) });
      const res = await fetch(`/api/careers/job-details?${params}`, { signal: controller.signal });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Butiran jawatan tidak tersedia.");
      if (controller.signal.aborted) return;
      if (data.resetAt <= Date.now()) throw new Error("Butiran harian telah ditetapkan semula. Cuba lagi.");
      setJobDetails(data.job);
      setCareerResetAt(data.resetAt);
    } catch (error) {
      if (!controller.signal.aborted) setDetailsError(error.message);
    } finally {
      if (!controller.signal.aborted) setDetailsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "career" || careerView !== "pathway" || !selectedStudentId) return;
    const controller = new AbortController();
    setPathway(null);
    setPathwayJobs([]);
    setPathwayError("");
    setPathwayWarning("");
    setPathwayLoading(true);
    async function loadPathway() {
      try {
        const res = await fetch(`/api/careers/pathways/${encodeURIComponent(selectedStudentId)}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || "Laluan pembelajaran tidak dapat dimuatkan.");
        if (controller.signal.aborted) return;
        if (data.resetAt <= Date.now()) throw new Error("Carian harian telah ditetapkan semula. Cuba lagi.");
        setPathway(data.pathway);
        setPathwayJobs(data.jobs);
        setPathwayWarning(data.warning || "");
        if (data.resetAt) setCareerResetAt(data.resetAt);
      } catch (error) {
        if (!controller.signal.aborted) setPathwayError(error.message || "Sambungan gagal. Sila cuba lagi.");
      } finally {
        if (!controller.signal.aborted) setPathwayLoading(false);
      }
    }
    loadPathway();
    return () => controller.abort();
  }, [activeTab, careerView, selectedStudentId, pathwayRetry]);

  const handleManualSearch = async (event, suggested = null, append = false) => {
    event?.preventDefault();
    const search = append ? lastManualSearch : { ...(suggested || { q: manualQuery, location: manualLocation, employmentType: manualEmploymentType }), date_posted: manualDatePosted };
    if (!search || (append && (!manualCursor || !careerResetAt || careerResetAt <= Date.now()))) return;
    if (!search.q.trim() || !search.location.trim()) return;
    manualRequest.current?.abort();
    const controller = new AbortController();
    manualRequest.current = controller;
    setCareerView("manual");
    setManualQuery(search.q);
    setManualLocation(search.location);
    setManualEmploymentType(search.employmentType);
    setManualDatePosted(search.date_posted);
    setRecentOpen(false);
    if (!append) {
      setManualJobs([]);
      setManualCursor(null);
      setJobDetails(null); setDetailsJobId(null);
      setDetailsLoading(false);
      setDetailsError("");
      detailsRequest.current?.abort();
    }
    setManualError("");
    setManualFailedPage(false);
    setManualSearched(true);
    setManualLoading(true);
    try {
      const params = new URLSearchParams({ ...search, ...(append ? { cursor: manualCursor } : {}), ...(selectedStudentId ? { studentId: selectedStudentId } : {}) });
      const res = await fetch(`/api/careers/search?${params}`, { signal: controller.signal });
      const data = await res.json();
      if (!res.ok || !data.success) {
        const error = new Error(data.warning || data.message || "Carian tidak dapat dimuatkan.");
        error.code = data.code;
        throw error;
      }
      if (controller.signal.aborted) return;
      if (data.resetAt <= Date.now()) throw new Error("Carian harian telah ditetapkan semula. Mulakan carian baharu.");
      setManualJobs((previous) => append ? [...new Map([...previous, ...data.jobs].map((job) => [job.jobId, job])).values()] : data.jobs);
      setManualCursor(data.cursor || null);
      setLastManualSearch(search);
      if (data.resetAt) setCareerResetAt(data.resetAt);
    } catch (error) {
      if (!controller.signal.aborted) {
        setManualError(error.message || "Sambungan gagal. Sila cuba lagi.");
        setManualFailedPage(append);
        if (["DAILY_RESET", "PROVIDER_INVALID_QUERY"].includes(error.code)) {
          setManualCursor(null);
          setManualFailedPage(false);
          if (error.code === "DAILY_RESET") setManualJobs([]);
        }
      }
    } finally {
      if (!controller.signal.aborted) setManualLoading(false);
    }
  };

  useEffect(() => {
    const u = getClientUser();
    setUser(u);

    const t = getClientToken();
    if (t) {
      fetch("/api/students", { headers: { Authorization: `Bearer ${t}` } })
        .then((res) => res.json())
        .then((data) => {
          const isRestrictedUser = u?.role === "user" && u?.studentId;
          const visibleStudents = isRestrictedUser
            ? data.filter((s) => s.id === u.studentId)
            : data;
          setStudents(visibleStudents);
          if (visibleStudents.length > 0)
            setSelectedStudentId(visibleStudents[0].id);
        })
        .catch((err) => console.error("Fetch students error:", err))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const isRestrictedUser = user?.role === "user" && user?.studentId;
  const currentStudentLabel = user?.displayName || "Pelajar";

  const handleLogout = async (e) => {
    e.preventDefault();
    await logoutAction();
  };

  useEffect(() => {
    if (!selectedStudentId) return;
    setIsLoading(true);
    const loadStudentData = async () => {
      const t = getClientToken();
      if (!t) { router.push("/"); return; }
      try {
        const resGap = await fetch(`/api/students/${selectedStudentId}/skill-gap`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        setSkillGap(await resGap.json());

        const resStudent = await fetch(`/api/students/${selectedStudentId}`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        const studentData = await resStudent.json();
        setCustomCerts(studentData.uploadedCertificates || []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    loadStudentData();
  }, [selectedStudentId]);

  const radarData = {
    labels: skillGap.chart.labels,
    datasets: [
      {
        label: "Data Pelajar",
        data: skillGap.chart.current,
        fill: true,
        backgroundColor: "rgba(37, 99, 235, 0.2)",
        borderColor: "#2563EB",
        pointBackgroundColor: "#2563EB",
      },
      {
        label: "Target",
        data: skillGap.chart.target,
        fill: true,
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        borderColor: "#10B981",
        pointBackgroundColor: "#10B981",
        borderDash: [5, 5],
      },
    ],
  };

  const courseMappings = {
    "PLO 1": {
      title: "Professional Soft Skills: Communication",
      desc: "Kursus ini dicadangkan kerana skor komunikasi anda di bawah par industri.",
      bg: "bg-blue-600",
      btn: "bg-blue-50 text-blue-600 hover:bg-blue-100",
    },
    "PLO 2": {
      title: "Bengkel Pengaturcaraan Praktikal",
      desc: "Untuk meningkatkan kompetensi penyelesaian masalah pengaturcaraan.",
      bg: "bg-slate-900",
      btn: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    },
    "PLO 3": {
      title: "Latihan Keselamatan Industri (OSH)",
      desc: "Memperkukuhkan pemahaman tentang prosedur keselamatan tempat kerja.",
      bg: "bg-purple-600",
      btn: "bg-purple-50 text-purple-600 hover:bg-purple-100",
    },
    "PLO 4": {
      title: "Kursus Pengurusan Masa & Projek",
      desc: "Meningkatkan keupayaan merancang dan melaksanakan projek dengan cekap.",
      bg: "bg-blue-600",
      btn: "bg-blue-50 text-blue-600 hover:bg-blue-100",
    },
    "PLO 5": {
      title: "Bengkel Inovasi & Reka Bentuk Produk",
      desc: "Menambah kemahiran kreatif dalam merekabentuk penyelesaian baharu.",
      bg: "bg-slate-900",
      btn: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    },
    "PLO 6": {
      title: "Latihan Penyelesaian Kerosakan Motor/Elektrik",
      desc: "Peningkatan kemahiran teknikal dalam diagnosis kerosakan.",
      bg: "bg-purple-600",
      btn: "bg-purple-50 text-purple-600 hover:bg-purple-100",
    },
    "PLO 7": {
      title: "Kursus Keusahawanan & Pemasaran Digital",
      desc: "Memperluas kemahiran perniagaan dan pemasaran kendiri.",
      bg: "bg-blue-600",
      btn: "bg-blue-50 text-blue-600 hover:bg-blue-100",
    },
    "PLO 8": {
      title: "Bengkel Etika Kerja & Kepimpinan",
      desc: "Membentuk sahsiah dan kemahiran memimpin pasukan.",
      bg: "bg-slate-900",
      btn: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    },
    "PLO 9": {
      title: "Latihan Integriti & Tanggungjawab Profesional",
      desc: "Memantapkan nilai etika dan tanggungjawab di tempat kerja.",
      bg: "bg-purple-600",
      btn: "bg-purple-50 text-purple-600 hover:bg-purple-100",
    },
  };

  const weakestPlo = skillGap.insight?.weakestSkill || "PLO 1";
  const recommendedCourse =
    courseMappings[weakestPlo] || courseMappings["PLO 1"];

  const handleProfileImageChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append("file", file);

      try {
        const t = getClientToken();
        if (!t) { router.push("/"); return; }
        const res = await fetch(
          `/api/students/${selectedStudentId}/profile-image`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${t}`,
            },
            body: formData,
          },
        );

        if (!res.ok) throw new Error("Gagal memuat naik gambar profil");
        const data = await res.json();

        setSkillGap((prev) => ({
          ...prev,
          student: { ...prev.student, profileImage: data.imagePath },
        }));

        // Sync the main students array so it persists across tabs
        setStudents((prev) =>
          prev.map((s) =>
            s.id === selectedStudentId ? { ...s, profileImage: data.imagePath } : s
          )
        );
      } catch (err) {
        console.error(err);
        alert("Ralat semasa memuat naik gambar profil.");
      }
    }
  };

  const handleCertInputChange = (e) => {
    setNewCert({ ...newCert, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleAddCertificate = async (e) => {
    e.preventDefault();
    if (!newCert.name || !newCert.issuer || !selectedFile) {
      alert("Sila isi nama, pengeluar, dan lampirkan fail.");
      return;
    }

    setIsUploadingCert(true);
    const formData = new FormData();
    formData.append("name", newCert.name);
    formData.append("issuer", newCert.issuer);
    formData.append("file", selectedFile);

    try {
      const t = getClientToken();
      if (!t) { router.push("/"); return; }
      const res = await fetch(
        `/api/students/${selectedStudentId}/certificates`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${t}`,
          },
          body: formData,
        },
      );

      if (!res.ok) throw new Error("Gagal memuat naik sijil");
      const data = await res.json();

      setCustomCerts([...customCerts, data.certificate]);
      setNewCert({ name: "", issuer: "" });
      setSelectedFile(null);
    } catch (err) {
      console.error(err);
      alert("Ralat semasa memuat naik sijil.");
    } finally {
      setIsUploadingCert(false);
    }
  };

  const handleDeleteCertificate = async (certId) => {
    try {
      const t = getClientToken();
      if (!t) { router.push("/"); return; }
      const res = await fetch(
        `/api/students/${selectedStudentId}/certificates/${certId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${t}` },
        },
      );

      if (!res.ok) throw new Error("Gagal memadam sijil");

      setCustomCerts(customCerts.filter((cert) => cert._id !== certId));
    } catch (err) {
      console.error(err);
      alert("Ralat semasa memadam sijil.");
    }
  };

  const navItems = [
    { id: "dashboard", icon: "ph-user-circle", label: "Profil & Prestasi" },
    { id: "profile", icon: "ph-pencil-line", label: "Kemaskini Sijil Saya" },
    { id: "reports", icon: "ph-tray", label: "Laporan & Temujanji" },
    { id: "career", icon: "ph-briefcase", label: "Padanan Kerjaya (AI)" },
    { id: "courses", icon: "ph-certificate", label: "Kursus Cadangan" },
  ];

  if (isLoading || !user) {
    return <div className="h-screen flex items-center justify-center text-slate-500">Memuatkan Dashboard...</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden text-slate-800 bg-[#F8FAFC] font-sans relative">
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
        ></div>
      )}

      <Sidebar
        navItems={navItems}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        currentUser={user}
        handleLogout={handleLogout}
        profileImage={skillGap.student?.profileImage}
      />

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative w-full">
        <header className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10">
          <img
            src="/logo-tvetmara.jpg"
            alt="Logo"
            className="h-8 object-contain"
          />
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-slate-600 p-2 hover:bg-slate-100 rounded-lg"
          >
            <i className="ph-bold ph-list text-2xl"></i>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-20">
          {/* TAB 1: DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="animate-[fadeIn_0.3s_ease-in-out]">
              <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-blue-100 border-2 border-white shadow-md overflow-hidden flex items-center justify-center text-blue-600 font-bold text-xl shrink-0">
                    {skillGap.student?.profileImage ? (
                      <img src={skillGap.student.profileImage} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      skillGap.student?.nama?.charAt(0) || "P"
                    )}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                      Selamat Datang, {currentStudentLabel}! 👋
                    </h1>
                    <p className="text-slate-500 text-sm">
                      Analisis prestasi dan potensi kerjaya anda.
                    </p>
                  </div>
                </div>
                {skillGap.student?.dropoutRisk === "Tinggi" ||
                skillGap.student?.dropoutRisk === "Bermasalah" ? (
                  <span className="bg-red-100 text-red-700 px-4 py-2 rounded-full text-xs font-bold border border-red-200">
                    ⚠️ Risiko Tinggi
                  </span>
                ) : skillGap.student?.dropoutRisk === "Sederhana" ? (
                  <span className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-full text-xs font-bold border border-yellow-200">
                    ⚠️ Perhatian Diperlukan
                  </span>
                ) : (
                  <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-xs font-bold border border-green-200">
                    ✅ Status: Good Standing
                  </span>
                )}
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-sm text-slate-500 mb-1">
                    Ramalan Kebolehpasaran
                  </p>
<h2 className="text-3xl font-bold text-slate-900">
                     {skillGap.student
                       ? calculateEmployability(skillGap.student.cgpa, skillGap.student.attendance)
                       : 0}
                     %
                   </h2>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-sm text-slate-500 mb-1">
                    Purata Kehadiran
                  </p>
                  <h2 className="text-3xl font-bold text-slate-900">
                    {skillGap.student?.attendance || 0}%
                  </h2>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <p className="text-sm text-slate-500 mb-1">CGPA Terkini</p>
                  <h2 className="text-3xl font-bold text-slate-900">
                    {skillGap.student?.cgpa || "0.00"}
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <i className="ph-fill ph-radar text-blue-600"></i>{" "}
                      Analisis Jurang Skill
                    </h3>
                    {students.length > 1 && !isRestrictedUser ? (
                      <select
                        value={selectedStudentId}
                        onChange={(e) => setSelectedStudentId(e.target.value)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
                      >
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.id} • Risiko {s.dropoutRisk}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600">
                        {selectedStudentId || "Pelajar"}
                      </span>
                    )}
                  </div>
                  <div className="h-64 flex items-center justify-center">
                    {isLoading ? (
                      <p>Memuatkan...</p>
                    ) : (
                      <Radar
                        data={radarData}
                        options={{
                          maintainAspectRatio: false,
                          scales: {
                            r: {
                              beginAtZero: true,
                              min: 0,
                              max: 100,
                              ticks: { stepSize: 20 },
                            },
                          },
                        }}
                      />
                    )}
                  </div>
                  <div className="mt-4 bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                    <p className="text-xs font-bold text-yellow-700 mb-1">
                      CADANGAN AI:
                    </p>
                    <p className="text-sm text-slate-700">
                      {skillGap.insight.message}
                    </p>
                  </div>
                </div>
                <div className="bg-slate-900 p-6 rounded-2xl text-white flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-bold">
                      Peluang Kerjaya Teratas
                    </h3>
                    <p className="text-slate-300 text-sm mt-2">
                      Berdasarkan kursus{" "}
                      <strong>
                        {getFullCourseName(skillGap.student?.kursus)}
                      </strong>
                      :
                    </p>
                    <div className="mt-4 space-y-3">
                      {(careerMapping[skillGap.student?.kursus] || [])
                        .slice(0, 2)
                        .map((j, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 bg-white/5 p-3 rounded-lg"
                          >
                            <i className={`${j.icon} text-blue-400`}></i>
                            <div className="text-xs">
                              <p className="font-bold">{j.title}</p>
                              <p className="opacity-60">{j.company}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab("career")}
                    className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold"
                  >
                    Lihat Analisis Penuh →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROFILE & CERTIFICATES */}
          {activeTab === "profile" && (
            <div className="animate-[fadeIn_0.3s_ease-in-out]">
              <header className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">
                  Kemaskini Sijil Saya
                </h1>
                <p className="text-slate-500">
                  Uruskan sijil tambahan dan gambar profil anda.
                </p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center">
                  <label
                    htmlFor="profileImg"
                    className="relative w-32 h-32 rounded-full bg-slate-100 border-4 border-white shadow-md cursor-pointer flex items-center justify-center text-slate-400 font-bold text-4xl overflow-hidden group"
                  >
                    {skillGap.student?.profileImage ? (
                      <img
                        src={skillGap.student.profileImage}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{skillGap.student?.nama?.charAt(0) || "P"}</span>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                      <i className="ph-fill ph-camera text-3xl"></i>
                      <span className="text-xs mt-1 font-bold">
                        Tukar Gambar
                      </span>
                    </div>
                    <input
                      type="file"
                      id="profileImg"
                      accept="image/*"
                      onChange={handleProfileImageChange}
                      className="hidden"
                    />
                  </label>
                  <div className="mt-6 w-full space-y-3">
                    <div>
                      <label className="text-xs text-slate-500">
                        Nama Pelajar
                      </label>
                      <input
                        type="text"
                        disabled
                        value={skillGap.student?.nama || ""}
                        className="mt-1 w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm text-slate-700 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">
                        No. Pendaftaran
                      </label>
                      <input
                        type="text"
                        disabled
                        value={skillGap.student?.id || ""}
                        className="mt-1 w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm text-slate-700 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Kursus</label>
                      <input
                        type="text"
                        disabled
                        value={getFullCourseName(skillGap.student?.kursus)}
                        className="mt-1 w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm text-slate-700 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
                    <i className="ph-fill ph-certificate text-blue-600"></i>{" "}
                    Tambah Sijil Baru
                  </h3>
                  <form
                    onSubmit={handleAddCertificate}
                    className="space-y-4 mb-8 border-b border-slate-100 pb-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-500 font-medium">
                          Nama Sijil
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={newCert.name}
                          onChange={handleCertInputChange}
                          placeholder="cth: Sijil Kompetensi Kimpalan"
                          className="mt-1 w-full bg-white border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 font-medium">
                          Pengeluar (Issuer)
                        </label>
                        <input
                          type="text"
                          name="issuer"
                          value={newCert.issuer}
                          onChange={handleCertInputChange}
                          placeholder="cth: CIDB"
                          className="mt-1 w-full bg-white border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-medium">
                        Lampiran Fail (PDF/PNG/JPG - Max 5MB)
                      </label>
                      {!selectedFile ? (
                        <label className="mt-1 w-full flex flex-col items-center justify-center h-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                          <i className="ph-fill ph-upload-simple text-2xl text-slate-400"></i>
                          <span className="text-xs text-slate-500 mt-1">
                            Klik untuk memilih fail
                          </span>
                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>
                      ) : (
                        <div className="mt-1 flex items-center justify-between bg-blue-50 p-3 rounded-xl border border-blue-100">
                          <div className="flex items-center gap-2 text-sm text-blue-700">
                            <i className="ph-fill ph-file text-xl"></i>{" "}
                            {selectedFile.name}
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedFile(null)}
                            className="text-red-500 hover:bg-red-50 p-1 rounded"
                          >
                            <i className="ph-bold ph-x text-lg"></i>
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={isUploadingCert}
                      className="w-full py-2.5 bg-blue-600 text-white hover:bg-blue-500 disabled:bg-slate-400 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      {isUploadingCert ? (
                        "Sedang Memuat Naik..."
                      ) : (
                        <>
                          <i className="ph-bold ph-plus"></i> Tambah Sijil
                        </>
                      )}
                    </button>
                  </form>

                  <h3 className="font-bold text-lg text-slate-900 mb-4">
                    Senarai Sijil
                  </h3>
                  {customCerts.length === 0 ? (
                    <p className="text-sm text-slate-400 italic text-center py-6">
                      Tiada sijil tambahan dijumpai. Sila tambah menggunakan
                      borang di atas.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {customCerts.map((cert) => (
                        <div
                          key={cert._id || cert.id}
                          className="border border-slate-100 p-4 rounded-xl bg-white shadow-sm hover:shadow-md transition flex items-start justify-between gap-4"
                        >
                          <div className="flex gap-3">
                            <a
                              href={cert.filePath}
                              target="_blank"
                              rel="noreferrer"
                              className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"
                            >
                              <i className="ph-fill ph-file-pdf text-xl"></i>
                            </a>
                            <div>
                              <p className="font-bold text-sm text-slate-900">
                                {cert.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {cert.issuer}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-1 truncate">
                                {cert.fileName}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              handleDeleteCertificate(cert._id || cert.id)
                            }
                            className="text-slate-300 hover:text-red-500 transition p-1"
                          >
                            <i className="ph-bold ph-trash text-lg"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: REPORTS / LAPORAN & TEMUJANJI */}
          {activeTab === "reports" && (
            <div className="animate-[fadeIn_0.3s_ease-in-out]">
              <MergedLaporanTab user={user} />
            </div>
          )}

          {/* TAB 3: CAREER */}
          {activeTab === "career" && (
            <div className="animate-[fadeIn_0.3s_ease-in-out] anim-fill">
              <SectionCard title="Kerjaya & Laluan Pembelajaran" icon="ph-briefcase" subtitle="Terokai jawatan dan rancang langkah seterusnya mengikut kemahiran anda.">
                <PillTabs
                  tabs={[
                    { id: "auto", label: "Cadangan Automatik", icon: "ph-sparkle" },
                    { id: "manual", label: "Carian Manual", icon: "ph-magnifying-glass" },
                    { id: "pathway", label: "Laluan Pembelajaran", icon: "ph-path" },
                    ...(isRestrictedUser ? [{ id: "saved", label: "Disimpan", icon: "ph-bookmark-simple", count: savedJobs.length }] : []),
                  ]}
                  activeTab={careerView}
                  setActiveTab={setCareerView}
                />

                {saveMessage && <p role="status" className="mt-3 text-sm text-emerald-700">{saveMessage}</p>}
                {saveError && <p role="alert" className="mt-3 text-sm text-red-700">{saveError}</p>}
                {savedError && <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 text-sm text-red-700"><p>{savedError}</p><button type="button" onClick={() => setSavedRetry((value) => value + 1)} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 touch-target active:scale-95">Muat Semula Simpanan</button></div>}

                {careerView === "auto" && (
                  <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
                    <p className="text-sm text-slate-500">Contoh kerjaya mengikut kursus. Gunakan carian untuk melihat jawatan yang disenaraikan oleh majikan.</p>
                    {(careerMapping[skillGap.student?.kursus] || []).length ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {careerMapping[skillGap.student.kursus].map((job) => (
                          <JobCard key={job.title} job={job} onSearch={(q) => handleManualSearch(null, { q, location: "Malaysia", employmentType: "INTERN" })} />
                        ))}
                      </div>
                    ) : <EmptyState icon="ph-briefcase" title="Cadangan belum tersedia" message="Gunakan Carian Manual untuk mencari jawatan pilihan anda." />}
                  </div>
                )}

                {careerView === "manual" && (
                  <form onSubmit={handleManualSearch} className="mt-4 space-y-3 animate-[slideUp_0.3s_ease-out] anim-fill stagger-1">
                    <div onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setRecentOpen(false); }}>
                      <label htmlFor="career-query" className="block text-sm font-semibold text-slate-700 mb-1">Kata kunci jawatan</label>
                      <input id="career-query" value={manualQuery} onChange={(e) => { setManualQuery(e.target.value); setRecentIndex(-1); }} required maxLength={150}
                        onFocus={loadRecentSearches} role="combobox" aria-expanded={recentOpen} aria-controls="career-recent-searches" aria-autocomplete="list"
                        aria-activedescendant={recentOpen && recentIndex >= 0 ? `career-recent-${recentIndex}` : undefined}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") setRecentOpen(false);
                          if (recentOpen && visibleRecentSearches.length && ["ArrowDown", "ArrowUp"].includes(event.key)) {
                            event.preventDefault();
                            setRecentIndex((index) => event.key === "ArrowDown" ? (index + 1) % visibleRecentSearches.length : (index <= 0 ? visibleRecentSearches.length - 1 : index - 1));
                          }
                          if (event.key === "Enter" && recentOpen && recentIndex >= 0) {
                            event.preventDefault();
                            handleManualSearch(null, { q: visibleRecentSearches[recentIndex], location: manualLocation, employmentType: manualEmploymentType });
                          }
                        }}
                        placeholder="Contoh: Welder, IT Support" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500" />
                      {recentOpen && (
                        <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-sm p-2 animate-[fadeIn_0.2s_ease-out]">
                          <p className="px-2 py-1 text-xs font-semibold text-slate-500">Carian terkini jabatan anda hari ini</p>
                          {historyLoading ? <SkeletonList rows={2} /> : historyError ? <p className="px-2 py-2 text-xs text-slate-500">{historyError}</p> : (
                            <ul id="career-recent-searches" role="listbox" aria-label="Carian terkini jabatan">
                              {visibleRecentSearches.map((keyword, index) => <li key={keyword} role="presentation"><button id={`career-recent-${index}`} type="button" role="option" aria-selected={recentIndex === index}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => handleManualSearch(null, { q: keyword, location: manualLocation, employmentType: manualEmploymentType })}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm touch-target active:scale-95 ${recentIndex === index ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50 text-slate-700"}`}><i className="ph ph-clock-counter-clockwise mr-2" aria-hidden="true"></i>{keyword}</button></li>)}
                            </ul>
                          )}
                          {!historyLoading && !historyError && !visibleRecentSearches.length && <p className="px-2 py-2 text-xs text-slate-500">Tiada carian terkini yang sepadan.</p>}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="career-location" className="block text-sm font-semibold text-slate-700 mb-1">Lokasi di Malaysia</label>
                        <input id="career-location" value={manualLocation} onChange={(e) => setManualLocation(e.target.value)} required maxLength={100}
                          placeholder="Malaysia atau Terengganu" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label htmlFor="career-date-posted" className="block text-sm font-semibold text-slate-700 mb-1">Tarikh iklan</label>
                        <select id="career-date-posted" value={manualDatePosted} onChange={(event) => setManualDatePosted(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500">
                          <option value="all">Semua tarikh</option><option value="today">Hari ini</option><option value="3days">3 hari lepas</option><option value="week">Minggu ini</option><option value="month">Bulan ini</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="career-employment" className="block text-sm font-semibold text-slate-700 mb-1">Jenis pekerjaan</label>
                        <select id="career-employment" value={manualEmploymentType} onChange={(e) => setManualEmploymentType(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500">
                          <option value="INTERN">Latihan industri</option>
                          <option value="FULLTIME">Sepenuh masa</option>
                          <option value="PARTTIME">Separuh masa</option>
                          <option value="CONTRACTOR">Kontrak</option>
                        </select>
                      </div>
                    </div>
                    <button type="submit" disabled={manualLoading || !manualQuery.trim() || !manualLocation.trim()} className="px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors touch-target active:scale-95">
                      <i className={`ph ${manualLoading ? "ph-spinner-gap animate-spin" : "ph-magnifying-glass"} mr-2`} aria-hidden="true"></i>
                      {manualLoading ? "Mencari…" : "Cari Jawatan"}
                    </button>
                  </form>
                )}

                {careerView === "pathway" && !selectedStudentId && <EmptyState icon="ph-student" title="Rekod pelajar diperlukan" message="Laluan pembelajaran tersedia selepas akaun dipautkan kepada rekod pelajar." />}
                {careerView === "pathway" && pathway && !pathwayLoading && (
                  <div className="mt-4 space-y-5 animate-[fadeIn_0.3s_ease-out] anim-fill stagger-1">
                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                      <h4 className="font-bold text-blue-900"><i className="ph ph-target mr-1" aria-hidden="true"></i>{pathway.courseName}</h4>
                      {pathway.supported ? (
                        <div className="flex flex-wrap gap-2 mt-3">{pathway.targetRoles.map((role) => <Badge key={role} tone="blue">{role}</Badge>)}</div>
                      ) : <p className="text-sm text-blue-800 mt-2">Pemetaan kursus ini belum tersedia. Semak pilihan bersama penyelaras atau gunakan Carian Manual.</p>}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between gap-3"><h4 className="font-semibold text-slate-800">Indeks kesediaan</h4><Badge tone="blue">{pathway.readinessScore}/100</Badge></div>
                      <div role="progressbar" aria-label="Indeks kesediaan" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pathway.readinessScore} className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${pathway.readinessScore}%` }} />
                      </div>
                      <p className="text-xs text-slate-500">{pathway.readinessExplanation}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800 mb-3">Pelan tindakan anda</h4>
                      <ol className="space-y-3 list-decimal pl-5 text-sm text-slate-600">
                        {pathway.actionPlan.map((action) => <li key={action.title}><p className="font-semibold text-slate-800">{action.title}</p><p>{action.description}</p></li>)}
                      </ol>
                    </div>
                    {pathway.recommendedCertifications.length > 0 && (
                      <div className="animate-[slideUp_0.3s_ease-out] anim-fill stagger-2">
                        <h4 className="font-semibold text-slate-800 mb-2">Pensijilan untuk diterokai</h4>
                        <div className="flex flex-wrap gap-2">{pathway.recommendedCertifications.map((cert) => <Badge key={cert} tone="purple">{cert}</Badge>)}</div>
                      </div>
                    )}
                    {pathway.suggestedSearches.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-slate-800 mb-2">Carian dicadangkan</h4>
                        <div className="flex flex-wrap gap-2">{pathway.suggestedSearches.map((search) => (
                          <button key={search.label} type="button" onClick={() => handleManualSearch(null, { q: search.q, location: search.location, employmentType: search.employmentType })}
                            className="px-3 py-2 text-xs font-medium bg-slate-100 text-slate-700 rounded-full hover:bg-blue-100 hover:text-blue-700 transition-all touch-target active:scale-95">
                            <i className="ph ph-magnifying-glass mr-1" aria-hidden="true"></i>{search.label} · {search.location}
                          </button>
                        ))}</div>
                      </div>
                    )}
                  </div>
                )}

                {careerView !== "auto" && (
                  <div className="mt-6" aria-live="polite" aria-busy={careerView === "saved" ? savedLoading : careerView === "manual" ? manualLoading : pathwayLoading}>
                    {(careerView === "saved" ? savedLoading : careerView === "manual" ? manualLoading && !manualJobs.length : pathwayLoading) ? <SkeletonList rows={3} /> : (
                      <>
                        {(careerView === "manual" ? manualError : careerView === "pathway" ? pathwayError || pathwayWarning : "") ? (
                          <div role="alert" className="space-y-3">
                            <EmptyState icon="ph-warning-circle" title={careerView === "pathway" && pathway ? "Jawatan belum dapat dimuatkan" : "Permintaan tidak berjaya"} message={careerView === "manual" ? manualError : pathwayError || pathwayWarning} />
                            <button type="button" onClick={() => careerView === "manual" ? handleManualSearch(null, null, manualFailedPage) : setPathwayRetry((value) => value + 1)} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl touch-target active:scale-95">Cuba Lagi</button>
                          </div>
                        ) : null}
                        {careerJobs.length ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{careerJobs.map((job, index) => <JobCard key={job.jobId} job={job} isDynamic onDetails={toggleJobDetails}
                            detailsOpen={detailsJobId === job.jobId} details={jobDetails} detailsLoading={detailsLoading} detailsError={detailsError} onRetryDetails={loadJobDetails}
                            isSaved={savedJobs.some((saved) => saved.jobId === job.jobId)} onToggleSave={isRestrictedUser ? toggleSavedJob : undefined}
                            saveDisabled={savedLoading || Boolean(savedError) || savingIds.includes(job.jobId)} delay={index * 60} />)}</div>
                        ) : careerView === "saved" && !savedError ? <EmptyState icon="ph-bookmark-simple" title="Belum ada jawatan disimpan" message="Tekan Simpan pada jawatan yang anda ingin lihat semula." /> : careerView === "manual" && !manualError ? (
                          <EmptyState icon="ph-magnifying-glass" title={manualSearched ? "Tiada jawatan ditemui" : "Mulakan carian anda"} message={manualSearched ? "Cuba kata kunci lain atau luaskan lokasi carian." : "Masukkan jawatan, lokasi dan jenis pekerjaan untuk melihat peluang semasa."} />
                        ) : careerView === "pathway" && pathway?.supported && !pathwayError && !pathwayWarning ? <EmptyState icon="ph-briefcase" title="Tiada jawatan ditemui" message="Teruskan pelan pembelajaran anda atau cuba salah satu carian dicadangkan." /> : null}
                        {careerView === "manual" && manualCursor && <button type="button" disabled={manualLoading} onClick={() => handleManualSearch(null, null, true)} className="mt-4 px-4 py-3 rounded-xl bg-blue-50 text-blue-700 disabled:opacity-50 touch-target active:scale-95">{manualLoading ? "Memuatkan…" : "Muat Lagi"}</button>}
                      </>
                    )}
                  </div>
                )}

              </SectionCard>
            </div>
          )}

          {/* TAB 4: COURSES */}
          {activeTab === "courses" && (
            <div className="animate-[fadeIn_0.3s_ease-in-out]">
              <header className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">
                  Kursus Cadangan (Personalized)
                </h1>
                <p className="text-slate-500">
                  Senarai kursus untuk menutup jurang kemahiran anda berdasarkan
                  PLO terlemah:{" "}
                  <strong className="text-blue-600">{weakestPlo}</strong>.
                </p>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition flex flex-col h-full relative">
                  <div
                    className={`${recommendedCourse.bg} p-6 h-40 flex flex-col justify-end`}
                  >
                    <span className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1 rounded-lg">
                      Disyorkan AI
                    </span>
                    <h3 className="text-white font-bold text-xl leading-tight">
                      {recommendedCourse.title}
                    </h3>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-xs text-slate-500 font-semibold mb-3 flex items-center gap-2">
                        <i className="ph-fill ph-clock text-lg"></i> 4 Jam •
                        Online
                      </p>
                      <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                        {recommendedCourse.desc}
                      </p>
                    </div>
                    <button
                      className={`w-full py-3 font-bold rounded-xl text-sm transition-colors ${recommendedCourse.btn}`}
                    >
                      Mula Belajar
                    </button>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition flex flex-col h-full">
                  <div className="bg-slate-900 p-6 h-40 relative flex flex-col justify-end">
                    <span className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1 rounded-lg">
                      Advanced
                    </span>
                    <h3 className="text-white font-bold text-xl leading-tight">
                      AWS Cloud Practitioner Essentials
                    </h3>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-xs text-slate-500 font-semibold mb-3 flex items-center gap-2">
                        <i className="ph-fill ph-chalkboard-teacher text-lg"></i>{" "}
                        6 Jam • Bengkel IKMB
                      </p>
                      <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                        Untuk meningkatkan peluang anda mendapat kerja "Cloud
                        Engineer" di industri teknologi.
                      </p>
                    </div>
                    <button className="w-full py-3 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold rounded-xl text-sm transition-colors">
                      Daftar Sesi
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
```

---

## src/components/JobCard.jsx
`jsx` · 60 lines · 5265 bytes · path `src/components/JobCard.jsx`

```jsx
import React from "react";
import { Badge, SkeletonList, formatMsDate } from "@/components/ui/dashboard-kit";

export default function JobCard({ job, isDynamic = false, delay = 0, onSearch, onDetails, detailsOpen = false, details, detailsLoading, detailsError, onRetryDetails, isSaved = false, onToggleSave, saveDisabled = false }) {
  if (isDynamic) {
    let applyLink = null;
    try {
      const url = new URL(job.applyLink);
      if (["http:", "https:"].includes(url.protocol)) applyLink = url.href;
    } catch {}
    return (
      <article className="flex flex-col p-5 bg-slate-900 rounded-2xl border border-slate-800 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group animate-[slideUp_0.4s_ease-out] anim-fill"
        style={{ animationDelay: `${delay}ms` }}>
        <div className="flex justify-between items-start gap-3 mb-3">
          <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg"><i className="ph-bold ph-briefcase text-xl" aria-hidden="true"></i></div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Badge tone="blue">{job.source || "JSearch"}</Badge>
            {onToggleSave && <button type="button" aria-label={`${isSaved ? "Disimpan" : "Simpan"} ${job.title}`} aria-pressed={isSaved} disabled={saveDisabled} onClick={() => onToggleSave(job)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-blue-200 rounded-xl border border-blue-400/40 hover:bg-blue-500/20 disabled:opacity-50 touch-target active:scale-95">
              <i className={`${isSaved ? "ph-fill" : "ph"} ph-bookmark-simple`} aria-hidden="true"></i>{isSaved ? "Disimpan" : "Simpan"}
            </button>}
          </div>
        </div>
        <h3 className="font-bold text-white mb-1 break-words">{job.title}</h3>
        <p className="text-sm text-slate-300 mb-3">{job.company}</p>
        <div className="space-y-2 text-xs text-slate-300 mb-4">
          <p><i className="ph ph-map-pin mr-1" aria-hidden="true"></i>{job.location}</p>
          <p><i className="ph ph-money mr-1" aria-hidden="true"></i>{job.salary}</p>
          {job.postedAt && <p>Disiarkan {formatMsDate(job.postedAt)}</p>}
        </div>
        {onDetails && <button type="button" aria-expanded={detailsOpen} onClick={() => onDetails(job)} className="mb-3 py-2 text-sm text-blue-300 rounded-xl border border-blue-500/30 hover:bg-blue-500/10 touch-target active:scale-95">{detailsOpen ? "Tutup Butiran" : "Lihat Butiran"} <span className="sr-only">untuk {job.title}</span></button>}
        {detailsOpen && <div className="mb-4 border-t border-slate-700 pt-4 animate-[fadeIn_0.3s_ease-out]" aria-live="polite" aria-busy={detailsLoading}>
          <h4 className="text-sm font-semibold text-white mb-2">Deskripsi Jawatan</h4>
          {detailsLoading ? <SkeletonList rows={3} /> : detailsError ? <div role="alert"><p className="text-sm text-amber-200">{detailsError}</p><button type="button" onClick={() => onRetryDetails(job)} className="mt-2 px-3 py-2 text-sm text-blue-200 rounded-xl border border-blue-500/30 touch-target active:scale-95">Cuba Lagi</button></div> : <p className="whitespace-pre-line break-words text-sm leading-relaxed text-slate-300">{details?.description || "Deskripsi tidak tersedia."}</p>}
        </div>}
        {applyLink ? (
          <a href={applyLink} target="_blank" rel="noopener noreferrer" className="mt-auto block text-center py-3 text-sm font-semibold text-blue-300 bg-blue-500/10 rounded-xl hover:bg-blue-600 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 transition-colors touch-target active:scale-95">
            Mohon Sekarang <i className="ph ph-arrow-square-out ml-1" aria-hidden="true"></i><span className="sr-only"> untuk {job.title} (tab baharu)</span>
          </a>
        ) : <p className="mt-auto text-sm text-slate-400">Pautan permohonan tidak tersedia.</p>}
      </article>
    );
  }
  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition group animate-[slideUp_0.4s_ease-out]">
      <div className="flex justify-between items-start mb-3 sm:mb-4">
        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl sm:text-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
          <i className={job.icon}></i>
        </div>
        <span className="bg-green-50 text-green-700 px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold border border-green-100 flex items-center gap-1">
          <i className="ph-fill ph-sparkle"></i> {job.match} Match
        </span>
      </div>
      <h3 className="font-bold text-base sm:text-lg text-slate-900">{job.title}</h3>
      <p className="text-slate-500 text-xs sm:text-sm mb-3 sm:mb-4">{job.company}</p>
      <button type="button" onClick={() => onSearch?.(job.title)} disabled={!onSearch} className="w-full py-3 sm:py-2.5 bg-slate-50 text-slate-600 hover:bg-blue-600 hover:text-white rounded-xl text-sm font-bold transition touch-target active:scale-95 shadow-sm hover:shadow-lg disabled:opacity-50">
        Cari Jawatan Ini
      </button>
    </div>
  );
}
```

---

## src/__tests__/Careers.test.jsx
`jsx` · 224 lines · 14641 bytes · path `src/__tests__/Careers.test.jsx`

```jsx
import React from "react";
import "@testing-library/jest-dom";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudentDashboardClient from "@/components/dashboard/StudentDashboardClient";
import JobCard from "@/components/JobCard";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/image", () => ({ default: (props) => <img {...props} alt={props.alt || ""} /> }));
vi.mock("@/app/actions", () => ({ logoutAction: vi.fn() }));
vi.mock("@/lib/client-auth", () => ({ getClientUser: () => ({ role: "user", studentId: "S1", displayName: "Test Student" }), getClientToken: () => "proxy-handled" }));
vi.mock("react-chartjs-2", () => ({ Radar: () => <div aria-label="Radar chart" /> }));

const student = { id: "S1", nama: "Test Student", kursus: "ITW", cgpa: 3, attendance: 90, dropoutRisk: "Sederhana", uploadedCertificates: [] };
const job = { jobId: "J1", title: "Welder Intern", company: "Test Employer", location: "Terengganu", salary: "RM 1,000+", applyLink: "https://example.com/apply", source: "Test Jobs" };
const pathway = {
  supported: true, courseName: "Diploma Kompetensi Kimpalan", readinessScore: 74, readinessExplanation: "Indeks panduan akademik.", targetRoles: ["Welder / Fabricator"],
  actionPlan: [{ title: "Sediakan portfolio", description: "Kumpulkan projek kimpalan anda." }], recommendedCertifications: ["TWIMC"],
  suggestedSearches: [{ label: "Oil & Gas Welder", q: "Pipe Welder NDT Intern", location: "Terengganu", employmentType: "INTERN" }],
};
const response = (body, ok = true) => ({ ok, json: async () => body });
let careerFetch;
let savedFetch;
let storedJobs;

beforeEach(() => {
  storedJobs = [];
  savedFetch = vi.fn(async (url, options = {}) => {
    if (options.method === "POST") { const saved = JSON.parse(options.body).job; storedJobs = [saved]; return response({ success: true, job: saved }); }
    if (options.method === "DELETE") { storedJobs = []; return response({ success: true }); }
    return response({ success: true, jobs: storedJobs });
  });
  careerFetch = vi.fn(async (url) => response(url.startsWith("/api/careers/history")
    ? { success: true, keywords: ["welder", "ndt"], resetAt: Date.now() + 60000 }
    : url.startsWith("/api/careers/job-details")
      ? { success: true, job: { ...job, description: "Join the welding team." }, resetAt: Date.now() + 60000 }
      : { success: true, jobs: [job], pathway, resetAt: Date.now() + 60000 }));
  vi.stubGlobal("fetch", vi.fn(async (url, options) => {
    if (url.startsWith("/api/careers/saved-jobs")) return savedFetch(url, options);
    if (url.startsWith("/api/careers/")) return careerFetch(url, options);
    if (url.endsWith("/skill-gap")) return response({ student, chart: { labels: ["PLO 1"], current: [60], target: [80] }, insight: { weakestSkill: "PLO 1", message: "Test insight" } });
    if (url === "/api/students") return response([student]);
    if (url === "/api/students/S1") return response(student);
    throw new Error(`Unexpected request ${url}`);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function openCareers(view) {
  render(<StudentDashboardClient />);
  // The sidebar can briefly render before the selected student's data finishes loading.
  await screen.findByText("Test insight");
  fireEvent.click(await screen.findByRole("button", { name: "Padanan Kerjaya (AI)" }));
  if (view) fireEvent.click(await screen.findByRole("button", { name: view }));
}

describe("career tab", () => {
  it("keeps automatic recommendations and searches through the same-origin proxy", async () => {
    await openCareers("Carian Manual");
    expect(screen.getByText("Mulakan carian anda")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Kata kunci jawatan"), { target: { value: "Welder" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari Jawatan" }));
    expect(await screen.findByRole("link", { name: /Mohon Sekarang untuk Welder Intern/ })).toHaveAttribute("href", "https://example.com/apply");
    const url = new URL(careerFetch.mock.calls[0][0], "http://localhost");
    expect(url.pathname).toBe("/api/careers/search");
    expect(url.searchParams.get("q")).toBe("Welder");
    expect(url.searchParams.get("employmentType")).toBe("INTERN");
    fireEvent.click(screen.getByRole("button", { name: "Cadangan Automatik" }));
    expect(screen.getByText("Juruteknik Kimpalan 6G")).toBeInTheDocument();
    expect(screen.queryByText("Test Employer")).not.toBeInTheDocument();
  });

  it("shows the action plan and preserves suggested location and employment type", async () => {
    await openCareers("Laluan Pembelajaran");
    expect(await screen.findByText("Sediakan portfolio")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "74");
    fireEvent.click(screen.getByRole("button", { name: "Oil & Gas Welder · Terengganu" }));
    await screen.findByLabelText("Kata kunci jawatan");
    expect(screen.getByLabelText("Lokasi di Malaysia")).toHaveValue("Terengganu");
    const url = new URL(careerFetch.mock.calls.at(-1)[0], "http://localhost");
    expect(url.searchParams.get("q")).toBe("Pipe Welder NDT Intern");
    expect(url.searchParams.get("location")).toBe("Terengganu");
    expect(url.searchParams.get("employmentType")).toBe("INTERN");
  });

  it("recovers from a search error and distinguishes empty results", async () => {
    careerFetch.mockResolvedValueOnce(response({ success: false, warning: "Carian tergendala" }, false));
    await openCareers("Carian Manual");
    fireEvent.change(screen.getByLabelText("Kata kunci jawatan"), { target: { value: "Welder" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari Jawatan" }));
    expect(await screen.findByText("Carian tergendala")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cari Jawatan" })).toBeEnabled();
    careerFetch.mockResolvedValueOnce(response({ success: true, jobs: [] }));
    fireEvent.click(screen.getByRole("button", { name: "Cuba Lagi" }));
    expect(await screen.findByText("Tiada jawatan ditemui")).toBeInTheDocument();
  });

  it("keeps the pathway visible if job listings are unavailable", async () => {
    careerFetch.mockResolvedValue(response({ success: true, pathway, jobs: [], warning: "Carian belum diaktifkan" }));
    await openCareers("Laluan Pembelajaran");
    expect(await screen.findByText("Sediakan portfolio")).toBeInTheDocument();
    expect(screen.getByText("Carian belum diaktifkan")).toBeInTheDocument();
  });

  it("does not keep showing a spinner after a network failure", async () => {
    careerFetch.mockRejectedValue(new Error("Sambungan terputus"));
    await openCareers("Laluan Pembelajaran");
    expect(await screen.findByText("Sambungan terputus")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cuba Lagi" })).toBeEnabled());
  });

  it("loads department recent searches on focus and searches the selected keyword", async () => {
    await openCareers("Carian Manual");
    fireEvent.focus(screen.getByLabelText("Kata kunci jawatan"));
    const option = await screen.findByRole("option", { name: "welder" });
    expect(careerFetch.mock.calls[0][0]).toBe("/api/careers/history?studentId=S1");
    fireEvent.click(option);
    expect(await screen.findByRole("link", { name: /Mohon Sekarang untuk Welder Intern/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Kata kunci jawatan")).toHaveValue("welder");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("retains the original page after a pagination failure and binds retry to original filters", async () => {
    careerFetch.mockResolvedValueOnce(response({ success: true, jobs: [job], cursor: "page2", resetAt: Date.now() + 60000 }));
    await openCareers("Carian Manual");
    fireEvent.change(screen.getByLabelText("Kata kunci jawatan"), { target: { value: "Welder" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari Jawatan" }));
    await screen.findByRole("button", { name: "Muat Lagi" });
    fireEvent.change(screen.getByLabelText("Lokasi di Malaysia"), { target: { value: "Selangor" } });
    careerFetch.mockResolvedValueOnce(response({ success: false, message: "Page unavailable" }, false));
    fireEvent.click(screen.getByRole("button", { name: "Muat Lagi" }));
    expect(await screen.findByText("Page unavailable")).toBeInTheDocument();
    expect(screen.getByText("Test Employer")).toBeInTheDocument();
    careerFetch.mockResolvedValueOnce(response({ success: true, jobs: [job, { ...job, jobId: "J2", title: "NDT Trainee" }], cursor: null, resetAt: Date.now() + 60000 }));
    fireEvent.click(screen.getByRole("button", { name: "Muat Lagi" }));
    expect(await screen.findByRole("heading", { name: "NDT Trainee" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Welder Intern" })).toHaveLength(1);
    const url = new URL(careerFetch.mock.calls.at(-1)[0], "http://localhost");
    expect(url.searchParams.get("cursor")).toBe("page2");
    expect(url.searchParams.get("location")).toBe("Malaysia");
  });

  it("loads job descriptions through the authenticated proxy", async () => {
    await openCareers("Carian Manual");
    fireEvent.change(screen.getByLabelText("Kata kunci jawatan"), { target: { value: "Welder" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari Jawatan" }));
    fireEvent.click(await screen.findByRole("button", { name: "Lihat Butiran untuk Welder Intern" }));
    const description = await screen.findByText("Join the welding team.");
    expect(within(description.closest("article")).getByText("Test Employer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tutup Butiran untuk Welder Intern" }));
    expect(screen.queryByText("Join the welding team.")).not.toBeInTheDocument();
    expect(careerFetch.mock.calls.at(-1)[0]).toBe("/api/careers/job-details?job_id=J1&studentId=S1");
  });

  it("saves a found job, reloads it from the account and removes it", async () => {
    await openCareers("Carian Manual");
    fireEvent.change(screen.getByLabelText("Kata kunci jawatan"), { target: { value: "Welder" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari Jawatan" }));
    const bookmark = await screen.findByRole("button", { name: "Simpan Welder Intern" });
    await waitFor(() => expect(bookmark).toBeEnabled());
    fireEvent.click(bookmark);
    expect(await screen.findByRole("button", { name: "Disimpan Welder Intern" })).toHaveAttribute("aria-pressed", "true");
    const save = savedFetch.mock.calls.find(([, options]) => options?.method === "POST");
    expect(save[0]).toBe("/api/careers/saved-jobs");
    expect(JSON.parse(save[1].body)).toEqual({ job });
    cleanup();
    await openCareers();
    fireEvent.click(screen.getByRole("button", { name: /^Disimpan\s*\d*$/ }));
    const savedButton = await screen.findByRole("button", { name: "Disimpan Welder Intern" });
    fireEvent.click(savedButton);
    expect(await screen.findByText("Belum ada jawatan disimpan")).toBeInTheDocument();
    expect(savedFetch.mock.calls.find(([, options]) => options?.method === "DELETE")[0]).toBe("/api/careers/saved-jobs?job_id=J1");
  });

  it("keeps the bookmark unchanged when saving fails and permits retry", async () => {
    await openCareers("Carian Manual");
    fireEvent.change(screen.getByLabelText("Kata kunci jawatan"), { target: { value: "Welder" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari Jawatan" }));
    const bookmark = await screen.findByRole("button", { name: "Simpan Welder Intern" });
    await waitFor(() => expect(bookmark).toBeEnabled());
    savedFetch.mockResolvedValueOnce(response({ success: false, message: "Simpanan tergendala" }, false));
    fireEvent.click(bookmark);
    expect(await screen.findByText("Simpanan tergendala")).toBeInTheDocument();
    expect(bookmark).toHaveAttribute("aria-pressed", "false");
    expect(bookmark).toBeEnabled();
    fireEvent.click(bookmark);
    expect(await screen.findByRole("button", { name: "Disimpan Welder Intern" })).toHaveAttribute("aria-pressed", "true");
  });

  it("discards responses that arrive after their reset deadline", async () => {
    careerFetch.mockResolvedValueOnce(response({ success: true, jobs: [job], resetAt: Date.now() - 1 }));
    await openCareers("Carian Manual");
    fireEvent.change(screen.getByLabelText("Kata kunci jawatan"), { target: { value: "Welder" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari Jawatan" }));
    expect(await screen.findByText("Carian harian telah ditetapkan semula. Mulakan carian baharu.")).toBeInTheDocument();
    expect(screen.queryByText("Test Employer")).not.toBeInTheDocument();
  });

  it("restarts from page one when the reset occurs after a failed next page", async () => {
    storedJobs = [job];
    careerFetch.mockResolvedValueOnce(response({ success: true, jobs: [job], cursor: "page2", resetAt: Date.now() + 700 }));
    await openCareers("Carian Manual");
    fireEvent.change(screen.getByLabelText("Kata kunci jawatan"), { target: { value: "Welder" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari Jawatan" }));
    await screen.findByRole("button", { name: "Muat Lagi" });
    careerFetch.mockResolvedValueOnce(response({ success: false, message: "Page unavailable" }, false));
    fireEvent.click(screen.getByRole("button", { name: "Muat Lagi" }));
    await screen.findByText("Page unavailable");
    await screen.findByText("Carian harian telah ditetapkan semula pada 8 pagi. Mulakan carian baharu.");
    fireEvent.click(screen.getByRole("button", { name: "Cuba Lagi" }));
    expect(await screen.findByText("Test Employer")).toBeInTheDocument();
    const url = new URL(careerFetch.mock.calls.at(-1)[0], "http://localhost");
    expect(url.searchParams.has("cursor")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /^Disimpan\s*\d*$/ }));
    expect(screen.getByRole("heading", { name: job.title })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disimpan Welder Intern" })).toHaveAttribute("aria-pressed", "true");
  });
});

it("does not render unsafe application links", () => {
  render(<JobCard job={{ ...job, applyLink: "javascript:alert(1)" }} isDynamic />);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(screen.getByText("Pautan permohonan tidak tersedia.")).toBeInTheDocument();
});
```

---

## compose.yml
`yaml` · 77 lines · 2108 bytes · path `compose.yml`

```yaml
services:
  backend:
    build:
      context: ./backend
      dockerfile: Containerfile.backend
    container_name: tvet_backend
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=development        # Forces Express to show detailed error logs
      - JWT_SECRET=${JWT_SECRET:?Set JWT_SECRET in the project-root .env}
      - MONGO_URI=${MONGO_URI:-mongodb://%2Ftmp%2Fmongodb-27017.sock/ikmb-dashboard}
      - ML_API_URL=http://ml-api:8000
      - GEMINI_API_KEY=${GEMINI_API_KEY:-}
      - JSEARCH_API_KEY=${JSEARCH_API_KEY:-}
      - REDIS_URL=redis://redis:6379
      - TZ=Asia/Kuala_Lumpur
      - CORS_ORIGIN=${CORS_ORIGIN:-http://localhost:8080,http://localhost:3000}
    depends_on:
      redis:
        condition: service_healthy
    volumes:
      - ./backend/uploads:/app/uploads:Z
      # Host mongod unix socket (bypasses bridge->host firewall). If host mongod restarts, run: docker restart tvet_backend
      - /tmp/mongodb-27017.sock:/tmp/mongodb-27017.sock
    command: sh -c "sleep 5 && npm run start:prod"
    restart: always
    networks:
      - tvet_net

  redis:
    image: redis:7.4-alpine
    command: ["redis-server", "--appendonly", "yes", "--maxmemory", "128mb", "--maxmemory-policy", "noeviction"]
    volumes:
      - career_redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 2s
      retries: 5
    restart: always
    networks:
      - tvet_net

  ml-api:
    build:
      context: ./ML
      dockerfile: Containerfile
    container_name: tvet_ml_api
    ports:
      - "8000:8000"
    restart: always
    networks:
      - tvet_net

  frontend:
    build:
      context: .
      dockerfile: Containerfile.frontend
    container_name: tvet_frontend
    ports:
      - "8080:3000" # Maps host 8080 to Next.js internal 3000
    environment:
      - BACKEND_URL=http://backend:5000 # Allows Server Components to fetch data
      - NODE_ENV=production
    depends_on:
      - backend
    restart: always
    networks:
      - tvet_net

networks:
  tvet_net:
    driver: bridge

volumes:
  career_redis_data:
```

---

## .env.example
`dotenv` · 13 lines · 551 bytes · path `.env.example`

```dotenv
# Copy to .env for Docker Compose, then fill in your private values.
# Generate a signing secret with: openssl rand -hex 32
JWT_SECRET=
JSEARCH_API_KEY=
GEMINI_API_KEY=
CORS_ORIGIN=http://localhost:8080,http://localhost:3000

# Compose currently uses an existing host MongoDB Unix socket at this path.
# A running host MongoDB and /tmp/mongodb-27017.sock are required.
MONGO_URI=mongodb://%2Ftmp%2Fmongodb-27017.sock/ikmb-dashboard

# Used by Next.js when running locally. Compose overrides this inside its frontend.
BACKEND_URL=http://127.0.0.1:5000
```

---

## .github/workflows/ci.yml
`yaml` · 94 lines · 2695 bytes · path `.github/workflows/ci.yml`

```yaml
name: TVETMARA CI/CD Pipeline

on:
  push:
    branches: [ "main", "master" ]
  pull_request:
    branches: [ "main", "master" ]

jobs:
  repository-hygiene:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check tracked files and environment templates
        run: python3 scripts/check-repository.py

  # --- 1. FRONTEND TEST & BUILD (Next.js 15 SSR) ---
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install Dependencies
        run: npm install
      - name: Run Frontend Tests (Vitest)
        run: npm test
      - name: Build Frontend (Next.js SSR)
        env:
          BACKEND_URL: http://backend:5000
        run: npm run build

  # --- 2. BACKEND TEST (Express + Jest) ---
  backend:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis:7.4-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s
          --health-timeout 2s
          --health-retries 5
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install Dependencies
        run: npm install
      - name: Run Backend Tests (Jest + Supertest)
        env:
          CAREER_TEST_REDIS_URL: redis://127.0.0.1:6379/15
        run: npm test

  # --- 3. ML SERVICE TEST (FastAPI + Pytest) ---
  ml-service:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ML
    steps:
      - uses: actions/checkout@v4
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.9'
      - name: Install mdbtools (ETL dependency)
        run: sudo apt-get update && sudo apt-get install -y mdbtools
      - name: Install Dependencies
        run: pip install -r requirements.txt
      - name: Run ML Tests (Pytest)
        run: pytest test_ml.py

  # --- 4. DOCKER BUILD (Only if all tests pass) ---
  docker-build:
    needs: [repository-hygiene, frontend, backend, ml-service]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Frontend Image
        run: docker build -f Containerfile.frontend -t tvet-frontend:latest .
      - name: Build Backend Image
        run: docker build -f backend/Containerfile.backend -t tvet-backend:latest ./backend
      - name: Build ML Image
        run: docker build -f ML/Containerfile -t tvet-ml-api:latest ./ML
```

---

## scripts/check-repository.py
`python` · 96 lines · 4526 bytes · path `scripts/check-repository.py`

```python
"""Check the files Git would publish without printing credential values."""
from pathlib import Path
import re
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]


def git_paths(*args):
    output = subprocess.check_output(["git", *args, "-z"], cwd=ROOT)
    return [name for name in output.decode().split("\0") if name]


def main():
    findings = []
    tracked = set(git_paths("ls-files", "--cached"))
    candidates = tracked | set(git_paths("ls-files", "--others", "--exclude-standard"))
    for name in git_paths("ls-files", "--cached", "--ignored", "--exclude-standard"):
        findings.append(f"{name}: ignored file is still tracked; remove it from the Git index")

    patterns = {
        "private key": r"-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----",
        "GitHub token": r"\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{25,})",
        "AWS access ID": r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b",
        "Google API key": r"\bAIza[0-9A-Za-z_-]{30,}\b",
        "MongoDB credentials": r"mongodb(?:\+srv)?://[^\s/]+:[^\s/@]+@",
        "public signing-secret fallback": r"super_secret_fyp_key_\d+",
    }
    local_secrets = []
    for directory in [ROOT, ROOT / "backend", ROOT / "ML"]:
        for path in directory.glob(".env*"):
            if not path.is_file() or path.name.endswith(".example"):
                continue
            for line in path.read_text().splitlines():
                match = re.match(r"\s*([A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD)[A-Z0-9_]*)\s*=\s*(.+)", line)
                if match:
                    value = match[2].strip().strip("\"'")
                    if len(value) >= 16:
                        local_secrets.append((match[1], value))

    for name in sorted(candidates):
        path = ROOT / name
        parts = Path(name).parts
        is_example = path.name.startswith(".env") and path.name.endswith(".example")
        if path.name.startswith(".env") and not is_example:
            findings.append(f"{name}: private environment file would be published")
        if any(part in {".next", "node_modules", "__pycache__", "uploads", "mdb_extracted"} for part in parts):
            findings.append(f"{name}: generated output or private data would be published")
            continue
        if path.suffix.lower() in {".mdb", ".accdb", ".sqlite", ".sqlite3", ".pyc"} or ("db" in parts and path.name.startswith(("data_tvet", "ml_training_data"))):
            findings.append(f"{name}: local database or student export would be published")
            continue
        if not path.is_file():
            continue
        if path.stat().st_size > 10 * 1024 * 1024:
            findings.append(f"{name}: exceeds 10 MiB; review before publishing")
            continue
        try:
            content = path.read_text()
        except UnicodeError:
            continue
        for number, line in enumerate(content.splitlines(), 1):
            for label, pattern in patterns.items():
                if re.search(pattern, line):
                    findings.append(f"{name}:{number}: possible {label}; value withheld")
            for key, value in local_secrets:
                if value in line:
                    findings.append(f"{name}:{number}: contains local {key}; value withheld")
            if is_example and re.match(r"\s*\w*(?:KEY|SECRET|TOKEN|PASSWORD)\w*\s*=\s*\S", line):
                findings.append(f"{name}:{number}: leave example credentials empty")

    examples = {
        ".env.example": {"JWT_SECRET", "JSEARCH_API_KEY", "GEMINI_API_KEY", "CORS_ORIGIN", "MONGO_URI", "BACKEND_URL"},
        "backend/.env.example": {"PORT", "MONGO_URI", "JWT_SECRET", "ML_API_URL", "GEMINI_API_KEY", "JSEARCH_API_KEY", "CORS_ORIGIN", "REDIS_URL", "TZ"},
    }
    for name, required in examples.items():
        path = ROOT / name
        if name not in candidates or not path.is_file():
            findings.append(f"{name}: environment template is missing or ignored")
            continue
        keys = set(re.findall(r"^([A-Z_]+)=", path.read_text(), re.MULTILINE))
        for key in sorted(required - keys):
            findings.append(f"{name}: missing {key}")

    if findings:
        print("Repository checks failed:")
        print("\n".join(f"- {finding}" for finding in findings))
        return 1
    print(f"Repository checks passed for {len(candidates)} tracked and new files. Git history was not rewritten or certified secret-free.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

---

## docs/career-cache.md
`markdown` · 159 lines · 11392 bytes · path `docs/career-cache.md`

````markdown
# Department career caching

The career module uses Redis for search pages, recent keywords, and job details. MongoDB remains the source of student identity and department membership.

## Start the cache

For Docker Compose, put `JSEARCH_API_KEY` in the ignored project-root `.env`. Compose already supplies `REDIS_URL=redis://redis:6379` and `TZ=Asia/Kuala_Lumpur` to the backend.

From the project root, rebuild the backend and frontend with Redis:

```bash
docker compose up -d --build redis backend frontend
docker compose exec redis redis-cli ping
```

The check returns `PONG`. Redis has no published host port. It uses a named volume, append-only persistence, a 128 MB memory limit, and `noeviction`. Increase the memory limit if Redis reaches capacity. The backend refuses new paid searches when Redis cannot confirm a cache claim.

For local Node development, start a separate Redis instance bound to loopback:

```bash
docker run -d --name tvet-career-redis-local \
  -p 127.0.0.1:6379:6379 redis:7.4-alpine
```

Add these settings to the ignored `backend/.env`, alongside the existing MongoDB and JWT settings:

```dotenv
REDIS_URL=redis://127.0.0.1:6379
TZ=Asia/Kuala_Lumpur
JSEARCH_API_KEY=your-openweb-ninja-key
```

Install backend dependencies and start the backend from its directory. Redis is connected lazily on the first career request. Its outages affect career searches, not login or unrelated endpoints.

## API reference

All routes require a valid JWT through the existing Next.js proxy. Career responses use `Cache-Control: private, no-store`.

| Route | Input | Output |
| --- | --- | --- |
| `GET /api/careers/search` | Search parameters and an authorized scope | `jobs`, `cursor`, `department`, `cached`, `resetAt` |
| `GET /api/careers/history` | Optional authorized scope | `keywords`, `department`, `resetAt` |
| `GET /api/careers/history/:department` | Department checked against the student record | Same history output |
| `GET /api/careers/job-details` | One `job_id` and optional authorized scope | `job`, `cached`, `resetAt` |
| `GET /api/careers/pathways/:studentId` | Existing owner-or-staff check | Derived pathway and department-cached recommended jobs |

A student's scope comes from `Student.Kursus`, fetched by the JWT's `studentId`. A supplied department must match that record. An unlinked student receives 403. Invalid departments also receive 403. The supported codes are ITW, DFK, DGA, SLR, DCG, SED, and PPU.

Admin and counselor requests must select one department or one student with `department=DFK` or `studentId=...`. Supplying both selectors receives 400. Staff can access all seven departments under the existing role policy.

Search accepts the documented provider fields `query`, `country`, `date_posted`, `cursor`, `num_pages`, `language`, `work_from_home`, `employment_types`, `job_requirements`, `radius`, `exclude_job_publishers`, and `fields`. Unknown fields, repeated scalar fields, invalid enums, and conflicting aliases receive 400. `num_pages` is restricted to `1` to cap each cache miss at one page credit.

Existing callers may use `q`, `location`, and `employmentType`. Those aliases become the effective `query` and `employment_types` before hashing or contacting the provider. Defaults are `country=my`, `date_posted=all`, `employment_types=INTERN`, `num_pages=1`, and `work_from_home=false`.

Keywords normalize whitespace and case. Set-valued filters normalize their ordering. Opaque cursor text is preserved. The hash covers exactly the effective object serialized into the provider URL, with stable object-key order. Department selectors and the API key are never provider parameters.

When callers request a field projection, the backend adds `job_id`, `job_title`, and `job_apply_link` before hashing and serialization. Partial projections cannot turn real listings into false empty pages.

## Cache ownership and reset

The implementation lives in these files:

- `backend/utils/careerCache.js` validates effective parameters, builds keys, and calculates the reset deadline.
- `backend/services/careerCache.service.js` owns Redis connection handling, cache claims, history updates, and cooldowns.
- `backend/services/jobSearch.service.js` owns provider authentication and response mapping.
- `backend/careers.js` resolves authorization and maps HTTP results and errors.
- `src/components/dashboard/StudentDashboardClient.jsx` owns browser state, history selection, pagination, and details display.

Search keys are `job_cache:<department>:<md5 of canonical effective parameters>`. History keys are `job_history:<department>`. Detail keys are `job_details:<job_id>` and are shared across departments.

Global detail requests use fixed `country=my` and `language=en`. They accept one job ID, not batches or caller-selected response variants. If detail language or country becomes configurable, include those variants in the global key.

08:00 Asia/Kuala_Lumpur is 00:00 UTC. `getDailyCacheWindow()` returns the next UTC-midnight deadline and dynamic TTL seconds. At exactly 08:00, the helper advances to tomorrow's 08:00. The cache uses Redis time and absolute `PXAT` or `PEXPIREAT` expiration. Absolute expiry avoids extending a TTL by the time spent waiting for the provider. See [Redis expiration](https://redis.io/docs/latest/commands/expireat/).

Result and history keys become unavailable at that deadline. Redis can reclaim their memory later. The implementation does not promise that every byte is physically erased at the same instant.

Publication uses a Lua script that checks the original deadline and lock owner. A provider request that crosses the reset receives `DAILY_RESET` and cannot recreate yesterday's results or history. The browser clears cached display state at `resetAt` and rejects late expired responses.

Recent history is a ten-item Redis list. One atomic script removes the prior matching keyword, prepends it, trims the list, and assigns the daily deadline. Successful manual searches and cache hits update history, including valid empty pages. Pagination refreshes the same keyword. Automatic pathway loads and detail reads do not add history.

Both manual searches and pathways use this single cache. The old MongoDB `JobSearchCache` model and student-level cache reader and writer were removed. Existing unused documents do not affect new requests. Rebuild every backend replica so an old application instance cannot continue using the previous policy.

## Pagination and failures

The provider's `data.cursor` is returned without modification. Each cursor and filter combination has a separate cache entry. The provider adapter retains the complete page instead of discarding listings after six cards.

The browser stores the parameters of the last successful search. **Muat Lagi** uses those parameters, even if the student has edited the form. It deduplicates job IDs across pages. A failed next page leaves previous listings visible. **Cuba Lagi** retries that page. An invalid cursor or a reset requires a new search. The adapter stops a repeated cursor to prevent a pagination loop.

A missing key, malformed provider response, network failure, or provider timeout is an error. It never becomes a cached successful empty page. There are no automatic provider retries. Authentication secrets and provider error bodies are not returned to the browser.

A provider 429 stores a global cooldown based on `Retry-After`, bounded to 1–300 seconds. New misses receive 429 and `Retry-After` during that period. Existing cache hits remain available. Cooldown and 30-second request locks are coordination records, not job caches. Their short deadlines can cross 08:00 to protect an active request or a provider limit.

Concurrent 429 responses preserve the longer remaining cooldown. A later shorter response cannot reopen paid misses early.

An unpredictable owner token and an atomic Redis claim protect ordinary concurrent misses across backend instances. Waiters share the result or a short-lived failure and wait at most 12 seconds. They never call the provider while another owner holds the claim. The lock lasts longer than the provider's 10-second timeout.

This prevents duplicate calls during normal concurrency. It cannot guarantee exactly-once external billing after a process crash, lost Redis state, or an ambiguous HTTP timeout. Owner fencing prevents stale publication. The bounded lock permits recovery after a crash.

## Frontend examples

The existing proxy supplies the HttpOnly token. Browser code sends only same-origin requests:

```javascript
const response = await fetch('/api/careers/search?' + new URLSearchParams({
	q: 'Cloud Support',
	location: 'Malaysia',
	employmentType: 'INTERN',
	date_posted: 'week',
}));
const page = await response.json();
if (!response.ok) throw new Error(page.message);

const historyResponse = await fetch('/api/careers/history');
const { keywords } = await historyResponse.json();

const nextResponse = await fetch('/api/careers/search?' + new URLSearchParams({
	q: 'Cloud Support',
	location: 'Malaysia',
	employmentType: 'INTERN',
	date_posted: 'week',
	cursor: page.cursor,
}));
```

The implemented dropdown loads history when the input receives focus. It supports keyboard selection and shows loading and unavailable states. Job cards expose **Lihat Butiran**, which calls the globally cached details endpoint.

## Verify without provider credits

The normal backend tests use fixture responses. To include the real Redis integration suite, start an isolated test container:

```bash
docker run -d --name tvet-career-cache-test \
  -p 127.0.0.1:6389:6379 redis:7.4-alpine \
  redis-server --save '' --appendonly no
```

From `backend`, run:

```bash
CAREER_TEST_REDIS_URL=redis://127.0.0.1:6389/15 npm test
```

The test suite clears database 15. Use a disposable Redis instance, never a production database. GitHub Actions provisions its own Redis service and enables this suite.

Tests check department authorization, full-parameter identities, concurrent misses, ten unique keywords, global details, provider cooldowns, real absolute expiry, old-owner fencing, and an in-flight publisher crossing the reset. Pure time tests cover just before 08:00 and exactly 08:00. UI tests cover history selection, pagination failures, details, and late expired responses.

Remove the isolated test container after verification:

```bash
docker rm -f tvet-career-cache-test
```

## Design decision

The design comparison considered a MongoDB-only cache and a Redis-owned cache. Both could enforce department authorization and logical freshness. Redis was selected because it provides absolute expiration and atomic bounded history operations without adding MongoDB cache schemas or transaction requirements. MongoDB TTL deletion is asynchronous, as described in [MongoDB TTL documentation](https://www.mongodb.com/docs/manual/core/index-ttl/).

The final design incorporates the MongoDB candidate's full-page preservation, request-bound pagination, and expiry-fenced writes. It uses bounded Redis locks instead of persistent uncertain-attempt reservations. This accepts bounded crash-recovery ambiguity in exchange for availability and a smaller interface.

Provider requests follow the [OpenWeb Ninja JSearch contract](https://www.openwebninja.com/api/jsearch/llms.txt). No provider key or student record is sent to the browser.
````

---

## ML_TEST_RESULTS.md
`markdown` · 14 lines · 361 bytes · path `ML_TEST_RESULTS.md`

```markdown
# ML Service Test Results

## Model Files Present
- model_ai_risiko_lengkap_v3.pkl
- model_ai_risiko_lengkap_v4.pkl

## Test Results
All 3 tests passed:
- test_health_check
- test_predict_risk_valid_data
- test_predict_risk_invalid_data

## Conclusion
ML service updates (environment variable for model path, health check, error handling) are working correctly.
```

---
