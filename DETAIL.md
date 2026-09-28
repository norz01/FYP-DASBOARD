# DETAIL.md — TVETMARA Besut Skills Talent Development Dashboard

> A complete, beginner-friendly technical reference for this repository.
> Read this file first if you have never seen this project before.

---

## 1. What Is This Project?

**TVETMARA Besut Skills Talent Development Dashboard** is a Final Year Project (FYP) smart dashboard system for **IKMB / TVETMARA Besut**.

It is used to:

1. **Monitor** student academic performance (CGPA, GPA trend, attendance, PLO 1–9, awards, co-curriculum).
2. **Predict** student dropout risk / performance category using a real AI model (`Bermasalah` / `Sederhana` / `Cemerlang` mapped to `Tinggi` / `Sederhana` / `Rendah`).
3. **Analyze** skills gaps at institute level (average PLO vs 80% target).
4. **Recommend** learning pathways, career matches, and courses.
5. **Manage** students (CRUD), certificates, profile images, and Microsoft Access (`.mdb`) database uploads with ETL processing.
6. **Support two roles**: Staff/Admin and Student/User with strict access control.

The UI language is primarily **Bahasa Melayu (ms)**.

---

## 2. High-Level Architecture (4 Docker Services)

```
Browser (port 8080)
   |
   v
+----------------+   rewrites /api/*, /uploads/*   +----------------+   HTTP   +----------------+
| Frontend       |  ---------------------------->  | Backend        |  --------> | ML API         |
| Next.js 15 SSR |                                 | Express 5 API  |            | FastAPI +      |
| port 3000      |                                 | port 5000      |            | scikit-learn   |
| (host: 8080)   |                                 |                |            | port 8000      |
+----------------+                                 +----------------+            +----------------+
                                                            |
                                                            v
                                                     +----------------+
                                                     | MongoDB        |
                                                     | port 27017     |
                                                     | db: ikmb-      |
                                                     | dashboard      |
                                                     +----------------+
```

All four services are defined in `compose.yml` on a shared bridge network called `tvet_net`:

| Service | Image / Build | Container Name | Host Port -> Container Port | Key Environment Variables |
|---|---|---|---|---|
| `mongodb` | `docker.io/mongo:latest` | `tvet_mongodb` | `27017:27017` | — (volume `./mongodb_data:/data/db`) |
| `backend` | `./backend/Containerfile.backend` | `tvet_backend` | `5000:5000` | `NODE_ENV=development`, `JWT_SECRET=super_secret_fyp_key_2026`, `MONGO_URI=mongodb://mongodb:27017/ikmb-dashboard`, `ML_API_URL=http://ml-api:8000` |
| `ml-api` | `./ML/Containerfile` | `tvet_ml_api` | `8000:8000` | — (model file baked into image) |
| `frontend` | `./Containerfile.frontend` | `tvet_frontend` | `8080:3000` | `BACKEND_URL=http://backend:5000`, `NODE_ENV=production` |

Request flow details:

- Browser talks only to Frontend (`:8080`).
- `next.config.mjs` rewrites `/api/:path*` to `http://backend:5000/api/:path*` and `/uploads/:path*` to `http://backend:5000/uploads/:path*`. This hides the backend URL from the browser.
- Server Components / Server Actions use `process.env.BACKEND_URL` (`http://backend:5000` in Docker, `http://127.0.0.1:5000` in local `.env.local`).
- Client Components use relative `/api/...` URLs (which get rewritten) plus a `Bearer <JWT>` header from the `ikmbToken` cookie.
- Backend talks to ML API via `ML_API_URL` (`http://ml-api:8000` in Docker, `http://127.0.0.1:8000` or `http://tvet_ml_api:8000` locally).
- Backend talks to MongoDB via `MONGO_URI`.

---

## 3. Technology Stack

### 3.1 Frontend (`/` root)

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js `15.1.6`, React `19`, `react-dom` 19 | SSR, App Router, Server Actions, `output: 'standalone'` for Docker |
| Styling | Tailwind CSS `3.4.19`, PostCSS, Autoprefixer | Config in `tailwind.config.js`, `postcss.config.js` |
| Font | `Plus Jakarta Sans` via `next/font/google` | Loaded in `src/app/layout.jsx` |
| Icons | Phosphor Icons via CDN `https://unpkg.com/@phosphor-icons/web` | Loaded with `<Script strategy="beforeInteractive">`, used as `<i class="ph ...">` |
| Charts | `chart.js` 4 + `react-chartjs-2` 5 | Bar (staff PLO), Radar (student skill-gap), Bar+Line combo (profile trend) |
| Auth | Cookies `user` + `ikmbToken`, Server Actions, `middleware.js` | No NextAuth; custom JWT flow |
| Path alias | `@/*` -> `./src/*` | Defined in `jsconfig.json` and `vitest.config.js` |
| Testing | Vitest 4 + jsdom + Testing Library | `npm test` runs `vitest run src/__tests__` |
| Lint | ESLint 9 + `eslint-config-next` | `react/no-unescaped-entities` off, `@next/next/no-img-element` off |

### 3.2 Backend (`/backend/`)

| Layer | Technology | Notes |
|---|---|---|
| Runtime | Node 20 Alpine | ESM `"type": "module"` |
| Framework | Express `5.2.1` | Routers in `auth.js` + `items.js` |
| Database ODM | Mongoose `9.3.3` | Models: `Student`, `User`, `MdbFile` |
| Auth | `jsonwebtoken` 9 + `bcryptjs` 3 | JWT `8h` expiry, bcrypt hashed passwords |
| Uploads | `multer` 2 | Certificates/images (5 MB, jpg/png/pdf) + `.mdb` (100 MB) |
| Docs | `swagger-jsdoc` 6 + `swagger-ui-express` 5 | Served at `/api/docs` |
| Config | `dotenv` 17 | Loads `backend/.env` |
| Dev / Test | `nodemon`, `jest` 30, `supertest` 7, `cross-env`, `@babel/preset-env` | `npm test` runs Jest with ESM support |
| Container | `Containerfile.backend` | `node:20-alpine`, `npm install --production`, `CMD ["node","server.js"]` |

