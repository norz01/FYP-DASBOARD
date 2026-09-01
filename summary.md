# TVETMARA Besut Skills & Talent Development Dashboard — Complete Project Summary

> Read top to bottom. Each section explains one layer of the system. No prior knowledge needed.
> Verified against source code on 2026-09-01.

---

## 1. What This Project Is (The Big Picture)

Full-stack web application built as a **Final Year Project (FYP)**. Malay name: **"Papan Pemuka Pintar"** (Smart Dashboard). Purpose: help staff and students of **IKMB (Institut Kemahiran MARA Besut)** — a Malaysian technical/vocational (TVET) college under MARA — do 3 things:

1. **MONITOR** — track student academic performance: CGPA (cumulative GPA), attendance %, and 9 PLO (Programme Learning Outcome) skill scores.
2. **PREDICT** — use a Machine Learning model (Random Forest classifier in Python) to classify each student into 3 status categories: `Cemerlang` (excellent), `Sederhana` (moderate), `Bermasalah` (problematic/at-risk).
3. **DEVELOP** — show skills-gap analysis (which PLO is weakest vs an 80% institutional target), personalized learning-pathway suggestions, and career recommendations per course.

**UI language: Bahasa Melayu.** Data source: real student records exported from the institute's legacy **Microsoft Access database** (`Ekspot_Senat.mdb`, ~11.7 MB, from the senate-export system). Python ETL scripts (using the `mdbtools` system package) convert it into MongoDB documents.

**Analytics maturity model implemented:**
1. *Descriptive* ("What happened?") — PLO averages, attendance, CGPA charts.
2. *Diagnostic* ("Why?") — AI insight messages naming the weakest skill + gap size.
3. *Predictive* ("What will happen?") — ML dropout-risk classification.
4. *Prescriptive* ("What to do?") — workshop/course/intervention recommendations.

---

## 2. High-Level Architecture

Four services, orchestrated by Docker/Podman Compose (`compose.yml`) on one bridge network `tvet_net`:

```
┌───────────┐   proxy /api,/uploads  ┌──────────┐   HTTP :8000  ┌───────────┐
│ FRONTEND  │ ─────────────────────> │ BACKEND  │ ────────────> │  ML API   │
│ React 19  │                        │ Express  │               │  FastAPI  │
│ + Nginx   │ <───────────────────── │ :5000    │ <──────────── │  (Python) │
│ :8080→80  │                        └────┬─────┘               └───────────┘
└───────────┘                             │ Mongoose ODM
                                     ┌─────▼──────┐
                                     │  MongoDB   │  DB name: ikmb-dashboard
                                     │  :27017    │  volume: ./mongodb_data
                                     └────────────┘
```

| Service | Tech stack | Port | Role |
|---|---|---|---|
| `frontend` | React 19, Vite 7, Tailwind CSS 3, Chart.js 4 (react-chartjs-2), React Router 7, Phosphor Icons; served by Nginx | host 8080 → container 80 | SPA UI. Nginx serves built static files, SPA fallback to `index.html`, proxies `/api/` and `/uploads/` to backend. |
| `backend` | Node 20, Express 5, Mongoose 9, JWT (jsonwebtoken), bcryptjs, Multer 2, Swagger UI | 5000 | REST API: auth (login/JWT), student CRUD, certificate/profile-image uploads, relays MDB uploads to ML service, Swagger docs. |
| `ml-api` | Python 3.9, FastAPI, scikit-learn, pandas, numpy, joblib, mdbtools (system package) | 8000 | AI prediction endpoint `/predict/risk` + ETL endpoint `/etl/process-mdb` (extracts Access DB). |
| `mongodb` | `mongo:latest` | 27017 | Stores 2 collections: `students`, `users`. Data persisted to host folder `./mongodb_data` (with SELinux `:Z` flag). |

---

## 3. Repository Directory Map

