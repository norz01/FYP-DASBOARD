# Department career caching

The career module uses Redis for search pages, recent keywords, and job details. MongoDB remains the source of student identity and department membership.

## Start the cache

For Podman Compose, put `JSEARCH_API_KEY` in the ignored project-root `.env`. Compose already supplies `REDIS_URL=redis://redis:6379` and `TZ=Asia/Kuala_Lumpur` to the backend.

From the project root, rebuild the backend and frontend with Redis:

```bash
podman compose up -d --build redis backend frontend
podman compose exec redis redis-cli ping
```

The check returns `PONG`. Redis has no published host port. It uses a named volume, append-only persistence, a 128 MB memory limit, and `noeviction`. Increase the memory limit if Redis reaches capacity. The backend refuses new paid searches when Redis cannot confirm a cache claim.

For local Node development, start a separate Redis instance bound to loopback:

```bash
podman run -d --name tvet-career-redis-local \
  -p 127.0.0.1:6379:6379 docker.io/library/redis:7.4-alpine
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
podman run -d --name tvet-career-cache-test \
  -p 127.0.0.1:6389:6379 docker.io/library/redis:7.4-alpine \
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
podman rm -f tvet-career-cache-test
```

## Design decision

The design comparison considered a MongoDB-only cache and a Redis-owned cache. Both could enforce department authorization and logical freshness. Redis was selected because it provides absolute expiration and atomic bounded history operations without adding MongoDB cache schemas or transaction requirements. MongoDB TTL deletion is asynchronous, as described in [MongoDB TTL documentation](https://www.mongodb.com/docs/manual/core/index-ttl/).

The final design incorporates the MongoDB candidate's full-page preservation, request-bound pagination, and expiry-fenced writes. It uses bounded Redis locks instead of persistent uncertain-attempt reservations. This accepts bounded crash-recovery ambiguity in exchange for availability and a smaller interface.

Provider requests follow the [OpenWeb Ninja JSearch contract](https://www.openwebninja.com/api/jsearch/llms.txt). No provider key or student record is sent to the browser.