### 3.3 ML Service (`/ML/`)

| Layer | Technology | Notes |
|---|---|---|
| Framework | FastAPI + Uvicorn | `ml.py` defines `app` |
| ML | scikit-learn `RandomForestClassifier`, `joblib`, `pandas`, `numpy` | Model files `.pkl` |
| Validation | Pydantic `BaseModel` | `StudentFeatures`, `BatchPredictRequest` |
| ETL | `mdbtools` (`mdb-tables`, `mdb-export`) + `subprocess` + `csv` | Parses `.mdb` tables on Linux |
| Testing | `pytest`, `pytest-asyncio`, `httpx`, `python-multipart` | `pytest test_ml.py` |
| Container | `ML/Containerfile` | `python:3.9-slim`, installs `mdbtools`, `CMD ["uvicorn","ml:app",...]` |

### 3.4 Database

- **Runtime DB**: MongoDB (`ikmb-dashboard` database in Docker; `ikmb-dashboard` or `tvetmara_db` locally depending on `.env`).
- **Source data**: Legacy Microsoft Access `.mdb` files in `backend/db/` (`JJ2025.mdb`, `JD2025.mdb`, `JJ2026.mdb`).
- **Extracted CSVs**: `backend/db/mdb_extracted/{JJ2025,JD2025,JJ2026}/{pelajar,Daftar_Subjek,GPA,Detail_Result,Anugerah}.csv`.
- **Training CSV**: `backend/db/ml_training_data_real.csv` (+ timestamped backups).
- **Seed JSON**: `backend/db/data_tvet_muktamad.json`.

---

## 4. Repository Root Files (What Each File Does)

| File | Purpose |
|---|---|
| `package.json` | Frontend deps + scripts: `dev` (`next dev`), `build`, `start`, `lint`, `test` (`vitest run src/__tests__`). Description in Malay explains SSR smart dashboard with AI analytics. |
| `next.config.mjs` | `output: 'standalone'` + `rewrites()` for `/api/*` and `/uploads/*` to backend service. |
| `middleware.js` | Edge middleware. Reads `user` cookie (JSON), enforces login redirect + role-based access. Matcher excludes `api`, `_next/static`, `_next/image`, `favicon.ico`, `assets`. See Section 6. |
| `jsconfig.json` | `@/*` alias to `./src/*`. |
| `tailwind.config.js` | Scans `src/app/**` + `src/components/**`, adds `Plus Jakarta Sans` as default sans. |
| `postcss.config.js` | Enables `tailwindcss` + `autoprefixer`. |
| `vitest.config.js` | jsdom environment, includes `src/**/*.{test,spec}.{js,jsx}`, `@` alias, `globals: true`. |
| `.eslintrc.json` | Extends `next/core-web-vitals`, disables two noisy rules. |
| `.env.local` | Local frontend env: `BACKEND_URL=http://127.0.0.1:5000`. |
| `compose.yml` | Defines 4 services (see Section 2). Backend command `sh -c "sleep 5 && npm run start:prod"` waits for Mongo. |
| `Containerfile.frontend` | 3-stage build: `deps` (npm install) -> `builder` (npm run build) -> `runner` (non-root `nextjs` user, copies `.next/standalone` + `.next/static` + `public`, `CMD ["node","server.js"]`, port 3000). |
| `.dockerignore` | Excludes `node_modules`, `dist`, `ML`, `.git`, `.env`, `*.tar`, helper scripts from frontend image. |
| `.gitignore` | Excludes `.env`, `node_modules/`, `dist/`, `mongodb_data/`, large `.mdb`/JSON files, logs, editor files. |
| `ML_TEST_RESULTS.md` | Short record: v3/v4 model files present, 3 ML tests passed. |
| `logo-tvetmara.jpg` | Logo source (also copied to `public/logo-tvetmara.jpg`). |
| `public/logo-tvetmara.jpg`, `public/vite.svg` | Static assets served by Next.js. |
| `.github/workflows/ci.yml` | CI pipeline (see Section 12). |
| `DETAIL.md` | This file. |

---

## 5. Frontend Deep Dive (`src/`)

### 5.1 Directory Tree

```
src/
  app/
    layout.jsx            # Root layout, font, metadata, Phosphor CDN
    page.jsx              # Login page (force-dynamic), renders LoginForm
    actions.js            # Server Actions: loginAction, logoutAction
    globals.css           # Tailwind directives + fadeIn keyframes
    staff-dashboard/page.jsx    # Thin wrapper -> StaffDashboardClient (force-dynamic)
    student-dashboard/page.jsx  # Thin wrapper -> StudentDashboardClient (force-dynamic)
    student-profile/page.jsx    # Reads ?id= from searchParams -> StudentProfileClient
  components/
    auth/LoginForm.jsx
    Sidebar.jsx
    KpiCard.jsx
    JobCard.jsx
    StudentModal.jsx
    StudentListGrid.jsx
    dashboard/
      StaffDashboardClient.jsx   # ~953 lines, 6 tabs
      StudentDashboardClient.jsx # ~939 lines, 4 tabs
      StudentProfileClient.jsx   # ~538 lines, 3 tabs
  lib/
    auth.js         # Server helpers: getStoredUser, getToken, getDashboardPathForRole
    client-auth.js  # Client helpers: getClientUser, getClientToken (parses document.cookie)
    heuristics.js   # Employability formulas
  assets/react.svg
  __tests__/Login.test.jsx
```

### 5.2 Routes (App Router)

| URL | File | Access | Description |
|---|---|---|---|
| `/` or `/login` | `src/app/page.jsx` + `LoginForm.jsx` | Public (logged-in users get redirected away) | Split-screen login: left AI marketing panel, right email+password form using React 19 `useActionState(loginAction)`. Prefilled `admin@ikmb.edu.my` / `password123`. |
| `/staff-dashboard` | `staff-dashboard/page.jsx` -> `StaffDashboardClient` | `admin` only | 6 tabs (see 5.4). |
| `/student-dashboard` | `student-dashboard/page.jsx` -> `StudentDashboardClient` | `user` only | 4 tabs (see 5.5). |
| `/student-profile?id=XXX` | `student-profile/page.jsx` -> `StudentProfileClient` | `admin` only | Detailed single-student view, defaults to `TVET001` if no `?id=`. |