```
/
├── src/                          # FRONTEND React source
│   ├── main.jsx                  # React entry (StrictMode)
│   ├── App.jsx                   # Router + role-based route guards
│   ├── index.css                 # Tailwind directives + Google Font import
│   ├── App.css                   # leftover Vite template CSS (unused)
│   ├── pages/
│   │   ├── Login.jsx             # split-screen login page
│   │   ├── StaffDashboard.jsx    # admin dashboard, 6 tabs
│   │   ├── StudentDashboard.jsx  # student dashboard, 4 tabs
│   │   └── StudentProfile.jsx    # admin drill-down of one student
│   ├── components/
│   │   ├── Sidebar.jsx           # shared nav sidebar
│   │   ├── KpiCard.jsx           # KPI stat card
│   │   ├── StudentModal.jsx      # add/edit student form modal
│   │   ├── StudentListGrid.jsx   # searchable/filterable student card grid
│   │   └── JobCard.jsx           # career match card
│   ├── utils/auth.js             # localStorage session helpers
│   └── __tests__/Login.test.jsx  # Vitest frontend test
├── backend/                      # BACKEND Express API (own package.json)
│   ├── server.js                 # app bootstrap, Swagger, Mongo connect
│   ├── auth.js                   # /api/auth routes (login, users)
│   ├── auth.model.js             # bcrypt compare + JWT signing
│   ├── items.js                  # /api student/data/predict routes (JWT-protected)
│   ├── item.model.js             # business logic: normalize, AI call, insight
│   ├── middleware/authMiddleware.js  # verifyToken JWT guard
│   ├── models/Student.js         # Mongoose student schema
│   ├── models/User.js            # Mongoose user schema
│   ├── seed.js                   # DB seeder (upsert from JSON)
│   ├── seed-admin.js             # legacy admin seeder
│   ├── .env / .env.example       # PORT, MONGO_URI, JWT_SECRET
│   ├── Containerfile.backend     # node:20-alpine image
│   ├── babel.config.json         # for Jest ESM transforms
│   ├── __tests__/                # Jest + Supertest tests (auth, items)
│   └── db/                       # data files + Python ETL scripts
│       ├── Ekspot_Senat.mdb      # source MS Access database
│       ├── sedut_mdb_tulen.py    # main offline extractor → JSON
│       ├── extract_history.py    # patch academicHistory into JSON
│       ├── ekstrak_mdb.py        # pyodbc extractor (Windows-oriented, legacy)
│       ├── prepare_ml_data.py    # build ML training CSV
│       ├── data_tvet_muktamad.json  # final student records (currently "[]")
│       ├── data_tvet.json        # older 553-record dummy dataset
│       ├── login_users.json      # legacy plaintext users (unused)
│       └── *.csv                 # intermediate table dumps + training CSV
├── ML/                           # PYTHON ML microservice
│   ├── ml.py                     # FastAPI app (predict + ETL)
│   ├── train_and_evaluate.py     # RandomForest training + GridSearchCV
│   ├── test_ml.py                # pytest API tests
│   ├── requirements.txt
│   ├── Containerfile             # python:3.9-slim + mdbtools
│   └── *.pkl                     # trained models (v3 active)
├── public/                       # static assets (logo-tvetmara.jpg, vite.svg)
├── mongodb_data/                 # Mongo volume (gitignored)
├── compose.yml                   # 4-service orchestration
├── Containerfile.frontend        # 2-stage: node build → nginx serve
├── nginx.conf                    # SPA fallback + proxy + 100MB upload
├── inspect_mdb_linux.py          # standalone MDB schema dump utility
├── package.json / vite.config.js / tailwind.config.js / postcss.config.js
├── eslint.config.js
├── index.html                    # loads Phosphor Icons CDN
└── .github/workflows/ci.yml      # CI: test all 3 services → build images
```

Note: `README.md` and `AGENTS.md` exist in git history (committed) but are currently deleted in the working tree.

---

## 4. Frontend — React SPA (root package)

**Dependencies (root `package.json`):** react 19, react-dom 19, react-router-dom 7, chart.js 4 + react-chartjs-2. Dev: vite 7, tailwind 3 + postcss + autoprefixer, vitest 4 + Testing Library, eslint 9. Scripts: `dev`, `build`, `lint`, `preview`, `test` (vitest run).

### 4.1 Routing & Auth Guard — `src/App.jsx`

- `BrowserRouter` with 4 routes:
  - `/` → Login page. If already logged in (user in localStorage), redirect to role's dashboard.
  - `/staff-dashboard` → **admin only** (StaffDashboard).
  - `/student-dashboard` → **user (student) only** (StudentDashboard).
  - `/student-profile?id=X` → **admin only** (StudentProfile drill-down).
- `ProtectedRoute` wrapper: reads `getStoredUser()`; no user → `/`; wrong role → own dashboard.
- App subscribes to custom window event `authChange` (fired by auth utils on login/logout) so it re-renders on session change.

### 4.2 Session Utils — `src/utils/auth.js`

- localStorage keys: `ikmbCurrentUser` (user object: email/role/displayName/studentId), `ikmbToken` (JWT).
- `storeUser()` / `clearStoredUser()` dispatch `authChange` event.
- `getDashboardPathForRole(role)`: `admin` → `/staff-dashboard`, anything else → `/student-dashboard`.

### 4.3 Pages

