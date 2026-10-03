# Project Architecture & Technical Blueprint

## 1. System Overview & Tech Stack

### Core Framework & Runtime

| Layer | Technology | Exact Version / Config | Notes |
| :--- | :--- | :--- | :--- |
| Frontend Framework | Next.js (App Router, SSR + Client Components) | `15.1.6` | `output: 'standalone'` in `next.config.mjs`. `dynamic = 'force-dynamic'` on all 4 route entries. Multi-stage Docker build (`Containerfile.frontend`, base `node:20-alpine`, runner `nodejs:1001/nextjs:1001`, `PORT=3000`, `HOSTNAME=0.0.0.0`). CI builds with `BACKEND_URL=http://backend:5000`. |
| UI Runtime | React + React DOM | `^19.0.0` | Functional components + Hooks only. `"use client"` on all interactive components. Server Components used only as thin wrappers (`page.jsx`) + Server Actions (`actions.js`) + Proxy Route (`api/[...proxy]/route.js`). |
| Path Alias | `jsconfig.json` | `@/*` -> `./src/*` | Used as `@/app/actions`, `@/...` in tests. |
| Backend Framework | Express | `^5.2.1` | ESM (`"type": "module"`), entry `backend/server.js`. `express.json({limit:"200kb"})`. `helmet({contentSecurityPolicy:false})`. `cors(origin: CORS_ORIGIN split "," else "*")`. Global error handler. Static mounts `/uploads/certificates`, `/uploads/referrals`, `/uploads/reports`. Swagger at `/api/docs` (OpenAPI 3.0.0, `bearerAuth` JWT). |
| Backend ODM | Mongoose | `^9.3.3` | Database `ikmb-dashboard` (compose) / `mongodb://mongodb:27017/ikmb-dashboard`. Models: `Student`, `User`, `Report`, `StudentReport`, `MdbFile`. Startup recovery resets stuck `MdbFile{status:Processing}` -> `Saved`. |
| Auth Crypto | `bcryptjs` / `jsonwebtoken` | `^3.0.3` / `^9.0.3` | Passwords hashed with bcrypt salt 10 (`password123` default for seeded/imported users). JWT payload `{email, role, studentId}`, `expiresIn: '8h'`, secret `process.env.JWT_SECRET \|\| "super_secret_fyp_key_2026"` (compose hardcodes `super_secret_fyp_key_2026`). |
| Uploads | `multer` | `^2.2.0` | Three disk storages: `certificates` (5 MB, `jpeg\|jpg\|png\|pdf`), `referrals` (5 MB, `jpeg\|jpg\|png\|pdf`), `reports` (PDF-only, 5 MB), `mdb` (100 MB, `.mdb` only). Ensures `uploads/{certificates,mdb,referrals,reports}` exist at boot. Path-traversal guard on delete (`resolved startsWith uploads/`). |
| Rate Limit / Security | `express-rate-limit`, `helmet`, `cors`, `dotenv` | `^8.7.0`, `^8.3.0`, `^2.8.6`, `^17.3.1` | AI chat limiter: 60 s window, limit 15, key `req.user.email`. `swagger-jsdoc ^6.3.0`, `swagger-ui-express ^5.0.1`. |
| Backend Test | `jest` + `supertest` + `cross-env` + `@babel/preset-env` | `^30.4.2`, `^7.2.2`, `^10.1.0`, `^7.24.7` | Command: `cross-env NODE_ENV=test node --experimental-vm-modules node_modules/jest/bin/jest.js --forceExit`. `babel.config.json`: `@babel/preset-env {targets:{node:"current"}, modules:false}`. Tests: `backend/__tests__/auth.test.js`, `backend/__tests__/items.test.js`. |
| Backend Dev | `nodemon` | `^3.1.14` | `npm run dev` -> `nodemon server.js`. `npm run seed` -> `node seed.js`. `npm run start:prod` -> `node server.js`. |
| ML Service | FastAPI + Uvicorn | unpinned (`fastapi`, `uvicorn`, `python-multipart`) | File `ML/ml.py`, title `TVETMARA AI Prediction API V4`, port `8000`, `CMD ["uvicorn","ml:app","--host","0.0.0.0","--port","8000"]`. Base image `python:3.9-slim` + `apt mdbtools`. No auth on ML endpoints (only reachable via internal `tvet_net` + backend `ML_API_URL=http://ml-api:8000`). |
| ML Data / Training | `scikit-learn`, `joblib`, `pandas`, `numpy`, `httpx`, `pydantic` | unpinned; local training observed on `scikit-learn 1.6.1` | Artifacts: `ML/model_ai_risiko_lengkap_v3.pkl`, `ML/model_ai_risiko_lengkap_v4.pkl` (active). Trainers: `ML/train_and_evaluate.py` (v3-style), `ML/train_and_evaluate_v4.py` (current, GroupShuffleSplit). Tests: `pytest`, `pytest-asyncio`, `ML/test_ml.py` (3 tests). |
| Database | MongoDB | `docker.io/mongo:latest` | Compose service `tvet_mongodb`, host port `27017:27017`, volume `./mongodb_data:/data/db:Z`, network `tvet_net (bridge)`, `restart: always`. |
| Orchestration | Docker Compose / Podman Compose | `version: "3.8"` | Services: `mongodb (27017)`, `backend (5000:5000, sleep 5 + npm run start:prod)`, `ml-api (8000:8000)`, `frontend (8080:3000)`. Shared network `tvet_net`. Backend volume `./backend/uploads:/app/uploads:Z`. |
| CI/CD | GitHub Actions (`.github/workflows/ci.yml`) | `actions/checkout@v4`, `actions/setup-node@v4 (node 20)`, `actions/setup-python@v5 (python 3.9)` | 4 jobs: `frontend` (npm install + `vitest run` + `npm run build`), `backend` (npm install + `npm test` in `backend/`), `ml-service` (apt `mdbtools` + `pip install -r requirements.txt` + `pytest test_ml.py` in `ML/`), `docker-build` (needs all 3; builds `tvet-frontend`, `tvet-backend`, `tvet-ml-api`). Triggers on push/PR to `main`/`master`. |
| Node Runtime (local/CI) | Node.js | `20` (Docker + CI); local shell observed `v25.2.1` | Python local `3.14.7`, ML container `3.9-slim`. |

### State Management & Data Fetching Strategy

No global store (no Redux, Zustand, Jotai, React Query/SWR). State is deliberately colocated:

- **Server Actions (`src/app/actions.js`, directive `'use server'`):** `loginAction(prevState, formData)` POSTs to `${BACKEND_URL}/api/auth/login` (`BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000'`), sets two cookies via `next/headers cookies()`: `user` (JSON, `httpOnly:false`, `secure: prod`, `maxAge: 86400`, `path:'/'`, readable by middleware + client UI) and `ikmbToken` (JWT, `httpOnly:true`, `secure: prod`, `maxAge: 86400`, `path:'/'`, `sameSite:'lax'`, never readable by JS). Role-based `redirect('/staff-dashboard' | '/student-dashboard')`. Returns `{error}` on failure. `logoutAction()` deletes both cookies and redirects to `/`.
- **API Proxy (`src/app/api/[...proxy]/route.js`):** All client `fetch('/api/...')` calls hit Next.js first. `proxyRequest` reconstructs `BACKEND_URL/api/<proxy-path + query>`, reads `ikmbToken` via `cookies().get('ikmbToken')`, clones incoming headers (strips `host`, `connection`, `content-length`), injects `Authorization: Bearer <token>`, forwards `method + headers + body (blob for non-GET/HEAD)`, strips `transfer-encoding` from backend response, streams `backendRes.body` back with original status. On exception returns `500 {message:'Proxy connection failed'}`. Client sends dummy `Bearer proxy-handled`; proxy replaces it with the real HttpOnly JWT.
- **Client fetching pattern:** Every dashboard client uses native `fetch('/api/...')` with `Authorization: Bearer proxy-handled` (value ignored server-side, required only so header exists). Examples: `GET /api/students`, `GET /api/students/:id/skill-gap`, `POST /api/students`, `PUT /api/students/:id`, `DELETE /api/students/:id`, `POST /api/students/:id/certificates`, `DELETE /api/students/:id/certificates/:certId`, `POST /api/students/:id/profile-image`, `POST /api/predict/manual`, `GET/POST/DELETE /api/data/mdb-files*`, `POST /api/data/process-mdb/:id`, `POST /api/data/upload-mdb`, `POST /api/ai/chat` (streaming SSE fallback to JSON), `GET/PATCH /api/reports*`, `GET/POST/DELETE /api/student-reports*`, `GET /api/auth/users`. No caching layer; `fetchMdbFiles` polls every 3000 ms while any file is `Processing`.
- **Local state primitives:** `useState` for user, lists, activeTab, modals, forms, toasts, AI chat transcript; `useEffect` for mount fetch + polling + autoscroll + Escape-key listener; `useMemo` for filtered students, PLO averages, chart datasets, calendar cells, employability; `useCallback` for `fetchReports`/`fetchData`; `useRef` for modal backdrop + chat end anchor; `useActionState` + `useFormStatus` for login form; custom hook `useFilePreview` for attachment validation + `URL.createObjectURL` lifecycle.
- **Server helpers (`src/lib/auth.js`, server-only):** `getStoredUser()` (parses `user` cookie), `getToken()` (reads `ikmbToken`), `getDashboardPathForRole(role)` (staff -> `/staff-dashboard`, else `/student-dashboard`). Client helpers (`src/lib/client-auth.js`, `"use client"`): `getClientUser()` (parses `document.cookie` `user=`, SSR-guarded), `getClientToken()` (returns literal `"proxy-handled"`; legacy direct token read removed).
- **Domain helpers (`src/lib/heuristics.js`, `src/lib/roles.js`):** `calculateEmployability(cgpa,attendance) = min(100, round(cgpa/4*40 + attendance*0.6))`, `calculateTopPerformerScore = min(100, round(cgpa/4*60 + attendance*0.4))`; `ROLES = {admin:{label:'Penyelaras',group:'staff'}, counselor:{label:'Kaunselor',group:'staff'}, user:{label:'Pelajar',group:'student'}}`, `getRoleLabel()`, `isStaff()`.

