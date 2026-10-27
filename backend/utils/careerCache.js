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
