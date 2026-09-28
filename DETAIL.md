# DETAIL.md — TVETMARA Besut Skills Talent Development Dashboard

> Complete, beginner-friendly documentation of this project structure.
> If you read this file for the first time, you will understand what this project is,
> how each folder and file works, how data flows, and how to run it.

---

## 1. What Is This Project?

**Name:** TVETMARA Besut Skills Talent Development Dashboard
**Type:** Final Year Project (FYP)
**Purpose:** Smart dashboard system for Institut Kemahiran MARA Besut (IKMB / TVETMARA Besut) to:

1. Monitor student talent data (CGPA, attendance, PLO 1-9, certificates).
2. Predict dropout risk / student status with AI (`Bermasalah` / `Sederhana` / `Cemerlang` → displayed as `Tinggi` / `Sederhana` / `Rendah`).
3. Analyze skill gaps (PLO vs 80% target).
4. Recommend learning pathways, courses, and careers.
5. Let staff upload Microsoft Access `.mdb` files and automatically sync them to the database via ETL + AI.
6. Provide an AI academic advisor chatbot powered by Google Gemini.
7. Give students their own dashboard to view performance, upload certificates/profile images, and see job matches.

**Main users:**

- `admin` (staff / penyelaras): full access — all students, CRUD, MDB upload/process, AI chat.
- `user` (student): restricted access — only own data, certificates, career/courses view.

**Default login accounts (seeded):**

- `admin@ikmb.edu.my` / `password123` → role `admin`
- `user@ikmb.edu.my` / `password123` → role `user` (generic)
- Each student also gets `ID_Pelajar@student.ikmb.edu.my` / `password123` after seed or MDB sync.

---

## 2. High-Level Architecture (4 Services)

This is a **monorepo with 3 codebases + 1 database**, orchestrated by Docker Compose:

```
Browser
  |
  | HTTP :8080
  v
Frontend (Next.js 15 SSR, React 19) — port 3000 inside Docker, mapped to 8080 on host
  |
  | /api/:path* rewrite → http://backend:5000/api/:path*
  | /uploads/:path* rewrite → http://backend:5000/uploads/:path*
  v
Backend (Express.js Node 20) — port 5000
  |----> MongoDB (mongo:latest) — port 27017, database `ikmb-dashboard`
  |----> ML API (FastAPI Python 3.9) — port 8000
  |----> Google Gemini API (cloud, via GEMINI_API_KEY, model `gemini-3.5-flash-lite`)
```

**File that defines this:** `compose.yml`

- `mongodb`: image `mongo:latest`, volume `./mongodb_data:/data/db`, network `tvet_net`.
- `backend`: built from `./backend` with `Containerfile.backend`, env `JWT_SECRET`, `MONGO_URI=mongodb://mongodb:27017/ikmb-dashboard`, `ML_API_URL=http://ml-api:8000`, `GEMINI_API_KEY`, volume `./backend/uploads:/app/uploads`.
- `ml-api`: built from `./ML` with `Containerfile`, port `8000:8000`.
- `frontend`: built from repo root with `Containerfile.frontend`, port `8080:3000`, env `BACKEND_URL=http://backend:5000`.

All services share bridge network `tvet_net`.

---

## 3. Technology Stack Summary

| Layer | Technology | Key Libraries |
|---|---|---|
| Frontend | Next.js 15.1.6 (SSR, App Router), React 19, TailwindCSS 3.4 | `chart.js`, `react-chartjs-2`, `Plus Jakarta Sans`, Phosphor Icons via CDN, `vitest` + Testing Library |
| Backend | Express 5.2.1, Node 20, ESM (`"type": "module"`) | `mongoose`, `jsonwebtoken`, `bcryptjs`, `multer`, `helmet`, `cors`, `express-rate-limit`, `@google/generative-ai`, `swagger-jsdoc` + `swagger-ui-express`, `jest` + `supertest` |
| ML Service | FastAPI, Python 3.9, scikit-learn RandomForest | `joblib`, `pandas`, `numpy`, `pydantic`, `uvicorn`, `python-multipart`, `pytest`, `mdbtools` system package |
| Database | MongoDB | Mongoose ODM, persisted in `./mongodb_data/` |
| AI Chat | Google Gemini `gemini-3.5-flash-lite` | Streaming + JSON fallback |
| DevOps | Docker / Podman Compose, GitHub Actions CI | 3 Dockerfiles, `ci.yml` with frontend/backend/ML/docker-build jobs |
| Data source | Microsoft Access `.mdb` | `mdb-tables`, `mdb-export` CLI |

---

## 4. Root Directory — File by File

```
/
├── .dockerignore              # Excludes node_modules, dist, ML, .git, .env from frontend Docker build
├── .env.local                 # Local dev: BACKEND_URL=http://127.0.0.1:5000 + GEMINI_API_KEY
├── .eslintrc.json             # Extends next/core-web-vitals, disables no-img-element + unescaped-entities
├── .github/workflows/ci.yml   # CI: frontend Vitest+build, backend Jest, ML pytest, then 3 docker builds
├── .gitignore                 # (standard) ignores node_modules, .next, .env, uploads, etc.
├── .next/                     # Next.js build output (generated, do not edit)
├── backend/                   # Express API (see Section 6)
├── compose.yml                # 4-service orchestration (see Section 2)
├── Containerfile.frontend     # 3-stage Node 20-alpine build → standalone Next.js server
├── dist/                      # Old Vite build artifact (legacy, not used by Next.js flow)
├── jsconfig.json              # Allows `@/*` → `./src/*` imports
├── logo-tvetmara.jpg          # Official logo, also copied to public/
├── middleware.js              # Next.js edge middleware: auth + role redirect (see Section 5.2)
├── ML/                        # FastAPI AI service (see Section 7)
├── ML_TEST_RESULTS.md         # Notes: v3/v4 models present, 3 pytest tests passed
├── mongodb_data/              # Local MongoDB data files (Docker volume)
├── next.config.mjs            # `output: standalone` + rewrites /api and /uploads to backend:5000
├── node_modules/              # Frontend deps (generated)
├── package.json               # Frontend scripts: dev/build/start/lint/test (vitest run src/__tests__)
├── package-lock.json          # Locked frontend deps
├── postcss.config.js          # tailwindcss + autoprefixer
├── public/logo-tvetmara.jpg   # Served at /logo-tvetmara.jpg
├── public/vite.svg            # Legacy Vite asset
├── src/                       # All frontend source (see Section 5)
├── tailwind.config.js         # Content scans src/app + src/components, font Plus Jakarta Sans
└── vitest.config.js           # jsdom, include src/**/*.{test,spec}, alias @ → ./src
```

### 4.1 Important root configs explained

- **`next.config.mjs`**: Sets `output: 'standalone'` for minimal Docker image. `rewrites()` proxies `/api/:path*` to `http://backend:5000/api/:path*` and `/uploads/:path*` to backend. This means frontend code can simply call `fetch("/api/students")` and it works both locally and in Docker.
- **`middleware.js`**: Runs on every route except `api`, `_next/static`, `_next/image`, `favicon.ico`, `assets`. Reads `user` cookie (JSON with `role`). If on `/` login page and already logged in → redirect to role dashboard. If no user and accessing protected route → redirect to `/`. If `admin`-only route (`/staff-dashboard`, `/student-profile`) accessed by `user` → redirect to `/student-dashboard`. Vice versa for `/student-dashboard` accessed by `admin`.
- **`Containerfile.frontend`**: 3 stages — `deps` (npm install), `builder` (npm run build), `runner` (non-root `nextjs` user, copies `.next/standalone` + `.next/static` + `public`, runs `node server.js` on port 3000).
- **`jsconfig.json` + `vitest.config.js`**: Both define `@` alias so you can write `import LoginForm from '@/components/auth/LoginForm'`.
- **`tailwind.config.js`**: Only scans `src/app` and `src/components`. Custom font family `sans: Plus Jakarta Sans`.
- **`.env.local`**: Used by Next.js Server Actions (`src/app/actions.js`) as `BACKEND_URL`. In Docker this is overridden to `http://backend:5000`.