### Styling & UI Layer

- **Tailwind CSS `^3.4.19` + `autoprefixer ^10.4.27` + `postcss ^8.5.6`:** `tailwind.config.js` scans `./src/app/**/*.{js,ts,jsx,tsx,mdx}` and `./src/components/**/*.{js,ts,jsx,tsx,mdx}`; extends `fontFamily.sans` to `"Plus Jakarta Sans", sans-serif`; no plugins. `postcss.config.js` loads `tailwindcss` + `autoprefixer`. `src/app/globals.css` contains only `@tailwind base/components/utilities` plus one custom `@keyframes fadeIn {from{opacity:0; transform:translateY(6px)} to{opacity:1; transform:translateY(0)}}`, consumed via arbitrary classes `animate-[fadeIn_0.2s_ease-out]` (modals, toasts) and `animate-[fadeIn_0.3s_ease-in-out]` (tab content).
- **No animation library (no Framer Motion, no GSAP):** All motion is Tailwind utilities + the single `fadeIn` keyframe + Chart.js canvas transitions. Patterns: `transition-all duration-300`, `transition-transform duration-300` (sidebar slide), `transition-colors` (JobCard icon, buttons), `hover:shadow-lg hover:-translate-y-1` (student cards), `hover:shadow-md` (report cards), `hover:bg-*` states, `animate-spin` (spinners `ph-spinner-gap`, loading ring), `animate-pulse` (skeletons `SkeletonList`, AI caret), `animate-bounce` with `[animation-delay:0ms/150ms/300ms]` (AI typing dots), progress bars `transition-all duration-500` with inline `width:%`, backdrop `bg-black/50 backdrop-blur-sm` / `bg-black/60`.
- **Charts (`chart.js ^4.5.1` + `react-chartjs-2 ^5.3.1`):** Staff registers `CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend` and renders `Bar` for PLO averages (datasets `Purata #2563EB` vs `Sasaran 80 #E5E7EB`) and dual-axis trend (`line GPA #2563EB` on `y` + `bar Kehadiran rgba(16,185,129,0.2)` on `y1`). Student + profile register `RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend` and render `Radar` (`Data Pelajar rgba(37,99,235,0.2)/#2563EB` vs `Target rgba(16,185,129,0.1)/#10B981 dashed`). Fixed heights `h-80` (staff Bar), `h-64`/`h-72` (Radar/trend).
- **Icons & Fonts:** Phosphor Icons via CDN `<Script src="https://unpkg.com/@phosphor-icons/web" strategy="beforeInteractive"/>` in `layout.jsx`; usage `<i className="ph ...">` (e.g. `ph-squares-four`, `ph-magic-wand`, `ph-chart-bar`, `ph-path`, `ph-users-three`, `ph-heart-half`, `ph-database`, `ph-fill`, `ph-bold`, `ph-file-pdf`, `ph-paper-plane-tilt`, `ph-spinner-gap`, `ph-sign-out`). Font `Plus_Jakarta_Sans({subsets:['latin'], weight:['400','500','600','700'], display:'swap'})` applied as `<body className>`, `<html lang="ms">`. Login hero uses Unsplash `photo-1518770660439` with `opacity-40 mix-blend-overlay` + `blur-3xl` decorative circles. Logos: `public/logo-tvetmara.jpg` (also root copy `logo-tvetmara.jpg`) rendered via `next/image` (`w-48`, `priority`) and plain `<img>` on login.
- **Shared kit (`src/components/ui/dashboard-kit.jsx`):** `Badge` (tones blue/purple/green/amber/rose/slate), `StatCard`, `SectionCard`, `PillTabs` (active `bg-blue-600 text-white`, count badge `bg-white/20` vs `bg-slate-100`), `EmptyState`, `SkeletonList` (`animate-pulse`), `formatMsDate` (`ms-MY` locale). Lint: `.eslintrc.json` extends `next/core-web-vitals`, disables `react/no-unescaped-entities` and `@next/next/no-img-element`.
- **Testing UI:** `vitest ^4.1.10` + `jsdom ^29.1.1` + `@testing-library/react ^16.3.2` + `@testing-library/jest-dom ^6.9.1` + `@testing-library/user-event ^14.6.1`; config `vitest.config.js` (`environment:'jsdom'`, `include:['src/**/*.{test,spec}.{js,jsx}']`, `globals:true`, alias `@`). Script `npm test` = `vitest run src/__tests__`. Only frontend test is `src/__tests__/Login.test.jsx`.

### Third-party Services / External Integrations

| Integration | Direction | Details |
| :--- | :--- | :--- |
| MongoDB (`mongo:latest`) | Backend <-> DB via Mongoose | `MONGO_URI` (`mongodb://mongodb:27017/ikmb-dashboard` in compose, `mongodb://127.0.0.1:27017/ikmb-dashboard` fallback, `mongodb://localhost:27017/tvetmara_db` in `seed.js`). Collections map to `Student`, `User`, `Report`, `StudentReport`, `MdbFile` models. Seed source `backend/db/data_tvet_muktamad.json` (if present). |
| ML FastAPI (`http://ml-api:8000`, fallback `http://127.0.0.1:8000`) | Backend -> ML (server-to-server, no browser calls) | `POST /predict/risk {CGPA, Attendance, PLO_1..9, Sijil}` -> `{success, prediction, raw_output}`; `POST /predict/batch {students:[...]}` -> `{success, predictions:[str]}`; `POST /etl/process-mdb (multipart file)` -> `{success, data}` (uses `mdb-export`, `mdb-tables -1` internally; auto-excludes subjects with `LO>9`; computes `PLO_Avg`, `PLO_Variance`, `Kehadiran_Pct`, `academicHistory`). Model: `RandomForestClassifier` (`n_estimators [100,200,300]`, `max_depth [None,10,20]`, `min_samples_split [2,5,10]`, `class_weight [balanced,None]`, `cv` adaptive, `f1_weighted`), 15 features `[CGPA, Avg_Subjek_Attendance, PLO_1..9, PLO_Avg, PLO_Variance]`, labels `[Bermasalah, Sederhana, Cemerlang]`. Note `Sijil` accepted but ignored at inference. Fallback rule if ML down: `attendance<80 \|\| cgpa<2.0 => Tinggi`, else map status. |
| Google Gemini (`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite`) | Backend -> Gemini REST + SSE | `callGeminiAPI` (`:generateContent`, header `x-goog-api-key: GEMINI_API_KEY`, `temperature 0.4`, `maxOutputTokens 1024`) and `callGeminiStreamAPI` (`:streamGenerateContent?alt=sse`, streamed as `text/plain` chunks parsed from `data:` JSON). System prompt grounds on TVET course codes, careers, PLO definitions, risk thresholds, certs, interventions. Input sanitized: `sanitizeHistory` (filter roles, slice -16, enforce start-user + strict alternation, drop trailing user, truncate 1500 chars), `AI_MAX_MESSAGE_LENGTH=1500`, `AI_MAX_HISTORY=16`. PII stripped (`studentDataForAI` excludes IC/phone/address). Key from `GEMINI_API_KEY` (compose + `.env.local`); missing key -> 500. |
| Swagger Docs | Backend serves UI | `GET /api/docs` via `swagger-ui-express`; spec from `swagger-jsdoc` scanning `auth.js`, `items.js`, `reports.js`, `studentReports.js`. |
| Phosphor Icons CDN / Unsplash / Next Font | Frontend <- CDN | `https://unpkg.com/@phosphor-icons/web` (beforeInteractive), Unsplash hero image, Google Font `Plus Jakarta Sans` via `next/font`. No other SaaS (no auth provider, no analytics, no storage bucket; uploads stay on backend disk `./backend/uploads`). |
| Environment schema | Root + backend + compose | Root `.env.local`: `BACKEND_URL`, `GEMINI_API_KEY`. Backend `.env`: `PORT`, `MONGO_URI`, `JWT_SECRET`, `ML_API_URL`, `GEMINI_API_KEY`, `CORS_ORIGIN` (example: `PORT=5001`, `CORS_ORIGIN=http://localhost:8080,http://localhost:3000`). Compose backend env: `NODE_ENV=development`, `JWT_SECRET=super_secret_fyp_key_2026`, `MONGO_URI`, `ML_API_URL`, `GEMINI_API_KEY`, `CORS_ORIGIN=${CORS_ORIGIN:-*}`. Frontend env: `BACKEND_URL=http://backend:5000`, `NODE_ENV=production`. Backend Containerfile defaults: `PORT=5000`, `MONGO_URI=mongodb://localhost:27017/ikmb-dashboard`. |

## 2. Directory Tree & Module Manifest

### Indented Directory Tree (key source directories; excludes `node_modules`, `.next`, `mongodb_data`, `dist`)

