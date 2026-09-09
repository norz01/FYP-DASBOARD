# TVETMARA Besut Skills & Talent Development Dashboard - Detailed Project Summary

---

## 1. Project Overview & Scope
- **Domain:** Final Year Project (FYP) for Institut Kemahiran MARA Besut (IKMB), a Malaysian TVET college under MARA.
- **Purpose:** Full-stack smart dashboard (`Papan Pemuka Pintar`) for monitoring student academic performance, predicting dropout risk using machine learning, and delivering personalized skill development and career recommendations.
- **Language:** UI in Bahasa Melayu; codebase & documentation in English/Malay mix.
- **Analytics Maturity:**
  1. *Descriptive:* CGPA, attendance %, Programme Learning Outcome (PLO) skill radar/bar charts.
  2. *Diagnostic:* AI insight messages identifying weakest skills and performance gaps.
  3. *Predictive:* Random Forest classifier predicting dropout risk (`Cemerlang`, `Sederhana`, `Bermasalah`).
  4. *Prescriptive:* Workshop, course, and career recommendations based on skill deficits against 80% institutional target.

---

## 2. Complete Repository Architecture & File Structure

```
TVETMARA-Besut-Skills-Talent-Development-Dashboard/
├── src/                          # React Frontend (Next.js 15 App Router)
│   ├── app/                      # Next.js App Router pages
│   │   ├── actions.js            # Server Actions: loginAction, logoutAction
│   │   ├── globals.css           # Tailwind CSS imports
│   │   ├── layout.jsx            # Root layout with font & Phosphor Icons
│   │   ├── page.jsx              # Login page (redirects to dashboards)
│   │   ├── staff-dashboard/
│   │   │   └── page.jsx          # Staff dashboard wrapper
│   │   ├── student-dashboard/
│   │   │   └── page.jsx          # Student dashboard wrapper
│   │   └── student-profile/
│   │       └── page.jsx          # Student profile page with dynamic routing
│   ├── assets/                   # Static images (react.svg, logo)
│   ├── components/               # Reusable UI components
│   │   ├── auth/
│   │   │   └── LoginForm.jsx     # Login form with server action
│   │   ├── dashboard/
│   │   │   ├── StaffDashboardClient.jsx    # Main staff dashboard (776 lines)
│   │   │   ├── StudentDashboardClient.jsx  # Student dashboard (940 lines)
│   │   │   └── StudentProfileClient.jsx    # Student detail view (561 lines)
│   │   ├── JobCard.jsx           # Career recommendation card component
│   │   ├── KpiCard.jsx           # Metric KPI card with progress indicator
│   │   ├── Sidebar.jsx           # Role-based navigation sidebar
│   │   ├── StudentListGrid.jsx   # Grid view for students with search/filters
│   │   └── StudentModal.jsx      # Add/edit student modal form for staff
│   ├── lib/                      # Utility functions
│   │   ├── auth.js               # Server-side cookie auth helpers
│   │   └── client-auth.js        # Client-side cookie auth helpers
│   ├── __tests__/                # Frontend test suite
│   │   └── Login.test.jsx        # Vitest test for login flow
│   └── public/                   # Static assets served directly
├── backend/                      # Express REST API Backend
│   ├── db/                       # Database files, MDB databases & ETL pipelines
│   │   ├── JD2025.mdb            # Legacy Microsoft Access database (2025)
│   │   ├── JJ2025.mdb            # Legacy Microsoft Access database (2025)
│   │   ├── JJ2026.mdb            # Legacy Microsoft Access database (2026)
│   │   ├── data_tvet_muktamad.json # Seed data JSON file (upsert source)
│   │   ├── ml_training_data_real.csv # ML training CSV dataset (3 semesters combined)
│   │   ├── ml_training_data_real_before_option2_20260901_125904.csv # Backup
│   │   ├── sedut_mdb_tulen.py    # Python ETL extraction script for single MDB
│   │   ├── inspect_mdb_linux.py  # MDB table inspector utility
│   │   ├── prepare_ml_data_3mdb.py # Multi-MDB dataset preparation script (v4)
│   │   ├── relabel_option2.py    # Label adjustment utility
│   │   └── mdb_extracted/        # CSV dumps extracted from MDB files per semester
│   ├── middleware/               # Express middleware
│   │   └── authMiddleware.js     # JWT token verification (`verifyToken`)
│   ├── models/                   # Mongoose schemas
│   │   ├── Student.js            # Student schema with all fields
│   │   └── User.js               # User schema for authentication
│   ├── __tests__/                # Backend test suite
│   │   ├── auth.test.js          # Jest tests for authentication endpoints
│   │   └── items.test.js         # Jest tests for student CRUD & endpoints
│   ├── server.js                 # Express app initialization, Swagger docs & routes
│   ├── auth.js                   # Authentication route handlers (`/api/auth`)
│   ├── auth.model.js             # User model logic (bcrypt hashing, JWT creation)
│   ├── items.js                  # Student data and MDB upload route handlers (`/api`)
│   ├── item.model.js             # Student normalization logic, risk mapping, AI prediction
│   ├── seed.js                   # MongoDB seeding script from JSON (upsert)
│   ├── repredict-status.js       # Batch ML re-prediction utility script
│   ├── Containerfile.backend     # Container definition for backend service
│   ├── babel.config.json         # Babel configuration for Jest tests
│   ├── package.json              # Backend dependencies & npm scripts
│   ├── .env                      # Environment config (JWT_SECRET, MONGO_URI) - GITIGNORED
│   └── .env.example              # Environment template
├── ML/                           # FastAPI Machine Learning Service
│   ├── ml.py                     # FastAPI application, prediction endpoints & ETL sync (338 lines)
│   ├── train_and_evaluate.py     # Random Forest model training script (v3)
│   ├── train_and_evaluate_v4.py  # Random Forest model training script (v4, group-aware)
│   ├── model_ai_risiko_lengkap_v3.pkl # Trained ML model v3 (714KB)
│   ├── model_ai_risiko_lengkap_v4.pkl # Trained ML model v4 (577KB) - ACTIVE
│   ├── test_ml.py                # Pytest test suite for ML API & ETL
│   ├── Containerfile             # Container definition for ML microservice
│   ├── requirements.txt          # Python package dependencies
│   └── .pytest_cache/            # Pytest cache directory
├── public/                       # Static public assets (logo-tvetmara.jpg)
├── mongodb_data/                 # Persistent MongoDB database storage volume
├── compose.yml                   # Docker Compose 4-service orchestration
├── Containerfile.frontend        # Frontend container definition (multi-stage)
├── nginx.conf                    # Nginx reverse proxy config (referenced in compose)
├── next.config.mjs               # Next.js config (standalone output, rewrites)
├── tailwind.config.js            # Tailwind CSS styling configuration
├── postcss.config.js             # PostCSS configuration
├── package.json                  # Root package config & workspace scripts
├── package-lock.json             # Dependency lockfile
├── .eslintrc.json                # ESLint linting rules
├── AGENTS.md                     # AI coding assistant guidelines & repo map
├── README.md                     # Main user documentation
└── summary.md                    # Detailed technical summary (this file)
```