---

## 5. Frontend — `src/` Deep Dive

### 5.1 Folder map

```
src/
├── app/
│   ├── actions.js                 # Server Actions: loginAction, logoutAction
│   ├── globals.css                # Tailwind directives + fadeIn keyframes
│   ├── layout.jsx                 # Root HTML layout, font, Phosphor CDN, metadata
│   ├── page.jsx                   # Route `/` — login page, renders LoginForm
│   ├── staff-dashboard/page.jsx   # Route `/staff-dashboard` — renders StaffDashboardClient
│   ├── student-dashboard/page.jsx # Route `/student-dashboard` — renders StudentDashboardClient
│   └── student-profile/page.jsx   # Route `/student-profile?id=XXX` — renders StudentProfileClient
├── assets/react.svg               # Legacy asset
├── components/
│   ├── auth/LoginForm.jsx         # Split-screen login UI + useActionState(loginAction)
│   ├── Sidebar.jsx                # Reusable sidebar with navItems, user card, logout
│   ├── KpiCard.jsx                # KPI number card with icon + progress bar
│   ├── StudentModal.jsx           # Add/Edit student modal (Escape + backdrop close)
│   ├── StudentListGrid.jsx        # Search + course filter chips + card grid
│   ├── JobCard.jsx                # Career card with match % + Mohon Sekarang button
│   └── dashboard/
│       ├── StaffDashboardClient.jsx   # ~1147 lines: admin full dashboard (6 tabs)
│       ├── StudentDashboardClient.jsx # ~939 lines: student 4-tab dashboard
│       └── StudentProfileClient.jsx   # ~538 lines: admin single-student 360° profile
├── lib/
│   ├── auth.js                    # Server helpers: getStoredUser, getToken, getDashboardPathForRole
│   ├── client-auth.js             # Client helpers: getClientUser, getClientToken from document.cookie
│   └── heuristics.js              # calculateEmployability + calculateTopPerformerScore
└── __tests__/Login.test.jsx       # Vitest test: LoginForm renders heading + inputs + button
```

### 5.2 Routing and auth flow (frontend)

1. User opens `/` → `src/app/page.jsx` (forced `dynamic = 'force-dynamic'` so no cookie read at build time) renders `LoginForm`.
2. `LoginForm.jsx` is a Client Component using `useActionState(loginAction)`. Email defaults to `admin@ikmb.edu.my`, password to `password123`. On submit → `loginAction` Server Action.
3. `src/app/actions.js:loginAction`:
   - POSTs `{email, password}` to `${BACKEND_URL}/api/auth/login`.
   - On success sets two cookies (non-httpOnly so client JS can read): `user` (JSON stringified sanitized user) and `ikmbToken` (JWT, 8h expiry), `maxAge: 86400`, `secure` only in production.
   - Calls `redirect()` to `/staff-dashboard` if `role === 'admin'`, else `/student-dashboard`. Note: `redirect()` is deliberately outside try/catch because Next.js throws internally for redirects.
4. `logoutAction` deletes both cookies and redirects to `/`.
5. `middleware.js` enforces redirects on every navigation (see 4.1).
6. Client Components read auth via `src/lib/client-auth.js` (`document.cookie` parsing). Server Components would use `src/lib/auth.js` (`next/headers` cookies).
7. All API calls from browser use relative `/api/...` which Next.js rewrites to backend, with header `Authorization: Bearer <ikmbToken>`.

### 5.3 Pages in detail

- **`layout.jsx`**: Wraps all pages. Loads `Plus_Jakarta_Sans` (400,500,600,700), sets `<html lang="ms">`, loads Phosphor Icons via `<Script src="https://unpkg.com/@phosphor-icons/web" strategy="beforeInteractive" />`. Title: `TVETMARA Besut - Papan Pemuka Pintar`.
- **`staff-dashboard/page.jsx` / `student-dashboard/page.jsx`**: Thin wrappers (`dynamic = 'force-dynamic'`) that render the heavy Client components. Keeps SSR build from trying to access `window`/`document.cookie`.
- **`student-profile/page.jsx`**: Async Server Component reading `searchParams.id` (defaults to `TVET001`), passes `studentId` to `StudentProfileClient`. Admin-only route per middleware.

### 5.4 Reusable components