**`Login.jsx`** — split-screen (blue AI-themed hero left with Unsplash image, form right). Pre-filled demo credentials `admin@ikmb.edu.my` / `password123`. On submit: POST `/api/auth/login` → stores user + token → navigates by role. Shows inline error on failure. Helper text explains default accounts (`admin@ikmb.edu.my`, `user@ikmb.edu.my`, students `ikm001@student.ikmb.edu.my` format, all passwords `password123`).

**`StaffDashboard.jsx`** (admin) — 6 sidebar tabs:
1. **Dashboard Overview** — 3 KPI cards (total active students, average employability %, high-risk count), bar chart of institute-average PLO 1–9 vs 80% target, top-5 high-risk list (red cards, reason shown: low attendance or low CGPA), top-5 performers list (yellow cards with a score using a *different* formula: `(cgpa/4)*60 + attendance*0.4`). Clicking a student → `/student-profile?id=X`.
2. **AI Prediction** — manual input form (CGPA, attendance, 9 PLO scores, certification dropdown) → POST `/api/predict/manual` → colored result badge (Rendah=green / Sederhana=yellow / Tinggi=red).
3. **Skills Gap Analysis** — table of per-PLO institute average, gap to 80% target, status badge: `Selamat` (≥80), `Perlu Peningkatan` (60–79), `Kritikal` (<60).
4. **Learning Pathways** — cards mapping weakest PLOs to intervention courses (hardcoded `pathwayMappings`, e.g. PLO 1 → "Kursus Komunikasi Efektif"), sorted by gap size descending.
5. **Student Management** — `StudentListGrid` (search box + course filter chips Semua/ITW/DFK/DGA/SLR/DCG/SED/PPU + card grid) + `StudentModal` for add (POST `/api/students`) and edit (PUT). Page reloads after save (`window.location.reload()`). Note: `handleDelete` still exists in this file but the management tab UI does not expose a delete button anymore (grid cards only navigate to profile).
6. **Pengurusan Data** — click `.mdb` file picker → POST multipart to `/api/data/upload-mdb` → backend relays to ML ETL → MongoDB refreshed → success message → page auto-reloads after 2s.

Employability formula (client-side heuristic, repeated in several places): `min(100, round((cgpa/4)*40 + attendance*0.6))`. High-risk definition (client): `dropoutRisk==="Tinggi"` OR attendance<80 OR cgpa<2.0.

**`StudentDashboard.jsx`** (student) — 4 tabs. If logged-in user has `role=user` + `studentId`, list is filtered to only that student (`isRestrictedUser`).
1. **Profil & Prestasi** — greeting with displayName, risk badge (Tinggi red / Sederhana yellow / else green "Good Standing"), 3 stat cards (employability %, attendance %, latest CGPA), **radar chart** of own 9 PLO scores vs 80% target (data from `/students/:id/skill-gap` which includes live AI prediction), yellow "CADANGAN AI" insight box, dark card with top-2 career previews per course.
2. **Kemaskuni Sijil Saya** — upload profile image (POST `students/:id/profile-image`), add certificate: name + issuer + file PDF/PNG/JPG ≤5MB (POST `students/:id/certificates`), grid list of own certificates with delete (DELETE `students/:id/certificates/:certId`). Certificates open in new tab via `/uploads/...` URL.
3. **Padanan Kerjaya (AI)** — `JobCard` grid from hardcoded `careerMapping` keyed by course code (ITW/DFK/DGA/SLR/DCG/SED/PPU), 2 jobs each (e.g. DFK → Cloud Engineer @ AWS Malaysia 94%, DevOps Engineer @ Maxis 85%).
4. **Kursus Cadangan** — recommended course card based on weakest PLO from insight (hardcoded `courseMappings` per PLO), plus static "AWS Cloud Practitioner Essentials" promo card.

**`StudentProfile.jsx`** (admin drill-down) — query param `?id=` (defaults to `TVET001` if absent). Fetches `/students/:id/skill-gap`. Layout:
- **Left card (sticky):** dark blue banner, StatusBadge (risk), avatar initial, name, ID, course full name, semester, certification, attendance. Buttons: Edit (no-op), Print (`window.print()`), Download (exports profile+history+insight+PLO scores as JSON file).
- **Right panel, 3 tabs:**
  - *Maklumat Peribadi* — email derived as `{id}@student.ikmb.edu.my`, phone (`noTelefon`), IC number (`noKP`), address (`alamat`).
  - *Rekod Akademik* — CGPA value + colored progress bar (green ≥3.5, amber ≥2.5, else red), dual-axis chart: GPA line (left axis, max 4) + attendance bars (right axis, max 100) per semester from `academicHistory`.
  - *PLO & AI Insight* — dark AI card with employability % + insight message, PLO radar chart with "DATA PLO BELUM LENGKAP" orange warning if any PLO=0, and 3 static intervention cards (Kaunseling Kehadiran, Klinik Akademik, Pembangunan Soft Skills) with alert() buttons.