```
.
├── backend/
│   ├── auth.js
│   ├── auth.model.js
│   ├── babel.config.json
│   ├── Containerfile.backend
│   ├── db/ (seed JSON data_tvet_muktamad.json when present)
│   ├── item.model.js
│   ├── items.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── models/
│   │   ├── MdbFile.js
│   │   ├── Report.js
│   │   ├── Student.js
│   │   ├── StudentReport.js
│   │   └── User.js
│   ├── package.json
│   ├── reports.js
│   ├── repredict-status.js
│   ├── seed.js
│   ├── seed-admin.js
│   ├── server.js
│   ├── studentReports.js
│   ├── uploads/
│   │   ├── certificates/
│   │   ├── mdb/ (e.g. 1790220879867-753667825.mdb)
│   │   ├── referrals/ (e.g. 1790827543095-443417605.png)
│   │   └── reports/
│   └── __tests__/
│       ├── auth.test.js
│       └── items.test.js
├── ML/
│   ├── Containerfile
│   ├── ml.py
│   ├── model_ai_risiko_lengkap_v3.pkl
│   ├── model_ai_risiko_lengkap_v4.pkl (active)
│   ├── requirements.txt
│   ├── test_ml.py
│   ├── train_and_evaluate.py
│   └── train_and_evaluate_v4.py (current trainer)
├── public/
│   ├── logo-tvetmara.jpg
│   └── vite.svg
├── src/
│   ├── app/
│   │   ├── actions.js
│   │   ├── api/
│   │   │   └── [...proxy]/
│   │   │       └── route.js
│   │   ├── globals.css
│   │   ├── layout.jsx
│   │   ├── page.jsx (route /)
│   │   ├── staff-dashboard/
│   │   │   └── page.jsx (route /staff-dashboard)
│   │   ├── student-dashboard/
│   │   │   └── page.jsx (route /student-dashboard)
│   │   └── student-profile/
│   │       └── page.jsx (route /student-profile?id=...)
│   ├── assets/
│   │   └── react.svg (unused Vite asset)
│   ├── components/
│   │   ├── auth/
│   │   │   └── LoginForm.jsx
│   │   ├── dashboard/
│   │   │   ├── AppointmentCalendar.jsx
│   │   │   ├── CounselorDashboardClient.jsx
│   │   │   ├── MergedLaporanTab.jsx
│   │   │   ├── StaffDashboardClient.jsx
│   │   │   ├── StudentDashboardClient.jsx
│   │   │   └── StudentProfileClient.jsx
│   │   ├── ui/
│   │   │   ├── AttachmentPreview.jsx
│   │   │   └── dashboard-kit.jsx
│   │   ├── GenerateReportModal.jsx
│   │   ├── JobCard.jsx
│   │   ├── KpiCard.jsx
│   │   ├── ReportFormModal.jsx
│   │   ├── Sidebar.jsx
│   │   ├── StudentDetailModal.jsx
│   │   ├── StudentListGrid.jsx
│   │   └── StudentModal.jsx
│   ├── lib/
│   │   ├── auth.js
│   │   ├── client-auth.js
│   │   ├── heuristics.js
│   │   ├── roles.js
│   │   └── use-file-preview.js
│   └── __tests__/
│       └── Login.test.jsx
├── middleware.js (Next.js Edge guard)
├── compose.yml
├── Containerfile.frontend
├── next.config.mjs
├── tailwind.config.js
├── postcss.config.js
├── jsconfig.json
├── vitest.config.js
├── package.json
├── ML_TEST_RESULTS.md
└── .github/
    └── workflows/
        └── ci.yml
```

### Breakdown Table