- **`LoginForm.jsx`**: Left side (desktop only) blue marketing panel with AI background image + headline “Revolusi Bakat TVET dengan Kuasa AI.” Right side white form with logo `/logo-tvetmara.jpg`, email/password inputs with Phosphor icons, `SubmitButton` using `useFormStatus` (shows “Memproses...” when pending), error box if `state?.error`.
- **`Sidebar.jsx`**: Props `navItems, activeTab, setActiveTab, isSidebarOpen, setIsSidebarOpen, currentUser, handleLogout`. Shows logo via `next/image`, nav buttons with active highlight (`bg-blue-50 border-l-4`), bottom user card with initials avatar, displayName, role label (`Penyelaras` for admin, `Pelajar` for user), logout button.
- **`KpiCard.jsx`**: Props `title, value, isLoading, icon, iconBg, iconColor, barColor, barWidth, subtitle`. White card with progress bar.
- **`StudentModal.jsx`**: Add/Edit form with fields `ID_Pelajar` (disabled when editing), `Nama`, `CGPA`, `Kehadiran_Pct`, `Sijil_Profesional` (Tiada/CompTIA/Cisco CCNA/AWS Cloud), `Kursus` (ITW/DGA/DFK/PPU/SLR/DCG/SED), `Status_Pelajar` (Bermasalah/Sederhana/Cemerlang). Closes on Escape key or backdrop click via `modalRef`.
- **`StudentListGrid.jsx`**: Local search + course filter chips (`Semua, ITW, DFK, DGA, SLR, DCG, SED, PPU`). Card grid shows semester badge, initial avatar, name, course full name via `courseMap`, ID + CGPA footer. Click → `onViewProfile(id)`.
- **`JobCard.jsx`**: Shows icon, `match` badge, title, company, “Mohon Sekarang” button (UI only, no backend call).

### 5.5 Dashboard clients (core UI logic)

#### A. `StaffDashboardClient.jsx` (admin, 6 tabs)

Tabs defined in `navItems`: `overview`, `prediction` (AI chat), `skills`, `pathways`, `management`, `data`.

- **State**: `user`, `students`, `searchTerm`, modal `formData`, AI chat (`aiStudentId, aiMessages, aiInput, isAiTyping`), MDB (`mdbFile, datasetName, mdbFiles, processingId, isLoadingFiles, deletingId`).
- **On mount**: `getClientUser()` + `getClientToken()`, `GET /api/students`, `GET /api/data/mdb-files`.
- **Overview**: Computes `totalStudents`, `highRiskStudents` (dropoutRisk Tinggi OR attendance<80 OR cgpa<2.0), `averageEmployability` via `calculateEmployability`, `topPerformers` (top 5 by CGPA), `ploAverages` (mean of plo1-9), Bar chart (institute avg vs 80 target), high-risk list + top performers list (click → `/student-profile?id=`).
- **AI Prediction tab**: Two-column layout. Left: student selector + context card (name, risk badge, kursus, CGPA, attendance, weakest PLO) + 3 quick prompts (analisis kelemahan, sijil profesional, ringkasan prestasi). Right: chat UI with streaming. `handleSendAiMessage` POSTs `{studentId, userMessage, chatHistory}` to `/api/ai/chat`, reads `content-type`: if `application/json` → non-stream fallback (`data.reply`), else streams via `res.body.getReader()` + `TextDecoder`, updating last bubble token-by-token with blinking caret. `renderAiText` handles `**bold**`, `*italic*`, bullet normalization.
- **Skills tab**: Table of PLO 1-9 with average, gap (`80-avg`), status (`Selamat` ≥80, `Perlu Peningkatan` 60-79, `Kritikal` <60).
- **Pathways tab**: Cards for each PLO with gap>0, sorted by gap desc, with `pathwayMappings` (e.g. PLO 1 → Kursus Komunikasi Efektif).
- **Management tab**: Renders `StudentListGrid` + `StudentModal`. `handleSubmit` POST/PUT `/api/students`, `handleDelete` DELETE.
- **Data tab (Pengurusan Data TVET)**: Step 1 upload form (datasetName + .mdb file → `POST /api/data/upload-mdb` with FormData). Step 2 archive table (datasetName, originalName, size MB, uploadDate, status badge `Saved/Processing/Selesai/Gagal`, process + delete buttons). Polls every 3s while `isAnyProcessing`. `handleProcessMdb` POSTs `/api/data/process-mdb/:id` then refreshes students. `handleDeleteMdb` DELETEs `/api/data/mdb-files/:id`.

#### B. `StudentDashboardClient.jsx` (student, 4 tabs)

Tabs: `dashboard` (Profil & Prestasi), `profile` (Kemaskini Sijil Saya), `career` (Padanan Kerjaya AI), `courses` (Kursus Cadangan).

- **Data scoping**: After `GET /api/students`, if `role==='user' && studentId` filters to own record only, auto-selects it. Admin viewing this page would see all (but middleware normally prevents admin here).
- **Skill-gap loading**: On `selectedStudentId` change, fetches `/api/students/:id/skill-gap` (radar data + AI insight) and `/api/students/:id` (certificates).
- **Dashboard tab**: 3 stat cards (employability via `calculateEmployability`, attendance, CGPA), Radar chart (student vs target 80), AI insight box, career teaser card (top 2 jobs from `careerMapping[kursus]`), risk badge.
- **Profile tab**: Profile image upload (`POST /api/students/:id/profile-image`), read-only name/ID/course, certificate add form (`POST /api/students/:id/certificates` with name/issuer/file) + certificate grid with delete (`DELETE /api/students/:id/certificates/:certId`).
- **Career tab**: Maps `careerMapping[kursus]` to `JobCard`. See Section 9 for full mapping.
- **Courses tab**: `courseMappings[PLO]` for weakest PLO + hardcoded AWS Cloud Practitioner card.
- **Helpers**: `getFullCourseName(code)` (short names: Diploma Kimpalan, Diploma Komputasi Awan, etc.), `careerMapping` object (see Section 9), `initialSkillGap` placeholder.

#### C. `StudentProfileClient.jsx` (admin 360° view)

Props: `studentId` from URL. Fetches `/api/students/:id/skill-gap`.

- Left card: navy header with `StatusBadge` (Tinggi=red, Sederhana=amber, Rendah/Cemerlang=green), avatar initial, name, ID, kursus full name (long formal names, e.g. DFK → Diploma Teknologi Komputer (Komputasi Awan)), semester, certification, attendance, Edit/Print/Download buttons. Download exports JSON (`Profil_Pelajar_ID.json` with studentDetails, academicHistory, aiInsight, employabilityScore, ploScores). Print calls `window.print()`.
- Right tabs: `personal` (email `ID@student.ikmb.edu.my`, phone, IC, address), `academic` (CGPA bar + combined Bar+Line trend chart: GPA line left axis 0-4, attendance bar right axis 0-100 from `academicHistory`), `skills` (employability gradient card + Radar PLO chart + 3 intervention cards: Kaunseling Kehadiran, Klinik Akademik, Pembangunan Soft Skills).
- Handles `hasZeroScore` warning if any PLO is 0 (“DATA PLO BELUM LENGKAP”).

### 5.6 Frontend lib + tests

