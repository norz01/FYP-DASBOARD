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