### 4.4 Components

- `Sidebar.jsx` — logo, "Menu Utama" nav items (Phosphor icons), user chip at bottom (initials avatar, displayName, role label `Penyelaras`/`Pelajar`), logout button. Fixed drawer on mobile with overlay, static on md+.
- `KpiCard.jsx` — title, big value (or "-" while loading), icon with colored bg, optional subtitle, animated progress bar (barWidth %).
- `StudentModal.jsx` — add/edit form: ID (disabled when editing), Nama, CGPA, Kehadiran, Sijil dropdown (Tiada/CompTIA/Cisco CCNA/AWS Cloud), Kursus dropdown (**6 codes — SED missing**), Status dropdown (Bermasalah/Sederhana/Cemerlang).
- `StudentListGrid.jsx` — own search + filter-chip state (`useMemo` filtering by name/ID + course), responsive 1–4 column card grid; card: dark banner + Sem badge, centered avatar initial, name, course full name, ID + CGPA footer. Empty state "Tiada pelajar dijumpai".
- `JobCard.jsx` — icon, green match % badge, job title, company, "Mohon Sekarang" button (static).

### 4.5 Frontend Config Files

- `vite.config.js` — react plugin; dev server proxy `/api` → `http://localhost:$PORT` (PORT from env, default 5000); `allowedHosts: ['dashboard-bak.tvetdfk.com']`; Vitest config: jsdom environment, globals, only `src/**/*.test.{js,jsx}` included.
- `tailwind.config.js` — content: `index.html` + `src/**`; font family "Plus Jakarta Sans".
- `postcss.config.js` — tailwind + autoprefixer.
- `index.html` — title "TVETMARA AI Dashboard", loads Phosphor Icons from unpkg CDN, mounts `#root` → `src/main.jsx`.
- `nginx.conf` (production) — `client_max_body_size 100M` (for .mdb uploads, set both at server and `/api/` location level); `/` → SPA fallback `index.html`; `/api/` and `/uploads/` → `proxy_pass http://backend:5000`.
- `src/index.css` — Google Fonts import + 3 Tailwind directives. `src/App.css` — leftover Vite template, unused.

---

## 5. Backend — Express API (`backend/` package)

**Dependencies:** express 5, mongoose 9, jsonwebtoken 9, bcryptjs 3, multer 2, cors, dotenv, swagger-jsdoc + swagger-ui-express. Dev: jest 30 + supertest + babel preset-env + cross-env + nodemon. Scripts: `start`, `dev` (nodemon), `seed`, `start:prod` (= `node server.js`, **no seeding**), `test` (cross-env NODE_ENV=test jest --forceExit).

### 5.1 Bootstrap — `server.js`

- `cors()` + `express.json()`.
- Static route `/uploads` → serves files from `backend/uploads/` (certificate & profile images).
- Swagger UI at `/api/docs` (openapi 3.0, bearerAuth scheme, scans `./auth.js` + `./items.js` JSDoc comments).
- Mongoose connects `process.env.MONGO_URI` (skipped when `NODE_ENV=test`).
- `GET /api/health` → `{status:"ok", source:"mongodb-database"}`.
- Mounts `authRouter` at `/api/auth`, `itemsRouter` at `/api`. Listens `PORT` (default 5000), skipped under test.
- Exports `app` for supertest.

### 5.2 Auth — `auth.js` + `auth.model.js` + `middleware/authMiddleware.js`

- `POST /api/auth/login` — validates email+password present → `authenticateUser()`:
  - loads all users from MongoDB `User` collection, finds by lowercase email;
  - `bcrypt.compare(password, hashed)`;
  - on match signs **JWT (8h expiry)** with `process.env.JWT_SECRET`, payload `{email, role, studentId}`;
  - returns `{message, user: sanitized (no password), token}`. Wrong credentials → 401, missing fields → 400.
- `GET /api/auth/users` — **protected (admin only)** sanitized user list.
- `verifyToken` middleware — expects `Authorization: Bearer <jwt>`; missing header → 403, invalid/expired → 401; attaches decoded payload to `req.user` (used for role + studentId checks).

### 5.3 Student/Data/Predict Routes — `items.js` (all behind `verifyToken`)