---

## 3. Technology Stack & Service Breakdown

### Orchestration (`compose.yml`)
Four independent containerized services communicating over a shared bridge network (`tvet_net`):
1. **`frontend`** — Next.js 15 React 19 SPA served via standalone Node server on port `8080` (maps to internal port 3000).
2. **`backend`** — Node.js 20 Express 5 REST API running on port `5000`. Handles authentication, student CRUD, file uploads (Multer), and proxying ML/ETL requests.
3. **`ml-api`** — Python 3.9 FastAPI microservice running on port `8000`. Executes scikit-learn random forest inference and processes legacy Access `.mdb` files via `mdbtools`.
4. **`mongodb`** — Official `mongo:latest` database instance on port `27017` with persistent volume (`./mongodb_data:/data/db:Z`).

### Frontend Stack (`src/`)
- **Framework:** Next.js 15 (App Router, Server Components, Server Actions)
- **UI:** React 19, Tailwind CSS 3, Chart.js + react-chartjs-2
- **Icons:** Phosphor Icons (via CDN script)
- **Fonts:** Plus Jakarta Sans (Google Fonts via next/font)
- **Testing:** Vitest + React Testing Library + jsdom

### Backend Stack (`backend/`)
- **Runtime:** Node.js 20 (ESM modules)
- **Framework:** Express 5
- **Database:** MongoDB with Mongoose ODM
- **Auth:** JWT (jsonwebtoken) + bcryptjs password hashing
- **File Uploads:** Multer (disk storage for certs, memory storage for MDB)
- **API Docs:** Swagger (swagger-jsdoc + swagger-ui-express)
- **Testing:** Jest + Supertest (cross-env NODE_ENV=test)

