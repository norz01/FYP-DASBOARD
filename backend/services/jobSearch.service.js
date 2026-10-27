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