| Endpoint | Role check | What it does |
|---|---|---|
| `GET /students` | any authenticated | list all students (normalized via `normaliseStudent`) |
| `POST /students` | admin only | create student |
| `PUT /students/:studentId` | admin only | update student |
| `DELETE /students/:studentId` | admin only | delete student |
| `GET /students/:studentId` | any | single student normalized |
| `GET /students/:studentId/skill-gap` | any | student + live AI risk + PLO chart arrays + insight message |
| `POST /students/:studentId/certificates` | admin **or** owner (`req.user.studentId === studentId`) | Multer disk upload to `uploads/certificates/` (≤5MB, jpeg/jpg/png/pdf only), `$push` into `uploadedCertificates`. Unauthorized + file present → file unlinked first. |
| `DELETE /students/:studentId/certificates/:certId` | admin or owner | removes subdocument + unlinks physical file |
| `POST /students/:studentId/profile-image` | admin or owner | same uploader; sets `profileImage` field to `/uploads/certificates/<file>` |
| `POST /predict/manual` | admin only | body = 13 features → `getRealAIPrediction()` → `{success, prediction}` (Rendah/Sederhana/Tinggi) |
| `POST /data/upload-mdb` | admin only | Multer **memory** storage ≤100MB, `.mdb` only → forwards file to ML service `/etl/process-mdb` via FormData fetch → receives student array → **sync step**: `Student.deleteMany` for IDs absent in new file → **bulkWrite upserts** both Students and Users (one hashed default password reused, email `<ID>@student.ikmb.edu.my`, password `password123`). Two bulk network calls total (OOM fix). |

### 5.4 Business Logic — `item.model.js`

- `certificationScores` map: Tiada 35, CompTIA 70, Cisco CCNA 85, AWS Cloud 90 (default 50).
- `normaliseStudent(record)` — converts Mongo doc (Malay field names) → API object: `id, nama, kursus, semester, attendance, cgpa, anugerah, kokoLulus, plo1..plo9 (Number), certification, certificationScore, dropoutRisk, careerStatus:"Pelajar", uploadedCertificates, profileImage, academicHistory (numeric), noKP, noTelefon, alamat`.
  - Risk mapping: `Bermasalah→Tinggi`, `Sederhana→Sederhana`, `Cemerlang→Rendah`, `Pending AI→Pending`.
  - **Overrides**: attendance<80 or cgpa<2.0 → forced `Tinggi`; cgpa≥3.5 → `Rendah`; else Status_Pelajar=Cemerlang → `Rendah`.
- `getRealAIPrediction(features)` — POSTs to `process.env.ML_API_URL || 'http://127.0.0.1:8000'` + `/predict/risk` with JSON body `{CGPA, Attendance, PLO_1..PLO_9, Sijil}`. Maps Malay prediction → risk word. **Heuristic fallback** if ML unreachable: attendance<80 or cgpa<2.0 → Tinggi; cgpa≥3.5 → Rendah; else Sederhana.
- `buildMetrics(student)` — 9 objects `{label:"PLO n", value, target:80}`.
- `buildInsight(metrics, student)` — finds weakest PLO; if value 0 → "not yet recorded" note; else Malay message naming weakest skill + value% + risk + priority text ("perlu diberi perhatian segera" if gap ≥20, else "bole dipertingkatkan lagi" — sic, typo in source).
- `getStudentSkillGapById(id)` — combines: normalized student + **live AI risk overwrite** (`student.dropoutRisk = trueAiRisk`) + `chart:{labels,current,target}` + `insight`.
- CRUD: `createStudent`, `updateStudent` (findOneAndUpdate by ID_Pelajar, validators), `deleteStudent`.

### 5.5 Mongoose Models

**`Student.js`** — all loose strings (numbers stored as strings, parsed at read time):
`ID_Pelajar, Nama, Kursus, Semester(Number), Kehadiran_Pct, CGPA, Sijil_Profesional, PLO_1..PLO_9, Status_Pelajar, No_KP, No_Telefon, Alamat` (last 3 with default ''), `academicHistory[] {semester:Number, gpa:String, cgpa:String, attendance:String}`, `uploadedCertificates[] {name, issuer, fileName, filePath, uploadDate:Date.now}`, `profileImage`.

**`User.js`** — `email` (required unique), `password` (bcrypt hash), `role` enum `admin|user` (default user), `displayName`, `studentId` (default null).

### 5.6 Seeding — `seed.js`

- Reads `backend/db/data_tvet_muktamad.json`.
- **Non-destructive upsert**: for each student, `findOneAndUpdate` with `$set` (upsert) — preserves uploadedCertificates/profileImage of existing docs; also upserts matching User account (default bcrypt password `password123`).
- Ensures `admin@ikmb.edu.my` (role admin) + `user@ikmb.edu.my` (role user) accounts exist.
- Run manually with `npm run seed`. Note: compose `start:prod` just runs `node server.js` — the compose comment about "automatic seed on startup" is stale.