- **`lib/heuristics.js`**: `calculateEmployability(cgpa, attendance) = (cgpa/4)*40 + attendance*0.6`, capped 100, rounded. `calculateTopPerformerScore = (cgpa/4)*60 + attendance*0.4`.
- **`__tests__/Login.test.jsx`**: Mocks `next/navigation`, `next/script`, `@/app/actions`, renders `LoginForm`, asserts “Selamat Kembali”, email label, password label, login button exist. Run via `npm test` (vitest).

---

## 6. Backend — `backend/` Deep Dive (Express API)

### 6.1 Folder map

```
backend/
├── server.js                  # App entry: helmet, cors, json limit, static, swagger, routes, error handler
├── auth.js                    # Router: POST /api/auth/login, GET /api/auth/users (admin)
├── items.js                   # Main router: students CRUD, certificates, profile-image, predict/manual, MDB, ai/chat
├── auth.model.js              # DB helpers: readLoginDatabase, authenticateUser (bcrypt+JWT), getPublicLoginUsers
├── item.model.js              # DB helpers: normaliseStudent, getRealAIPrediction, skill-gap, CRUD
├── models/
│   ├── Student.js             # Mongoose schema: ID_Pelajar, Nama, Kursus, CGPA, PLO_1..9, etc.
│   ├── User.js                # Mongoose schema: email, password (hashed), role, displayName, studentId
│   └── MdbFile.js             # Mongoose schema: datasetName, originalName, filePath, fileSize, status, etc.
├── middleware/authMiddleware.js # verifyToken, requireAdmin, requireOwnershipOrAdmin
├── db/
│   ├── data_tvet_muktamad.json # Seed JSON (used by seed.js)
│   ├── inspect_mdb_linux.py     # Standalone mdbtools schema dump utility
│   ├── mdb_extracted/           # CSV extracts from MDBs (generated)
│   ├── prepare_ml_data_3mdb.py  # Multi-MDB → ml_training_data_real.csv + rule labels
│   ├── relabel_option2.py       # (label rule variant)
│   └── sedut_mdb_tulen.py       # (legacy extract script)
├── __tests__/
│   ├── auth.test.js             # Mocks auth.model, tests login success (200+token) + wrong password (401)
│   └── items.test.js            # Tests GET /api/students without token → 401, invalid token → 401
├── seed.js                    # Upserts students from JSON + student Users + admin/user demo accounts
├── seed-admin.js              # Upserts only admin@ikmb.edu.my + user@ikmb.edu.my
├── repredict-status.js        # Batch re-predicts all Status_Pelajar via ML /predict/batch (chunks of 500)
├── uploads/certificates/      # Public: profile images + certificate files (served statically)
├── uploads/mdb/               # Private: uploaded .mdb files (NOT served statically)
├── .env / .env.example        # PORT, MONGO_URI, JWT_SECRET, CORS_ORIGIN
├── babel.config.json          # @babel/preset-env for Jest ESM
├── Containerfile.backend      # Node 20-alpine, npm install --production, CMD node server.js
├── package.json               # Scripts: start/dev/seed/start:prod/test (jest with --experimental-vm-modules)
└── node_modules/              # (generated)
```

### 6.2 `server.js` explained

- Imports `cors, dotenv, express, helmet, mongoose, swagger-jsdoc, swagger-ui-express`, routers `auth.js`, `items.js`, model `MdbFile`.
- `helmet({contentSecurityPolicy:false})` so Swagger UI works. `cors({origin: CORS_ORIGIN split by comma or *})`. `express.json({limit:"200kb"})` prevents oversized payload abuse.
- Static: only `/uploads/certificates` is public. `/uploads/mdb` stays private (no static mount).
- Swagger at `/api/docs` scanning `./auth.js`, `./items.js`.
- Mongo connect (skipped when `NODE_ENV=test`): logs success, recovers stuck files (`updateMany {status:Processing} → Saved`) on boot after crash.
- `GET /api/health` → `{status:"ok", source:"mongodb-database"}`.
- Mounts `authRouter` at `/api/auth`, `itemsRouter` at `/api`.
- Global error handler returns 500 with `message + stack`.
- Listens on `PORT` (default 5000) unless in test mode. Exports `app` for supertest.

### 6.3 Auth (`auth.js` + `auth.model.js` + `middleware/authMiddleware.js`)

- **`POST /api/auth/login`**: Requires `email, password` (400 if missing). Calls `authenticateUser(email,password)`. Returns 401 if null, else `{message:"Login berjaya.", user:{email,role,displayName,studentId}, token}`.
- **`GET /api/auth/users`**: `verifyToken + requireAdmin`, returns sanitized users (no password).
- **`auth.model.js:authenticateUser`**: Finds user by lowercased email in Mongo, `bcrypt.compare(password, hashed)`, signs JWT `{email,role,studentId}` with `JWT_SECRET` (fallback `super_secret_fyp_key_2026` in middleware, but auth.model requires env), `expiresIn:'8h'`.
- **`verifyToken`**: Checks `Authorization: Bearer <token>`, verifies JWT, sets `req.user = decoded`, 401 if missing/invalid. Has console logs for debugging + try/catch so server never crashes on bad token.
- **`requireAdmin`**: 403 unless `req.user.role==='admin'`.
- **`requireOwnershipOrAdmin`**: Allows if `role==='admin'` OR `req.user.studentId === req.params.studentId`. Used for single-student routes so students can only see themselves.

### 6.4 Student + AI routes (`items.js` — 694 lines, most important backend file)

All routes require `verifyToken` (JWT). Admin-only vs ownership-checked as noted.

| Method & Path | Guard | Purpose |
|---|---|---|
| `GET /api/students` | verifyToken | If student role + studentId → returns `[ownStudent]` only (data exposure fix). Else admin gets all via `getAllStudents()`. |
| `POST /api/students` | admin | `createStudent(req.body)` → 201 |
| `PUT /api/students/:studentId` | admin | `updateStudent(id, body)` → 404 if not found |
| `DELETE /api/students/:studentId` | admin | `deleteStudent(id)` |
| `GET /api/students/:studentId` | ownershipOrAdmin | Single normalized student |
| `GET /api/students/:studentId/skill-gap` | ownershipOrAdmin | Skill-gap analysis (see item.model) |
| `POST /api/students/:studentId/certificates` | ownershipOrAdmin + multer | Upload cert (PDF/JPG/PNG ≤5MB) to `uploads/certificates`, `$push` to `uploadedCertificates {name,issuer,fileName,filePath}` |
| `DELETE /api/students/:studentId/certificates/:certId` | ownershipOrAdmin | Deletes DB subdoc + physical file |
| `POST /api/students/:studentId/profile-image` | ownershipOrAdmin + multer | Upload image, sets `Student.profileImage = /uploads/certificates/<file>` |
| `POST /api/predict/manual` | admin | Forwards features to ML `/predict/risk`, returns `{success,prediction}` |
| `POST /api/data/upload-mdb` | admin + mdbUpload | Saves .mdb (≤100MB) + requires `datasetName`, creates `MdbFile {status:Saved}` |
| `GET /api/data/mdb-files` | admin | Lists all MdbFiles sorted newest first |
| `POST /api/data/process-mdb/:id` | admin | Triggers `executeEtlAndSync` (see below) |
| `DELETE /api/data/mdb-files/:id` | admin | Deletes DB record + physical file (path-traversal guard: only inside `uploads/`), blocks if `Processing` |
| `POST /api/ai/chat` | admin + rateLimit | Gemini chatbot (see 6.6) |