| Path / Module | Purpose | Key Exports / Responsibilities |
| :--- | :--- | :--- |
| `middleware.js` | Next.js Edge route guard for all non-API/static routes | `middleware(request)`: parses `user` cookie JSON; redirects logged-in users away from `/` and `/login` to role dashboard; redirects guests to `/`; enforces staff-only `/staff-dashboard` + `/student-profile` and student-only `/student-dashboard`. `config.matcher = ['/((?!api\|_next/static\|_next/image\|favicon.ico\|assets).*)']`. |
| `next.config.mjs` | Next.js build/output config | `output:'standalone'`; `rewrites()`: only `/uploads/:path*` -> `http://backend:5000/uploads/:path*` (API rewrites removed; proxy route handles `/api`). |
| `src/app/layout.jsx` | Root layout, font, icons, locale | `RootLayout({children})`: loads `Plus_Jakarta_Sans`, sets `<html lang="ms">`, injects Phosphor `<Script>`, imports `globals.css`. `metadata {title, description}`. |
| `src/app/page.jsx` | Public login route `/` | `LoginPage()` renders `<LoginForm/>`. `dynamic='force-dynamic'`. No fetch; defers to middleware. |
| `src/app/actions.js` | Login/logout Server Actions | `loginAction(prevState,formData)`: reads `email/password` (supports `FormData` or plain object fallback), `POST BACKEND_URL/api/auth/login`, sets `user` + `ikmbToken` cookies, role redirects. `logoutAction()`: deletes both cookies, redirects `/`. |
| `src/app/api/[...proxy]/route.js` | Authenticated API gateway to Express | `GET/POST/PUT/PATCH/DELETE -> proxyRequest`: joins `params.proxy`, forwards method/headers/body to `BACKEND_URL/api/<path+query>`, injects `Authorization: Bearer <ikmbToken>`, strips `host/connection/content-length` (req) and `transfer-encoding` (res), streams body. `500 {message:'Proxy connection failed'}` on network error. |
| `src/app/globals.css` | Tailwind entry + motion token | `@tailwind` directives + `@keyframes fadeIn` (opacity 0->1, translateY 6px->0). |
| `src/app/staff-dashboard/page.jsx` | Staff shell route | `StaffDashboardPage()` renders `<StaffDashboardClient/>`. `dynamic='force-dynamic'`. |
| `src/app/student-dashboard/page.jsx` | Student shell route | `StudentDashboardPage()` renders `<StudentDashboardClient/>`. `dynamic='force-dynamic'`. |
| `src/app/student-profile/page.jsx` | Staff detail route with query id | `StudentProfilePage({searchParams})`: awaits `searchParams`, defaults `studentId = id \|\| 'TVET001'`, renders `<StudentProfileClient studentId/>`. |
| `src/components/auth/LoginForm.jsx` | Split-screen login UI | `LoginForm()`: `useActionState(loginAction)` + inner `SubmitButton()` (`useFormStatus pending`); inputs `email (default admin@ikmb.edu.my)` + `password (default password123)`; error box from `state.error`; left brand panel (Unsplash + blur circles + `ph-brain`), right card (logo, `ph-envelope`/`ph-lock-key`, hints `admin/user@ikmb.edu.my`). |
| `src/components/dashboard/StaffDashboardClient.jsx` | Staff SPA shell with 7 tabs + CRUD + AI chat + MDB pipeline | No props. Tabs `overview/prediction/skills/pathways/management/counselor/data`. Registers Chart.js Bar. State: user/students/search/activeTab/sidebar/modals/AI transcript/MDB files. Functions: `fetchMdbFiles`, `handleProcessMdb`, `handleDeleteMdb`, `handleMdbUpload`, `handleInputChange/openAddModal/openEditModal/handleSubmit/handleDelete`, `handleSendAiMessage` (SSE stream reader + JSON fallback, `renderAiText` for `**bold**`/`*italic*`/bullets), `handleLogout`, `handleNavigate`. Derived: `highRiskStudents`, `averageEmployability`, `topPerformers`, `ploAverages`, `ploChartData`, `skillsGapData`, `recommendedPathways`, `filteredStudents`. `navItems` hides `data` tab for counselors. |
| `src/components/dashboard/StudentDashboardClient.jsx` | Student self-service with 5 tabs | No props. Tabs `dashboard/profile/reports/career/courses`. Registers Radar. State: user/students/selectedStudentId/skillGap/certs/activeTab/sidebar. Constants: `careerMapping` (8 course codes x 2 jobs), `courseMappings` (PLO1-9 cards), `initialSkillGap`. Functions: `handleLogout`, `handleProfileImageChange`, `handleCertInputChange/handleFileChange/handleAddCertificate/handleDeleteCertificate`. Derived: `isRestrictedUser`, `radarData`, `weakestPlo`, `recommendedCourse`. |
| `src/components/dashboard/StudentProfileClient.jsx` | Single-student 360 view for staff | `StudentProfileClient({studentId})` + inner `StatusBadge({status})`. State: skillGap/loading/error/activeTab/currentUser/interventionModal/generateReportOpen. Fetches `GET /api/students/:id/skill-gap`. Derived: `cgpaColor`, trend `labels/gpaData/attendanceData`, radar datasets, `employabilityScore`, `hasZeroScore`. Actions: `handlePrint (window.print)`, `handleDownload` (JSON blob `Profil_Pelajar_<id>.json`). Gates intervention grid + buttons on `isStaff`. Hosts `ReportFormModal` + `GenerateReportModal`. |
| `src/components/dashboard/CounselorDashboardClient.jsx` | Intervention queue + calendar + sent letters | `CounselorDashboardClient({currentUser})`. State: reports/sentReports/activeTab/selectedReport/modalAction/scheduleDate/notes/isSubmitting/toast. Constants: `INTERVENTION_LABELS`, `STATUS_CONFIG {pending/accepted/scheduled/completed/rejected}`. Functions: `fetchReports`, `fetchSentReports`, `showToast`, `handleAccept/handleReject/openScheduleModal/openCompleteModal/handleScheduleSubmit/handleCompleteSubmit/handleCalendarComplete/handleDeleteSentReport`, admin `PATCH {action:pending}` reset. Tabs: `calendar/pending/scheduled/completed/sent-reports/all`. |
| `src/components/dashboard/MergedLaporanTab.jsx` | Student unified inbox (letters + appointments) | `MergedLaporanTab({user})` + pure `formatLaporanDate`, `normalizeLaporanItems(reports,appointments)` (maps + sorts desc by `displayDate`). State: items/isLoading/activeFilter/selectedItem. `fetchData`: `Promise.all([GET /api/student-reports, GET /api/reports/mine])`. `handleOpenItem`: opens `StudentDetailModal`, marks report read via `GET /api/student-reports/:id`. Filters `all/report/appointment` with counts; label maps `REPORT_TYPE_LABELS`, `INTERVENTION_LABELS`. |
| `src/components/dashboard/AppointmentCalendar.jsx` | Month-grid scheduler view | `AppointmentCalendar({reports,onComplete})`. State: `currentMonth{year,month}`, `selectedDay (YYYY-MM-DD)`. Helpers: `DAY_NAMES (Isnin..Ahad)`, `MONTH_NAMES (Januari..Disember)`, `dayKey`, `formatTime (ms-MY)`. Memos: `scheduledReports (scheduledDate && status scheduled\|accepted)`, `byDay`, `calendarCells` (Monday-first offset, null pads), `selectedDayReports`. Pure presentational; callbacks to parent for completion. |
| `src/components/Sidebar.jsx` | Responsive nav + identity + logout | Props `navItems/activeTab/setActiveTab/isSidebarOpen/setIsSidebarOpen/currentUser/handleLogout`. Derives `displayName`, `roleLabel (getRoleLabel)`, `userInitials`. Mobile `fixed -translate-x-full` + overlay; desktop `md:relative md:translate-x-0`. Active item `bg-blue-50 text-blue-600 border-l-4`. |
| `src/components/KpiCard.jsx` | Stateless KPI tile | Props `title/value/isLoading/icon/iconBg/iconColor/barColor/barWidth/subtitle`. Renders value or `-`, optional subtitle, progress bar inline `width:%`. |
| `src/components/StudentListGrid.jsx` | Searchable student card grid | Props `students/onViewProfile/onAddStudent/readOnly`. State `search/filter`; `useMemo filteredStudents`; `filters [Semua,ITW,DFK,DGA,SLR,DCG,SED,PPU]`; `courseMap` long names. Card banner `bg-[#0C2461]`, avatar `bg-[#1251AA]`. Hides add button when `readOnly`. |
| `src/components/StudentModal.jsx` | Add/edit student dialog | Props `isOpen/onClose/editingStudent/formData/handleInputChange/handleSubmit`. `useRef modalRef` + Escape listener + backdrop click (`!contains(e.target)`). ID disabled when editing. Grid 2-col inputs. |
| `src/components/StudentDetailModal.jsx` | Unified detail viewer | Props `kind/appointment/report/item/onClose/onDownload/onPrint/onShare`. Resolves `item.itemType \|\| kind`; early null if no data. Appointment branch (priority, `formatMsDate`, counselor, reason/notes) vs report branch (message, `filePath` iframe `h-96`, download `<a download>` + `window.open`). |
| `src/components/ReportFormModal.jsx` | Referral creator (staff -> counselor) | Props `isOpen/onClose/student/interventionType`. State `reason/priority/scheduledDate/counselorId/counselors/isSubmitting/toast` + `useFilePreview`. On open fetches `GET /api/auth/users` (filter counselors), defaults tomorrow 09:00. Submits `FormData -> POST /api/reports`. Labels `interventionLabels {kaunseling/klinik/softskills}`. |
| `src/components/GenerateReportModal.jsx` | Letter/message creator (staff -> student inbox) | Props `isOpen/onClose/student/skillGap`. State `title/message/isSubmitting/toast` + `useFilePreview({acceptTypes:['pdf']})`. On open presets `title = Laporan Prestasi & Intervensi: <nama>`. Submits `FormData (+ploScores JSON, employability) -> POST /api/student-reports`. Auto-close 1500 ms on success. |
| `src/components/JobCard.jsx` | Career recommendation tile | Prop `job{icon,title,company,match}`. Group-hover icon invert, `ph-sparkle {match} Match` badge, full-width apply button. |
| `src/components/ui/AttachmentPreview.jsx` | File chip with inline preview | Props `file{name,type,size}/previewUrl/onRemove`. Branches PDF (`iframe h-48`) vs image (`img max-h-48 object-contain`) vs generic icon. `formatFileSize` for label. |
| `src/components/ui/dashboard-kit.jsx` | Shared primitives | `formatMsDate(value,withTime)`, `Badge({tone,children})`, `StatCard({icon,label,value,tone})`, `SectionCard({icon,title,subtitle,actions,children})`, `PillTabs({tabs,activeTab,setActiveTab})`, `EmptyState({icon,title,message})`, `SkeletonList({rows})`. |
| `src/lib/auth.js` | Server auth readers | `getStoredUser()`, `getToken()`, `getDashboardPathForRole(role)`. Uses `next/headers cookies()`. |
| `src/lib/client-auth.js` | Browser cookie readers | `getClientUser()` (parses `document.cookie`, SSR-safe), `getClientToken()` (returns `"proxy-handled"` sentinel). |
| `src/lib/roles.js` | Role constants | `ROLES`, `getRoleLabel(role)`, `isStaff(role)`. Labels: `admin=Penyelaras`, `counselor=Kaunselor`, `user=Pelajar`. |
| `src/lib/heuristics.js` | Employability math | `calculateEmployability`, `calculateTopPerformerScore`. Single source for KPI derivations. |
| `src/lib/use-file-preview.js` | Upload validation hook | `MAX_ATTACHMENT_BYTES=5MB`, `formatFileSize(bytes)`, `useFilePreview({acceptTypes,maxBytes})` -> `{file,previewUrl,error,selectFile,clear}` with `URL.createObjectURL` + `revokeObjectURL` cleanup. |
| `src/__tests__/Login.test.jsx` | Frontend unit test | Mocks `next/navigation`, `next/script`, `@/app/actions`; asserts heading `Selamat Kembali`, labels `Emel Pengguna`/`Kata Laluan`, button `Log Masuk Dashboard`. |
| `backend/server.js` | Express bootstrap | Creates `app`, middleware, static, Swagger, mounts `/api/health`, `/api/auth`, `/api/reports`, `/api/student-reports`, `/api` (items), `mongoose.connect` + stuck-MDB recovery, `app.listen(PORT\|\|5000)`. Exports `app` for tests. Skips DB when `NODE_ENV=test`. |
| `backend/auth.js` | Auth router (`/api/auth`) | `GET /users` (admin-only, sanitized list), `POST /login` (public, 400 without fields, 401 on bad creds, 200 `{message,user,token}`). Delegates to `auth.model.js`. |
| `backend/auth.model.js` | Credential store logic | `readLoginDatabase()`, `sanitiseUser()`, `getAllLoginUsers()`, `getPublicLoginUsers()`, `authenticateUser(email,password)` (bcrypt compare + `jwt.sign 8h`). Backed by `User` collection. |
| `backend/items.js` | Student/AI/MDB router (`/api`) | Multer configs + `sanitizeHistory`, `callGeminiAPI`, `callGeminiStreamAPI`, `executeEtlAndSync`. 14 endpoints: student CRUD, skill-gap, certs, profile-image, manual predict, MDB upload/list/process/delete, AI chat (staff + rate-limited). See Section 3 matrix. |
| `backend/item.model.js` | Student normalization + AI fallback | `normaliseStudent(record)` (frontend shape + risk + `certificationScores {Tiada:35,CompTIA:70,Cisco CCNA:85,AWS Cloud:90}`), `getStudentsDataset()`, `buildMetrics()`, `buildInsight()`, `getRealAIPrediction(features)` (ML call + rule fallback), `getAllStudents/getStudentById/getStudentSkillGapById/createStudent/updateStudent/deleteStudent`. |
| `backend/reports.js` | Referral router (`/api/reports`) | `POST /` (create scheduled referral + file), `GET /` (counselor-scoped vs all), `GET /mine` (student own accepted/scheduled), `GET /:id`, `PATCH /:id` (state machine `pending/accepted/scheduled/completed/rejected` + notes-only). `safeUnlink` helper. |
| `backend/studentReports.js` | Letter router (`/api/student-reports`) | `POST /` (`reportType = file+message?full:file?letter:message`, `ploScores` parse, employability clamp), `GET /` (user/counselor/admin scoping), `GET /:id` (marks `readByStudent` on owner read), `DELETE /:id` (author/admin only). `safeUnlink` helper. |
| `backend/middleware/authMiddleware.js` | JWT guards | `verifyToken` (Bearer parse + `jwt.verify`), `requireAdmin`, `requireStaff`, `requireOwnershipOrAdmin (staff \|\| studentId match)`. Malay error messages, 401/403 codes. |
| `backend/models/Student.js` | Student schema | `ID_Pelajar, Nama, Kursus, Semester, Kehadiran_Pct, CGPA, Sijil_Profesional, PLO_1..9, Status_Pelajar, No_KP/No_Telefon/Alamat, academicHistory[{semester,gpa,cgpa,attendance}], uploadedCertificates[{name,issuer,fileName,filePath,uploadDate}], profileImage`. |
| `backend/models/User.js` | Login schema | `email (unique, required), password (required), role enum [admin,counselor,user], displayName, studentId`. |
| `backend/models/Report.js` | Referral schema | `studentId/studentName (indexed), course/cgpa/attendance/riskLevel, interventionType enum [kaunseling,klinik,softskills], reason, priority [urgent,normal], status [pending,accepted,scheduled,completed,rejected] default pending, adminEmail, counselorId, counselorNotes, scheduledDate, fileName/filePath, timestamps`. |
| `backend/models/StudentReport.js` | Letter schema | `studentId/studentName (indexed), course/cgpa/attendance/riskLevel/semester, ploScores[{label,value}], employability, authorEmail/authorRole [admin,counselor]/authorName, title/message/fileName/filePath, reportType [message,letter,full], readByStudent, timestamps`. |
| `backend/models/MdbFile.js` | MDB ingestion schema | `datasetName, originalName, filePath, fileSize, status [Saved,Processing,Processed,Failed], recordsProcessed, uploadDate, processedDate`. |
| `backend/repredict-status.js` | Batch risk backfill script | `main()`: reads all `Student`, chunks 500, `POST ML/predict/batch`, `bulkWrite update Status_Pelajar`. Standalone, no HTTP exposure. |
| `backend/seed.js` / `backend/seed-admin.js` | Seed scripts | `seedDatabase()` upserts students from JSON + demo users (`admin/counselor/user@ikmb.edu.my / password123`); `seedAdminDatabase()` upserts only 3 accounts. `findOneAndUpdate + upsert`, no deletes. |
| `backend/__tests__/auth.test.js` / `items.test.js` | Backend tests | Auth: mocked `auth.model.js`, login success (200 + token + admin) vs wrong password (401). Items: unauthenticated `GET /api/students` -> 401, invalid Bearer -> 401. |
| `ML/ml.py` | FastAPI inference + ETL | `read_root (GET /)`, `predict_risk (POST /predict/risk)`, `predict_batch (POST /predict/batch)`, `etl_process_mdb (POST /etl/process-mdb)`, helpers `get_table_data/inspect_mdb/process_mdb_data`. Loads `model_ai_risiko_lengkap_v4.pkl` via joblib at import. Computes `PLO_Avg (mean)`, `PLO_Variance (var)`, reorders via `feature_names_in_` if present. |
| `ML/train_and_evaluate.py` / `train_and_evaluate_v4.py` | Model trainers | 13-col GridSearch `RandomForestClassifier` on `backend/db/ml_training_data_real.csv`. v4 adds `No_Pelajar str`, `Avg_Subjek_Attendance NaN->80`, `GroupShuffleSplit` when duplicated students, adaptive `cv (5/3/2)`, logs train/test student counts. Output `model_ai_risiko_lengkap_v4.pkl`. |
| `ML/test_ml.py` | ML tests | `TestClient(app)`: health 200, valid `POST /predict/risk (CGPA 3.9, Att 100, PLO 95x9)` -> prediction in set, invalid (missing PLO) -> 422. |
| `compose.yml` / `Containerfile.frontend` / `ML/Containerfile` / `backend/Containerfile.backend` | Deployables | Compose 4 services + `tvet_net`; frontend 3-stage standalone; ML `python:3.9-slim + mdbtools`; backend `node:20-alpine`. Ports `27017/5000/8000/8080->3000`. |