All three dashboard pages export `dynamic = 'force-dynamic'` so they never try to read cookies at build time.

### 5.3 Auth Plumbing (Frontend Side)

- `src/app/actions.js`:
  - `loginAction(prevState, formData)`: POSTs `{email,password}` to `${BACKEND_URL}/api/auth/login`, parses JSON, sets two non-`httpOnly` cookies (`user` = JSON stringified user object, `ikmbToken` = JWT, both `maxAge: 86400`, `secure` only in production), then calls `redirect()` **outside** try/catch (required — otherwise Next.js treats redirect as error). Returns `{error: ...}` on failure.
  - `logoutAction()`: deletes both cookies, redirects to `/`.
- `src/lib/auth.js` (server): `getStoredUser()`, `getToken()` read cookies via `next/headers` with defensive `?.get()` checks; `getDashboardPathForRole(role)` maps `admin` -> `/staff-dashboard`, else `/student-dashboard`.
- `src/lib/client-auth.js` (client, `"use client"`): `getClientUser()` and `getClientToken()` parse `document.cookie` manually, return `null` on server or on JSON parse failure.
- `middleware.js`: full logic — parse `user` cookie, if on login page and already logged in redirect to role dashboard; if on protected route and no user redirect to `/`; if `staff-dashboard` or `student-profile` but role != `admin` redirect to `/student-dashboard`; if `student-dashboard` but role != `user` redirect to `/staff-dashboard`.

### 5.4 Staff Dashboard (`StaffDashboardClient.jsx`)

State: `user`, `students`, `isLoading`, `activeTab`, `isSidebarOpen`, `searchTerm`, modal state (`isModalOpen`, `editingStudent`, `formData`), manual prediction state (`manualPredict` with cgpa/attendance/plo1-9/certification + `manualResult`), MDB state (`mdbFile`, `datasetName`, `mdbFiles`, `processingId`, `uploadMsg`, `isUploading`, `isLoadingFiles`, `deletingId`).

On mount: reads user + token from cookies, `GET /api/students` and `GET /api/data/mdb-files`. Live-polls `mdb-files` every 3 seconds while any file has `status === "Processing"` or `processingId !== null`.

Six tabs (`navItems`):

1. **`overview`** — 3 `KpiCard`s (total students, average employability %, high-risk count), Bar chart PLO averages vs 80% target, high-risk list (top 5, click -> profile), top performers (top 5 by CGPA, shows `calculateTopPerformerScore`).
2. **`prediction`** — Manual AI form (CGPA, attendance, cert select, 9 PLO inputs) -> `POST /api/predict/manual` -> colored result badge (`Rendah`=green, `Sederhana`=yellow, else red).
3. **`skills`** — Table of 9 PLOs with average, gap (`max(80-avg,0)`), status (`Selamat` >=80, `Perlu Peningkatan` >=60, else `Kritikal`).
4. **`pathways`** — Cards for each PLO with gap > 0, sorted by gap desc, mapped via `pathwayMappings` (e.g. PLO 1 -> Komunikasi Efektif).
5. **`management`** — Reuses `StudentListGrid` (search + course filter chips + card grid, click -> `/student-profile?id=`).
6. **`data` (Pengurusan Data TVET)** — Upload section (dataset name + `.mdb` file -> `POST /api/data/upload-mdb` with `FormData`, includes raw-text debug logging), archive table (dataset name, original name, size MB, upload date ms-MY locale, status badge `Saved`/`Processing`/`Processed`/`Failed`, process + delete buttons with `window.confirm`).

CRUD helpers: `openAddModal`, `openEditModal` (maps `dropoutRisk` Rendah/Tinggi -> Cemerlang/Bermasalah), `handleSubmit` (POST or PUT `/api/students`), `handleDelete` (DELETE), `runManualPrediction`, `handleMdbUpload`, `handleProcessMdb` (POST `/api/data/process-mdb/:id`, refreshes students), `handleDeleteMdb` (DELETE `/api/data/mdb-files/:id`).

### 5.5 Student Dashboard (`StudentDashboardClient.jsx`)

State: `user`, `students` (filtered to own `studentId` if role=user with studentId), `selectedStudentId`, `skillGap`, `customCerts`, `newCert`, `selectedFile`, `isUploadingCert`, `activeTab`, `isSidebarOpen`, `isLoading`.

On mount: fetches `/api/students`, restricts visibility for students, auto-selects first student. On `selectedStudentId` change: fetches `/api/students/:id/skill-gap` and `/api/students/:id` (for `uploadedCertificates`).

Static maps: `careerMapping` (2 jobs per course code ITW/DFK/DGA/SLR/DCG/SED/PPU with title/company/match%/icon), `courseMappings` (PLO 1–9 -> recommended course title/desc/colors), `getFullCourseName()`.

Four tabs:

1. **`dashboard`** — Welcome header + risk badge, 3 stat cards (employability via `calculateEmployability`, attendance, CGPA), Radar chart (student vs target 80), AI insight box, top-career dark card with button to career tab.
2. **`profile` (Kemaskini Sijil Saya)** — Profile image upload (`POST .../profile-image`), read-only name/ID/course fields, add-certificate form (name+issuer+file -> `POST .../certificates`), certificate grid with delete (`DELETE .../certificates/:certId`).
3. **`career`** — `JobCard` grid for student's course.
4. **`courses`** — Personalized course card for weakest PLO + static AWS card.

### 5.6 Student Profile (`StudentProfileClient.jsx`, admin-only)

Fetches `/api/students/:id/skill-gap` once. Shows breadcrumb back to staff dashboard, left card (TVETMARA header, `StatusBadge`, avatar initial, ID, course full name, semester, cert, attendance, Edit/Print/Download buttons), right panel with 3 sub-tabs:

- `personal`: email (`<id>@student.ikmb.edu.my`), phone, IC, address.
- `academic`: CGPA bar (red <2.5, amber <3.5, emerald >=3.5), combined Bar+Line chart (GPA line left axis max 4, attendance bar right axis max 100).
- `skills`: AI employability gradient card, Radar PLO chart with `DATA PLO BELUM LENGKAP` warning if any score is 0, 3 intervention cards (Kaunseling Kehadiran, Klinik Akademik, Soft Skills) with alert buttons.

Download button exports JSON (`studentDetails`, `academicHistory`, `aiInsight`, `employabilityScore`, `ploScores`) as `Profil_Pelajar_<id>.json`. Print button calls `window.print()`.

### 5.7 Reusable Components

- `Sidebar.jsx`: fixed/responsive sidebar (`w-64`, slide-in on mobile), logo via `next/image`, `navItems` buttons with active highlight, footer user card (initials avatar, displayName, Penyelaras/Pelajar label, logout button).
- `KpiCard.jsx`: title, value (or `-` while loading), icon, subtitle, progress bar (`barWidth%`).
- `JobCard.jsx`: icon box, match badge, title, company, `Mohon Sekarang` button.
- `StudentModal.jsx`: add/edit student modal (ID disabled when editing), fields ID/Nama/CGPA/Kehadiran/Sijil/Kursus/Status, closes on Escape key or backdrop click via `modalRef`.
- `StudentListGrid.jsx`: search by name/ID + course filter chips (`Semua, ITW, DFK, DGA, SLR, DCG, SED, PPU`), card grid with semester badge, avatar initial, full course name map, ID + CGPA footer, empty state.

### 5.8 Frontend Business Logic (`heuristics.js`)

```js
calculateEmployability(cgpa, attendance) = min(100, round((cgpa/4)*40 + attendance*0.6))
calculateTopPerformerScore(cgpa, attendance) = min(100, round((cgpa/4)*60 + attendance*0.4))
```

`StudentProfileClient` duplicates the employability formula inline.

### 5.9 Frontend Test

- `src/__tests__/Login.test.jsx`: mocks `next/navigation`, `next/script`, `@/app/actions`, renders `LoginForm`, asserts heading `Selamat Kembali`, email + password labels, and submit button exist.

---

## 6. Middleware (`middleware.js`)

Runs on every non-API/static route. Pseudocode:

```
user = JSON.parse(cookies.get('user')) or null
if pathname is '/' or '/login':
  if user: redirect to /staff-dashboard (admin) or /student-dashboard (user)
  else: next()
else:
  if !user: redirect to '/'
  if pathname starts with /staff-dashboard or /student-profile and role != admin:
    redirect to /student-dashboard
  if pathname starts with /student-dashboard and role != user:
    redirect to /staff-dashboard
  else: next()
```

Defensive: wraps JSON parse in try/catch, uses `cookies?.get?.()`.

---

## 7. Backend Deep Dive (`backend/`)

### 7.1 Files

```
backend/
  server.js                 # Express app, Swagger, Mongo connect, routers, error handler
  auth.js                   # Router: POST /api/auth/login, GET /api/auth/users (admin)
  items.js                  # Router: students CRUD, skill-gap, certs, profile image,
                            #         manual predict, MDB upload/list/process/delete
  auth.model.js             # readLoginDatabase, sanitiseUser, authenticateUser (bcrypt+jwt)
  item.model.js             # normaliseStudent, getRealAIPrediction, skill-gap builders, CRUD ops
  models/Student.js         # Mongoose schema (ID_Pelajar, Nama, Kursus, PLO_1..9, etc.)
  models/User.js            # Mongoose schema (email, password hashed, role, displayName, studentId)
  models/MdbFile.js         # Mongoose schema (datasetName, originalName, filePath, fileSize,
                            #                 status Saved|Processing|Processed|Failed, counts, dates)
  middleware/authMiddleware.js  # verifyToken, requireAdmin, requireOwnershipOrAdmin
  seed.js                   # Upsert students from db/data_tvet_muktamad.json + admin/user demo accounts
  seed-admin.js             # Upsert only admin@ikmb.edu.my + user@ikmb.edu.my
  repredict-status.js       # Batch re-predict all Status_Pelajar via ML /predict/batch (chunks of 500)
  .env / .env.example       # PORT, MONGO_URI, JWT_SECRET, ML_API_URL
  babel.config.json         # @babel/preset-env for Jest ESM
  Containerfile.backend     # node:20-alpine production image
  db/                       # .mdb files, extracted CSVs, training CSV, python ETL helpers
  uploads/mdb/ + uploads/certificates/  # Runtime upload storage (mounted as volume for mdb)
  __tests__/auth.test.js + items.test.js
```

### 7.2 Server (`server.js`)

- `cors()`, `express.json()`, static serve only for `/uploads/certificates` (`.mdb` files stay private).
- Swagger at `/api/docs` scanning `auth.js` + `items.js`.
- Mongo connect (skipped when `NODE_ENV=test`); on connect, recovers stuck files: `updateMany({status:"Processing"}, {status:"Saved"})`.
- `GET /api/health` -> `{status:"ok", source:"mongodb-database"}`.
- Mounts `authRouter` at `/api/auth`, `itemsRouter` at `/api`.
- Global error handler returns `{message, stack}` with status 500.
- Listens on `PORT` (default 5000) unless in test mode. Exports `app` for Supertest.

### 7.3 Auth (`auth.js` + `auth.model.js` + `authMiddleware.js`)