**Multer configs:**

- `upload` (certificates/images): `diskStorage` to `uploads/certificates`, unique filename `Date.now()-random + ext`, 5MB limit, allow `jpeg|jpg|png|pdf` (checks both ext + mimetype). Important: `verifyToken` runs BEFORE multer so unauthenticated uploads never hit disk.
- `mdbUpload`: to `uploads/mdb`, 100MB limit, only `.mdb` extension.

**`executeEtlAndSync(mdbRecord)` steps:**

1. Set status `Processing`.
2. Read file from disk → `FormData` + `Blob` → `POST {ML_API_URL}/etl/process-mdb` → gets `{data: students[]}`.
3. If students non-empty, batch AI: map to `{CGPA, Attendance, PLO_1..9, Sijil}` → `POST {ML_API_URL}/predict/batch` → overwrites each `Status_Pelajar` with prediction. Warns but continues if AI unreachable.
4. Sync Mongo: if new list non-empty, `deleteMany({ID_Pelajar: {$nin: newIds}})` (removes students not in new file), then `bulkWrite` upserts for `Student` (all fields + academicHistory) and `User` (email `ID@student.ikmb.edu.my`, default hashed `password123`, role `user`).
5. Set `MdbFile {status:Processed, recordsProcessed, processedDate}`. On error set `Failed` and rethrow.

### 6.5 Data normalization (`item.model.js`)

- **`normaliseStudent(record)`**: Maps raw Mongo (UPPER_SNAKE like `ID_Pelajar`, `Kehadiran_Pct`) to frontend camelCase (`id, nama, kursus, semester, attendance, cgpa, anugerah, kokoLulus, plo1..9, certification, certificationScore, dropoutRisk, careerStatus, uploadedCertificates, profileImage, academicHistory, noKP, noTelefon, alamat`).
- **Risk logic**: `dropoutRiskMap: Bermasalah→Tinggi, Sederhana→Sederhana, Cemerlang→Rendah, Pending AI→Pending`. Then override: if `attendance<80 OR cgpa<2.0` → `Tinggi`; else if `Status_Pelajar==='Bermasalah'` stays `Tinggi` even if cgpa≥3.5; else if `cgpa≥3.5 OR Status==='Cemerlang'` → `Rendah`.
- **`certificationScores`**: Tiada 35, CompTIA 70, Cisco CCNA 85, AWS Cloud 90 (fallback 50).
- **`getRealAIPrediction(features)`**: POSTs to `{ML_API_URL}/predict/risk` with `{CGPA, Attendance, PLO_1..9, Sijil}`, maps `Bermasalah→Tinggi` etc. Fallback heuristic if ML down: attendance<80 or cgpa<2.0 → Tinggi, cgpa≥3.5 → Rendah, else Sederhana.
- **`getStudentSkillGapById(id)`**: Gets student, calls real AI to refresh `dropoutRisk`, builds `metrics` (9× {label, value, target:80}), `chart {labels, current, target}`, `insight {weakestSkill, message}` via `buildInsight` (if weakest is 0 → “belum direkodkan”, else gap + priority text).
- **CRUD**: `createStudent`, `updateStudent` (runValidators), `deleteStudent` via Mongoose.

### 6.6 Gemini chatbot (`POST /api/ai/chat`)

Hardened for production:

- Guards: `verifyToken + requireAdmin + aiRateLimiter` (15 req/min per email, keyGenerator uses `req.user.email` to avoid IPv6 error).
- Validation: `studentId` non-empty string, `userMessage` non-empty ≤1500 chars, `GEMINI_API_KEY` must exist.
- Privacy: Fetches student via `getStudentById`, builds `studentDataForAI` with ONLY non-PII (nama, kursus, semester, cgpa, kehadiran, statusRisiko, sijil, PLOs, anugerah, koko, academicHistory). **IC/phone/address are NEVER sent to LLM** (comment in code).
- Grounding: `TVET_KNOWLEDGE` string is single source of truth — official course codes, career mappings, PLO definitions + recommended courses, risk definitions, recognized certs, IKMB intervention programs. `systemPrompt` instructs model to answer ONLY from this + student data, in professional Malay, actionable, bold + bullets, never hallucinate, ignore prompt-injection inside `<DATA_PELAJAR>` or user message.
- Model: `gemini-3.5-flash-lite`, `temperature 0.4`, `maxOutputTokens 1024`. History sanitized by `sanitizeHistory` (max 16 turns, must start with `user`, strict alternation, must not end on `user`, truncates each to 1500 chars).
- Response: Tries `sendMessageStream` → `text/plain` chunked write with `Cache-Control: no-cache`. If streaming fails (proxy/Docker blocks), falls back to `sendMessage` → JSON `{success, reply}`. Never leaks key/error details (generic “Gagal mendapatkan respons daripada AI.”).

### 6.7 Mongoose schemas

- **`Student.js`**: All String except `Semester Number`, `academicHistory [{semester Number, gpa String, cgpa String, attendance String}]`, `uploadedCertificates [{name, issuer, fileName, filePath, uploadDate}]`, `profileImage String`, plus `No_KP, No_Telefon, Alamat` with default `''`. Note: CGPA/PLO stored as String in DB (from MDB), parsed to Number in `normaliseStudent`.
- **`User.js`**: `email unique required`, `password required (bcrypt hashed)`, `role enum admin/user default user`, `displayName`, `studentId default null`.
- **`MdbFile.js`**: `datasetName required (admin label e.g. Intake July 2026)`, `originalName`, `filePath (absolute disk path)`, `fileSize bytes`, `status enum Saved/Processing/Processed/Failed default Saved`, `recordsProcessed default 0`, `uploadDate`, `processedDate`.