### ML Stack (`ML/`)
- **Framework:** FastAPI (Python 3.9)
- **ML:** scikit-learn RandomForestClassifier, joblib for model persistence
- **Data Processing:** pandas, numpy
- **MDB Extraction:** mdbtools (mdb-tables, mdb-export) via subprocess
- **Testing:** pytest + httpx TestClient

---

## 4. Database Schema & Data Normalization

### Student Record (`backend/models/Student.js`)
Stored in MongoDB collection `students` with key fields (all stored as **Strings** in MongoDB, parsed to numbers at read time via `item.model.js:normaliseStudent`):

| Field | Type | Description |
|-------|------|-------------|
| `ID_Pelajar` | String | Primary key (e.g., "TVET001") |
| `Nama` | String | Student full name |
| `Kursus` | String | Course code: ITW, DFK, DGA, SLR, DCG, SED, PPU |
| `Semester` | Number | Current semester |
| `Kehadiran_Pct` | String | Attendance percentage (0-100) |
| `CGPA` | String | Cumulative GPA (0.00-4.00) |
| `Sijil_Profesional` | String | Certification: Tiada, CompTIA, Cisco CCNA, AWS Cloud |
| `PLO_1` - `PLO_9` | String | Programme Learning Outcome scores (0-100) |
| `Status_Pelajar` | String | AI prediction: Cemerlang, Sederhana, Bermasalah, Pending AI |
| `No_KP` | String | IC number (default: '') |
| `No_Telefon` | String | Phone number (default: '') |
| `Alamat` | String | Full address (default: '') |
| `Anugerah` | Boolean | Award recipient flag |
| `Koko_Lulus` | Boolean | Co-curricular pass flag |
| `academicHistory` | Array | Semester history: {semester, gpa, cgpa, attendance} |
| `uploadedCertificates` | Array | {name, issuer, fileName, filePath, uploadDate} |
| `profileImage` | String | Profile image path |

### User Authentication (`backend/models/User.js`)
Stored in MongoDB collection `users`:
- `email` (unique lowercase identifier)
- `password` (bcrypt hashed string)
- `role` (`admin` or `user`)
- `displayName`
- `studentId` (links to `ID_Pelajar` for student accounts)

### Normalization Logic (`backend/item.model.js:10-70`)
The `normaliseStudent()` function converts raw MongoDB strings to typed frontend objects:
- Maps Malay field names → English-ish API keys (`ID_Pelajar` → `id`, `Nama` → `nama`, etc.)
- Calculates `dropoutRisk` using deterministic rules:
  - `Bermasalah` → `Tinggi`
  - `Sederhana` → `Sederhana`
  - `Cemerlang` → `Rendah`
  - **Overrides:** `attendance < 80 || cgpa < 2.0` → `Tinggi`; `cgpa >= 3.5` → `Rendah`
- Builds PLO metrics array with 80% target
- Generates diagnostic insight message identifying weakest skill

---

## 5. Machine Learning & ETL Pipeline

### ML Model Contract (`ML/ml.py:16-81`)
- **Active Model:** `model_ai_risiko_lengkap_v4.pkl` (RandomForestClassifier trained via `train_and_evaluate_v4.py`)
- **MODEL_PATH:** Must match exactly; do not switch to v2 or `model_ai_tvet_besut.pkl` without updating `MODEL_PATH`
- **Feature Vector (Exact Order - 13 features):**
  1. `CGPA`
  2. `Avg_Subjek_Attendance`
  3. `PLO_1` through `PLO_9` (9 features)
  4. `PLO_Avg` (derived)
  5. `PLO_Variance` (derived)