- `POST /api/auth/login`: requires email+password (400 if missing), calls `authenticateUser()`, 401 if null, else `{message:"Login berjaya.", user, token}`. 500 on exception.
- `GET /api/auth/users`: `verifyToken` + `requireAdmin`, returns sanitized users (no passwords).
- `authenticateUser()`: loads all `User` docs, lowercases email match, `bcrypt.compare(password, hash)`, signs JWT `{email, role, studentId}` with `process.env.JWT_SECRET`, `expiresIn: '8h'`.
- `verifyToken`: requires `Authorization: Bearer <token>`, verifies with `JWT_SECRET` or fallback `super_secret_fyp_key_2026`, sets `req.user`, 401 on missing/invalid (with console logs for debugging).
- `requireAdmin`: 403 unless `req.user.role === "admin"`.
- `requireOwnershipOrAdmin`: passes if admin OR `req.user.studentId === req.params.studentId`, else 403.

### 7.4 Student + File Endpoints (`items.js`)

All require `verifyToken`; admin-only or ownership-checked as noted.

| Method | Path | Guard | Description |
|---|---|---|---|
| `GET` | `/api/students` | token | Students see only `[ownStudent]` (or `[]`); admins see all via `getAllStudents()`. |
| `POST` | `/api/students` | admin | `createStudent(req.body)` -> 201. |
| `PUT` | `/api/students/:studentId` | admin | `updateStudent()` -> 404 if missing. |
| `DELETE` | `/api/students/:studentId` | admin | `deleteStudent()`. |
| `GET` | `/api/students/:studentId` | ownership-or-admin | Single normalized student or 404. |
| `GET` | `/api/students/:studentId/skill-gap` | ownership-or-admin | Live AI risk + chart + insight (see 7.5). |
| `POST` | `/api/students/:studentId/certificates` | ownership-or-admin + multer | Fields `name`, `issuer`, `file` (5 MB jpg/png/pdf). Pushes `{name, issuer, fileName, filePath: /uploads/certificates/...}` to `uploadedCertificates`. 201. Auth runs **before** multer to avoid unauthenticated disk writes. |
| `DELETE` | `/api/students/:studentId/certificates/:certId` | ownership-or-admin | Removes subdocument + deletes physical file if exists. |
| `POST` | `/api/students/:studentId/profile-image` | ownership-or-admin + multer | Saves image to same certificates folder, sets `Student.profileImage`. |
| `POST` | `/api/predict/manual` | admin | Forwards body to `getRealAIPrediction()` -> `{success:true, prediction}`. |
| `POST` | `/api/data/upload-mdb` | admin + mdbUpload | Requires `file` (.mdb, 100 MB) + `datasetName` (deletes file from disk if name missing). Creates `MdbFile` with `status:'Saved'`. 201. |
| `GET` | `/api/data/mdb-files` | admin | Lists all `MdbFile` sorted by `uploadDate` desc. |
| `POST` | `/api/data/process-mdb/:id` | admin | 409 if already Processing, 404 if record/file missing, else runs `executeEtlAndSync()` and returns record count. |
| `DELETE` | `/api/data/mdb-files/:id` | admin | 409 if Processing; deletes physical file only if resolved path is inside `uploads/` (path-traversal guard), then deletes DB record. |

Multer error handler at router end maps `MulterError` to 400 and other errors to 500.

### 7.5 Normalization + AI Logic (`item.model.js`)

`normaliseStudent(record)` maps raw Mongo fields to frontend shape:

- `id` <- `ID_Pelajar`, `nama`, `kursus`, `semester`, `attendance` (number), `cgpa` (number), `anugerah`, `kokoLulus`, `plo1..plo9` (numbers), `certification` + `certificationScore` (Tiada:35, CompTIA:70, Cisco CCNA:85, AWS Cloud:90, default 50), `uploadedCertificates`, `profileImage`, `academicHistory` (numbers), `noKP`, `noTelefon`, `alamat`.
- `dropoutRisk` mapping: `Bermasalah`->`Tinggi`, `Sederhana`->`Sederhana`, `Cemerlang`->`Rendah`, `Pending AI`->`Pending`, then overrides: if `attendance<80` or `cgpa<2.0` -> `Tinggi`; else if `Bermasalah` (even with high CGPA) stays `Tinggi`; else if `cgpa>=3.5` or `Cemerlang` -> `Rendah`.

`getRealAIPrediction(features)`: POSTs to `${ML_API_URL}/predict/risk` with `{CGPA, Attendance, PLO_1..9, Sijil}`, maps response `Bermasalah/Sederhana/Cemerlang` to `Tinggi/Sederhana/Rendah`, falls back to rule-based (`<80` or `<2.0` -> Tinggi, `>=3.5` -> Rendah, else Sederhana) if ML unreachable.

`getStudentSkillGapById(id)`: loads normalized student, overwrites `dropoutRisk` with live AI prediction, builds 9 metrics (value + target 80), returns `{student, chart:{labels,current,target}, insight:{weakestSkill,message}}`. Insight handles `value===0` (not yet recorded) specially.

CRUD: `createStudent`, `updateStudent` (`findOneAndUpdate` with validators), `deleteStudent`, `getAllStudents`, `getStudentById`.

### 7.6 ETL + Sync (`executeEtlAndSync` in `items.js`)

Triggered by `POST /api/data/process-mdb/:id`:

1. Set `MdbFile.status='Processing'`.
2. Read file from disk, POST as multipart to `${ML_API_URL}/etl/process-mdb`, expect `{data: students[]}`.
3. If students found, build batch payload (`CGPA`, `Attendance`, `PLO_1..9`, `Sijil`) and POST to `${ML_API_URL}/predict/batch`; on success overwrite each `Status_Pelajar` with prediction. Warns but continues if AI unreachable.
4. Sync to Mongo: delete students whose `ID_Pelajar` not in new list, then `bulkWrite` upserts for `Student` (all academic + PLO + history fields) and `User` (email `<ID>@student.ikmb.edu.my`, default hashed `password123`, role `user`).
5. Set `status='Processed'`, `recordsProcessed`, `processedDate`. On error set `status='Failed'` and rethrow.

### 7.7 Mongoose Schemas