### 5.7 Environment

`backend/.env.example`: `PORT=5001`, `MONGO_URI=mongodb://127.0.0.1:27017/ikmb-dashboard`, `JWT_SECRET=your_secret_key_herea`. Real `.env` gitignored. Also consumed: `ML_API_URL` (set to `http://ml-api:8000` inside compose).

---

## 6. ML Service — Python FastAPI (`ML/`)

### 6.1 API — `ml.py` (title "TVETMARA AI Prediction API V3")

- Startup: `joblib.load("model_ai_risiko_lengkap_v3.pkl")` → global `risk_model` (RandomForestClassifier).
- `GET /` — health: `{"status": "AI Server V3 is running"}`.
- `POST /predict/risk` — Pydantic body `StudentFeatures`: `CGPA, Attendance, PLO_1..PLO_9 (floats), Sijil (str)`.
  - Feature engineering: `PLO_Avg` = mean of 9 PLOs, `PLO_Variance` = variance.
  - Builds DataFrame with exact training column names (`CGPA`, `Avg_Subjek_Attendance` ← Attendance, PLO_1..9, PLO_Avg, PLO_Variance).
  - Reorders columns to `risk_model.feature_names_in_` if available.
  - Returns `{success, prediction, raw_output}` where prediction ∈ {Cemerlang, Sederhana, Bermasalah}. 500 if model not loaded; 400 on predict error.
- `POST /etl/process-mdb` — accepts `.mdb` UploadFile (400 otherwise), saves to temp file, runs full ETL with **system mdbtools** (`mdb-export`, `mdb-tables` via subprocess), deletes temp file, returns `{success, data: [student records]}`.

### 6.2 ETL Pipeline inside `ml.py` (`process_mdb_data`)

1. `inspect_mdb()` — debug dump of every table's columns + first row.
2. **GPA table** → per student: latest semester + latest CGPA; also builds `history_map` of `{semester, gpa, cgpa}` per semester.
3. **Pelajar table** → name, course code (`Kod_Kursus_Pelajar`), IC (`NoKP_Pelajar`), phone, merged address (Alamat + Poskod + Bandar).
4. **Daftar_Subjek** → overall average attendance (`Kehadiran` mean) **and per-semester averages** (only values >0), matched into each `academicHistory` entry by semester.
5. **Detail_Result** → PLO scores: regex `LO(\d+)` on `Kod_Ujian`, Markah averaged per PLO 1–9.
6. **Anugerah** → award flag True. 7. **Pelajar_Koko_Detail** (Result == 'LULUS') → `Koko_Lulus` flag.
7. Finalize: average PLO lists → strings (0 if none), sort history by semester, strip temp fields. Returns list of dicts matching Student schema (`Status_Pelajar: 'Pending AI'`, `Sijil_Profesional: 'Tiada'`).

### 6.3 Training — `train_and_evaluate.py`

- Input: `../backend/db/ml_training_data_real.csv` (733 data rows + header).
- Preprocessing: CGPA to numeric (median fill), PLOs numeric (0 fill); engineers `PLO_Avg`, `PLO_Variance`.
- Features: `CGPA, Avg_Subjek_Attendance, PLO_1..9, PLO_Avg, PLO_Variance`. Target: `Status_Pelajar`.
- 80/20 stratified split (random_state 42) → `GridSearchCV` over `n_estimators [100,200,300]`, `max_depth [None,10,20]`, `min_samples_split [2,5,10]`, `class_weight ['balanced',None]`, cv=5, scoring `f1_weighted` on `RandomForestClassifier`.
- Prints best params, accuracy, classification report, confusion matrix; saves `model_ai_risiko_lengkap_v3.pkl`.
- Model files: **v3 active** (~714 KB); v2 and `model_ai_tvet_besut.pkl` kept as history.

### 6.4 Tests — `test_ml.py` (pytest + TestClient)

Health check; valid payload → prediction in 3 labels; missing PLO fields → HTTP 422.

`requirements.txt`: fastapi, uvicorn, scikit-learn, joblib, pydantic, pandas, numpy, httpx, pytest, pytest-asyncio, python-multipart.

---

## 7. Data Layer & Offline Pipeline (`backend/db/`)

**Source:** `Ekspot_Senat.mdb` — Microsoft Access export of the senate system. Key tables: `GPA`, `Pelajar`, `Daftar_Subjek`, `Detail_Result`, `Anugerah`, `Pelajar_Koko_Detail`, `Layak_Sijil`, `Tidak_Lengkap`.