## 3. Role-Based Access Control (RBAC) & Permissions

### Role Definitions

| Role | Value | Group | Intended Purpose |
| :--- | :--- | :--- | :--- |
| Guest (unauthenticated) | — | `guest` | Public visitor. May only view login page `/` (and alias `/login`). Any other route redirects to `/`. Any `/api/*` without `Bearer` returns `401`. |
| Pelajar (Student) | `user` | `student` | TVET student. Linked to exactly one `Student.ID_Pelajar` via `User.studentId`. Sees only own record, own skill-gap, own certificates/profile image, own inbox (`student-reports` where `studentId` matches + `reports/mine` where `studentId` matches and status accepted/scheduled), career/course recommendations. Cannot create referrals, letters, students, or MDB operations. Demo account `user@ikmb.edu.my / password123`. |
| Kaunselor (Counselor) | `counselor` | `staff` | Counseling staff. Full staff dashboards except MDB data pipeline. Owns intervention queue: views `pending` + assigned reports, accepts/rejects/schedules/completes, manages calendar, sends letters to students, views all students/skill-gaps. Cannot upload/process/delete MDB, cannot list all users, cannot reset arbitrary reports unless admin (reset is admin-only). Demo account `counselor@ikmb.edu.my / password123`. |
| Penyelaras (Admin) | `admin` | `staff` | Coordinator with full control. All counselor abilities plus MDB lifecycle (upload/list/process/delete), user listing, student CRUD, manual predict, AI chat, letter delete for any author, report reset to `pending` for completed/rejected items. Demo account `admin@ikmb.edu.my / password123`. |

Role labels come from `src/lib/roles.js` (`ROLES` map + `getRoleLabel` fallback `'Tidak Diketahui'`). JWT claim `role` is the enforcement source; `user` cookie mirrors it for Edge middleware + UI.

### Permission Matrix

Legend: ✅ allowed, ❌ denied (401 unauthenticated, 403 forbidden, or Edge redirect).

| Resource / Route / Action | Guest | Pelajar (`user`) | Kaunselor (`counselor`) | Penyelaras (`admin`) |
| :--- | :---: | :---: | :---: | :---: |
| `GET /` and `GET /login` (login UI) | ✅ | ➡️ redirect to `/student-dashboard` | ➡️ redirect to `/staff-dashboard` | ➡️ redirect to `/staff-dashboard` |
| `GET /student-dashboard` | ➡️ redirect `/` | ✅ (own data only) | ➡️ redirect `/staff-dashboard` | ➡️ redirect `/staff-dashboard` |
| `GET /staff-dashboard` | ➡️ redirect `/` | ➡️ redirect `/student-dashboard` | ✅ (without Data tab) | ✅ (all 7 tabs) |
| `GET /student-profile?id=:id` | ➡️ redirect `/` | ➡️ redirect `/student-dashboard` | ✅ (any id; intervention buttons enabled) | ✅ (any id; + reset powers) |
| `POST /api/auth/login` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/auth/users` | ❌ 401 | ❌ 403 (staff only) | ❌ 403 (admin only) | ✅ |
| `GET /api/students` | ❌ 401 | ✅ scoped (returns `[own]` if `studentId` set, else all — normally own only) | ✅ (all) | ✅ (all) |
| `POST /api/students` | ❌ 401 | ❌ 403 | ✅ | ✅ |
| `PUT /api/students/:studentId` | ❌ 401 | ❌ 403 | ✅ | ✅ |
| `DELETE /api/students/:studentId` | ❌ 401 | ❌ 403 | ✅ | ✅ |
| `GET /api/students/:studentId` | ❌ 401 | ✅ only if `JWT.studentId == :studentId` | ✅ (any) | ✅ (any) |
| `GET /api/students/:studentId/skill-gap` | ❌ 401 | ✅ only own | ✅ (any) | ✅ (any) |
| `POST /api/students/:studentId/certificates` | ❌ 401 | ✅ only own | ✅ (any, staff override) | ✅ (any) |
| `DELETE /api/students/:studentId/certificates/:certId` | ❌ 401 | ✅ only own | ✅ (any) | ✅ (any) |
| `POST /api/students/:studentId/profile-image` | ❌ 401 | ✅ only own | ✅ (any) | ✅ (any) |
| `POST /api/predict/manual` | ❌ 401 | ❌ 403 | ✅ | ✅ |
| `POST /api/data/upload-mdb` | ❌ 401 | ❌ 403 | ❌ 403 (admin only) | ✅ |
| `GET /api/data/mdb-files` | ❌ 401 | ❌ 403 | ❌ 403 | ✅ |
| `POST /api/data/process-mdb/:id` | ❌ 401 | ❌ 403 | ❌ 403 | ✅ (409 if already Processing; 404 if missing) |
| `DELETE /api/data/mdb-files/:id` | ❌ 401 | ❌ 403 | ❌ 403 | ✅ (409 if Processing) |
| `POST /api/ai/chat` | ❌ 401 | ❌ 403 | ✅ (15 req/min per email) | ✅ (15 req/min per email) |
| `POST /api/reports` (create referral) | ❌ 401 | ❌ 403 | ✅ | ✅ |
| `GET /api/reports` (queue) | ❌ 401 | ❌ 403 | ✅ scoped (`pending` + `counselorId == email`) | ✅ (all) |
| `GET /api/reports/mine` | ❌ 401 | ✅ (own `accepted/scheduled` by `studentId`; `[]` if no `studentId`) | ✅ (same rule; typically `[]`) | ✅ (same rule) |
| `GET /api/reports/:id` | ❌ 401 | ❌ 403 | ✅ only if `pending` or assigned | ✅ (any) |
| `PATCH /api/reports/:id` (`accepted/rejected/scheduled/completed/pending` + notes) | ❌ 401 | ❌ 403 | ✅ (accept/reject/schedule/complete + notes) but reset-to-pending is admin UI pattern | ✅ (all incl. reset `pending`) |
| `POST /api/student-reports` (send letter) | ❌ 401 | ❌ 403 | ✅ | ✅ |
| `GET /api/student-reports` | ❌ 401 | ✅ scoped own `studentId` | ✅ scoped `authorEmail == email` | ✅ (all) |
| `GET /api/student-reports/:id` | ❌ 401 | ✅ only own (marks `readByStudent=true`) | ✅ only if author or (edge: owner check fails for staff) — in practice own sent letters | ✅ (any) |
| `DELETE /api/student-reports/:id` | ❌ 401 | ❌ 403 | ✅ only own authored (`authorEmail` match) | ✅ (any) |
| `GET /api/health` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/docs` (Swagger) | ✅ (no guard in `server.js`) | ✅ | ✅ | ✅ |
| `POST /predict/risk`, `POST /predict/batch`, `POST /etl/process-mdb` (ML, direct port 8000) | ✅ (no auth; internal network only) | ✅ (same) | ✅ | ✅ |
| UI: Staff `management` tab (student add/edit/delete) | — | — | ✅ visible + enabled | ✅ visible + enabled |
| UI: Staff `data` tab (MDB upload/process/delete) | — | — | ❌ hidden (`navItems` filters out `data` for counselors; API also 403) | ✅ visible + enabled |
| UI: Staff `counselor` tab (queue + calendar + sent) | — | — | ✅ header `Kaunselor`; no reset button | ✅ header `Penyelaras`; extra `Set Semula` on completed/rejected |
| UI: Student tabs `dashboard/profile/reports/career/courses` | — | ✅ all | — | — |
| UI: `StudentProfileClient` intervention cards + Generate/Hantar buttons | — | — | ✅ enabled (`isStaff`) | ✅ enabled |
| UI: `StudentListGrid` Tambah button | — | — | ✅ when `readOnly=false` | ✅ when `readOnly=false` |