- `Student`: all-String academic fields (`ID_Pelajar`, `Nama`, `Kursus`, `Kehadiran_Pct`, `CGPA`, `Sijil_Profesional`, `PLO_1..9`, `Status_Pelajar`), `Semester` Number, `No_KP/No_Telefon/Alamat` (default `''`), `academicHistory[{semester,gpa,cgpa,attendance}]`, `uploadedCertificates[{name,issuer,fileName,filePath,uploadDate}]`, `profileImage` String.
- `User`: `email` unique required, `password` required (hashed), `role` enum `admin|user` default `user`, `displayName`, `studentId` default null.
- `MdbFile`: `datasetName`, `originalName`, `filePath`, `fileSize`, `status` enum `Saved|Processing|Processed|Failed` default `Saved`, `recordsProcessed` default 0, `uploadDate` default now, `processedDate`.

### 7.8 Scripts

- `npm start` / `start:prod`: `node server.js`.
- `npm run dev`: `nodemon server.js`.
- `npm run seed`: `node seed.js` — upserts students from `db/data_tvet_muktamad.json` + demo `admin@ikmb.edu.my` (admin) and `user@ikmb.edu.my` (user), all password `password123` (bcrypt hashed). Uses `$set` + `upsert:true` so existing certificates/profile images are preserved.
- `seed-admin.js`: upserts only the two demo accounts.
- `node repredict-status.js`: loads all students, chunks into 500s, calls ML batch predict, `bulkWrite`s new `Status_Pelajar`, logs counts. Env: `ML_API_URL`, `MONGO_URI`.
- `npm test`: `cross-env NODE_ENV=test node --experimental-vm-modules node_modules/jest/bin/jest.js --forceExit`.

### 7.9 Backend Tests

- `__tests__/auth.test.js`: mocks `auth.model.js`, imports app dynamically, tests successful admin login (200 + token + role) and wrong password (401).
- `__tests__/items.test.js`: asserts `GET /api/students` without token is blocked and with invalid token is 401 (note: file expects 403 for missing token, reflecting middleware behavior at time of writing).

---

## 8. ML Service Deep Dive (`ML/`)

### 8.1 Files

```
ML/
  ml.py                          # FastAPI app: predict + ETL endpoints
  requirements.txt               # fastapi, uvicorn, scikit-learn, joblib, pydantic,
                                 # pandas, numpy, httpx, pytest, pytest-asyncio, python-multipart
  Containerfile                  # python:3.9-slim + mdbtools + uvicorn
  model_ai_risiko_lengkap_v3.pkl # Older trained model (kept for reference)
  model_ai_risiko_lengkap_v4.pkl # Active model loaded by ml.py
  train_and_evaluate.py          # Original training script (GridSearchCV, cv=5)
  train_and_evaluate_v4.py       # Updated training: GroupShuffleSplit, adaptive cv folds
  test_ml.py                     # 3 pytest tests
```

### 8.2 API (`ml.py`, title `TVETMARA AI Prediction API V4`)

Loads `model_ai_risiko_lengkap_v4.pkl` at startup (`risk_model = None` on failure, endpoints return 500).

| Method | Path | Input | Output |
|---|---|---|---|
| `GET` | `/` | — | `{"status":"AI Server V4 is running"}` (health check used by tests). |
| `POST` | `/predict/risk` | `StudentFeatures{CGPA, Attendance, PLO_1..9, Sijil}` | Computes `PLO_Avg` (mean) + `PLO_Variance` (variance), builds DataFrame with exact training columns (`CGPA`, `Avg_Subjek_Attendance`, `PLO_1..9`, `PLO_Avg`, `PLO_Variance`), reorders to `model.feature_names_in_` if present, returns `{success, prediction, raw_output}`. 400 on error. |
| `POST` | `/predict/batch` | `{students: StudentFeatures[]}` | Same per-row engineering, single `predict()` call, returns `{success, predictions[]}`. 400 on error. |
| `POST` | `/etl/process-mdb` | Multipart `file` (must end `.mdb`) | Saves to temp file, runs `process_mdb_data()`, returns `{success, data[]}`. 400 if not `.mdb`, 500 on ETL error. Deletes temp file in `finally`. |

Note: `Sijil` is accepted but not used as a model feature (model uses only numeric CGPA/attendance/PLO columns + engineered avg/variance).

### 8.3 ETL Logic (`process_mdb_data`)

Uses `mdb-tables -1` and `mdb-export` via `subprocess`:

1. `inspect_mdb()`: logs tables + headers + sample row for every table (debug).
2. `GPA` table: keeps latest semester per `No_Pelajar` (fields `ID_Pelajar`, `Semester`, `CGPA`, defaults; initializes `PLO_Scores`, `academicHistory` via `history_map`).
3. `Pelajar` (case-insensitive `pelajar`): fills `Nama`, `Kursus` (stripped of `*`), `No_KP`, `No_Telefon`, combined `Alamat` (`Alamat, Poskod Bandar`).
4. `Daftar_Subjek`: averages `Kehadiran` per student (overall) and per (student, semester) for `academicHistory`; filters zero-attendance rows for semester mapping.
5. `Detail_Result`: regex `LO(\d+)` from `Kod_Ujian`; **auto-excludes** any `Kod_Subjek` that ever references `LO>9` (internal CLO scheme, e.g. `DUA20102`), then averages marks per PLO 1–9; missing -> `"0"`.
6. `Anugerah`: sets `Anugerah=True` if student appears.
7. `Pelajar_Koko_Detail`: sets `Koko_Lulus=True` if `Result=='LULUS'`.
8. Finalizes: sorts `academicHistory` by semester, returns list for Mongo sync.

Expected MDB tables: `GPA`, `Pelajar`/`pelajar`, `Daftar_Subjek`, `Detail_Result`, `Anugerah`, optionally `Pelajar_Koko_Detail`.

### 8.4 Training