### 6.8 Scripts, seeds, tests

- **`seed.js`**: Connects `MONGO_URI` (default `mongodb://localhost:27017/tvetmara_db`), reads `./db/data_tvet_muktamad.json`, upserts each student + student User (default hashed `password123`), plus `admin@ikmb.edu.my` and `user@ikmb.edu.my`. Uses `$set` so existing certificates/profile images are NOT deleted. Run: `npm run seed` or `node seed.js` from `backend/`.
- **`seed-admin.js`**: Only upserts the two demo accounts (useful for fresh DB without student data).
- **`repredict-status.js`**: Loads all Students, chunks payloads of 500, POSTs to ML `/predict/batch`, `bulkWrite`s `Status_Pelajar`, logs counts. Run with `ML_API_URL` + `MONGO_URI` env set.
- **`__tests__/auth.test.js`**: Mocks `auth.model.js`, tests login 200 with token + 401 on bad password. **`items.test.js`**: Tests 401 without/invalid token. Run: `npm test` from `backend/` (Jest ESM with `cross-env NODE_ENV=test node --experimental-vm-modules`).
- **`package.json` scripts**: `start: node server.js`, `dev: nodemon`, `seed: node seed.js`, `start:prod: node server.js` (used in compose `sleep 5 && npm run start:prod`), `test: jest`.

---

## 7. ML Service — `ML/` Deep Dive (FastAPI)

```
ML/
├── ml.py                         # FastAPI app: / , /predict/risk, /predict/batch, /etl/process-mdb
├── requirements.txt              # fastapi, uvicorn, sklearn, joblib, pandas, numpy, httpx, pytest, etc.
├── test_ml.py                    # 3 pytest tests: health, valid predict, invalid 422
├── train_and_evaluate.py         # V1 training on ml_training_data_real.csv → v4 pkl
├── train_and_evaluate_v4.py      # V4 training with GroupShuffleSplit + GridSearchCV
├── model_ai_risiko_lengkap_v3.pkl # Older model artifact
├── model_ai_risiko_lengkap_v4.pkl # Active model (loaded by ml.py)
├── Containerfile                 # Python 3.9-slim + mdbtools + uvicorn ml:app :8000
└── __pycache__/ .pytest_cache/   # (generated)
```

### 7.1 `ml.py` endpoints

- **`MODEL_PATH = "model_ai_risiko_lengkap_v4.pkl"`**, loaded via `joblib.load` at startup. If fails, `risk_model = None` and all predict routes return 500.
- **`GET /`** → `{"status":"AI Server V4 is running"}` (health check).
- **`POST /predict/risk`** input `StudentFeatures {CGPA, Attendance, PLO_1..9, Sijil}`. Computes `plo_avg = mean`, `plo_variance = var`, builds DataFrame with columns `CGPA, Avg_Subjek_Attendance (=Attendance), PLO_1..9, PLO_Avg, PLO_Variance`, reorders to `model.feature_names_in_` if present, `model.predict()` → `{"success", "prediction": "Bermasalah|Sederhana|Cemerlang"}`. Note: `Sijil` is accepted but NOT used as model feature (kept for API compatibility).
- **`POST /predict/batch`** input `{students: StudentFeatures[]}` → same feature engineering per row → returns `{"success", "predictions": [...]}`. Used by backend ETL and `repredict-status.js`.
- **`POST /etl/process-mdb`** input multipart `file (.mdb)` → saves to temp file → `process_mdb_data(tempPath)` → returns `{"success", "data": [...]}` → deletes temp file. Rejects non-`.mdb` with 400.

### 7.2 ETL logic (`process_mdb_data`)

Uses `mdb-tables` + `mdb-export` subprocess + `csv.DictReader`. Expected tables:

1. **`GPA`**: Reads `No_Pelajar, Sem_Pelajar, CGPA, GPA`. Keeps latest semester per student as base record (`CGPA` formatted `:.2f`, defaults for attendance/PLO/status). Also builds `history_map[No_Pelajar] = [{semester, gpa, cgpa}]` for `academicHistory`.
2. **`Pelajar`**: Fills `Nama_Pelajar → Nama`, `Kod_Kursus_Pelajar` (strip `*` whitespace) → `Kursus`, `NoKP_Pelajar → No_KP`, `No_Telefon`, combines `Alamat_Pelajar + Poskod_Pelajar + Bandar_Pelajar → Alamat`.
3. **`Daftar_Subjek`**: Averages `Kehadiran` per student → `Kehadiran_Pct` (rounded int string). Also per-(student,semester) attendance to fill each `academicHistory[].attendance` (only values >0). Skips unrecorded subjects.
4. **`Detail_Result`**: Parses `Kod_Ujian` with regex `LO(\d+)` → PLO index. **Auto-exclusion**: if any row for a `Kod_Subjek` references `LO>9` (e.g. DUA20102 LO11 uses internal CLO scheme), that entire subject is excluded from PLO mapping. Remaining LO 1-9 marks averaged per PLO → string int, else `"0"`.
5. **`Anugerah`**: If `No_Pelajar` present → `Anugerah=True`.
6. **`Pelajar_Koko_Detail`**: If `Result==='LULUS'` → `Koko_Lulus=True`.
7. Finalize: deletes temp keys, sorts `academicHistory` by semester, returns list. Logs counts at each step + `inspect_mdb()` prints tables/headers/sample row for debugging new MDB files.

### 7.3 Training scripts

- **`train_and_evaluate.py` (V1)**: Loads `../backend/db/ml_training_data_real.csv`, fills CGPA median, PLO NaN→0, engineers `PLO_Avg` + `PLO_Variance`, features `[CGPA, Avg_Subjek_Attendance + PLO_1..9 + PLO_Avg + PLO_Variance]`, label `Status_Pelajar`, train_test_split 80/20 (stratified unless minority <2), GridSearchCV RandomForest (`n_estimators [100,200,300], max_depth [None,10,20], min_samples_split [2,5,10], class_weight [balanced,None]`, cv=5, f1_weighted), prints accuracy/report/matrix, saves `model_ai_risiko_lengkap_v4.pkl`.
- **`train_and_evaluate_v4.py`**: Same but from 3-semester data, handles `No_Pelajar` as string, attendance NaN→80, uses `GroupShuffleSplit` if same student appears multiple times (prevents leakage, logs train/test student counts), adaptive `cv` (5 if minority≥5, 3 if ≥2, else 2), same grid, saves `model_ai_risiko_lengkap_v4.pkl`.
- **`prepare_ml_data_3mdb.py`** (in `backend/db/`): Extracts `pelajar, Daftar_Subjek, GPA, Detail_Result, Anugerah` from `JJ2025.mdb, JD2025.mdb, JJ2026.mdb` via `mdb-export` to `mdb_extracted/<source>/`, aggregates subject features, latest CGPA, award flag, PLO pivot (with same LO>9 exclusion), merges, generates rule-based label `generate_real_label` (Option 2: `Bermasalah` if CGPA<3.00 OR score<70 OR failed>0 OR dropped>0 OR attendance<80; `Cemerlang` only if CGPA≥3.90 + attendance≥80 + all active PLO≥80; else `Sederhana`), backs up old CSV with timestamp, writes `ml_training_data_real.csv`, logs label/source distributions.
- **`test_ml.py`**: `test_health_check` (GET / → 200 + V4 status), `test_predict_risk_valid_data` (CGPA 3.9 all PLO 95 → 200 + prediction in 3 classes), `test_predict_risk_invalid_data` (missing PLO → 422). Run: `pytest test_ml.py` from `ML/`.