| File | Purpose |
|---|---|
| `sedut_mdb_tulen.py` | Main **offline** extractor (mdbtools): merges all tables per student incl. per-semester `academicHistory` (GPA + attendance) → writes `data_tvet_muktamad.json`. (Note: hardcoded `DB_PATH` points to old `db/` root location — needs path fix to run.) |
| `extract_history.py` | Pandas patcher: rebuilds `academicHistory` (CGPA + attendance per semester, filters 0-attendance, assumes 100 if missing) into existing JSON. |
| `ekstrak_mdb.py` | Windows-oriented pyodbc extractor (first table → JSON). Legacy. |
| `prepare_ml_data.py` | Builds ML training set: extracts 5 tables, pivots PLO scores, aggregates subject stats (credits, fails, drops, koko), merges with latest CGPA + award flag, generates ground-truth labels with rule-based scoring + Gaussian noise → `ml_training_data_real.csv` (733 rows). Label logic: Cemerlang if CGPA≥3.75 & attendance≥80 & all active PLOs≥80; else score<70 → Bermasalah, else Sederhana. |
| `ml_training_data_real.csv` | Final training CSV consumed by `train_and_evaluate.py`. |
| `data_tvet_muktamad.json` | Final student JSON for seeding. Currently just `[]` (2 bytes) locally. |
| `data_tvet.json` | Older 553-record dummy dataset (IDs TVET001...; no Nama field). |
| `login_users.json` | Legacy plaintext user list. **Superseded by Mongo Users. Contains plaintext passwords — sensitive artifact.** |
| `*.csv` | Raw table dumps (GPA ~2,284 rows; Daftar_Subjek ~16,184; Detail_Result ~64,785; pelajar ~1,327; Anugerah ~358; Layak_Sijil ~123). |
| `inspect_mdb_linux.py` (repo root) | Standalone utility: prints all tables + columns + 3 sample rows via mdbtools. Path also points to old root `db/` folder. |

**Runtime (online) path** doesn't use these scripts — the same ETL logic lives inside `ML/ml.py` and runs when admin uploads `.mdb` through the UI.

---

## 8. DevOps & CI/CD

- **`compose.yml`** — 4 services on `tvet_net` bridge. Backend: env from `backend/.env`, overridden `MONGO_URI=mongodb://mongodb:27017/ikmb-dashboard`, `ML_API_URL=http://ml-api:8000`; command `sleep 5 && npm run start:prod` (just starts server — seeding must be done via MDB upload in UI or manual `npm run seed`). Mongo volume `./mongodb_data:/data/db:Z`. All `restart: always`.
- **`Containerfile.frontend`** — stage 1: node:20-alpine `npm install && npm run build`; stage 2: nginx:alpine + custom `nginx.conf` + `dist/`.
- **`backend/Containerfile.backend`** — node:20-alpine, production install, EXPOSE 5000, `node server.js`.
- **`ML/Containerfile`** — python:3.9-slim, `apt-get install mdbtools`, pip install, uvicorn on 8000.
- **`.dockerignore`** — excludes node_modules, dist, ML, .git, .env, tar files, 2 db python scripts.
- **CI `.github/workflows/ci.yml`** ("TVETMARA CI/CD Pipeline") on push/PR to main/master: 3 parallel jobs — frontend (`npm install`, `npm test`, `npm run build`), backend (jest), ml-service (pytest) — then `docker-build` job (needs all 3) builds 3 images: `tvet-frontend`, `tvet-backend`, `tvet-ml-api`.

---

## 9. Testing

| Layer | Framework | File | Covers |
|---|---|---|---|
| Frontend | Vitest + Testing Library + jsdom | `src/__tests__/Login.test.jsx` | renders "Selamat Kembali"; failed login shows error message (fetch + navigate mocked) |
| Backend | Jest + Supertest | `backend/__tests__/auth.test.js` | login success 200 with token (auth.model mocked); wrong password 401 |
| Backend | Jest + Supertest | `backend/__tests__/items.test.js` | `/api/students` → 403 without token, 401 with invalid token |
| ML | pytest + TestClient | `ML/test_ml.py` | health, valid prediction label, 422 on missing fields |

Run commands:
- Frontend: `npm test` (root)
- Backend: `cd backend && npm test` (cross-env NODE_ENV=test jest --forceExit)
- ML: `cd ML && pytest test_ml.py`

---

## 10. Domain Glossary