- **Dataset**: `backend/db/ml_training_data_real.csv` built by `backend/db/prepare_ml_data_3mdb.py` from 3 MDBs (`JJ2025`, `JD2025`, `JJ2026`). That script extracts required tables via `mdb-export`, aggregates PLO/subject/GPA/award features, and generates rule-based labels (`generate_real_label`, Option 2): `Bermasalah` if CGPA<3.00 OR score<70 OR failed>0 OR dropped>0 OR attendance<80; `Cemerlang` only if CGPA>=3.90 AND attendance>=80 AND all recorded PLOs>=80; else `Sederhana`. Backs up old CSV with timestamp before overwrite.
- **Other DB helpers**: `sedut_mdb_tulen.py`, `inspect_mdb_linux.py`, `relabel_option2.py` (relabeling), `ml_training_data_real_before_option2_*.csv` (pre-relabel snapshot).
- **`train_and_evaluate.py`**: loads CSV, median/0 imputation, `PLO_Avg`/`PLO_Variance` engineering, 80/20 split (stratified unless minority class <2), `GridSearchCV` RandomForest (`n_estimators` 100/200/300, `max_depth` None/10/20, `min_samples_split` 2/5/10, `class_weight` balanced/None, `cv=5`, `f1_weighted`), prints accuracy/report/matrix, saves `model_ai_risiko_lengkap_v4.pkl`.
- **`train_and_evaluate_v4.py`**: same but group-aware — if `No_Pelajar` repeats and >3 unique students, uses `GroupShuffleSplit` (no student leakage between train/test); adaptive CV folds (5 if minority>=5, 3 if >=2, else 2); logs train/test student counts and label distributions.
- **Relabel/maintenance**: `relabel_option2.py` + `repredict-status.js` keep DB labels in sync with latest model.

### 8.5 ML Tests (`test_ml.py`, summarized in `ML_TEST_RESULTS.md`)

1. `test_health_check`: `GET /` is 200 with V4 status string.
2. `test_predict_risk_valid_data`: high CGPA/PLO payload returns 200 with prediction in `Cemerlang/Sederhana/Bermasalah`.
3. `test_predict_risk_invalid_data`: payload missing PLOs returns 422.

---

## 9. Data Reference

### 9.1 Course Codes

| Code | Full Name (varies slightly by component) |
|---|---|
| ITW | Diploma Kimpalan / Kompetensi Kimpalan |
| DFK | Diploma Teknologi Komputer / Komputasi Awan / Cloud Computing |
| DGA | Diploma Automotif / Teknologi Automotif |
| SLR | Sijil Lukisan Rekabentuk / Teknologi Kejuruteraan Mekanikal (Lukisan Rekabentuk) |
| DCG | Diploma Elektrik Industri / Kompetensi Elektrik (Industri) / Elektrik (PW4) |
| SED | Sijil Elektrik Domestik / Teknologi Kejuruteraan Elektrik (Domestik dan Industri) |
| PPU | Diploma Penyejukan & Udara / Penyamanan Udara / Teknologi Penyejukan dan Penyamanan Udara |

### 9.2 Risk / Status Mapping

- ML model outputs: `Cemerlang`, `Sederhana`, `Bermasalah`.
- Backend/frontend risk: `Rendah` (good), `Sederhana`, `Tinggi` (at-risk).
- Mapping: `Cemerlang`->`Rendah`, `Sederhana`->`Sederhana`, `Bermasalah`->`Tinggi`, `Pending AI`->`Pending` (initial ETL default before batch prediction).
- Rule overrides in `normaliseStudent`: attendance<80 or CGPA<2.0 forces `Tinggi`; CGPA>=3.5 forces `Rendah` (unless AI said `Bermasalah`).

### 9.3 Demo Accounts

All passwords are `password123` (bcrypt-hashed in DB):

| Email | Role | `studentId` | Access |
|---|---|---|---|
| `admin@ikmb.edu.my` | `admin` | null | Staff dashboard + all student profiles + MDB management |
| `user@ikmb.edu.my` | `user` | null | Student dashboard (sees all students in current code path since no studentId filter; selector shown) |
| `<ID_Pelajar>@student.ikmb.edu.my` | `user` | `<ID>` | Student dashboard restricted to own record only |

### 9.4 Environment Variables

| File | Variables |
|---|---|
| `.env.local` (frontend local) | `BACKEND_URL=http://127.0.0.1:5000` |
| `backend/.env` (local) | `PORT=5000`, `MONGO_URI=mongodb://127.0.0.1:27017/ikmb-dashboard`, `JWT_SECRET=super_secret_tvetmara_fyp_key_2026`, `ML_API_URL=http://tvet_ml_api:8000` |
| `backend/.env.example` | Template with `PORT=5001`, placeholder secret |
| `compose.yml` (Docker, overrides `.env`) | Backend: `JWT_SECRET=super_secret_fyp_key_2026`, `MONGO_URI=mongodb://mongodb:27017/ikmb-dashboard`, `ML_API_URL=http://ml-api:8000`; Frontend: `BACKEND_URL=http://backend:5000` |

> Security note: JWT secrets are hardcoded in `compose.yml` and `backend/.env` for FYP convenience. Rotate them before any production use. `user` and `ikmbToken` cookies are readable via JavaScript (`httpOnly: false`) so client components can attach the token; this is intentional but weaker than httpOnly cookies.

---

## 10. How to Run

### 10.1 Docker (recommended, matches production)

```bash
podman-compose up --build -d
# or: docker compose up --build -d
```

Then open:

- Frontend: `http://localhost:8080` (login with `admin@ikmb.edu.my` / `password123`)
- Backend docs: `http://localhost:5000/api/docs`
- ML docs (FastAPI auto-docs): `http://localhost:8000/docs`
- MongoDB: `localhost:27017`

Seed demo data (inside backend container or locally with correct `MONGO_URI`):

```bash
npm --prefix backend run seed        # full student seed + demo accounts
node backend/seed-admin.js           # demo accounts only
node backend/repredict-status.js     # refresh AI Status_Pelajar after model change
```

### 10.2 Local Development (without Docker)

Terminal 1 — MongoDB must be running locally.

Terminal 2 — Backend:

```bash
npm --prefix backend install
npm --prefix backend run dev   # nodemon on :5000
```

Terminal 3 — ML API (Python 3.9, needs `mdbtools` on Linux for ETL):