### Enforcement Mechanism

1. **Edge Middleware (`middleware.js`, runs before rendering):** Reads `user` cookie (`JSON.parse`, null on missing/corrupt). `isLoginPage = pathname === '/' || pathname === '/login'`: if `user` exists redirects to `/staff-dashboard` (staff) or `/student-dashboard` (student). If no `user` and not login page redirects to `/`. Staff routes (`/staff-dashboard`, `/student-profile`) require `role admin|counselor`, else redirect to `/student-dashboard`. Student route (`/student-dashboard`) rejects staff to `/staff-dashboard`. Matcher excludes `api`, `_next/static`, `_next/image`, `favicon.ico`, `assets`. No JWT verification here — trusts `user` cookie for routing only; real authorization happens in backend.
2. **Backend JWT guards (`backend/middleware/authMiddleware.js`):** `verifyToken` requires `Authorization: Bearer <jwt>`, verifies with `JWT_SECRET`, attaches `req.user {email, role, studentId}`, 401 on missing/invalid. `requireAdmin` (role must be `admin`, 403 else), `requireStaff` (`admin|counselor`, 403 else), `requireOwnershipOrAdmin` (`isStaff || JWT.studentId === req.params.studentId`, 403 else). Applied per-route in `auth.js` (`verifyToken+requireAdmin` for `GET /users`), `items.js` (e.g. `verifyToken` for list, `+requireStaff` for create/update/delete/manual-predict/AI-chat, `+requireOwnershipOrAdmin` for detail/skill-gap/certs/profile-image, `+requireAdmin` for MDB), `reports.js` (`+requireStaff` for create/list/detail/patch; none for `/mine`), `studentReports.js` (`+requireStaff` for create/delete; ownership/author checks inline for read).
3. **Proxy token bridge (`src/app/api/[...proxy]/route.js` + `src/app/actions.js` + `src/lib/*auth.js`):** Browser never holds JWT in JS-accessible storage except the HttpOnly `ikmbToken` cookie. `loginAction` sets it `httpOnly:true`; `getClientToken()` returns sentinel `"proxy-handled"`; every client fetch sends `Authorization: Bearer proxy-handled`; proxy replaces it with the real cookie value before calling Express. `user` cookie (`httpOnly:false`) is the only client-readable identity, used by `getClientUser()`/`getStoredUser()` for UI labels, tab filtering, and Edge redirects.
4. **UI-level gating (defense in depth, not security boundary):** `StaffDashboardClient` hides `data` tab for counselors and only calls `fetchMdbFiles` for admins; `StudentDashboardClient` hides student selector for restricted users (`students.length>1 && !isRestricted`) and filters list to own `studentId`; `StudentProfileClient` disables intervention buttons when `!isStaff`; `StudentListGrid` hides add button when `readOnly`; `CounselorDashboardClient` shows `Set Semula` only when `isAdmin`. All are backed by backend 403s if bypassed.
5. **ML isolation:** `ml.py` endpoints have no auth; protection is network-level (only `backend` container + internal callers know `http://ml-api:8000`; frontend never calls ML directly; `ML_API_URL` is server-only env).

## 4. Page Breakdown, UI Behaviors & Animations

### Login (`src/app/page.jsx` + `src/components/auth/LoginForm.jsx`)

- **Route:** `/` (alias `/login` handled in middleware; `page.jsx` only mounts at `/`).
- **Access Level:** Public. Authenticated users are bounced by middleware to their dashboard.
- **Primary Function & User Flow:**
  1. User lands on split-screen login. Left panel shows brand, right card shows form.
  2. User edits `Emel Pengguna` (prefilled `admin@ikmb.edu.my`) and `Kata Laluan` (prefilled `password123`; hint lists `user@ikmb.edu.my` alternative).
  3. User clicks `Log Masuk Dashboard`. `SubmitButton` switches to `Memproses...` and disables.
  4. `loginAction` POSTs to backend, sets `user` + `ikmbToken` cookies, redirects to `/staff-dashboard` (admin/counselor) or `/student-dashboard` (user).
  5. On bad credentials the same page re-renders with red error box (`state.error`); no navigation.
- **Components Used:** `LoginPage` (RSC wrapper) -> `LoginForm` (client) -> inner `SubmitButton` (`useFormStatus`). Next `Script` (Phosphor), `next/image` vs `<img>` logo, no sidebar/KPI/chart.
- **Animations & Visual Transitions:**
  - **Type:** Button press micro-interaction.
  - **Implementation:** `bg-blue-600 hover:bg-blue-700 hover:scale-[1.02]` vs pending `bg-blue-400`; `transition` via Tailwind.
  - **Trigger:** Hover + `pending=true` during Server Action.
  - **Configuration/Props:** No duration override; scale `1.02`; text swap `Log Masuk Dashboard` <-> `Memproses...`.
  - **Type:** Static brand ambience (no entrance animation).
  - **Implementation:** Left panel `bg-blue-600` + Unsplash `<img className="opacity-40 mix-blend-overlay">` + two absolute `blur-3xl` circles.
  - **Trigger:** Initial paint.
  - **Configuration/Props:** None animated; purely layered opacity/blend.

### Staff Dashboard (`src/app/staff-dashboard/page.jsx` + `src/components/dashboard/StaffDashboardClient.jsx`)

- **Route:** `/staff-dashboard` (no query params; tab is client state default `overview`).
- **Access Level:** Protected, staff-only (`admin`, `counselor`). Guests -> `/`; students -> `/student-dashboard` (Edge). Backend further 403s non-staff on student mutations/AI/reports.
- **Primary Function & User Flow:**
  1. Shell mounts, reads `getClientUser()`; shows `Memuatkan...` spinner gate while `isLoading || !user`.
  2. Fetches `GET /api/students` (Bearer proxy-handled); admins also `GET /api/data/mdb-files`. Sidebar shows role label + initials + 7 (admin) or 6 (counselor, no `data`) nav items.
  3. `overview` tab: views 4 `KpiCard`s (total, high-risk, avg employability, top-performer count), Bar PLO chart, high-risk list, top-5 table, search + `StudentListGrid` (click -> `router.push('/student-profile?id=<id>')`).
  4. `prediction` tab: picks student from dropdown, types in AI chat, streams Gemini answer with bold/italic/bullet rendering; history kept in `aiMessages`.
  5. `skills` tab: reads PLO table (`gap/target/status Selamat/Perlu Peningkatan/Kritikal`).
  6. `pathways` tab: views PLO->course cards + recommended list sorted by gap.
  7. `management` tab: searches table, opens `StudentModal` to add (`POST`) or edit (`PUT`), deletes (`DELETE`) with confirm, navigates to profile.
  8. `counselor` tab: embeds `<CounselorDashboardClient currentUser={user}/>` (queue/calendar/sent; see below).
  9. `data` tab (admin only): uploads `.mdb` (`datasetName` + file -> `POST /api/data/upload-mdb` with raw-text debug log), lists files with status badges, processes (`POST /api/data/process-mdb/:id` -> refresh students), deletes (`DELETE`), auto-polls every 3 s while `Processing`.
- **Components Used:** `StaffDashboardClient` + `Sidebar`, `KpiCard`, `StudentListGrid`, `StudentModal`, `CounselorDashboardClient`, `AppointmentCalendar` (inside counselor tab), `StatCard/SectionCard/PillTabs/EmptyState/SkeletonList/Badge/formatMsDate` (kit), `Bar` (chart.js), `AttachmentPreview` indirectly via modals.
- **Animations & Visual Transitions:**
  - **Type:** Tab content entrance.
  - **Implementation:** Wrapper `animate-[fadeIn_0.3s_ease-in-out]` (from `globals.css` keyframe).
  - **Trigger:** `activeTab` change / route mount.
  - **Configuration/Props:** `fadeIn` 0.3 s ease-in-out, translateY 6px->0, opacity 0->1.
  - **Type:** Sidebar slide (mobile).
  - **Implementation:** `transform translate-x-0 / -translate-x-full transition-transform duration-300` + `fixed inset-y-0 left-0 z-30 w-64` vs `md:relative md:translate-x-0`; overlay `fixed inset-0 bg-black/50 z-20 md:hidden`.
  - **Trigger:** Hamburger toggle `setIsSidebarOpen`.
  - **Configuration/Props:** 300 ms transform; shadow `shadow-2xl md:shadow-none`.
  - **Type:** Card hover lift.
  - **Implementation:** Student cards `hover:shadow-lg hover:-translate-y-1 transition-all duration-300`; report cards `hover:shadow-md`; `JobCard`-style buttons `hover:bg-blue-600 hover:text-white`.
  - **Trigger:** Hover.
  - **Configuration/Props:** 300 ms all-properties.
  - **Type:** Progress + chart transitions.
  - **Implementation:** `KpiCard` bar `transition-all duration-500` with `style={{width:%}}`; Chart.js default canvas tween on data change.
  - **Trigger:** Data load / filter change.
  - **Configuration/Props:** 500 ms width; Chart.js DejaVu (no custom easing).
  - **Type:** AI streaming feedback.
  - **Implementation:** Placeholder bubble `streaming:true` shows three dots `animate-bounce` with `[animation-delay:0ms/150ms/300ms]` + trailing caret `animate-pulse`; input spinner `ph-spinner-gap animate-spin` while `isAiTyping`; `chatEndRef.scrollIntoView({behavior:'smooth'})` on `aiMessages` change.
  - **Trigger:** `handleSendAiMessage` -> SSE `reader.read()` chunks append to last message; error inserts `⚠️ Ralat` bubble.
  - **Configuration/Props:** Plain-text SSE (`text/plain`), `TextDecoder`, `data:` JSON parse per chunk; fallback to single JSON `callGeminiAPI` if stream fails.
  - **Type:** Skeleton loading.
  - **Implementation:** `SkeletonList rows=3` (`space-y-3 animate-pulse h-16 bg-slate-100 rounded-xl`) + data-table `animate-pulse` rows while `isLoadingFiles`.
  - **Trigger:** Initial fetch + MDB processing poll.
  - **Configuration/Props:** 3 rows default; poll interval 3000 ms cleared on unmount or when no `Processing`.