- **Derived Features at Inference (`ml.py:49-65`):**
  - `PLO_Avg`: Arithmetic mean of all 9 PLO scores
  - `PLO_Variance`: Statistical variance across the 9 PLO scores
- **Column Order Enforcement:** Uses `risk_model.feature_names_in_` to ensure exact match (`ml.py:68-69`)

### Endpoints:
- `POST /predict/risk` — Single prediction (CGPA, Attendance, PLO_1-9, Sijil)
- `POST /predict/batch` — Batch prediction for multiple students
- `POST /etl/process-mdb` — Upload .mdb file, returns processed student array

### MDB ETL Pipeline (`ML/ml.py:123-338` + `backend/db/`)
- **Tools:** Linux `mdbtools` (`mdb-tables`, `mdb-export`) via Python subprocess
- **Critical Tables (case-sensitive):**
  - `GPA` — Anchor table (students must have ≥1 GPA record to appear)
  - `pelajar` — **Lowercase** master data table (NOT `Pelajar`)
  - `Daftar_Subjek` — Subject enrollment + attendance per semester
  - `Detail_Result` — Exam marks with `Kod_Ujian` containing LO references
  - `Anugerah` — Awards
  - `Pelajar_Koko_Detail` — Co-curricular results
  - `Layak_Sijil` — Certificate eligibility
- **Parsing Robustness:** Uses Python's `csv.DictReader` to correctly handle embedded commas and newlines within student physical addresses (never line-splitting)
- **Auto-Exclusion Filter (`ml.py:260-269`):** Automatically ignores exam codes with `LO > 9` in `Detail_Result` to prevent internal CLO numbering from corrupting institutional PLO calculations
- **Academic History:** Builds per-semester GPA/CGPA/attendance from GPA + Daftar_Subjek tables
- **Address Concatenation:** Combines `Alamat_Pelajar`, `Poskod_Pelajar`, `Bandar_Pelajar` into single `Alamat` field

### Multi-MDB Training Data Preparation (`backend/db/prepare_ml_data_3mdb.py`)
- Processes 3 MDB files: `JJ2025.mdb`, `JD2025.mdb`, `JJ2026.mdb`
- Extracts required tables from each to `mdb_extracted/{source}/`
- Merges with group-aware handling for students appearing across semesters
- Generates `ml_training_data_real.csv` with rule-based labels (Option 2):
  - **Bermasalah if:** CGPA < 3.00 OR composite score < 70 OR failed subjects > 0 OR dropped subjects > 0 OR attendance < 80
  - **Cemerlang if:** CGPA ≥ 3.90 AND attendance ≥ 80 AND all active PLOs ≥ 80
  - **Sederhana** otherwise
- Uses `GroupShuffleSplit` by `No_Pelajar` to prevent data leakage

### Model Training (`ML/train_and_evaluate_v4.py`)
- Feature engineering: PLO_Avg, PLO_Variance
- Hyperparameter tuning: GridSearchCV with RandomForestClassifier
- CV folds adaptive based on minority class size (2-5 folds)
- Scoring: `f1_weighted` (handles class imbalance)
- Saves model to `model_ai_risiko_lengkap_v4.pkl`

---

## 6. API Endpoints Summary

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/login` | Authenticate user, return JWT + profile | Public |
| GET | `/api/auth/users` | List all users (sanitized, no passwords) | Admin |

### Student Management & Analytics (`/api`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/students` | Retrieve all student records | JWT |
| POST | `/api/students` | Create new student record | Admin |
| GET | `/api/students/:studentId` | Get single student profile | JWT |
| PUT | `/api/students/:studentId` | Update student details | Admin |
| DELETE | `/api/students/:studentId` | Remove student record | Admin |
| GET | `/api/students/:studentId/skill-gap` | Calculate skill gaps + AI diagnostic | JWT |