```bash
pip install -r ML/requirements.txt
uvicorn ml:app --host 0.0.0.0 --port 8000 --reload --app-dir ML
# pytest ML/test_ml.py  (ML tests)
```

Terminal 4 — Frontend:

```bash
npm install
npm run dev    # Next.js on :3000, BACKEND_URL from .env.local
```

### 10.3 Tests + CI

```bash
npm test              # frontend Vitest
npm --prefix backend test   # backend Jest + Supertest
pytest ML/test_ml.py  # ML pytest (from ML/ directory)
```

CI (`.github/workflows/ci.yml`) runs 4 jobs on push/PR to `main`/`master`: `frontend` (install+vitest+build), `backend` (install+jest), `ml-service` (py3.9 + mdbtools + pytest), `docker-build` (builds all 3 images, needs all tests green).

---

## 11. Key Workflows (End to End)

1. **Login**: `LoginForm` -> `loginAction` -> `POST backend /api/auth/login` -> bcrypt check -> JWT + user JSON -> cookies set -> `redirect()` -> `middleware.js` enforces role route.
2. **Staff views overview**: `StaffDashboardClient` mounts -> `GET /api/students` (Bearer) -> computes KPIs, PLO chart, risk lists locally.
3. **Staff manual prediction**: fills CGPA/attendance/PLOs -> `POST /api/predict/manual` -> backend `getRealAIPrediction` -> `POST ml-api /predict/risk` -> mapped risk shown.
4. **Staff MDB ingest**: enters dataset name + picks `.mdb` -> `POST /api/data/upload-mdb` (Saved) -> clicks process -> `POST /api/data/process-mdb/:id` -> backend fetches ML `/etl/process-mdb` -> ML batch `/predict/batch` -> Mongo `bulkWrite` students+users -> status `Processed`. Frontend polls every 3s during processing.
5. **Student skill-gap**: `StudentDashboardClient` -> `GET /api/students/:id/skill-gap` -> backend live AI predict + chart + insight -> Radar + career/course recommendations.
6. **Student uploads cert/image**: multipart POST with ownership check -> multer saves under `uploads/certificates/` -> Mongo reference; served publicly via `/uploads/certificates/*` (proxied through Next.js rewrites).
7. **Admin deep-dive**: clicks student card -> `/student-profile?id=` -> `GET skill-gap` -> personal/academic/skills tabs, print or JSON download.

---

## 12. File Inventory (Complete)

<details>
<summary>Click to expand full file list by area</summary>

- **Root**: `package.json`, `package-lock.json`, `next.config.mjs`, `middleware.js`, `jsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `vitest.config.js`, `.eslintrc.json`, `.env.local`, `.gitignore`, `.dockerignore`, `compose.yml`, `Containerfile.frontend`, `ML_TEST_RESULTS.md`, `DETAIL.md` (this file), `logo-tvetmara.jpg`, `public/`, `src/`, `backend/`, `ML/`, `.github/`, `.next/`, `dist/`, `mongodb_data/`, `node_modules/`.
- **Frontend**: `src/app/{layout,page,actions,globals}.jsx/js/css`, `src/app/{staff-dashboard,student-dashboard,student-profile}/page.jsx`, `src/components/{Sidebar,KpiCard,JobCard,StudentModal,StudentListGrid}.jsx`, `src/components/auth/LoginForm.jsx`, `src/components/dashboard/{StaffDashboardClient,StudentDashboardClient,StudentProfileClient}.jsx`, `src/lib/{auth,client-auth,heuristics}.js`, `src/__tests__/Login.test.jsx`, `src/assets/react.svg`.
- **Backend code**: `server.js`, `auth.js`, `items.js`, `auth.model.js`, `item.model.js`, `models/{Student,User,MdbFile}.js`, `middleware/authMiddleware.js`, `seed.js`, `seed-admin.js`, `repredict-status.js`, `package.json`, `babel.config.json`, `Containerfile.backend`, `.env`, `.env.example`, `__tests__/{auth,items}.test.js`.
- **Backend data**: `db/{JJ2025,JD2025,JJ2026}.mdb`, `db/data_tvet_muktamad.json`, `db/ml_training_data_real.csv` (+ `..._before_option2_*.csv` snapshot), `db/mdb_extracted/{JJ2025,JD2025,JJ2026}/*.csv`, `db/{prepare_ml_data_3mdb,sedut_mdb_tulen,inspect_mdb_linux,relabel_option2}.py`, `uploads/mdb/`, `uploads/certificates/`.
- **ML**: `ml.py`, `requirements.txt`, `Containerfile`, `model_ai_risiko_lengkap_{v3,v4}.pkl`, `train_and_evaluate.py`, `train_and_evaluate_v4.py`, `test_ml.py`.
- **CI**: `.github/workflows/ci.yml`.

</details>

---

## 13. Common Pitfalls for New Developers

- `redirect()` in `actions.js` must stay **outside** try/catch, otherwise Next.js swallows it as an error.
- Dashboard pages must stay `force-dynamic`; otherwise the build tries to read cookies and fails.
- `user` cookie is JSON — any manual edit breaks `JSON.parse`; middleware safely falls back to `null`.
- Backend `JWT_SECRET` differs between `compose.yml` (`super_secret_fyp_key_2026`) and `backend/.env` (`super_secret_tvetmara_fyp_key_2026`). Tokens issued in one environment do not verify in the other.
- ML `/predict/batch` expects exact field names (`CGPA`, `Attendance`, `PLO_1..9`, `Sijil`); backend maps lowercase frontend fields accordingly.
- `Detail_Result` rows with `LO>9` are excluded by subject — this is intentional (internal CLO numbering), not a bug.
- `Student` schema stores numbers as Strings (e.g. `CGPA: "3.50"`); always `parseFloat`/`Number()` before math (all call sites already do this).
- Deleting an `MdbFile` never deletes already-synced students (by design; confirmation dialogs state this).
- `mongodb_data/` is a bind-mounted live database directory — do not commit it (already gitignored).

---

Last modified: 2026-09-24 03:38:41 UTC