### Student Dashboard (`src/app/student-dashboard/page.jsx` + `src/components/dashboard/StudentDashboardClient.jsx`)

- **Route:** `/student-dashboard` (tab is client state default `dashboard`; student is `selectedStudentId` state, not URL).
- **Access Level:** Protected, student-only in practice (`user` role; staff are Edge-redirected away, though backend would allow staff to call the same APIs with broader scope).
- **Primary Function & User Flow:**
  1. Mount reads `getClientUser()`; `GET /api/students` then filters to own `studentId` when `role user && studentId` (restricted mode hides selector, shows badge with `displayName`).
  2. On `selectedStudentId` change fetches `GET /api/students/:id/skill-gap` (Radar + insight) and `GET /api/students/:id` (certs).
  3. `dashboard` tab: views risk badge, 3 KPI cards, Radar (`Data Pelajar` vs `Target`), weakest-PLO recommendation card, profile image upload (`POST profile-image`), academic history.
  4. `profile` tab: edits cert list — inputs `name/issuer` + file picker, `POST certificates` (FormData), deletes via `DELETE certificates/:certId`; previews via `previewUrl`.
  5. `reports` tab: embeds `<MergedLaporanTab user={user}/>` — filters All/Letters/Appointments, clicks card -> `StudentDetailModal`, unread letters auto-mark read.
  6. `career` tab: views dark AI-match card + two `JobCard`s from `careerMapping[kursus]` (e.g. ITW -> Juruteknik Kimpalan 6G 95%, DFK -> Cloud Engineer 94%).
  7. `courses` tab: views PLO course cards (`courseMappings`) with colored headers + CTA buttons.
- **Components Used:** `StudentDashboardClient` + `Sidebar`, `MergedLaporanTab`, `StudentDetailModal`, `JobCard`, `Radar` (chart.js), `PillTabs/SkeletonList/EmptyState/Badge/StatCard/SectionCard`, `AttachmentPreview` pattern for cert file chip.
- **Animations & Visual Transitions:**
  - **Type:** Tab + card entrance.
  - **Implementation:** `animate-[fadeIn_0.3s_ease-in-out]` on tab root; cards `bg-white rounded-2xl border` with `hover:shadow-md` on inbox items; unread inbox `border-blue-300 bg-blue-50/30 ring-1 ring-blue-200` + dot `w-2 h-2 bg-blue-500 rounded-full`.
  - **Trigger:** Tab switch, filter change, item read.
  - **Configuration/Props:** 0.3 s fadeIn; `line-clamp-2 italic` preview truncation.
  - **Type:** Sidebar + search parity with staff.
  - **Implementation:** Same `transition-transform duration-300` slide + `bg-slate-100 px-4 py-2.5 rounded-full` search.
  - **Trigger:** Mobile toggle / typing.
  - **Configuration/Props:** Identical 300 ms.
  - **Type:** Upload progress (no determinate bar).
  - **Implementation:** Button disables + `isUploadingCert` spinner text `Memuat Naik...`; file chip shows `formatFileSize` + remove `ph-x hover:text-red-500`.
  - **Trigger:** `handleAddCertificate` / `handleProfileImageChange`.
  - **Configuration/Props:** `FormData{name,issuer,file}`; success appends `data.certificate` locally, failure shows inline error.

### Student Profile (`src/app/student-profile/page.jsx` + `src/components/dashboard/StudentProfileClient.jsx`)

- **Route:** `/student-profile?id=<ID_Pelajar>` (e.g. `?id=TVET001`; defaults to `TVET001` when missing because `searchParams?.id || 'TVET001'`).
- **Access Level:** Protected, staff-only. Students Edge-redirected to `/student-dashboard`. Buttons additionally `disabled={!isStaff}`.
- **Primary Function & User Flow:**
  1. RSC awaits `searchParams`, passes `studentId` to client. Client fetches `GET /api/students/:id/skill-gap` + `getClientUser()`.
  2. Loading shows centered spinner (`animate-spin rounded-full border-[#1251AA]`); error shows red box with message; empty shows `Tiada data`.
  3. Header card shows avatar (initials on `bg-[#1251AA]`), name, course long name (`getFullCourseName`), semester, `StatusBadge` (Tinggi red `ph-warning-octagon`, Sederhana amber `ph-clock`, Rendah/Cemerlang emerald `ph-check-circle`), CGPA color (red <2.0, amber <3.0, emerald else), attendance, employability (`min(100, round(cgpa/4*40+attendance*0.6))`).
  4. Tabs `personal/academic/skills`: personal (bio + certs + profile image), academic (dual-axis Bar trend GPA + attendance + history table), skills (Radar + PLO grid + AI insight dark card `bg-gradient-to-br from-slate-900 to-slate-800`).
  5. Actions: `Cetak` (`window.print`), `Muat Turun JSON` (blob `Profil_Pelajar_<id>.json` with details/history/insight/employability/ploScores), `Jana Laporan` (opens `GenerateReportModal`), 3 intervention cards (kaunseling red, klinik orange, softskills blue -> opens `ReportFormModal` with `interventionType`).
  6. Modals submit to `POST /api/student-reports` (letter) or `POST /api/reports` (referral) with optional file; success toasts auto-close.
- **Components Used:** `StudentProfileClient` (+ `StatusBadge`) + `ReportFormModal` + `GenerateReportModal` + `AttachmentPreview` (inside modals) + `Bar` + `Radar` + kit (`Badge` for PLO chips).
- **Animations & Visual Transitions:**
  - **Type:** Page + modal entrance.
  - **Implementation:** Page `min-h-screen bg-[#EEF3FB] p-6`; breadcrumb hover underline; sticky left card `sticky top-6`; modals `fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]` + panel `bg-white rounded-2xl shadow-2xl max-w-2xl max-h-[90vh] overflow-y-auto`.
  - **Trigger:** Route mount with `?id=`; button clicks for modals; `onClose` on backdrop (`!contains`) + `ph-x` + Escape.
  - **Configuration/Props:** 0.2 s fadeIn for modals; inputs `border-slate-300 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500`; priority toggles `bg-blue-50/border-blue-500` vs `bg-red-50/border-red-500`; submit `bg-emerald-600 hover:bg-emerald-700` (letter) / `bg-blue-600` (referral) with `ph-spinner-gap animate-spin` while submitting; toast `bg-green-50/border-green-200` vs `bg-red-50` auto-dismiss 1500 ms (letter) / 3000 ms (counselor queue).
  - **Type:** Tab underline.
  - **Implementation:** Active tab `border-b-2 border-[#1251AA] text-[#1251AA]` vs inactive `text-slate-500`.
  - **Trigger:** `setActiveTab`.
  - **Configuration/Props:** No transition duration (instant swap).

### Counselor Workspace (embedded in Staff Dashboard: `CounselorDashboardClient.jsx` + `AppointmentCalendar.jsx` + `StudentDetailModal.jsx`)

- **Route:** No standalone URL; rendered as `counselor` tab inside `/staff-dashboard`. Deep-linking is via parent tab state only.
- **Access Level:** Staff-only (inherits parent). `isAdmin` toggles header copy + `Set Semula` button; queue scoping differs (counselor sees `pending` + own assigned; admin sees all).
- **Primary Function & User Flow:**
  1. Mount `Promise.all`-style dual fetch: `GET /api/reports` (queue) + `GET /api/student-reports` (sent letters).
  2. `calendar` tab: month grid (Monday-first) shows chips per day (red for `urgent`, purple otherwise + red dot for urgent); click day selects; side panel lists day details with `Selesai` shortcut (`onComplete` -> complete modal); upcoming list (max 5, `max-h-64 overflow-y-auto`) jumps selection.
  3. `pending` tab: cards show student/course/CGPA/attendance, `interventionType` label, `reason` box, `scheduledDate` request, optional file preview; actions `Terima` (`PATCH {action:accepted}`) / `Tolak` (`PATCH {action:rejected}`) / `Jadual` (opens schedule modal with `datetime-local` default tomorrow 09:00 -> `PATCH {action:scheduled, scheduledDate, counselorNotes}`).
  4. `scheduled` tab: same cards + `Selesaikan` (opens complete modal -> `PATCH {action:completed, counselorNotes}`).
  5. `completed` / `all` tabs: read-only history with status `Badge`; admins see `Set Semula` (`PATCH {action:pending}`).
  6. `sent-reports` tab: letters authored (counselor sees own, admin all); delete with `confirm()` -> `DELETE /api/student-reports/:id`.
  7. All mutations `showToast(type,text)` (`fixed top-4 right-4 z-[60] animate-[fadeIn_0.3s] bg-emerald-600/bg-red-600 text-white`) auto-clear 3 s, then refetch.