---

## 8. Authentication & Authorization Matrix

| Route / API | No login | Student (`user`) | Admin |
|---|---|---|---|
| `/` (login) | Allowed | Redirect to `/student-dashboard` | Redirect to `/staff-dashboard` |
| `/student-dashboard` | Redirect `/` | Allowed | Redirect `/staff-dashboard` |
| `/staff-dashboard`, `/student-profile` | Redirect `/` | Redirect `/student-dashboard` | Allowed |
| `POST /api/auth/login` | Allowed | Allowed | Allowed |
| `GET /api/auth/users` | 401 | 403 | Allowed |
| `GET /api/students` | 401 | Own record only (`[student]`) | All |
| `POST/PUT/DELETE /api/students` | 401 | 403 | Allowed |
| `GET /api/students/:id`, `/skill-gap` | 401 | Only if `studentId===own` | Allowed |
| Certificates / profile-image | 401 | Only own | Allowed (any) |
| `POST /api/predict/manual`, MDB routes, `/api/ai/chat` | 401 | 403 | Allowed |

JWT: signed with `JWT_SECRET`, payload `{email, role, studentId}`, expiry `8h`. Stored in `ikmbToken` cookie + sent as `Bearer`. Frontend Server Action sets cookies; middleware reads `user` cookie for redirects; backend verifies `ikmbToken` for API.

---

## 9. Domain Knowledge (Official TVETMARA Grounding)

These are hardcoded in **both** backend (`items.js:TVET_KNOWLEDGE`) and frontend (`StudentDashboardClient.jsx`):

**Course codes:**

- `ITW`: Diploma Kimpalan (welding)
- `DFK`: Diploma Komputasi Awan / Teknologi Komputer (Cloud Computing)
- `DGA`: Diploma Automotif / Teknologi Automotif
- `SLR`: Sijil Lukisan Rekabentuk / Teknologi Kejuruteraan Mekanikal (Lukisan Rekabentuk)
- `DCG`: Diploma Elektrik Industri / Kompetensi Elektrik (Industri)
- `SED`: Sijil Elektrik Domestik / Teknologi Kejuruteraan Elektrik (Domestik dan Industri)
- `PPU`: Diploma Penyejukan Udara / Teknologi Penyejukan dan Penyamanan Udara

**Career mapping (frontend `careerMapping`, backend grounding must match):**

- ITW → Juruteknik Kimpalan 6G @ Sapuran Energy (95%), Welding Inspector @ SGS Malaysia (88%)
- DFK → Cloud Engineer @ AWS Malaysia (94%), DevOps Engineer @ Maxis (85%)
- DGA → Service Advisor @ Perodua (92%), Diagnostic Tech @ Tan Chong (88%)
- SLR → CAD Drafter @ Dyson (96%), Design Engineer @ Proton (89%)
- DCG → Chargeman A0 @ TNB (94%), Industrial Electrician @ Intel (89%)
- SED → Wireman PW4 @ Kontraktor Berdaftar (91%), Maintenance @ Panasonic (87%)
- PPU → HVAC Technician @ Daikin (93%), ACMV Supervisor @ Bina Puri (86%)

**PLO 1-9 + recommended courses:**

- PLO 1 Pengetahuan & Komunikasi → Kursus Komunikasi Efektif / Professional Soft Skills: Communication
- PLO 2 Kognitif & Pengaturcaraan → Bengkel Pengaturcaraan Praktikal
- PLO 3 Praktikal & Keselamatan → Latihan Keselamatan Industri (OSH)
- PLO 4 Interpersonal & Pengurusan → Kursus Pengurusan Masa & Projek / Pengurusan Projek
- PLO 5 Komunikasi & Inovasi → Bengkel Inovasi & Reka Bentuk Produk / Inovasi Produk
- PLO 6 Digital & Teknikal → Latihan Penyelesaian Kerosakan Motor/Elektrik / Kerosakan Motor
- PLO 7 Kepimpinan & Keusahawanan → Kursus Keusahawanan & Pemasaran Digital / Keusahawanan Digital
- PLO 8 Pembangunan Diri & Etika → Bengkel Etika Kerja & Kepimpinan / Etika & Kepimpinan
- PLO 9 Kemahiran Keusahawanan & Integriti → Latihan Integriti & Tanggungjawab Profesional / Integriti Profesional

Target each PLO = `80%`. ≥80 Selamat, 60-79 Perlu Peningkatan, <60 Kritikal, 0 = not yet recorded.

**Risk:** Tinggi = at-risk (attendance<80 or CGPA<2.0 or AI Bermasalah), Sederhana = needs monitoring, Rendah = good/excellent (CGPA≥3.5 or AI Cemerlang).

**Certifications recognized:** Tiada, CompTIA, Cisco CCNA, AWS Cloud. Scores: 35/70/85/90.

**IKMB interventions:** Klinik Akademik, Kaunseling Kehadiran, Latihan Kemahiran Insaniah (Soft Skills), Program Mentor-Mentee.

**Employability formulas (`heuristics.js`):** General `(CGPA/4)*40 + Attendance*0.6`; Top performer `(CGPA/4)*60 + Attendance*0.4`.

---

## 10. Testing & CI