### Uploads & Data Sync (`/api`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/students/:studentId/certificates` | Upload student certification file | JWT (owner/admin) |
| DELETE | `/api/students/:studentId/certificates/:certId` | Remove uploaded certificate | JWT (owner/admin) |
| POST | `/api/students/:studentId/profile-image` | Upload profile avatar image | JWT (owner/admin) |
| POST | `/api/data/upload-mdb` | Upload .mdb → ETL → bulk sync + AI batch prediction | Admin |
| POST | `/api/predict/manual` | Manual ML prediction for custom features | Admin |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check (no auth) |
| GET | `/api/docs` | Swagger UI documentation |

---

## 7. Frontend Application Structure

### Routes & Views (`src/app/`)
- **`/`** — Public login screen (`LoginForm.jsx`). Server Action `loginAction` sets cookies (`user`, `ikmbToken`), redirects based on role.
- **`/staff-dashboard`** — Admin/Staff dashboard (`StaffDashboardClient.jsx`). Features:
  - KPI overview cards (total students, avg employability, high-risk count)
  - Institute-wide PLO bar chart (current vs 80% target)
  - High-risk student list (clickable → student profile)
  - Top performers (different employability formula: CGPA×60% + attendance×40%)
  - AI manual prediction panel
  - Skills gap analysis table
  - Learning pathways recommendations
  - Student management grid (search, filter by course, CRUD via modal)
  - MDB database upload tool
- **`/student-dashboard`** — Individual student portal (`StudentDashboardClient.jsx`). Features:
  - Personal KPIs (employability %, attendance, CGPA)
  - PLO competency radar chart (student vs target)
  - AI diagnostic insight (weakest skill + gap)
  - Certificate management (upload PDF/JPG/PNG, delete)
  - Career recommendations by course code
  - Personalized course recommendations based on weakest PLO
- **`/student-profile?id=<ID>`** — Comprehensive detail view (`StudentProfileClient.jsx`). Tabs:
  - Personal: Contact info, address, course, semester
  - Academic: CGPA trend chart, GPA/attendance history
  - Skills: PLO radar chart, AI employability score, intervention buttons

### Shared Components
- `Sidebar.jsx` — Responsive navigation with user avatar, role badge, logout
- `StudentModal.jsx` — Add/edit form (course dropdown includes SED)
- `StudentListGrid.jsx` — Responsive grid with search + course filter chips
- `KpiCard.jsx` — Metric card with icon, value, progress bar
- `JobCard.jsx` — Career card with match %, company, apply button

### Auth Flow
1. Login form submits to `loginAction` (Server Action)
2. Backend `/api/auth/login` validates credentials, returns JWT + user
3. Server Action sets cookies: `user` (JSON, httpOnly:false), `ikmbToken` (JWT)
4. Middleware/redirects based on role: admin → `/staff-dashboard`, user → `/student-dashboard`
5. Client components read cookies via `client-auth.js` for Authorization headers

---

## 8. Default Credentials & Security Rules

### Default User Accounts (Password: `password123`)
| Email | Role | Notes |
|-------|------|-------|
| `admin@ikmb.edu.my` | Admin / Staff | Full access to all features |
| `user@ikmb.edu.my` | Student (generic) | Demo student view |
| `<ID_Pelajar>@student.ikmb.edu.my` | Individual student | Auto-created on MDB sync |

### Security Best Practices
- **Never commit `backend/.env`** — contains real `JWT_SECRET` (gitignored)
- **Passwords:** Stored exclusively as bcrypt hashes (10 rounds). Legacy `login_users.json` (plaintext) deleted.
- **Student passwords reset** to `password123` on every MDB sync (upsert `$set` in `items.js:350-351`)
- **All `/api` routes** (except `/api/auth/login` and `/api/health`) protected by `verifyToken` middleware
- **JWT:** 8-hour expiry, contains `{email, role, studentId}`
- **File uploads:** Multer validates MIME types (PDF, JPG, PNG), 5MB limit for certs, 100MB for MDB
- **CORS:** Enabled globally on backend

### Known Security Gaps (from AGENTS.md)
- `GET /api/auth/users` returns emails/roles — consider protecting if modified
- `GET /students` returns full collection to any logged-in user; student dashboard filters client-side
- Role-based access control is coarse (admin vs user only)