- **Components Used:** `CounselorDashboardClient` + `AppointmentCalendar` + `StudentDetailModal` (view only) + kit (`PillTabs` with counts, `SkeletonList`, `EmptyState`, `Badge`, `formatMsDate`).
- **Animations & Visual Transitions:**
  - **Type:** Toast slide-fade.
  - **Implementation:** `fixed top-4 right-4 z-[60] animate-[fadeIn_0.3s_ease-in-out]` green/red pill.
  - **Trigger:** Every accept/reject/schedule/complete/delete/reset.
  - **Configuration/Props:** 0.3 s; auto-dismiss 3000 ms via `setTimeout`.
  - **Type:** Calendar selection.
  - **Implementation:** Cells `h-16 rounded-lg border p-1.5`; selected `bg-blue-50 border-blue-400 ring-1`; today `bg-blue-50/50 border-blue-200`; nav buttons `w-9 h-9 rounded-lg border hover:bg-slate-50 ph-caret-left/right`.
  - **Trigger:** `prevMonth/nextMonth` (resets `selectedDay`), day click `setSelectedDay(dayKey)`.
  - **Configuration/Props:** Monday-first offset `startDow = getDay()===0?6:getDay()-1`; time label `toLocaleTimeString('ms-MY',{hour:'2-digit',minute:'2-digit'})`.
  - **Type:** Modal + card parity.
  - **Implementation:** Schedule/complete modals `fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s]` + `max-w-md`; cards `rounded-2xl border p-5 hover:shadow-md`; reason `bg-slate-50 border`, notes `bg-emerald-50`.
  - **Trigger:** Open/close/success.
  - **Configuration/Props:** 0.2 s fadeIn; buttons `bg-blue-600/purple-600/emerald-600` per action.

## 5. Data Flow & State Lifecycles

### End-to-End Flow (Browser -> Next.js -> Express -> MongoDB / ML / Gemini)

1. **Login:** Browser `POST` (Server Action) -> Next `actions.js` -> `POST http://backend:5000/api/auth/login {email,password}` -> `auth.model.authenticateUser` (`User.find`, `bcrypt.compare`, `jwt.sign 8h`) -> `{user (sanitized), token}` -> Next sets `user` + `ikmbToken` cookies -> `redirect()` -> Edge `middleware.js` routes by `user.role` on next request.
2. **Authenticated read (example student list):** `StaffDashboardClient useEffect` -> `fetch('/api/students', {headers:{Authorization:'Bearer proxy-handled'}})` -> Next proxy `api/[...proxy]` reads `ikmbToken`, forwards `Authorization: Bearer <real JWT>` to `GET http://backend:5000/api/students` -> `verifyToken` -> `items.js` handler (`getAllStudents()` for staff, `[getStudentById]` for owned student) -> `item.model.normaliseStudent` (risk + cert scores) -> JSON -> proxy streams back -> `setStudents()` -> `useMemo` derivations (KPIs, charts, filters) -> render.
3. **Skill-gap read:** `StudentDashboardClient` / `StudentProfileClient` -> `GET /api/students/:id/skill-gap` -> `verifyToken + requireOwnershipOrAdmin` -> `getStudentSkillGapById` (calls `getRealAIPrediction` -> `POST ML/predict/risk {CGPA,Attendance,PLO_1..9,Sijil}` -> label `Bermasalah/Sederhana/Cemerlang` mapped to `Tinggi/Sederhana/Rendah/Pending AI`; on ML failure uses rule `attendance<80||cgpa<2.0=>Tinggi`) + `buildMetrics` (9x `{label,value,target:80}`) + `buildInsight` (weakest PLO, zero-score guard) -> `{student, chart, insight}` -> Radar/Bar + recommendation.
4. **AI chat (staff):** `handleSendAiMessage` pushes `{role:'user',text}` + `{role:'model',text:'',streaming:true}` -> `POST /api/ai/chat {studentId,userMessage,chatHistory}` (rate-limited 15/min) -> `items.js` loads student, builds `studentDataForAI` (PII-stripped) + `TVET_KNOWLEDGE` + `systemPrompt`, `sanitizeHistory` -> tries `callGeminiStreamAPI` (SSE `text/plain` chunks) piping `res.write(text)`; on stream error falls back to `callGeminiAPI` JSON -> frontend `reader.read()` loop appends via `TextDecoder`, flips `streaming:false` at `done:true`; `renderAiText` converts `**bold**`, `*italic*`, leading `-/ *` to `•`.
5. **MDB ingestion (admin):** `handleMdbUpload (FormData{file,datasetName})` -> `POST /api/data/upload-mdb` (admin + `.mdb` only, 100 MB) -> `MdbFile{status:Saved}` -> `handleProcessMdb` -> `POST /api/data/process-mdb/:id` -> `executeEtlAndSync` (set `Processing`, `POST ML/etl/process-mdb` multipart, then `POST ML/predict/batch` single chunk, `Student.deleteMany({ID not in new})`, bcrypt `password123` for new logins, `bulkWrite` Students + Users, set `Processed/Failed`) -> frontend polls `GET /api/data/mdb-files` every 3 s + refreshes `GET /api/students`. `DELETE /api/data/mdb-files/:id` unlinks physical file (409 if `Processing`). Recovery on backend boot resets orphan `Processing` -> `Saved`.
6. **Referral (staff -> counselor):** `ReportFormModal` (fetches `GET /api/auth/users` for counselor emails) -> `POST /api/reports (FormData{studentId,studentName,course,cgpa,attendance,riskLevel,interventionType,reason,priority,scheduledDate,counselorId,file?})` -> `reports.js` validates enum + date + counselor lookup, creates `Report{status:scheduled}` -> counselor queue `GET /api/reports` -> `PATCH /api/reports/:id {action:accepted|rejected|scheduled|completed|pending, scheduledDate?, counselorNotes?}` state machine -> student sees it in `GET /api/reports/mine` (only `accepted/scheduled`) via `MergedLaporanTab`.
7. **Letter (staff -> student):** `GenerateReportModal` -> `POST /api/student-reports (FormData{studentId,...,title,message,ploScores JSON,employability,file?})` -> `studentReports.js` computes `reportType`, clamps employability, creates `StudentReport{readByStudent:false}` -> student `GET /api/student-reports` lists own; `GET /api/student-reports/:id` marks read; staff `DELETE` removes (author/admin only, file unlinked).
8. **Certificates / profile image (student):** `POST /api/students/:id/certificates (FormData{name,issuer,file})` pushes subdoc `{filePath:/uploads/certificates/...}`; `DELETE .../:certId` unlinks via `process.cwd()+filePath`; `POST .../profile-image` sets `profileImage` path. Static served at `/uploads/certificates` (plus `/uploads/referrals`, `/uploads/reports`).

### Global State vs Local State Handling

- **No global store:** Identity is cookies (`user` readable, `ikmbToken` HttpOnly), not context. Each dashboard owns its copy: `user`, `students`, `activeTab`, `isSidebarOpen`, `searchTerm/search/filter`, modal open/editing/form, AI transcript/typing, MDB files/uploading/processing, certs/file, inbox items/filter/selected. No cross-tab sync; navigating staff `management` -> `student-profile?id=` passes identity via URL, refetching from API.
- **Derived (memoized) vs stored:** Employability, top-performer score, PLO averages, chart datasets, skills-gap table, pathway recommendations, filtered students, calendar `byDay/cells`, inbox `filteredItems/unreadCount`, `tabCounts` are all `useMemo` from fetched arrays, never persisted. Constants (`careerMapping`, `courseMappings`, `interventionLabels`, `STATUS_CONFIG`, `REPORT_TYPE_LABELS`, filters, month/day names) are module-scope literals.
- **Ephemeral UI state:** Toasts (`showToast` + `setTimeout` 1500/3000 ms), modal file previews (`useFilePreview` object URLs revoked on change/unmount), chat autoscroll ref, sidebar open, selected calendar day. All reset on unmount or tab switch.

### Caching, Local Storage, Session Persistence Patterns

- **Cookies (only persistence):** `user` (`maxAge 86400`, `path /`, `httpOnly false`, `secure prod`) survives reloads/tabs for 24 h and drives Edge routing + UI labels; `ikmbToken` (same age, `httpOnly true`, `sameSite lax`) survives for API auth but is invisible to JS. `logoutAction` deletes both. No `localStorage`/`sessionStorage`/`IndexedDB` usage anywhere (`grep` finds zero references). No `document.cookie` writes from client (only reads in `getClientUser`).
- **No ISR/SSG cache:** All routes `force-dynamic`; every navigation refetches (`GET students`, `skill-gap`, `reports`, `mdb-files`). Proxy does not cache; backend has no Redis/memory cache; Mongoose reads hit MongoDB directly. JWT expiry (8 h) is shorter than cookie age (24 h), so a stale `user` cookie with expired JWT yields API 401s until re-login (Edge still routes by `user` cookie).
- **Polling instead of websockets:** MDB `Processing` is polled (`setInterval 3000 ms` while `mdbFiles.some(Processing) || processingId !== null`, cleared otherwise). AI chat streams via one-shot `fetch` + `ReadableStream` reader, not a socket. Calendar/inbox update only on mount + after mutations (`fetchReports`/`fetchData` re-invoked, no background refresh).
- **File lifecycle:** Uploaded files persist on backend disk (`./backend/uploads`, Docker volume) and are referenced by DB paths (`/uploads/...`); frontend previews are transient blob URLs. Deletes unlink disk + DB (`safeUnlink` ignores `ENOENT`). MDB physical files persist after `Processed` until admin deletes; `repredict-status.js` and `seed*.js` are offline scripts with no runtime persistence effect.

---

**Last Updated:** 2026-10-03 18:18:41 UTC+8