- **Frontend**: `npm test` → `vitest run src/__tests__` (jsdom). Currently 1 test file (`Login.test.jsx`). Build: `npm run build` with `BACKEND_URL=http://backend:5000` in CI.
- **Backend**: `npm test` from `backend/` → Jest + Supertest, ESM mode, `NODE_ENV=test` skips Mongo connect. Tests auth login + student 401 guards.
- **ML**: `pytest test_ml.py` from `ML/` → 3 tests (see 7.3). Requires `mdbtools` installed in CI (`sudo apt-get install -y mdbtools`).
- **CI file `.github/workflows/ci.yml`**: 4 jobs — `frontend`, `backend`, `ml-service` run in parallel on push/PR to main/master (Node 20, Python 3.9), `docker-build` needs all three and builds `tvet-frontend`, `tvet-backend`, `tvet-ml-api` images. No push to registry, build-only verification.
- **Manual verification**: `ML_TEST_RESULTS.md` records all 3 ML tests passed.

---

## 11. How to Run (Beginner Steps)

### A. With Docker (recommended, matches production)

```bash
# From repo root:
docker compose -f compose.yml up --build
# Or with podman:
# podman compose up --build
```

Then open:

- Frontend: `http://localhost:8080` (login with admin@ikmb.edu.my / password123)
- Backend API: `http://localhost:5000/api/health`
- Swagger docs: `http://localhost:5000/api/docs`
- ML API: `http://localhost:8000/` (should return AI Server V4 is running)

Seed data (first time, in another terminal):

```bash
cd backend
npm install
# Set MONGO_URI=mongodb://localhost:27017/ikmb-dashboard in .env or env var
node seed-admin.js   # only admin accounts
# OR
node seed.js         # full students from db/data_tvet_muktamad.json
```

### B. Local dev without Docker (3 terminals)

1. Start MongoDB locally on `27017`.
2. Terminal 1 — ML: `cd ML && pip install -r requirements.txt && uvicorn ml:app --host 0.0.0.0 --port 8000`
3. Terminal 2 — Backend: `cd backend && npm install && npm run dev` (needs `.env` with `MONGO_URI`, `JWT_SECRET`, `ML_API_URL=http://127.0.0.1:8000`, `GEMINI_API_KEY`, `PORT=5000`)
4. Terminal 3 — Frontend: `npm install && npm run dev` (needs `.env.local` with `BACKEND_URL=http://127.0.0.1:5000`), open `http://localhost:3000`.

### C. MDB upload flow (admin UI)

1. Login as admin → tab `Pengurusan Data`.
2. Enter dataset name (e.g. “Pengambilan Julai 2026”) + choose `.mdb` file → `Simpan Fail` (status `Saved`).
3. Click play icon on the row → confirm → backend ETL + AI batch runs (status `Processing` → `Processed` with record count). Polling refreshes every 3s.
4. Student list auto-refreshes. New student logins work immediately with default `password123`.

---

## 12. Full File Tree (excluding generated `node_modules`, `.next`, `mongodb_data`)

```
.
├── backend/
│   ├── __tests__/auth.test.js, items.test.js
│   ├── db/data_tvet_muktamad.json, inspect_mdb_linux.py, mdb_extracted/,
│   │   prepare_ml_data_3mdb.py, relabel_option2.py, sedut_mdb_tulen.py
│   ├── middleware/authMiddleware.js
│   ├── models/MdbFile.js, Student.js, User.js
│   ├── uploads/certificates/ (public), uploads/mdb/ (private)
│   ├── auth.js, auth.model.js, item.model.js, items.js, server.js
│   ├── seed.js, seed-admin.js, repredict-status.js
│   ├── .env, .env.example, babel.config.json, Containerfile.backend, package.json
├── ML/
│   ├── ml.py, requirements.txt, test_ml.py
│   ├── train_and_evaluate.py, train_and_evaluate_v4.py
│   ├── model_ai_risiko_lengkap_v3.pkl, model_ai_risiko_lengkap_v4.pkl
│   └── Containerfile
├── src/
│   ├── app/actions.js, globals.css, layout.jsx, page.jsx
│   │   staff-dashboard/page.jsx, student-dashboard/page.jsx, student-profile/page.jsx
│   ├── components/auth/LoginForm.jsx, Sidebar.jsx, KpiCard.jsx, StudentModal.jsx,
│   │   StudentListGrid.jsx, JobCard.jsx, dashboard/StaffDashboardClient.jsx,
│   │   dashboard/StudentDashboardClient.jsx, dashboard/StudentProfileClient.jsx
│   ├── lib/auth.js, client-auth.js, heuristics.js
│   └── __tests__/Login.test.jsx
├── public/logo-tvetmara.jpg, vite.svg
├── .github/workflows/ci.yml
├── compose.yml, Containerfile.frontend, middleware.js, next.config.mjs
├── package.json, jsconfig.json, tailwind.config.js, postcss.config.js,
│   vitest.config.js, .eslintrc.json, .env.local, .dockerignore
├── ML_TEST_RESULTS.md, DETAIL.md (this file), logo-tvetmara.jpg
└── dist/ (legacy Vite output, ignore)
```

---

## 13. Common Pitfalls for New Readers

1. **Two `BACKEND_URL`s**: Frontend Server Actions use `process.env.BACKEND_URL` (`http://backend:5000` in Docker, `http://127.0.0.1:5000` locally). Backend calls ML via `ML_API_URL` (`http://ml-api:8000` in Docker). Mixing them breaks Docker networking.
2. **Cookies are non-httpOnly**: Intentional so `client-auth.js` can read them, but means XSS would expose tokens — hence strict input sanitization + rate limiting on AI routes.
3. **CGPA/PLO stored as String in Mongo**: Always `parseFloat` before math (see `normaliseStudent`). Direct numeric comparison on raw DB values will fail.
4. **`Status_Pelajar` vs `dropoutRisk`**: DB stores `Bermasalah/Sederhana/Cemerlang/Pending AI`; frontend displays `Tinggi/Sedang/Rendah/Pending`. Mapping lives in `item.model.js`.
5. **PLO 0 means “not recorded”**, not “failed”. UI shows special warning, AI prompt says to state data incomplete.
6. **MDB `LO>9` exclusion**: Subjects like DUA20102 use internal CLO numbering — must NOT count as PLO. Both `ML/ml.py` and `prepare_ml_data_3mdb.py` implement this; removing it skews PLO averages.
7. **`middleware.js` matcher**: Excludes `api` and static assets. Forgetting this causes infinite redirect loops on API calls.
8. **`redirect()` must be outside try/catch** in `actions.js` — Next.js implements redirects via thrown exception.
9. **Only `uploads/certificates` is static**: `uploads/mdb` must stay private; exposing it would leak raw student databases.
10. **Stuck `Processing` files**: `server.js` auto-resets them to `Saved` on boot. If ETL crashes mid-run, restart backend then re-process.

---

*Last modified: 2026-09-28 09:26:32 +08*