---

## 9. Data Flow & Key Workflows

### MDB Upload & Sync (`items.js:277-409`)
1. Admin uploads `.mdb` via Staff Dashboard "Pengurusan Data" tab
2. Backend sends file to ML service `/etl/process-mdb`
3. ML service extracts all tables via `mdbtools`, processes per `process_mdb_data()`
4. ML returns array of student objects with `Status_Pelajar: "Pending AI"`
5. Backend calls ML `/predict/batch` to get AI predictions for all students
6. Backend syncs: **deletes** students not in new file (`$nin` on `ID_Pelajar`)
7. Bulk writes students + users via `bulkWrite` (avoids OOM from loop saves)
8. Student passwords reset to `password123` on every sync

### AI Prediction Flow
1. Frontend calls `/api/students/:id/skill-gap` or `/api/predict/manual`
2. Backend `item.model.js:getRealAIPrediction()` calls ML `/predict/risk`
3. ML computes PLO_Avg, PLO_Variance, matches model `feature_names_in_`
4. Returns `Cemerlang`/`Sederhana`/`Bermasalah`
5. Backend maps to `Rendah`/`Sederhana`/`Tinggi` with deterministic overrides

### Student Dashboard Data Flow
1. On mount: fetches `/api/students` (all students for admins, filtered for students)
2. On student select: fetches `/api/students/:id/skill-gap` + `/api/students/:id`
3. `skill-gap` endpoint calls `getRealAIPrediction` for fresh AI risk
4. Renders radar chart, insight message, certificates, career/course cards

---

## 10. Course Codes & Career Mapping

### Course Codes (from `StudentDashboardClient.jsx:28-127` & `StudentProfileClient.jsx:37-48`)
| Code | Full Name | Career Paths |
|------|-----------|--------------|
| ITW | Diploma Kimpalan | Juruteknik Kimpalan 6G (95%), Welding Inspector (88%) |
| DFK | Diploma Komputasi Awan | Cloud Engineer (94%), DevOps Engineer (85%) |
| DGA | Diploma Automotif | Service Advisor (92%), Diagnostic Tech (88%) |
| SLR | Sijil Lukisan Rekabentuk | CAD Drafter (96%), Design Engineer (89%) |
| DCG | Diploma Elektrik Industri | Chargeman A0 (94%), Industrial Electrician (89%) |
| SED | Sijil Elektrik Domestik | Wireman PW4 (91%), Maintenance (87%) |
| PPU | Diploma Penyejukan Udara | HVAC Technician (93%), ACMV Supervisor (86%) |

### Learning Pathways (`StaffDashboardClient.jsx:177-190`)
| PLO | Recommended Pathway |
|-----|---------------------|
| PLO 1 | Kursus Komunikasi Efektif |
| PLO 2 | Bengkel Pengaturcaraan |
| PLO 3 | Latihan OSH |
| PLO 4 | Pengurusan Projek |
| PLO 5 | Inovasi Produk |
| PLO 6 | Kerosakan Motor |
| PLO 7 | Keusahawanan Digital |
| PLO 8 | Etika & Kepimpinan |
| PLO 9 | Integriti Profesional |

---

## 11. Testing & Verification Suites

### Frontend (`npm test` in root)
- **Framework:** Vitest + React Testing Library + jsdom
- **Test File:** `src/__tests__/Login.test.jsx`
- **Covers:** Login form rendering, failed login error display

### Backend (`cd backend && npm test`)
- **Framework:** Jest + Supertest
- **Test Files:**
  - `backend/__tests__/auth.test.js` — Login success/failure mocks
  - `backend/__tests__/items.test.js` — Auth middleware protection (403/401)
- **Config:** `babel.config.json` with `@babel/preset-env`, `cross-env NODE_ENV=test`

### ML (`cd ML && pytest test_ml.py`)
- **Framework:** pytest + httpx TestClient
- **Test File:** `ML/test_ml.py`
- **Covers:** Health check, valid prediction input, invalid input (422)