- **PLO** — Programme Learning Outcomes: 9 skill scores (0–100%) parsed from assessment codes `LO1..LO9`. Institutional target: **80%** each. Names: 1 Komunikasi Efektif, 2 Pengaturcaraan, 3 Keselamatan Industri (OSH), 4 Pengurusan Projek, 5 Inovasi Produk, 6 Kemahiran Teknikal (Motor/Elektrik), 7 Keusahawanan Digital, 8 Etika & Kepimpinan, 9 Integriti Profesional.
- **Status labels** (Malay): `Cemerlang` excellent → risk `Rendah` (low); `Sederhana` moderate; `Bermasalah` problematic → risk `Tinggi` (high); `Pending AI` → `Pending`.
- **Course codes**: ITW Diploma Kompetensi Kimpalan (welding), DFK Diploma Teknologi Komputer / Komputasi Awan (cloud), DGA Diploma Teknologi Automotif, SLR Sijil Lukisan Rekabentuk (mechanical drafting), DCG Diploma Elektrik Industri, SED Sijil Elektrik Domestik, PPU Diploma Penyejukan & Penyamanan Udara (HVAC).
- **Certifications**: Tiada / CompTIA / Cisco CCNA / AWS Cloud.
- **Employability score** (heuristic, UI-side): `(CGPA/4)*40 + attendance*0.6`, capped 100.
- **Default accounts** (all password `password123`): `admin@ikmb.edu.my` (admin), `user@ikmb.edu.my` (user), `<ID>@student.ikmb.edu.my` (each student).
- **MARA / IKMB / TVET**: MARA = Majlis Amanah Rakyat (Malaysian agency); IKMB = Institut Kemahiran MARA Besut (skills institute in Besut, Terengganu); TVET = Technical & Vocational Education & Training.

---

## 11. Key Data Flows (End-to-End)

**Login**: React form → `POST /api/auth/login` → bcrypt compare vs Mongo User → JWT (8h) → stored in localStorage (`ikmbToken` + `ikmbCurrentUser`) → `authChange` event → redirect by role.

**Live student risk + skill gap**: `GET /students/:id/skill-gap` → backend normalizes record → calls ML `/predict/risk` with 13 features → ML engineers PLO_Avg/Variance → RandomForest predicts Malay label → mapped to risk word → response `{student, chart{labels,current,target}, insight}` → frontend renders radar + insight box.

**Manual prediction (admin)**: form → `POST /predict/manual` → same ML call → colored badge. If ML down → heuristic fallback still returns answer.

**MDB refresh (admin)**: `.mdb` upload → nginx (100MB limit) → backend Multer memory → FormData forward to ML `/etl/process-mdb` → mdbtools ETL → student array → backend deletes stale students (IDs not in file) → bulkWrite upsert Students + Users (shared hashed `password123`) → frontend reloads. Existing students' uploaded certificates/profile images survive (upsert `$set` only touches listed fields).

**Certificate upload (student)**: multipart (name, issuer, file) → Multer disk storage `backend/uploads/certificates/<timestamp>-<rand>.<ext>` (≤5MB, pdf/jpg/jpeg/png) → `$push` subdocument → file served at `/uploads/...` (proxied by nginx). Delete removes DB entry + physical file.

**Profile image**: same uploader; sets `profileImage` path on student doc.

---

## 12. Notable Observations / Caveats

- `backend/.env` holds a **real JWT secret** in plaintext locally — gitignored, never commit.
- `backend/db/login_users.json` contains **plaintext passwords** — legacy artifact, unused by current auth.
- `backend/db/data_tvet_muktamad.json` is `[]` (empty array) locally — DB populated via MDB upload in UI or by fixing path in `sedut_mdb_tulen.py` (its hardcoded `DB_PATH` points to old root `db/` folder, not `backend/db/`).
- Student login **passwords reset to `password123` on every MDB sync** (upsert `$set` includes password).
- `GET /api/auth/users` is **protected (admin only)** — returns sanitized user list.
- `StudentModal` course dropdown omits **SED** (exists in data).
- `src/App.css` is dead Vite template CSS.
- Employability % shown in UI is a fixed heuristic, independent of AI model output. (StaffDashboard "Top Performers" score uses yet another formula: `(cgpa/4)*60 + attendance*0.4`.)
- `GET /students` returns full collection to **any** logged-in user; student dashboard filters client-side (data exposure, though UI-restricted).
- `README.md` / `AGENTS.md` tracked in git but deleted in working tree.
- `inspect_mdb_linux.py` + `sedut_mdb_tulen.py` paths reference `db/Ekspot_Senat.mdb` at repo root; actual file is `backend/db/Ekspot_Senat.mdb` — adjust before running offline.
- Compose comment "AUTOMATIC SEED ON STARTUP" is stale — `start:prod` only starts the server; seed with `npm run seed` or upload MDB via UI.
- Typo in `item.model.js` insight message: "bole dipertingkatkan lagi" (should be "boleh").
- `handleDelete` in StaffDashboard is dead code — management tab has no delete button.

---

Last modified: 2026-09-01 10:45:00

(End of file - total 400+ lines)