### CI/CD (`.github/workflows/ci.yml`)
- Parallel jobs: frontend, backend, ml-service
- Docker build job runs only if all tests pass
- Builds 3 images: `tvet-frontend`, `tvet-backend`, `tvet-ml-api`

---

## 12. Configuration Files

### `next.config.mjs`
- `output: 'standalone'` for Docker deployment
- Image remote patterns for backend uploads
- Rewrites: `/api/*` → backend, `/uploads/*` → backend

### `tailwind.config.js`
- Content paths for app/components
- Font family: Plus Jakarta Sans

### `compose.yml` Service Details
- **frontend:** Builds from `Containerfile.frontend`, port 8080→3000, env `BACKEND_URL=http://backend:5000`
- **backend:** Builds from `backend/Containerfile.backend`, port 5000, env `MONGO_URI`, `ML_API_URL`
- **ml-api:** Builds from `ML/Containerfile`, port 8000, installs `mdbtools` via apt
- **mongodb:** `mongo:latest`, volume `./mongodb_data:/data/db:Z`
- Network: `tvet_net` (bridge)

### `backend/Containerfile.backend`
- Node 20 Alpine, production deps only
- Exposes 5000, runs `node server.js`

### `ML/Containerfile`
- Python 3.9 slim, installs `mdbtools` via apt
- Runs `uvicorn ml:app --host 0.0.0.0 --port 8000`

---

## 13. Known Pitfalls & Tech Debt (from AGENTS.md + Code Review)

1. **Unprotected `/api/auth/users`** — Returns emails/roles without admin check (currently has check but endpoint design is questionable)
2. **Full student collection exposure** — `GET /students` returns all data; client-side filtering only
3. **StudentModal.jsx course dropdown** — Omits `SED` (exists in data) — *Wait, actually it DOES include SED (line 55)*
4. **Employability formula inconsistency:**
   - UI/StudentDashboard: `(CGPA/4)*40 + attendance*0.6`
   - StaffDashboard Top Performers: `(CGPA/4)*60 + attendance*0.4`
5. **ETL Scripts path resolution** — `sedut_mdb_tulen.py` and `inspect_mdb_linux.py` use `os.path.dirname(__file__)` — keep this pattern
6. **Compose `start:prod` does NOT auto-seed** — Must seed via MDB upload UI or `npm run seed`
7. **ML Model version coupling** — `ml.py` hardcodes `MODEL_PATH = "model_ai_risiko_lengkap_v4.pkl"`; training script outputs same name
8. **Feature set must EXACTLY match training** — 13 features in specific order; column order enforced via `feature_names_in_`
9. **MDB table case sensitivity** — `pelajar` is lowercase; `mdb-export` is case-sensitive
10. **Student addresses** — Contain embedded commas/newlines; must use `csv.DictReader` / pandas

---

## 14. Development Commands

```bash
# Frontend (repo root)
npm run dev          # Next.js dev server (port 3000)
npm run build        # Production build (standalone output)
npm run start        # Start production server
npm run lint         # ESLint
npm test             # Vitest

# Backend
cd backend
npm run dev          # Nodemon dev server (port 5000)
npm run seed         # Seed MongoDB from db/data_tvet_muktamad.json
npm run start:prod   # Production start
npm test             # Jest + Supertest (cross-env NODE_ENV=test)

# ML
cd ML
uvicorn ml:app --port 8000 --reload  # Dev server
pytest test_ml.py    # Run tests

# Docker
docker compose up --build           # Full stack
docker compose up -d                # Detached
docker compose logs -f backend      # View logs
docker compose exec backend npm run seed  # Seed in container
```

---

## 15. Environment Variables

### Backend (`backend/.env` - GITIGNORED)
```
PORT=5000
MONGO_URI=mongodb://mongodb:27017/ikmb-dashboard
ML_API_URL=http://ml-api:8000
JWT_SECRET=<secure-random-string>
```

### Frontend (injected via compose)
```
BACKEND_URL=http://backend:5000
NODE_ENV=production
```

### ML (no .env needed; uses compose service names)
- `ML_API_URL` used by backend to reach ML service

---

## 16. Last Modified
**Last Modified:** 2026-09-03 12:30:00 +08