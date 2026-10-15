# Project Architecture & Technical Blueprint

> TVETMARA Besut — Skills & Talent Development Dashboard (Sistem Papan Pemuka Pintar).
> Next.js 15 SSR frontend + Express 5 backend + FastAPI ML service + MongoDB.
> Purpose: monitor student performance, predict dropout risk with AI, manage counseling interventions, ingest academic records from Microsoft Access `.mdb` files, and deliver personalized career and course recommendations.

## 1. System Overview & Tech Stack

### Core Framework & Runtime

| Layer | Technology | Exact Version | Notes |
| :--- | :--- | :--- | :--- |
| Frontend framework | Next.js (App Router, SSR, standalone output) | 15.1.6 | `output: 'standalone'` in `next.config.mjs`. All pages set `export const dynamic = 'force-dynamic'` to avoid cookie reads at build time |
| UI runtime | React + React DOM | 19.0.0 | Uses `useActionState` (React 19) in `LoginForm.jsx` for Server Action login |
| Language | JavaScript (JSX, ES Modules) | — | `package.json` sets `"type": "module"`. Path alias `@/*` maps to `./src/*` via `jsconfig.json` |
| Font | `next/font/google` — Plus Jakarta Sans | weights 400, 500, 600, 700, `display: swap`, subset latin | Applied in `src/app/layout.jsx` via `plusJakartaSans.className` on `<body>`, `lang="ms"` on `<html>` |
| Icons | Phosphor Icons Web | loaded via CDN | `<Script src="https://unpkg.com/@phosphor-icons/web" strategy="beforeInteractive" />` in root layout. Consumed as `<i className="ph ph-...">` and `<i className="ph-bold ph-...">` and `<i className="ph-fill ph-...">` |
| Edge auth | `jose` (Edge-compatible JWT verify) | 6.2.12 | Used only in `middleware.js` (`jwtVerify`). Backend uses `jsonwebtoken` 9.0.3 for signing and verifying |
| Backend runtime | Node.js | 20 (Alpine image `docker.io/node:20-alpine`) | Both frontend builder/runner and backend containers use Node 20 |
| Backend framework | Express | 5.2.1 | Entry `backend/server.js`, `type: module`. JSON body limit `200kb` |
| Backend ODM | Mongoose | 9.3.3 | Models in `backend/models/`. Database name `ikmb-dashboard` |
| Backend auth crypto | `bcryptjs` | 3.0.3 | Salt rounds 10 for seeded passwords. `jsonwebtoken` 9.0.3 signs HS256 tokens with 8-hour expiry |
| Backend uploads | `multer` | 2.2.0 | Disk storage with timestamped filenames. Limits 5 MB for certificates/referrals/reports, 100 MB for `.mdb` |
| Backend hardening | `helmet` 8.3.0, `cors` 2.8.6, `express-rate-limit` 8.7.0 | — | Helmet CSP configured for self + unpkg + Google Fonts + Unsplash images. CORS allowlist from `CORS_ORIGIN` with `credentials: true`. AI chat route rate-limited to 15 requests per 60 seconds per staff email |
| Backend docs | `swagger-jsdoc` 6.3.0 + `swagger-ui-express` 5.0.1 | OpenAPI 3.0.0 | Served at `GET /api/docs`. Scans `auth.js`, `items.js`, `reports.js`, `studentReports.js` |
| Backend config | `dotenv` | 17.3.1 | Loads `backend/.env` |
| ML runtime | Python | 3.9-slim (`docker.io/python:3.9-slim`) | Server `uvicorn ml:app --host 0.0.0.0 --port 8000` |
| ML framework | FastAPI + Uvicorn | pinned via `ML/requirements.txt` (`fastapi`, `uvicorn`) | App variable `app` in `ML/ml.py`, titled `TVETMARA AI Prediction API V4` |
| ML stack | `scikit-learn`, `joblib`, `pydantic`, `pandas`, `numpy`, `httpx`, `python-multipart` | — | Model artifacts `model_ai_risiko_lengkap_v3.pkl` and `model_ai_risiko_lengkap_v4.pkl`. Active path `model_ai_risiko_lengkap_v4.pkl`. ETL uses system package `mdbtools` (`mdb-tables`, `mdb-export`) installed via `apt-get` |
| ML model | RandomForestClassifier with GridSearchCV | — | Features: `CGPA`, `Avg_Subjek_Attendance`, `PLO_1` through `PLO_9`, `PLO_Avg`, `PLO_Variance`. Target `Status_Pelajar` with values `Cemerlang`, `Sederhana`, `Bermasalah`. Scoring `f1_weighted`. Artifacts loaded with `joblib` |
| Database | MongoDB | `docker.io/mongo:latest` | Service `tvet_mongodb`, port 27017, volume `./mongodb_data:/data/db`, network `tvet_net` |
| Lint / test (frontend) | ESLint 9 + `eslint-config-next` 15.1.6, Vitest 4.1.10, `jsdom` 29.1.1, Testing Library `react` 16.3.2 + `jest-dom` 6.9.1 + `user-event` 14.6.1 | — | `npm test` runs `vitest run src/__tests__`. Vitest alias `@` points to `./src`. ESLint disables `react/no-unescaped-entities` and `@next/next/no-img-element` |
| Test (backend) | Jest 30.4.2 + Supertest 7.2.2 + `cross-env` 10.1.0 + Babel preset-env | — | `npm test` runs `cross-env NODE_ENV=test node --experimental-vm-modules node_modules/jest/bin/jest.js --forceExit` |
| Test (ML) | `pytest` + `pytest-asyncio` | — | `ML/test_ml.py` uses FastAPI `TestClient` |
| Styling build | Tailwind CSS 3.4.19 + Autoprefixer 10.4.27 + PostCSS 8.5.6 | — | `postcss.config.js` registers `tailwindcss` and `autoprefixer`. `tailwind.config.js` scans `src/app/**` and `src/components/**` |
| CI/CD | GitHub Actions (`.github/workflows/ci.yml`) | Node 20, Python 3.9 | Four jobs: frontend test plus build, backend test, ML test, Docker build gated on all three passing |
| Deployment | Podman/Docker Compose (`compose.yml`), three Containerfiles | — | Services: `mongodb`, `backend` (port 5000), `ml-api` (port 8000), `frontend` (host 8080 mapped to container 3000). Frontend is multi-stage build (deps, builder, runner as non-root `nextjs` uid 1001). Backend image installs production dependencies only. ML image installs `mdbtools` |

### State Management & Data Fetching Strategy

- No global store (no Redux, Zustand, or React Context for domain state). Every dashboard client owns local `useState` plus `useEffect` for fetching plus `useMemo` for derived lists plus `useRef` for scroll anchoring, dropdown dismissal, and modal references.
- Authentication state is cookie-based, not in-memory:
  - Server Action `loginAction` in `src/app/actions.js` posts credentials to `${BACKEND_URL}/api/auth/login`, then sets two cookies: `user` (JSON stringified `{email, role, displayName, studentId}`, `httpOnly: false`, `maxAge: 86400`, `path: /`) for UI display and client-side role checks, and `ikmbToken` (JWT, `httpOnly: true`, `secure` in production, `sameSite: lax`, `maxAge: 86400`, `path: /`) for real authorization.
  - `logoutAction` deletes both cookies and redirects to `/`.
  - Server helper `src/lib/auth.js` exposes `getStoredUser()` (parses `user` cookie) and `getToken()` (reads `ikmbToken`), plus `getDashboardPathForRole(role)` which maps `admin` and `counselor` to `/staff-dashboard` and all other roles to `/student-dashboard`.
  - Client helper `src/lib/client-auth.js` exposes `getClientUser()` (parses `document.cookie` for the non-HttpOnly `user` cookie) and `getClientToken()` which returns the sentinel string `"proxy-handled"` because the real JWT is HttpOnly and unreadable from JavaScript.
- Two data-fetching paths coexist:
  - Direct same-origin fetches with explicit `Authorization: Bearer <token>` header: used by `StaffDashboardClient.jsx`, `StudentDashboardClient.jsx`, and `StudentProfileClient.jsx` via `getClientToken()` placeholder logic and direct `fetch('/api/...')` calls that rely on the browser sending cookies. These call backend paths such as `/api/semesters`, `/api/students`, `/api/students/:id/skill-gap`, `/api/data/*`, `/api/students/:id/certificates`, and `/api/ai/chat`.
  - Next.js proxy route `src/app/api/[...proxy]/route.js`: catches all HTTP verbs (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) under `/api/*`, reads the HttpOnly `ikmbToken` via `next/headers` cookies, injects it as `Authorization: Bearer <token>`, strips `host`, `connection`, and `content-length` headers, forwards method plus query string plus body blob to `${BACKEND_URL}/api/<path>`, and streams the backend response back while stripping `transfer-encoding`. On network failure it returns HTTP 500 with `{ message: 'Proxy connection failed' }`. Static uploads under `/uploads/*` are instead rewritten at the edge by `next.config.mjs` to `http://backend:5000/uploads/*`.
- Backend-to-ML fetching uses Node `fetch` with `FormData` and `Blob` for ETL (`POST {ML_API_URL}/etl/process-mdb` with `X-API-Key: ML_API_SECRET`) and JSON posts for batch prediction (`POST {ML_API_URL}/predict/batch`). The standalone script `backend/repredict-status.js` posts batch predictions in chunks of 500 without the API key header.
- AI chat fetching uses backend-to-Gemini REST: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent` for JSON fallback and `POST ...:streamGenerateContent?alt=sse` for streaming, with headers `Content-Type: application/json` and `x-goog-api-key: GEMINI_API_KEY`, body containing `systemInstruction`, sanitized `contents`, and `generationConfig { temperature: 0.4, maxOutputTokens: 1024 }`.

### Styling & UI Layer

- Methodology: utility-first Tailwind CSS plus a custom motion system defined in `src/app/globals.css` plus shared primitives in `src/components/ui/dashboard-kit.jsx`.
- Tailwind theme extension: `fontFamily.sans` set to `"Plus Jakarta Sans", sans-serif`. No custom colors or breakpoints; all color usage is inline Tailwind palette classes (`blue-600`, `emerald-600`, `slate-50`, `red-500`, `amber-500`, `purple-100`).
- Custom keyframes in `globals.css`: `fadeIn` (opacity 0 plus translateY 6px to identity), `slideInLeft` (translateX negative 32px), `slideInRight` (translateX positive 32px), `slideUp` (translateY 20px), `scaleIn` (scale 0.92), `floatSoft` (translateY 0 to negative 8px loop), `shimmer` (background-position negative 200 percent to positive 200 percent). Consumed exclusively through Tailwind arbitrary animation syntax such as `animate-[fadeIn_0.3s_ease-in-out]`, `animate-[slideUp_0.4s_ease-out_0.2s]`, `animate-[scaleIn_0.3s_ease-out]`, `animate-[slideInLeft_0.5s_ease-out_0.1s]`, `animate-[floatSoft_3s_ease-in-out_infinite]`.
- Custom utilities in `@layer utilities`: stagger delays `stagger-1` through `stagger-8` (50 ms through 400 ms), `anim-fill` (`animation-fill-mode: both` so pre-delay state stays invisible), `skeleton-shimmer` (linear gradient `#f1f5f9` to `#e2e8f0` with `background-size: 200% 100%` and `shimmer 1.5s ease-in-out infinite`), mobile-first helpers `touch-target` (minimum 44 by 44 px per Apple HIG), `text-responsive-sm` through `text-responsive-2xl` (CSS `clamp()`), `no-select`, `scroll-smooth-mobile`, `safe-area-top`, `safe-area-bottom`, `pb-safe`.
- Charting: `chart.js` 4.5.1 with `react-chartjs-2` 5.3.1. Chart types used: Bar (PLO averages versus target in staff overview, GPA trend combo in student profile), Line (GPA overlay on the same combo chart), Radar (skill-gap current versus target in student dashboard and student profile). No Framer Motion, no GSAP, no CSS-in-JS.
- Shared UI primitives in `dashboard-kit.jsx`: `Badge`, `StatCard`, `SectionCard`, `PillTabs`, `EmptyState`, `SkeletonList`, `RiskBadge`, `getRiskMeta`, `formatMsDate`, `toneClasses`. File preview in `AttachmentPreview.jsx` driven by the `useFilePreview` hook.

### Third-Party Services / External Integrations

| Integration | Direction | Authentication | Usage |
| :--- | :--- | :--- | :--- |
| Google Gemini (`gemini-3.5-flash-lite`) | Backend to Google REST | `GEMINI_API_KEY` in `x-goog-api-key` header, never exposed to browser | Staff AI chatbot in `POST /api/ai/chat`. System prompt combines role `Pembantu Pintar TVETMARA`, static `TVET_KNOWLEDGE` grounding (course codes, career mapping, PLO definitions, thresholds, intervention catalog), and per-student `<DATA_PELAJAR>` JSON stripped of PII (no IC, phone, or address). Streaming via SSE with JSON fallback |
| Unsplash CDN | Browser to `images.unsplash.com` | None | Login brand-panel background photo with `opacity-40 mix-blend-overlay`. Explicitly allowed in Helmet `imgSrc` |
| Google Fonts | Browser to `fonts.googleapis.com` and `fonts.gstatic.com` | None | Allowed in Helmet `styleSrc` and `fontSrc`. Also loaded via `next/font/google` at build time |
| Phosphor Icons CDN | Browser to `unpkg.com` | None | Allowed in Helmet `scriptSrc`. Provides `ph`, `ph-bold`, `ph-fill` icon classes |
| MongoDB Atlas or local MongoDB | Backend to `MONGO_URI` | Connection string | Primary datastore for `User`, `Student`, `Report`, `StudentReport`, `MdbFile` collections |
| ML microservice | Backend to `ML_API_URL` (default `http://ml-api:8000` in Compose, `http://127.0.0.1:8000` fallback) | `X-API-Key: ML_API_SECRET` header | Risk prediction (`/predict/risk`, `/predict/batch`) and Access ETL (`/etl/process-mdb`) |
| SMTP or email provider | None | None | No email sending exists. Counselor assignment is matched by email string against the `User` collection, not by sending mail |

### Environment Schema

Root `.env` keys (also injected into Compose services):

| Variable | Required | Default | Consumed By |
| :--- | :---: | :--- | :--- |
| `JWT_SECRET` | Yes (backend and frontend fail closed without it; backend calls `process.exit(1)` when `NODE_ENV !== test`) | None | Backend `jsonwebtoken` sign and verify; frontend Edge `jose` verify in `middleware.js` |
| `JWT_ISSUER` | No | `tvetmara-backend` | Both sign options and verify options (`JWT_VERIFY_OPTIONS`, `JWT_SIGN_OPTIONS`) |
| `JWT_AUDIENCE` | No | `tvetmara-dashboard` | Both sign options and verify options |
| `GEMINI_API_KEY` | Yes for AI chat (route returns HTTP 500 without it) | None | `backend/items.js` `POST /api/ai/chat` |
| `CORS_ORIGIN` | No | `http://localhost:3000,http://localhost:8080` | `backend/server.js` CORS allowlist, comma-split and trimmed |
| `MONGO_URI` | No | `mongodb://mongodb:27017/ikmb-dashboard` in Compose; `mongodb://127.0.0.1:27017/ikmb-dashboard` in scripts; `mongodb://localhost:27017/tvetmara_db` in legacy `seed.js` | Mongoose connect, skipped when `NODE_ENV=test` |
| `ML_API_URL` | No | `http://ml-api:8000` in Compose; `http://127.0.0.1:8000` fallback in code | `items.js` ETL and prediction callers, `repredict-status.js` |
| `ML_API_SECRET` | Yes for ML POST routes (ML exits with code 1 without it; backend sends it as `X-API-Key`) | None | `ML/ml.py` `check_auth`, backend ETL and batch callers |
| `BACKEND_URL` | No (frontend only, from `.env.local` or Compose) | `http://127.0.0.1:5000` in code; `http://backend:5000` in Compose; `http://127.0.0.1:5000` in `.env.local` | `src/app/actions.js` login fetch and `src/app/api/[...proxy]/route.js` proxy target |
| `PORT` | No (backend only) | `5000` | `backend/server.js` listener |

`backend/.env.example` documents `PORT`, `MONGO_URI`, `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `ML_API_URL`, `ML_API_SECRET`, `GEMINI_API_KEY`, `CORS_ORIGIN` with placeholder values.

## 2. Directory Tree & Module Manifest

Indented tree of key source directories (excluding `node_modules`, `.next`, `mongodb_data`, `mdb_extracted` CSV dumps, and build output):

```text
/
├── .github/workflows/ci.yml
├── Containerfile.frontend
├── compose.yml
├── middleware.js
├── next.config.mjs
├── tailwind.config.js
├── postcss.config.js
├── jsconfig.json
├── vitest.config.js
├── .eslintrc.json
├── package.json
├── diagnostics.js
├── public/
│   ├── logo-tvetmara.jpg
│   └── vite.svg
├── src/
│   ├── app/
│   │   ├── layout.jsx
│   │   ├── page.jsx
│   │   ├── actions.js
│   │   ├── globals.css
│   │   ├── api/[...proxy]/route.js
│   │   ├── staff-dashboard/page.jsx
│   │   ├── student-dashboard/page.jsx
│   │   └── student-profile/page.jsx
│   ├── components/
│   │   ├── Sidebar.jsx
│   │   ├── KpiCard.jsx
│   │   ├── StudentModal.jsx
│   │   ├── StudentListGrid.jsx
│   │   ├── StudentDetailModal.jsx
│   │   ├── JobCard.jsx
│   │   ├── ReportFormModal.jsx
│   │   ├── GenerateReportModal.jsx
│   │   ├── auth/LoginForm.jsx
│   │   ├── dashboard/StaffDashboardClient.jsx
│   │   ├── dashboard/StudentDashboardClient.jsx
│   │   ├── dashboard/StudentProfileClient.jsx
│   │   ├── dashboard/CounselorDashboardClient.jsx
│   │   ├── dashboard/MergedLaporanTab.jsx
│   │   ├── dashboard/AppointmentCalendar.jsx
│   │   └── ui/dashboard-kit.jsx
│   │   └── ui/AttachmentPreview.jsx
│   ├── lib/
│   │   ├── auth.js
│   │   ├── client-auth.js
│   │   ├── roles.js
│   │   ├── heuristics.js
│   │   └── use-file-preview.js
│   └── __tests__/Login.test.jsx
├── backend/
│   ├── server.js
│   ├── auth.js
│   ├── auth.model.js
│   ├── items.js
│   ├── item.model.js
│   ├── reports.js
│   ├── studentReports.js
│   ├── repredict-status.js
│   ├── seed.js
│   ├── seed-admin.js
│   ├── package.json
│   ├── Containerfile.backend
│   ├── .env.example
│   ├── middleware/authMiddleware.js
│   ├── models/User.js
│   ├── models/Student.js
│   ├── models/Report.js
│   ├── models/StudentReport.js
│   ├── models/MdbFile.js
│   ├── db/sedut_mdb_tulen.py
│   ├── db/inspect_mdb_linux.py
│   ├── db/prepare_ml_data_3mdb.py
│   ├── db/relabel_option2.py
│   ├── db/data_tvet_muktamad.json
│   ├── uploads/certificates/
│   ├── uploads/mdb/
│   ├── uploads/referrals/
│   ├── uploads/reports/
│   └── __tests__/auth.test.js
│   └── __tests__/items.test.js
└── ML/
    ├── ml.py
    ├── requirements.txt
    ├── test_ml.py
    ├── train_and_evaluate.py
    ├── train_and_evaluate_v4.py
    ├── Containerfile
    ├── model_ai_risiko_lengkap_v3.pkl
    └── model_ai_risiko_lengkap_v4.pkl
```

### Module Breakdown

| Path / Module | Purpose | Key Exports / Responsibilities |
| :--- | :--- | :--- |
| `middleware.js` | Edge route guard for all non-API, non-static routes | `middleware(request)` verifies HttpOnly `ikmbToken` with `jose.jwtVerify` using issuer and audience, redirects authenticated users away from `/` and `/login` to role dashboard, redirects unauthenticated users to `/`, enforces staff-only `/staff-dashboard` and `/student-profile` and student-only `/student-dashboard`; `config.matcher` excludes `api`, `_next/static`, `_next/image`, `favicon.ico`, `assets` |
| `next.config.mjs` | Next.js standalone build plus upload rewrite | `output: 'standalone'`; `rewrites()` maps `/uploads/:path*` to `http://backend:5000/uploads/:path*` |
| `src/app/layout.jsx` | Root HTML shell, font, metadata, icon CDN | `RootLayout({children})`; `metadata { title: 'TVETMARA Besut - Papan Pemuka Pintar' }`; Plus Jakarta Sans setup; Phosphor `<Script>` |
| `src/app/page.jsx` | Public login route `/` | `LoginPage` renders `LoginForm`; `dynamic = 'force-dynamic'`; no cookie reads (middleware handles redirects) |
| `src/app/actions.js` | Server Actions for login and logout | `loginAction(prevState, formData)` posts to backend login, sets `user` and `ikmbToken` cookies, redirects by role; `logoutAction()` deletes both cookies and redirects to `/` |
| `src/app/api/[...proxy]/route.js` | Authenticated API proxy for browser callers without token access | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` handlers via shared `proxyRequest`; injects `Authorization: Bearer <ikmbToken>`; forwards query string and body blob to `BACKEND_URL`; streams backend response; returns 500 JSON on connection failure |
| `src/app/staff-dashboard/page.jsx` | Staff route entry | Renders `StaffDashboardClient`; `force-dynamic` |
| `src/app/student-dashboard/page.jsx` | Student route entry | Renders `StudentDashboardClient`; `force-dynamic` |
| `src/app/student-profile/page.jsx` | Student detail route entry with query parameter | Async component reads `searchParams.id` defaulting to `TVET001`, renders `StudentProfileClient studentId` |
| `src/app/globals.css` | Tailwind directives plus full motion and mobile utility system | Keyframes `fadeIn`, `slideInLeft`, `slideInRight`, `slideUp`, `scaleIn`, `floatSoft`, `shimmer`; utilities `stagger-1` to `stagger-8`, `anim-fill`, `skeleton-shimmer`, `touch-target`, `text-responsive-sm` to `text-responsive-2xl`, `no-select`, `scroll-smooth-mobile`, `safe-area-top`, `safe-area-bottom`, `pb-safe` |
| `src/lib/auth.js` | Server-side cookie readers | `getStoredUser()`, `getToken()`, `getDashboardPathForRole(role)` |
| `src/lib/client-auth.js` | Client-side cookie readers | `getClientUser()` parses `document.cookie`; `getClientToken()` returns sentinel `"proxy-handled"` |
| `src/lib/roles.js` | Role taxonomy | `ROLES` maps `admin` to Penyelaras in group staff, `counselor` to Kaunselor in group staff, `user` to Pelajar in group student; `getRoleLabel(role)`; `isStaff(role)` |
| `src/lib/heuristics.js` | Client-side employability formulas | `calculateEmployability(cgpa, attendance)` computes `(cgpa / 4) * 40 + attendance * 0.6`; `calculateTopPerformerScore(cgpa, attendance)` computes `(cgpa / 4) * 60 + attendance * 0.4`; both clamp to 100 and round |
| `src/lib/use-file-preview.js` | Controlled file selection with validation and object-URL preview | `MAX_ATTACHMENT_BYTES` (5 MB); `formatFileSize(bytes)`; `useFilePreview({acceptTypes, maxBytes})` returns `{ file, previewUrl, error, selectFile, clear }`; validates size then extension and MIME substring |
| `src/components/auth/LoginForm.jsx` | Split-screen login UI with Server Action form | `LoginForm` plus inner `SubmitButton` using `useActionState(loginAction)` and `useFormStatus`; left brand panel (Unsplash image, brain icon, headline) and right form panel (logo, email, password with defaults `admin@ikmb.edu.my` and `password123`, error box) |
| `src/components/Sidebar.jsx` | Responsive navigation drawer | Props `navItems`, `activeTab`, `setActiveTab`, `isSidebarOpen`, `setIsSidebarOpen`, `currentUser`, `handleLogout`, `profileImage`; Escape-to-close and mobile body scroll lock; avatar or initials; role label via `getRoleLabel` |
| `src/components/KpiCard.jsx` | Metric card with progress bar | Props `title`, `value`, `isLoading`, `icon`, `iconBg`, `iconColor`, `barColor`, `barWidth`, `subtitle`, `delay`; skeleton shimmer when loading; animated width bar |
| `src/components/StudentModal.jsx` | Add and edit student dialog | Props `isOpen`, `onClose`, `editingStudent`, `formData`, `handleInputChange`, `handleSubmit`; outside-click and Escape dismissal; body scroll lock; fields for ID, name, CGPA, attendance, certification, course, status |
| `src/components/StudentListGrid.jsx` | Searchable student grid with course and risk filters | Props `students`, `onViewProfile`, `onAddStudent`, `readOnly`; local `search`, `filter`, `riskFilter`; `courseMap` for seven course codes; risk chips with live counts via `getRiskMeta`; staggered cards with avatar, course, risk badge, ID, CGPA |
| `src/components/StudentDetailModal.jsx` | Read-only appointment and report viewer | Props `kind`, `appointment`, `report`, `item`, `onClose` (plus unused `onDownload`, `onPrint`, `onShare`); resolves unified `data`; renders appointment block (date, priority, counselor, reason, notes) or report block (message, PDF iframe); footer download and print links |
| `src/components/JobCard.jsx` | Career recommendation card | Prop `job { icon, match, title, company }`; match badge with sparkle icon; static `Mohon Sekarang` button with no handler |
| `src/components/ReportFormModal.jsx` | Staff-to-counselor referral composer | Props `isOpen`, `onClose`, `student`, `interventionType`; local `reason`, `priority`, `scheduledDate`, `counselorId`, `counselors`, `isSubmitting`, `toast`; uses `useFilePreview`; fetches counselor list from `/api/auth/users`; posts multipart `FormData` to `/api/reports` |
| `src/components/GenerateReportModal.jsx` | Staff-to-student report composer | Props `isOpen`, `onClose`, `student`, `skillGap`; local `title`, `message`, `isSubmitting`, `toast`; uses `useFilePreview({ acceptTypes: ['pdf'] })`; prefills title on open transition via `prevIsOpenRef`; posts multipart `FormData` with `ploScores` JSON and computed employability to `/api/student-reports` |
| `src/components/ui/dashboard-kit.jsx` | Shared primitives, risk taxonomy, date formatting | `formatMsDate(value, withTime)`; `toneClasses`; `Badge`; `StatCard`; `SectionCard`; `PillTabs`; `EmptyState`; `SkeletonList`; `getRiskMeta(risk)` mapping Tinggi, Sederhana, Rendah; `RiskBadge` |
| `src/components/ui/AttachmentPreview.jsx` | File row with inline image or PDF preview | Props `file`, `previewUrl`, `onRemove`; detects PDF versus image; shows name, formatted size, open link, remove button, and constrained preview pane |
| `src/components/dashboard/StaffDashboardClient.jsx` | Staff workspace with seven tabs, charts, AI chat, student CRUD, MDB pipeline | No props; owns semester, student, AI chat, and MDB state; fetches `/api/semesters`, `/api/students`, `/api/data/mdb-files`, `/api/ai/chat`; embeds `Sidebar`, `KpiCard`, `StudentListGrid`, `StudentModal`, `CounselorDashboardClient`, Chart.js Bar |
| `src/components/dashboard/StudentDashboardClient.jsx` | Student workspace with five tabs, radar chart, certificates, inbox, career | No props; owns semester, selected student, skill gap, certificate state; fetches `/api/semesters`, `/api/students`, `/api/students/:id/skill-gap`, profile image and certificate endpoints; embeds `Sidebar`, `JobCard`, `MergedLaporanTab`, Chart.js Radar |
| `src/components/dashboard/StudentProfileClient.jsx` | Per-student 360-degree profile with three inner tabs | Prop `studentId`; fetches `/api/students/:id/skill-gap`; renders header card with status badge and export actions plus personal, academic (Bar plus Line combo), and skills (Radar plus employability plus intervention buttons) sections; embeds `ReportFormModal` and `GenerateReportModal` |
| `src/components/dashboard/CounselorDashboardClient.jsx` | Counseling queue with six workflow tabs plus calendar | Prop `currentUser`; fetches `/api/reports` and `/api/student-reports`; implements accept, reject, schedule, complete, reset, and delete via `PATCH /api/reports/:id` and `DELETE /api/student-reports/:id`; embeds `AppointmentCalendar` and kit primitives |
| `src/components/dashboard/MergedLaporanTab.jsx` | Student inbox merging reports and appointments | Prop `user`; fetches `/api/student-reports` and `/api/reports/mine`; normalizes via `normalizeLaporanItems`; marks reports read via `GET /api/student-reports/:id`; renders `PillTabs` filters and `StudentDetailModal`; exports `formatLaporanDate` and `normalizeLaporanItems` |
| `src/components/dashboard/AppointmentCalendar.jsx` | Month calendar for scheduled counseling sessions | Props `reports`, `onComplete`; groups by day key `YYYY-MM-DD`; Monday-first grid; mobile bottom sheet and desktop side panel; upcoming list; no network calls |
| `src/__tests__/Login.test.jsx` | Frontend smoke test | Mocks `next/navigation`, `next/script`, `@/app/actions`; asserts `LoginForm` renders heading, labels, and submit button |
| `backend/server.js` | Express boot, security, static serving, route mounting, error handling | Fail-closed `JWT_SECRET` check; Helmet CSP; CORS allowlist; `uploads/certificates`, `uploads/referrals`, `uploads/reports` static mounts; Swagger at `/api/docs`; Mongo connect with `Processing` to `Saved` recovery; mounts `/api/auth`, `/api/reports`, `/api/student-reports`, `/api`; health endpoint; global error handler; `PORT` listener |
| `backend/auth.js` | Login and user-listing router | `GET /api/auth/users` (staff only) returns sanitized users; `POST /api/auth/login` (public) validates email and password and returns user plus JWT |
| `backend/auth.model.js` | Credential store and JWT Mint | `JWT_SIGN_OPTIONS` (HS256, 8-hour expiry, issuer, audience); `readLoginDatabase()` from `User` collection; `sanitiseUser()`; `getAllLoginUsers()`; `getPublicLoginUsers()`; `authenticateUser(email, password)` with `bcrypt.compare` and `jwt.sign` |
| `backend/items.js` | Student, dataset, upload, prediction, and AI chat router | Endpoints for semesters, student CRUD, skill gap, certificates, profile image, manual prediction, MDB upload, MDB list, MDB process, MDB delete, Gemini chat; includes `executeEtlAndSync`, Gemini helpers, `TVET_KNOWLEDGE` grounding, history sanitizer, and Multer error middleware |
| `backend/item.model.js` | Student normalization, metrics, live prediction, Mongo CRUD | `certificationScores`; `normaliseStudent(record)` with dropout-risk override rules; `getStudentsDataset`, `buildMetrics`, `buildInsight`; `getRealAIPrediction(features)` calling ML `/predict/risk` with heuristic fallback; `getAllStudents`, `getStudentById`, `getStudentSkillGapById`; `createStudent`, `updateStudent`, `deleteStudent` |
| `backend/reports.js` | Counselor referral router | `POST /api/reports` creates scheduled intervention with counselor email validation and optional referral file; `GET /api/reports` lists all for admin and pending plus owned for counselor; `GET /api/reports/mine` lists upcoming appointments for the logged-in student; `GET /api/reports/:id` with ownership check; `PATCH /api/reports/:id` unified state machine for accept, reject, schedule, complete, reset, and notes-only updates |
| `backend/studentReports.js` | Student inbox report router | `POST /api/student-reports` creates message, letter, or full report with PLO scores and employability; `GET /api/student-reports` scopes by role (student sees own, counselor sees authored, admin sees all); `GET /api/student-reports/:id` with author, owner, and admin checks plus automatic `readByStudent` marking; `DELETE /api/student-reports/:id` restricted to admin or author |
| `backend/repredict-status.js` | Batch backfill script for risk labels | Loads all `Student` documents, chunks into groups of 500, posts to ML `/predict/batch` without API key, bulk-writes `Status_Pelajar`, logs processed and skipped counts |
| `backend/seed.js` | Full database seeder | Reads `db/data_tvet_muktamad.json` when present; upserts `Student` snapshots and bound `user` logins with default password `password123`; upserts demo `admin@ikmb.edu.my`, `counselor@ikmb.edu.my`, `user@ikmb.edu.my`; preserves existing passwords and certificates via `$setOnInsert` |
| `backend/seed-admin.js` | Demo-account-only seeder | Upserts the same three demo accounts without touching student data |
| `backend/middleware/authMiddleware.js` | JWT guards | `verifyToken` requires `Authorization: Bearer` and verifies HS256 with issuer and audience; `requireAdmin` allows only `admin`; `requireStaff` allows `admin` and `counselor`; `requireOwnershipOrAdmin` allows staff plus the student whose `studentId` matches `:studentId` |
| `backend/models/User.js` | Login account schema | Fields `email` (required, unique), `password` (required hash), `role` (enum `admin`, `counselor`, `user`, default `user`), `displayName`, `studentId` (default null) |
| `backend/models/Student.js` | Per-semester student snapshot schema | Fields `ID_Pelajar`, `Nama`, `Kursus`, `Semester`, `Kehadiran_Pct`, `CGPA`, nine `PLO_1` to `PLO_9` strings, `Status_Pelajar`, `No_KP`, `No_Telefon`, `Alamat`, `academicHistory` array, `uploadedCertificates` array, `sourceDataset` (default `unknown`, indexed), `profileImage` |
| `backend/models/Report.js` | Counseling referral schema with timestamps | Fields `studentId` (required, indexed), `studentName`, `course`, `cgpa`, `attendance`, `riskLevel`, `interventionType` (enum `kaunseling`, `klinik`, `softskills`), `reason`, `priority` (`urgent`, `normal`), `status` (`pending`, `accepted`, `scheduled`, `completed`, `rejected`), `adminEmail`, `counselorId`, `counselorNotes`, `scheduledDate`, `fileName`, `filePath` |
| `backend/models/StudentReport.js` | Student inbox report schema with timestamps | Fields `studentId` (required, indexed), `studentName`, `course`, `cgpa`, `attendance`, `riskLevel`, `semester`, `ploScores` array, `employability`, `authorEmail`, `authorRole`, `authorName`, `title`, `message`, `fileName`, `filePath`, `reportType` (`message`, `letter`, `full`), `readByStudent` |
| `backend/models/MdbFile.js` | MDB ingestion ledger schema | Fields `datasetName`, `originalName`, `filePath`, `fileSize`, `status` (enum `Saved`, `Processing`, `Processed`, `Failed`), `recordsProcessed`, `uploadDate`, `processedDate` |
| `backend/db/` | ETL preparation scripts and extracted datasets | `sedut_mdb_tulen.py`, `inspect_mdb_linux.py`, `prepare_ml_data_3mdb.py`, `relabel_option2.py`, `data_tvet_muktamad.json`, plus `mdb_extracted` CSV dumps for intakes `JJ2025`, `JD2025`, `JJ2026` (tables `pelajar`, `Daftar_Subjek`, `GPA`, `Detail_Result`, `Anugerah`) |
| `ML/ml.py` | FastAPI prediction and ETL service | `GET /` health; `POST /predict/risk` single prediction; `POST /predict/batch` ordered batch prediction; `POST /etl/process-mdb` multipart Access extraction; feature engineering (`PLO_Avg`, `PLO_Variance`); `check_auth` via `X-API-Key`; model load from `model_ai_risiko_lengkap_v4.pkl`; `mdb-export` helpers with timeouts |
| `ML/train_and_evaluate.py` | Baseline training script | Loads `../backend/db/ml_training_data_real.csv`, coerces numerics, engineers `PLO_Avg` and `PLO_Variance`, stratified 80-20 split when possible, `GridSearchCV` over RandomForest hyperparameters with 5-fold CV and `f1_weighted`, prints accuracy plus classification report plus confusion matrix, saves `model_ai_risiko_lengkap_v4.pkl` |
| `ML/train_and_evaluate_v4.py` | Leakage-aware training script | Same as baseline plus student-group-aware `GroupShuffleSplit` when `No_Pelajar` is duplicated, dynamic CV folds (5, 3, or 2 based on minority class size), attendance default fill 80, logs train and test student counts |
| `ML/test_ml.py` | ML contract tests | `test_health_check`, `test_predict_risk_valid_data`, `test_predict_risk_invalid_data` using `TestClient` |
| `diagnostics.js` | `mongosh` database health script | Counts students and users, finds duplicate `ID_Pelajar` values, groups by `Kursus`, counts whitespace-padded IDs, lists `mdbfiles` ledger, samples 10 students |
| `.github/workflows/ci.yml` | Continuous integration pipeline | Jobs `frontend` (Node 20 install, Vitest, Next build with `BACKEND_URL`), `backend` (Node 20 install, Jest), `ml-service` (Python 3.9, `mdbtools`, pip install, pytest), `docker-build` (builds all three Containerfiles, gated on prior jobs) |

## 3. Role-Based Access Control (RBAC) & Permissions

### Role Definitions

| Role | Malay Label | Group | Intended Purpose |
| :--- | :--- | :--- | :--- |
| `admin` | Penyelaras | Staff | Full control: manage students, upload and process `.mdb` datasets, delete datasets, send reports to students, create counseling referrals, reset counseling states, view all referrals and all student reports, use AI chat |
| `counselor` | Kaunselor | Staff | Counseling workflow: view assigned and pending referrals, accept, schedule, complete, and reject appointments, view the calendar, manage own sent reports, send reports to students, create referrals, use AI chat. Cannot access the MDB data pipeline tab and cannot delete MDB files |
| `user` | Pelajar | Student | Personal workspace: view own performance, radar skill gap, employability, career matches, course suggestions, upload own certificates and profile image, read own inbox reports and own upcoming appointments. When the account has a bound `studentId`, the dashboard is restricted to that single student record and the student selector is hidden |

Guest (no valid `ikmbToken`) has no access to any dashboard route and is redirected to `/`.

JWT claims issued at login: `{ email, role, studentId }` with `expiresIn: 8h`, `algorithm: HS256`, `issuer: tvetmara-backend`, `audience: tvetmara-dashboard`. The Edge middleware reads `email`, `role`, and `studentId` from the verified payload. The `user` cookie mirrors `{ email, role, displayName, studentId }` for display purposes only and is never trusted for authorization at the edge or in the backend.

### Permission Matrix

| Resource / Route / Action | Guest | Student (`user`) | Counselor | Admin |
| :--- | :---: | :---: | :---: | :---: |
| `GET /` login page | ✅ | Redirect to `/student-dashboard` when token valid | Redirect to `/staff-dashboard` when token valid | Redirect to `/staff-dashboard` when token valid |
| `GET /staff-dashboard` | Redirect to `/` | Redirect to `/student-dashboard` | ✅ | ✅ |
| `GET /student-dashboard` | Redirect to `/` | ✅ | Redirect to `/staff-dashboard` | Redirect to `/staff-dashboard` |
| `GET /student-profile?id=:id` | Redirect to `/` | Redirect to `/student-dashboard` (Edge treats as staff route) | ✅ | ✅ |
| `POST /api/auth/login` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/auth/users` | ❌ | ❌ | ✅ | ✅ |
| `GET /api/semesters` | ❌ | ✅ | ✅ | ✅ |
| `GET /api/students` (list) | ❌ | Own record only (requires bound `studentId`, otherwise empty array) | ✅ all | ✅ all |
| `POST /api/students` | ❌ | ❌ | ✅ | ✅ |
| `PUT /api/students/:studentId` | ❌ | ❌ | ✅ | ✅ |
| `DELETE /api/students/:studentId` | ❌ | ❌ | ✅ | ✅ |
| `GET /api/students/:studentId` | ❌ | Own `:studentId` only | ✅ any | ✅ any |
| `GET /api/students/:studentId/skill-gap` | ❌ | Own `:studentId` only | ✅ any | ✅ any |
| `POST /api/students/:studentId/certificates` | ❌ | Own `:studentId` only | ✅ any | ✅ any |
| `DELETE /api/students/:studentId/certificates/:certId` | ❌ | Own `:studentId` only | ✅ any | ✅ any |
| `POST /api/students/:studentId/profile-image` | ❌ | Own `:studentId` only | ✅ any | ✅ any |
| `POST /api/predict/manual` | ❌ | ❌ | ✅ | ✅ |
| `POST /api/data/upload-mdb` | ❌ | ❌ | ❌ | ✅ |
| `GET /api/data/mdb-files` | ❌ | ❌ | ❌ | ✅ |
| `POST /api/data/process-mdb/:id` | ❌ | ❌ | ❌ | ✅ |
| `DELETE /api/data/mdb-files/:id` | ❌ | ❌ | ❌ | ✅ |
| `POST /api/ai/chat` | ❌ | ❌ | ✅ rate-limited | ✅ rate-limited |
| `POST /api/reports` (create referral) | ❌ | ❌ | ✅ | ✅ |
| `GET /api/reports` (list) | ❌ | ❌ | Pending plus own assigned only | ✅ all |
| `GET /api/reports/mine` | ❌ | Own upcoming (`accepted`, `scheduled`) only | ✅ (no student filter applied, returns empty unless `studentId` present) | ✅ |
| `GET /api/reports/:id` | ❌ | ❌ | Pending plus own assigned only | ✅ |
| `PATCH /api/reports/:id` (accept, reject, schedule, complete, reset) | ❌ | ❌ | Pending plus own assigned only (admin-only reset to `pending` is still reachable by counselor only for owned records) | ✅ |
| `POST /api/student-reports` | ❌ | ❌ | ✅ | ✅ |
| `GET /api/student-reports` | ❌ | Own `studentId` only | Authored by own email only | ✅ all |
| `GET /api/student-reports/:id` | ❌ | Own record only (marks `readByStudent`) | Author or admin | ✅ |
| `DELETE /api/student-reports/:id` | ❌ | ❌ | Author or admin | ✅ |
| `POST /predict/risk` (ML service) | ❌ without `X-API-Key` | ❌ without `X-API-Key` | ❌ without `X-API-Key` (backend calls with key) | ❌ without `X-API-Key` (backend calls with key) |
| `POST /predict/batch` (ML service) | ❌ without `X-API-Key` | ❌ without `X-API-Key` | ❌ without `X-API-Key` | ❌ without `X-API-Key` |
| `POST /etl/process-mdb` (ML service) | ❌ without `X-API-Key` | ❌ without `X-API-Key` | ❌ without `X-API-Key` | ❌ without `X-API-Key` |

### Enforcement Mechanism

- Edge layer (`middleware.js` with `jose`): verifies the HttpOnly `ikmbToken` on every matched request using `JWT_SECRET`, `JWT_ISSUER`, and `JWT_AUDIENCE`. Invalid, expired, or missing tokens are treated as unauthenticated. Staff detection is `role === 'admin' || role === 'counselor'`. Login pages redirect authenticated staff to `/staff-dashboard` and authenticated students to `/student-dashboard`. Protected routes redirect unauthenticated requests to `/`. Staff routes (`/staff-dashboard`, `/student-profile`) redirect non-staff to `/student-dashboard`. Student routes (`/student-dashboard`) redirect staff to `/staff-dashboard`. The matcher excludes `api`, `_next/static`, `_next/image`, `favicon.ico`, and `assets`.
- Server Action layer (`src/app/actions.js`): `loginAction` delegates credential validation to the backend and only sets cookies on HTTP success. `logoutAction` deletes both cookies. No role logic beyond choosing the post-login redirect path.
- Client layer (`src/lib/roles.js`, `getClientUser`, per-component checks): `ROLES` defines group membership. `StaffDashboardClient` filters out the `data` navigation item for non-admin staff. `StudentDashboardClient` computes `isRestrictedUser` as `role === 'user' && studentId` and restricts the visible list to the bound record. `StudentProfileClient` computes `isStaff` to gate the three intervention cards. `CounselorDashboardClient` computes `isAdmin` to gate the `Set Semula` reset button. These are UX conveniences; real authorization is rechecked server-side.
- Backend layer (`backend/middleware/authMiddleware.js`): `verifyToken` requires `Authorization: Bearer <token>` and verifies HS256 with issuer and audience, returning HTTP 401 with `Token tidak sah atau telah luput.` on failure. `requireAdmin` returns HTTP 403 unless `role === 'admin'`. `requireStaff` returns HTTP 403 unless role is `admin` or `counselor`. `requireOwnershipOrAdmin` returns HTTP 403 unless the caller is staff or `req.user.studentId === req.params.studentId`. Multer upload middleware is always placed after authentication and role middleware so unauthenticated requests never write files to disk.
- Proxy layer (`src/app/api/[...proxy]/route.js`): reads the HttpOnly cookie server-side and injects it as a Bearer header, so browser JavaScript never handles the JWT. Requests without a cookie are forwarded without a header and rejected by the backend with HTTP 401.
- ML layer (`ML/ml.py` `check_auth`): requires `X-API-Key` header equal to `ML_API_SECRET` on all three POST endpoints, returning HTTP 401 `Unauthorized` otherwise. The public `GET /` health endpoint requires no key.

## 4. Page Breakdown, UI Behaviors & Animations

### Login (src/app/page.jsx + src/components/auth/LoginForm.jsx)

- Route: `/` (also treats `/login` as login in middleware even though no `/login` page file exists).
- Access Level: Public. Authenticated requests are redirected by Edge middleware before rendering.
- Primary Function & User Flow:
  1. User lands on a split-screen page. Left panel presents branding (background photo, brain icon, headline `Revolusi Bakat TVET dengan Kuasa AI.`, subcopy about graduate employability, two decorative blurred orbs). Right panel presents the login card (TVETMARA logo, `Selamat Kembali` heading, helper text, default-account hint disclosing `admin@ikmb.edu.my`, `user@ikmb.edu.my`, and password `password123`).
  2. User submits email and password through a React Server Action form (`formAction` from `useActionState(loginAction)`).
  3. `SubmitButton` disables itself while `useFormStatus().pending` is true and swaps its label to a spinning `ph-spinner-gap` icon plus `Memproses...`.
  4. On backend success the server sets cookies and issues an HTTP redirect to `/staff-dashboard` for `admin` and `counselor` or `/student-dashboard` for `user`. On failure the same page re-renders with a red error box containing the backend message or `Gagal menyambung ke pelayan. Pastikan backend berjalan.` on network error.
- Components Used: `LoginForm`, inner `SubmitButton`. No sidebar, no charts, no modals.
- Animations & Visual Transitions:
  - Type: Page entrance plus staggered field entrance plus decorative float plus button micro-interaction plus error pop-in.
  - Implementation: Arbitrary Tailwind animations referencing `globals.css` keyframes: left panel `animate-[slideInLeft_0.6s_ease-out] anim-fill`; right panel `animate-[slideInRight_0.6s_ease-out] anim-fill`; headline `animate-[slideUp_0.5s_ease-out_0.2s] anim-fill`; subcopy `animate-[slideUp_0.5s_ease-out_0.35s] anim-fill`; header block `animate-[slideUp_0.5s_ease-out_0.15s] anim-fill`; email group `animate-[slideUp_0.5s_ease-out_0.25s] anim-fill`; password group `animate-[slideUp_0.5s_ease-out_0.35s] anim-fill`; submit wrapper `animate-[slideUp_0.5s_ease-out_0.45s] anim-fill`; error box `animate-[scaleIn_0.3s_ease-out]`; brain icon and orbs `animate-[floatSoft_3s_ease-in-out_infinite]`, `animate-[floatSoft_6s_ease-in-out_infinite]`, `animate-[floatSoft_8s_ease-in-out_infinite_1s]`; pending spinner `animate-spin`; submit button `transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]` with conditional `bg-blue-400 cursor-not-allowed` versus `bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/25`; inputs `transition-all duration-200` with `focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500`.
  - Trigger: Route mount for all entrance and float animations; form pending state for spinner and disabled style; presence of `state.error` for error pop-in; hover and active pointer states for button scaling.
  - Configuration/Props: Ease-out curves with explicit delays from 150 ms to 450 ms for stagger; `anim-fill` keeps pre-delay elements invisible; float loops infinitely with 3, 6, and 8 second periods.

### Staff Dashboard (src/app/staff-dashboard/page.jsx + src/components/dashboard/StaffDashboardClient.jsx)

- Route: `/staff-dashboard`.
- Access Level: Protected, staff-specific (`admin`, `counselor`). Students are redirected to `/student-dashboard`. Within the page, the `data` tab renders only for `admin`.
- Primary Function & User Flow:
  1. On mount the client loads the user via `getClientUser()`, aborts to `/` when no token exists, fetches `GET /api/semesters`, selects the first `datasetName` as `activeDataset`, fetches students for that dataset, and (for admin) fetches `GET /api/data/mdb-files`. A polling interval refreshes the MDB list every 3 seconds while any record has status `Processing` or a process request is in flight.
  2. Tab `overview` (Dashboard Overview): inspects three `KpiCard` metrics (total students, high-risk count, average employability), a Bar chart of nine PLO averages versus an 80-point target, a high-risk list (top 5) and a top-performer list (top 5). Clicking any student navigates to `/student-profile?id=<id>`.
  3. Tab `prediction` (AI Prediction): searches and filters students through a combobox with risk chips (`Semua`, `Tinggi`, `Sederhana`, `Rendah` with live counts), selects one student to reveal a context card, then sends quick prompts or free text to `POST /api/ai/chat` with streaming Server-Sent Events rendering, markdown-lite formatting (bullets normalized to `•`, `**bold**` and `*italic*` parsed), auto-scroll via `chatEndRef`, and a JSON fallback when the response content type is JSON.
  4. Tab `skills` (Skills Gap Analysis): reads a table of PLO label, average score, gap to target, and status (`Selamat` when average is at least 80, `Perlu Peningkatan` when at least 60, `Kritikal` otherwise).
  5. Tab `pathways` (Learning Pathways): reads recommendation cards sorted by descending gap, each mapped through `pathwayMappings` to a course title, description, and action.
  6. Tab `management` (Student Management): uses `StudentListGrid` search plus course plus risk filters, views profiles, opens `StudentModal` to add or edit records (`POST /api/students`, `PUT /api/students/:id`), and deletes records (`DELETE /api/students/:id`).
  7. Tab `counselor` (Kaunseling & Intervensi): embeds `CounselorDashboardClient` with the current user for the full referral workflow.
  8. Tab `data` (Pengurusan Data, admin only): enters a dataset name, selects an `.mdb` file, uploads via `POST /api/data/upload-mdb` with `FormData`, inspects the archive table, triggers `POST /api/data/process-mdb/:id`, deletes via `DELETE /api/data/mdb-files/:id`, and switches the active dataset through a semester `<select>`.
- Components Used: `Sidebar`, `KpiCard`, `StudentModal`, `StudentListGrid`, `CounselorDashboardClient`, `RiskBadge` and `getRiskMeta` from `dashboard-kit`, Chart.js `Bar` with `CategoryScale`, `LinearScale`, `BarElement`, `Title`, `Tooltip`, `Legend`, heuristics `calculateEmployability` and `calculateTopPerformerScore`, Next `useRouter`, `logoutAction`, `getClientUser` and `getClientToken`.
- Animations & Visual Transitions:
  - Type: Tab fade, card rise with stagger, list stagger, hover lift, dropdown fade, context-card pop, chat slide, typing bounce, streaming pulse, spinner rotation, processing pulse, skeleton pulse.
  - Implementation: Tab wrappers `animate-[fadeIn_0.3s_ease-in-out]`; PLO chart card `animate-[slideUp_0.4s_ease-out_0.2s] anim-fill`; risk and top panels `animate-[slideUp_0.4s_ease-out_0.3s]` and `0.35s`; list items `animate-[slideUp_0.3s_ease-out] anim-fill` with inline `animationDelay` computed as `350 + index * 60` ms and `400 + index * 60` ms; table rows `150 + index * 40` ms; pathway cards `100 + index * 80` ms with `hover:shadow-md hover:-translate-y-1 transition-all duration-300`; destructive rows `hover:bg-red-100 hover:shadow-sm hover:translate-x-1 transition-all duration-200`; filter chips `transition-all duration-200 active:scale-95`; AI dropdown `animate-[fadeIn_0.2s_ease-out]`; context card `animate-[scaleIn_0.3s_ease-out]`; split AI panels `animate-[slideInLeft_0.4s_ease-out]` and `animate-[slideInRight_0.4s_ease-out]`; chat empty state `animate-[fadeIn_0.5s_ease-out]` plus `animate-[floatSoft_4s_ease-in-out_infinite]`; messages `animate-[slideUp_0.3s_ease-out]`; typing dots `animate-bounce` with `[animation-delay:0.2s]` and `[animation-delay:0.4s]`; streaming cursor `animate-pulse`; send button `hover:shadow-lg hover:shadow-emerald-600/20 transition-all duration-200 active:scale-95`; spinner `animate-spin`; ETL badge `animate-pulse`; skeleton rows `animate-pulse`; status badges `animate-[fadeIn_0.4s_ease-in-out]` with processing state combining `animate-pulse` and `animate-spin`.
  - Trigger: Route mount and tab switch for entrance; message append for chat slide; typing flag for bounce; streaming flag for pulse; `status === 'Processing'` for ETL pulse; hover for lift and shadow; click for chip scale.
  - Configuration/Props: Chart.js Bar options `responsive: true`, `maintainAspectRatio: false`, y-axis 0 to 100, `animation: { duration: 800, easing: 'easeOutQuart' }`, container `h-80 w-full`, datasets `Purata Skor Institut (%)` in `#2563EB` with `borderRadius: 6` and `Sasaran 80` in `#E5E7EB`.

### Student Dashboard (src/app/student-dashboard/page.jsx + src/components/dashboard/StudentDashboardClient.jsx)

- Route: `/student-dashboard`.
- Access Level: Protected, student-specific (`user`). Staff are redirected to `/staff-dashboard`. Restricted students (role `user` with bound `studentId`) see only their own record, lose the student selector, and gain an ID badge.
- Primary Function & User Flow:
  1. On mount the client loads the user, fetches `GET /api/semesters`, picks the first dataset, fetches `GET /api/students` or `GET /api/students?dataset=<name>`, restricts the list when applicable, and selects the first record.
  2. Whenever the selected student or dataset changes, the client fetches `GET /api/students/:id/skill-gap` (with dataset query) and then `GET /api/students/:id` to hydrate `customCerts` from `uploadedCertificates`, toggling `isLoading` on each change.
  3. Tab `dashboard` (Profil & Prestasi): views welcome header with `RiskBadge`, semester selector, three stat cards (employability via `calculateEmployability`, attendance percentage, CGPA), a Radar skill-gap chart with AI insight text, and a career teaser showing the top two entries from `careerMapping[kursus]` with a button that switches to the career tab.
  4. Tab `profile` (Kemaskini Sijil Saya): clicks the avatar to open a file picker handled by `handleProfileImageChange` (posts `FormData { file }` to `/api/students/:id/profile-image`), views disabled name, ID, and course fields, adds certificates through name plus issuer plus file validated for presence (posts `FormData { name, issuer, file }` to `/api/students/:id/certificates`), and deletes certificates via `DELETE /api/students/:id/certificates/:certId`.
  5. Tab `reports` (Laporan & Temujanji): embeds `MergedLaporanTab` with the current user.
  6. Tab `career` (Padanan Kerjaya AI): reads a grid of `JobCard` entries for the student's course code.
  7. Tab `courses` (Kursus Cadangan): reads a personalized card from `courseMappings[weakestPlo]` plus a static AWS card.
- Components Used: `Sidebar` (with `profileImage` from `skillGap.student`), `JobCard`, `MergedLaporanTab`, Chart.js `Radar` with `RadialLinearScale`, `PointElement`, `LineElement`, `Filler`, `Tooltip`, `Legend`, `calculateEmployability`. Static maps `careerMapping` (seven course codes `ITW`, `DFK`, `DGA`, `SLR`, `DCG`, `SED`, `PPU`, each with two `{ title, company, match, icon }` entries), `getFullCourseName(code)`, `courseMappings` (nine PLO keys each with `{ title, desc, bg, btn }`), and `initialSkillGap` (nine zeroed PLO values with target 80).
- Animations & Visual Transitions:
  - Type: Tab fade, card hover shadow, dropzone hover, avatar overlay fade, button color transition.
  - Implementation: Every tab wrapper `animate-[fadeIn_0.3s_ease-in-out]`; cards `group` with `hover:shadow-md transition`; file dropzone `hover:bg-slate-100 transition`; avatar overlay `opacity-0 group-hover:opacity-100 transition-opacity`; buttons `transition-colors`.
  - Trigger: Route mount and tab switch for fade; hover for shadow and overlay; file selection for image and certificate list updates.
  - Configuration/Props: Radar datasets `Data Pelajar` in `rgba(37,99,235,0.2)` fill with `#2563EB` border and `Target` in `rgba(16,185,129,0.1)` fill with `#10B981` border plus `borderDash: [5,5]`; options `maintainAspectRatio: false`, radial axis `beginAtZero: true`, `min: 0`, `max: 100`, ticks `stepSize: 20`; container `h-64 flex items-center justify-center`. Chart.js default animation applies because no custom duration is set.

### Student Profile (src/app/student-profile/page.jsx + src/components/dashboard/StudentProfileClient.jsx)

- Route: `/student-profile?id=:id` (defaults to `TVET001` when the query parameter is absent).
- Access Level: Protected, staff route at the Edge (students are redirected away). The component additionally gates the three intervention cards behind `isStaff` so any non-staff renderer sees personal, academic, and skills content without referral buttons. Breadcrumb back navigates to `/staff-dashboard`, confirming staff as the primary audience.
- Primary Function & User Flow:
  1. On `studentId` change the client fetches `GET /api/students/:id/skill-gap`, shows a loading spinner while pending, and shows `Pelajar tidak dijumpai` when the result is null.
  2. Left card shows the TVETMARA header with `StatusBadge`, avatar, name, ID, course, semester, certification, attendance, and action row: Edit (currently a no-operation button), Print (calls `window.print()`), Download JSON (creates a client-side Blob of `{ studentDetails, academicHistory, aiInsight, employabilityScore, ploScores }` named `Profil_Pelajar_<id>.json`), and `Jana Laporan / Surat` (opens `GenerateReportModal`).
  3. Right panel switches three inner tabs. Tab `personal` shows derived email `<id>@student.ikmb.edu.my` plus national ID, phone, and address (or `Tiada Rekod`). Tab `academic` shows CGPA over 4.00 with a color-coded progress bar plus a Bar-plus-Line trend chart built from `academicHistory`. Tab `skills` shows an employability card, a Radar chart, a `DATA PLO BELUM LENGKAP` warning when any PLO score is zero, and three intervention cards (staff only) that open `ReportFormModal` with type `kaunseling`, `klinik`, or `softskills`.
- Components Used: `ReportFormModal` (with `student` and `interventionType`), `GenerateReportModal` (with `student` and `skillGap`), Chart.js `Bar` and `Radar` with `CategoryScale`, `LinearScale`, `BarElement`, `BarController`, `LineController`, `Title`, `Tooltip`, `Legend`, `RadialLinearScale`, `PointElement`, `LineElement`, `Filler`, local `StatusBadge`, `getFullCourseName` with long diploma names, `getClientUser` and `getClientToken`.
- Animations & Visual Transitions:
  - Type: Page fade, panel slide-in from opposite sides, staggered column rise, tab color transition, card lift, avatar pop, chart entrance, warning pop, wand float, progress-bar growth.
  - Implementation: Root `animate-[fadeIn_0.4s_ease-out]`; breadcrumb `animate-[slideUp_0.4s_ease-out]` with link `transition-colors duration-200`; left panel `animate-[slideInLeft_0.5s_ease-out_0.1s] anim-fill` with card `hover:shadow-md transition-shadow duration-300` and avatar `animate-[scaleIn_0.4s_ease-out_0.3s] anim-fill`; right panel `animate-[slideInRight_0.5s_ease-out_0.15s] anim-fill`; tab buttons `transition-all duration-200` with active `border-[#1251AA] text-[#1251AA]`; personal tab `animate-[fadeIn_0.3s]` with columns `animate-[slideUp_0.4s]` and `animate-[slideUp_0.4s_ease-out_0.1s]`; academic chart `animate-[slideUp_0.4s_ease-out_0.15s]`; employability card `animate-[slideUp_0.4s]` with wand `animate-[floatSoft_4s_ease-in-out_infinite]`; radar wrapper `animate-[slideUp_0.4s_ease-out_0.15s]`; warning `animate-[scaleIn_0.3s_ease-out]`; intervention cards `animate-[slideUp_0.4s_ease-out_0.2s]`, `0.3s`, `0.4s` with `anim-fill` and `hover:shadow-md hover:-translate-y-0.5 transition-all duration-300`; intervention buttons `transition-all duration-200 active:scale-95`; CGPA bar `transition-all duration-700 ease-out` with width `(cgpa / 4 * 100)%` and color `bg-red-500` below 2.5, `bg-amber-500` below 3.5, `bg-emerald-500` otherwise; employability computed as `Math.min(100, Math.round(cgpa / 4 * 40 + attendance * 0.6))`.
  - Trigger: Route mount for root and panel slides; inner tab switch for tab fade; staff flag for intervention cards; zero PLO score for warning; hover for card lift.
  - Configuration/Props: Combo trend chart datasets line GPA (`borderColor #2563EB`, `borderWidth 2`, `tension 0.3`, axis `y`) and bar attendance (`rgba(16,185,129,0.2)` fill, `#10B981` border, `borderRadius 4`, axis `y1`); dual axes `y` max 4 titled GPA and `y1` max 100 titled Kehadiran with `grid.drawOnChartArea: false`; `animation: { duration: 800, easing: 'easeOutQuart' }`; container `h-64`. Radar uses the same blue and green palette with radial 0 to 100 step 20 and container `h-72`.

### Counseling Workspace (embedded via Staff Dashboard, src/components/dashboard/CounselorDashboardClient.jsx)

- Route: No standalone URL. Rendered when staff selects the `counselor` tab as `<CounselorDashboardClient currentUser={user} />`.
- Access Level: Staff-only by parent route. Inside, `counselor` executes the full workflow and `admin` gains the additional `Set Semula` action that resets `completed` and `rejected` records to `pending`. No Bearer header is sent; requests rely on cookies.
- Primary Function & User Flow:
  1. On mount the client fetches `GET /api/reports` and `GET /api/student-reports` in parallel, showing `SkeletonList` with four rows while loading.
  2. Tab `calendar` renders `AppointmentCalendar` and completes sessions through `openCompleteModal`.
  3. Tab `pending` accepts (`{ action: 'accepted' }`) or rejects (`{ action: 'rejected' }`) referrals with toast confirmation (`Rujukan diterima...`, `Rujukan ditolak`).
  4. Tab `scheduled` (includes both `accepted` and `scheduled` records) schedules accepted referrals through a modal with a `datetime-local` input defaulting to tomorrow at 09:00 plus a notes field (`{ action: 'scheduled', scheduledDate, counselorNotes }`), completes scheduled sessions through a notes modal (`{ action: 'completed', counselorNotes }`), and reschedules existing sessions.
  5. Tabs `completed` and `all` display reason, counselor notes, and attachments, with admin reset (`{ action: 'pending' }`).
  6. Tab `sent-reports` lists student inbox reports with title, type, date, student, course, message, and PDF, and deletes them after confirmation (`DELETE /api/student-reports/:id`).
  7. Toasts render fixed at the top and auto-dismiss after 3000 ms.
- Components Used: `PillTabs`, `EmptyState`, `SkeletonList`, `Badge`, `formatMsDate`, `AppointmentCalendar`. Constants `STATUS_CONFIG` (pending amber, accepted blue, scheduled purple, completed green, rejected rose) and `INTERVENTION_LABELS` (kaunseling, klinik, softskills). No charts.
- Animations & Visual Transitions:
  - Type: Toast fade, card rise with stagger, modal fade plus rise, button press scale, spinner rotation.
  - Implementation: Toast `animate-[fadeIn_0.3s_ease-out]`; cards `animate-[slideUp_0.3s_ease-out] anim-fill` with `animationDelay: index * 50` ms and `hover:shadow-md transition`; action buttons `transition active:scale-95 touch-target`; modal backdrop `animate-[fadeIn_0.2s_ease-out]` with panel `animate-[slideUp_0.3s_ease-out]`; submitting icon `animate-spin`.
  - Trigger: Data arrival and filter change for card stagger; action result for toast; modal open for backdrop and panel animations.
  - Configuration/Props: Tab counts derived from `reports` plus `sentReports.length`; `filteredReports` maps `pending` to status pending, `scheduled` to scheduled or accepted, `completed` to completed, and `all` to every record.

### Student Inbox (embedded via Student Dashboard, src/components/dashboard/MergedLaporanTab.jsx)

- Route: No standalone URL. Rendered when the student selects the `reports` tab as `<MergedLaporanTab user={user} />`.
- Access Level: Student. The component fetches only when the `user` prop exists. Backend endpoints scope results to the logged-in student (`/api/student-reports` filters by `studentId`, `/api/reports/mine` filters by `studentId` and statuses `accepted` and `scheduled`).
- Primary Function & User Flow:
  1. When `user` becomes available the client runs `Promise.all` over `GET /api/student-reports` and `GET /api/reports/mine`, normalizes both collections with `normalizeLaporanItems`, sorts by `displayDate` descending, and stores the merged `items` array.
  2. `PillTabs` filters (`all` Semua, `report` Laporan, `appointment` Temujanji) narrow the list with live counts. The header shows `Peti Masuk Laporan`, an unread badge, and a `Muat Semula` button.
  3. Clicking an item sets `selectedItem` and, for unread reports, fires `GET /api/student-reports/:id` (which marks the record read server-side) and patches `readByStudent: true` locally.
  4. Details render in `StudentDetailModal` with `kind` derived from `itemType`. Loading shows `SkeletonList` with four rows; empty filters show `EmptyState`.
- Components Used: `PillTabs`, `Badge`, `EmptyState`, `SkeletonList`, `StudentDetailModal`. `SectionCard` and `formatMsDate` are imported but unused; local `formatLaporanDate` formats with `ms-MY` locale (`day 2-digit`, `month short`, `year numeric`, `hour 2-digit`, `minute 2-digit`, `-` on invalid input). Label maps `REPORT_TYPE_LABELS` (message to Mesej, letter to Surat, full to Laporan Penuh) and `INTERVENTION_LABELS` (kaunseling to Kaunseling, klinik to Klinik Akademik, softskills to Soft Skills).
- Animations & Visual Transitions:
  - Type: Badge pop, list rise with stagger, press scale, unread highlight.
  - Implementation: Unread badge `animate-[scaleIn_0.3s_ease-out]`; refresh button `transition active:scale-95 touch-target`; list buttons `animate-[slideUp_0.3s_ease-out] anim-fill` with delay `index * 50` ms plus `active:scale-[0.98] hover:shadow-md transition touch-target`; unread style `border-blue-300 bg-blue-50/30 ring-1 ring-blue-200` versus read style `border-slate-200`; unread dot `w-2 h-2 rounded-full bg-blue-500`.
  - Trigger: Fetch completion for badge; item arrival and filter change for stagger; click for press scale; `readByStudent` flag for highlight removal.
  - Configuration/Props: Report normalization preserves `title`, `studentName`, `course`, `cgpa`, `attendance`, `riskLevel`, `message`, `filePath`, `fileName`, `reportType`, `readByStudent`, `authorName`, `displayDate` from `createdAt`, `ploScores`, and `employability`. Appointment normalization synthesizes `title` as `Temujanji: <interventionType>` with `reason`, `priority`, `status`, `scheduledDate`, `counselorId`, `counselorNotes`, and `displayDate` from `scheduledDate` or `createdAt`.

### Appointment Calendar (embedded via Counseling Workspace, src/components/dashboard/AppointmentCalendar.jsx)

- Route: No standalone URL. Rendered when the counselor selects the `calendar` tab as `<AppointmentCalendar reports onComplete={openCompleteModal} />`.
- Access Level: Inherits staff-only counseling context. No network calls and no role checks inside; all data arrives through props.
- Primary Function & User Flow:
  1. The component filters props to `scheduledReports` (records with a `scheduledDate` and status `scheduled` or `accepted`), groups them by `dayKey(date)` formatted as `YYYY-MM-DD` with zero padding, and memoizes the map.
  2. It renders a Monday-first month grid (Sunday index 0 mapped to offset 6), with previous and next month buttons resetting `selectedDay`.
  3. Clicking a day sets `selectedDay` (toggling off on mobile when the same day is clicked again). Selected days use `bg-blue-50 border-blue-400 ring-1 sm:ring-2 ring-blue-300`; today uses `bg-blue-50/50 border-blue-200`. Day cells show up to one pill on mobile and two on desktop (`bg-red-100 text-red-700` for urgent, `bg-purple-100 text-purple-700` otherwise), plus `+N lagi` overflow text and a red dot when urgent items exist.
  4. A side panel on desktop and a bottom sheet on mobile list `selectedDayReports` with time (via `toLocaleTimeString('ms-MY')`), intervention type, priority, attachment link, and a `Tandakan Selesai` button for `scheduled` records that calls `onComplete(report)`.
  5. A `Temujanji Akan Datang` section sorts sessions by ascending `scheduledDate`; clicking an entry jumps the calendar to that day.
- Components Used: None external. Pure JSX with Phosphor `ph-*` icons. Constants `DAY_NAMES` (Isn through Ahd), `MONTH_NAMES` (Januari through Disember), and `INTERVENTION_LABELS`. No charts.
- Animations & Visual Transitions:
  - Type: Bottom-sheet rise on mobile, detail fade on desktop, cell press scale, row hover.
  - Implementation: Mobile sheet `animate-[slideUp_0.3s_ease-out]`; desktop detail `animate-[fadeIn_0.3s_ease-out]`; cells and buttons `transition active:scale-95 touch-target` with `hover:bg-slate-50`; rows `hover:bg-slate-50 transition`; upcoming cards `hover:shadow-sm transition`.
  - Trigger: Day selection for sheet and detail animations; viewport width below 1024 px (tracked by a resize listener in `isMobile`) for sheet versus side-panel layout; hover for cell and row feedback.
  - Configuration/Props: CSS grid `grid-cols-7` for the calendar and `grid lg:grid-cols-3` for the surrounding layout. All date grouping is memoized on `reports` and `currentMonth`.

### Shared Modals and Building Blocks

- `Sidebar.jsx`: Fixed mobile drawer (`fixed inset-y-0 left-0 z-30 w-64 transform transition-transform duration-300 ease-out shadow-2xl md:shadow-none` with `translate-x-0` versus `-translate-x-full`, static on desktop via `md:relative md:translate-x-0`) plus backdrop (`fixed inset-0 bg-black/50 backdrop-blur-sm z-20 md:hidden animate-[fadeIn_0.2s_ease-out]`). Navigation buttons use `transition-all duration-200` with active `bg-blue-50 text-blue-600 border-l-4 border-blue-600` and inactive `text-slate-500 hover:bg-slate-50 hover:text-slate-800 active:bg-slate-100`. Close and logout buttons use `transition-colors` with logout adding `active:scale-95` and `hover:bg-red-50 hover:text-red-600`. Escape key and backdrop click close the drawer; mobile open locks `document.body.style.overflow`.
- `KpiCard.jsx`: Card `hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 animate-[slideUp_0.4s_ease-out] anim-fill` with `animationDelay` from the `delay` prop; icon wrapper `transition-transform duration-300 hover:scale-110`; loading value replaced by `skeleton-shimmer` span; progress bar `transition-all duration-700 ease-out` with width from `barWidth`.
- `StudentModal.jsx`: Overlay `fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center items-center p-0 sm:p-4 animate-[fadeIn_0.2s_ease-out]`; panel `bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl overflow-y-auto sm:max-w-2xl animate-[slideUp_0.3s_ease-out]`; inputs `focus:ring-2 focus:ring-blue-500 transition-shadow`; buttons `transition-colors active:scale-95`; sticky header and footer with `safe-area-top`, `safe-area-bottom`, `touch-target`, `pb-safe`, `scroll-smooth-mobile`. Fullscreen on mobile, centered dialog on small screens and above.
- `StudentListGrid.jsx`: Root `animate-[fadeIn_0.3s_ease-in-out]`; header `animate-[slideUp_0.4s_ease-out]`; course chips `animate-[slideUp_0.4s_ease-out_0.1s] anim-fill` with active `bg-[#0C2461] text-white shadow-md`; risk chips `animate-[slideUp_0.4s_ease-out_0.15s] anim-fill` as rounded pills with dot and count; empty state `animate-[scaleIn_0.3s_ease-out]`; cards `hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animate-[slideUp_0.4s_ease-out] anim-fill` with `animationDelay: Math.min(index * 60, 480)` ms; avatar `transition-transform duration-300 group-hover:scale-105` (the parent card omits the `group` class so this scale never fires, which is a known dead hover).
- `ReportFormModal.jsx`: Overlay `fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]`; panel `sm:max-w-lg animate-[slideUp_0.3s_ease-out]`; toast `animate-[scaleIn_0.2s_ease-out]`; submitting icon `animate-spin`; priority toggle and dropzone `transition touch-target active:scale-95` and `active:scale-[0.98]`. Counselor dropdown is populated from `/api/auth/users` filtered to `counselor`, defaulting to the first entry; submit is disabled while `isSubmitting` or when no counselors exist.
- `GenerateReportModal.jsx`: Same overlay and panel animation as `ReportFormModal` with an emerald submit (`bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20`), PDF-only attachment handling, title prefill guarded by `prevIsOpenRef` so typing does not reset the form, and employability computed with the shared heuristic before posting.
- `StudentDetailModal.jsx`: Overlay `fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]`; panel `sm:max-w-2xl animate-[slideUp_0.3s_ease-out]`; purple calendar header for appointments versus blue file header for reports; date via `formatMsDate`; priority pill `SEGERA` red versus `NORMAL` slate; footer download anchor and `window.open(filePath, '_blank')` print button with `active:scale-95`; report PDF rendered in an `h-64 sm:h-96` iframe.
- `dashboard-kit.jsx`: `Badge` pill `animate-[scaleIn_0.25s_ease-out]`; `StatCard` card `animate-[slideUp_0.4s_ease-out] anim-fill` with delay prop and icon `hover:scale-110`; `SectionCard` wrapper `animate-[slideUp_0.4s_ease-out] anim-fill` with delay; `PillTabs` buttons `animate-[slideUp_0.3s_ease-out] anim-fill` with `index * 50` ms delay, active blue shadow versus inactive white border; `EmptyState` wrapper `animate-[fadeIn_0.4s_ease-out]` with icon `animate-[floatSoft_3s_ease-in-out_infinite]`; `SkeletonList` rows `skeleton-shimmer rounded-xl animate-[slideUp_0.3s_ease-out] anim-fill` with `index * 80` ms delay; `RiskBadge` pill `animate-[scaleIn_0.25s_ease-out]` with `title` tooltip and `ph-fill` icon. Risk mapping: `Tinggi` and `Bermasalah` map to `Risiko Tinggi` (red, `ph-warning-octagon`), `Sederhana` maps to `Risiko Sederhana` (amber, `ph-clock`), all other values including `Cemerlang`, `Rendah`, `Pending AI`, and undefined map to `Risiko Rendah` (emerald, `ph-check-circle`).
- `AttachmentPreview.jsx`: Container `animate-[scaleIn_0.2s_ease-out] border rounded-xl bg-slate-50`; red PDF icon versus blue image icon; remove button `hover:text-red-500 hover:bg-red-50 active:scale-95`; image pane `bg-slate-100 max-h-48 sm:max-h-64` with contain; PDF pane `h-48 sm:h-64 bg-slate-200` with iframe; `Buka` link opens `previewUrl` in a new tab.
- `JobCard.jsx`: Card `hover:border-blue-300 hover:shadow-md transition group animate-[slideUp_0.4s_ease-out]`; icon box `bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors`; action button `bg-slate-50 hover:bg-blue-600 hover:text-white transition active:scale-95 hover:shadow-lg`; match badge `ph-fill ph-sparkle` plus `<match> Match`.

## 5. Data Flow & State Lifecycles

### Backend to Component: Read Path

1. Browser holds two cookies after login: readable `user` JSON and HttpOnly `ikmbToken` JWT.
2. Dashboard clients call same-origin `/api/*` endpoints. The Next.js proxy injects the Bearer token server-side (or the request carries cookies that the backend verifies directly when called without the proxy prefix, depending on deployment). The backend `verifyToken` middleware validates issuer, audience, algorithm, and expiry, then attaches `req.user = { email, role, studentId }`.
3. Role middleware (`requireStaff`, `requireAdmin`, `requireOwnershipOrAdmin`) narrows access before any database query. Student list queries branch: staff call `getAllStudents(dataset)` which queries `Student.find({ sourceDataset: dataset })` when a dataset filter is present, while students call `getStudentById(studentId, dataset)` and receive a zero-or-one-element array.
4. `item.model.js` normalizes every raw `Student` document through `normaliseStudent`: numeric coercion of `CGPA` and `Kehadiran_Pct`, PLO coercion with zero fallback, certification scoring (`Tiada` 35, `CompTIA` 70, `Cisco CCNA` 85, `AWS Cloud` 90, fallback 50), dropout-risk derivation (attendance below 80 or CGPA below 2.0 forces `Tinggi`; `Bermasalah` forces `Tinggi` even with high CGPA; CGPA at least 3.5 or `Cemerlang` yields `Rendah`; otherwise `Sederhana` via the mapped value), and passthrough of certificates, profile image, personal fields, academic history, and `sourceDataset`.
5. Skill-gap endpoints extend the normalized record with `buildMetrics` (nine `{ label: 'PLO N', value, target: 80 }` entries) and `buildInsight` (weakest PLO detection with a special `Nota: Penilaian untuk ... belum direkodkan` message when the minimum is zero, otherwise a gap and priority sentence referencing the lowercase risk label), then overwrite `dropoutRisk` with a live ML prediction from `getRealAIPrediction` when the ML service is reachable.
6. Components store the normalized payload in `useState` (`students`, `skillGap`, `reports`, `items`, `mdbFiles`, `semesters`), derive display values with `useMemo` or inline computation (risk counts, PLO averages, gaps, filtered lists, chart datasets, employability scores), and render charts, tables, cards, and modals. Status transitions (accept, schedule, complete, delete, upload, process) trigger refetch functions (`fetchStudents`, `fetchReports`, `fetchSentReports`, `fetchMdbFiles`, `fetchData`) that replace the corresponding state slice.

### Backend to Component: Write Path

1. Student CRUD sends JSON (`POST /api/students`, `PUT /api/students/:studentId`, `DELETE /api/students/:id`) with `Content-Type: application/json`. Updates apply to all semester snapshots via `updateMany({ ID_Pelajar: id })`, wrapping non-operator bodies in `$set` with `runValidators: true`. Deletes remove all snapshots via `deleteMany({ ID_Pelajar: id })` plus bound `User` accounts via `deleteMany({ studentId: id, role: 'user' })`.
2. Certificate and profile-image writes send `FormData` without an explicit content type (browser sets the multipart boundary) to `POST /api/students/:id/certificates` (fields `name`, `issuer`, `file`) and `POST /api/students/:id/profile-image` (field `file`). Multer validates PDF, JPG, JPEG, and PNG with a 5 MB limit, stores files under `uploads/certificates` with timestamped names, records `/uploads/certificates/<filename>` in `uploadedCertificates` or `profileImage` across all snapshots, and returns the created certificate or image path for optimistic local patching.
3. Counseling referrals send `FormData` to `POST /api/reports` (fields `studentId`, `studentName`, `course`, `cgpa`, `attendance`, `riskLevel`, `interventionType`, `reason`, `priority`, `scheduledDate`, `counselorId`, optional `file`). The backend validates required fields, restricts `interventionType` to `kaunseling`, `klinik`, `softskills`, validates the date, resolves `counselorId` against a `User` with role `counselor`, normalizes priority to `urgent` or `normal`, and creates a `Report` with status `scheduled` plus an optional `/uploads/referrals/<filename>` attachment. State changes use `PATCH /api/reports/:id` with `{ action }` values `accepted`, `rejected`, `scheduled`, `completed`, `pending`, optionally plus `scheduledDate` and `counselorNotes`.
4. Student reports send `FormData` to `POST /api/student-reports` (fields `studentId`, `studentName`, `course`, `cgpa`, `attendance`, `riskLevel`, `semester`, `title`, `message`, optional `ploScores` JSON string, computed `employability`, optional PDF `file`). The backend parses `ploScores` into `{ label, value }` pairs, clamps employability to 0-100, derives `reportType` (`full` when file plus message, `letter` when file only, `message` otherwise), enforces PDF-only attachments with a 5 MB limit under `uploads/reports`, and creates a `StudentReport` with `readByStudent: false`. Reads via `GET /api/student-reports/:id` flip the flag for the owning student. Deletes remove the disk file (with path-traversal guard confining deletions to the `uploads` root) and the document.
5. MDB ingestion is a two-phase admin flow. Phase one (`POST /api/data/upload-mdb` with `FormData { file, datasetName }`) validates the dataset name, enforces the `.mdb` extension with a 100 MB limit, stores the file under `uploads/mdb`, and creates an `MdbFile` record with status `Saved`. Phase two (`POST /api/data/process-mdb/:id`) calls `executeEtlAndSync`: marks the record `Processing`, streams the file as a `Blob` in `FormData` to ML `POST /etl/process-mdb` with `X-API-Key`, maps each returned student to batch features, calls ML `POST /predict/batch` to fill `Status_Pelajar`, then bulk-upserts students with compound key `{ ID_Pelajar, sourceDataset: datasetName }` (preserving prior semesters) and bulk-upserts bound logins with `$setOnInsert` passwords (never overwriting existing credentials). Success marks the record `Processed` with `recordsProcessed` and `processedDate`; failure marks it `Failed` and throws. The frontend polls `GET /api/data/mdb-files` every 3 seconds while any record is `Processing`.
6. AI chat sends JSON to `POST /api/ai/chat` with `{ studentId, userMessage, chatHistory }`. The backend validates presence and a 1500-character limit, enforces 15 requests per minute per staff email, loads the student with `getStudentById`, strips PII into `studentDataForAI`, prepends `TVET_KNOWLEDGE` grounding and an injection guard to the system prompt, sanitizes history (valid roles only, last 16 entries, strict user-model alternation starting with user, no trailing user message, truncated to 1500 characters), calls Gemini streaming SSE first (writing `candidates[0].content.parts[0].text` chunks as `text/plain` with no-cache headers), falls back to non-streaming JSON when streaming yields no chunks, and returns HTTP 500 with `Gagal mendapatkan respons daripada AI.` without leaking the API key on failure.

### Global State versus Local State Handling

- No global store exists. Cross-cutting concerns are handled by cookies (`user` for display, `ikmbToken` for authorization), URL query parameters (`student-profile?id`), and server-side proxy injection.
- Each dashboard owns its domain slice: `StaffDashboardClient` owns semesters, datasets, students, AI chat, and MDB pipeline state; `StudentDashboardClient` owns semester, selected student, skill gap, and certificate draft state; `StudentProfileClient` owns the single skill-gap payload plus modal open flags; `CounselorDashboardClient` owns referral and sent-report lists plus modal and toast state; `MergedLaporanTab` owns the merged inbox plus filter and selection state; `AppointmentCalendar` owns only view state (`currentMonth`, `selectedDay`, `isMobile`) with all domain data passed as props.
- Shared logic is extracted as functions and hooks rather than stores: `getClientUser`, `getRoleLabel`, `isStaff`, `calculateEmployability`, `calculateTopPerformerScore`, `formatMsDate`, `getRiskMeta`, `useFilePreview`, `formatFileSize`, `normalizeLaporanItems`, `formatLaporanDate`. Modal visibility is always a local boolean plus an `onClose` callback; form drafts are always local `useState` objects updated by a single `handleInputChange` keyed on input `name`.
- Navigation state (`activeTab`, `isSidebarOpen`) lives in each dashboard client and is passed down to `Sidebar`. No tab state persists across routes; switching dashboards resets to the default tab (`overview` for staff, `dashboard` for students, `calendar` for the embedded counselor view, `all` for the embedded inbox).

### Caching, Local Storage, Session Persistence Patterns

- HTTP caching: all dynamic pages use `force-dynamic`, so Next.js never statically caches dashboard HTML. Chart.js and component state are in-memory only and refetch on dataset change, tab-relevant polling, or explicit refresh buttons. No `localStorage`, `sessionStorage`, or IndexedDB usage exists anywhere in `src`.
- Cookie persistence: `user` and `ikmbToken` both use `maxAge: 86400` (24 hours). `ikmbToken` is `httpOnly: true`, `secure` in production, `sameSite: lax`, `path: /`. `user` is readable (`httpOnly: false`) with `secure` in production and `path: /`. Logout deletes both cookies. JWT itself expires after 8 hours, so sessions longer than 8 hours but shorter than 24 hours retain cookies that the Edge and backend reject, producing redirects to `/` or HTTP 401 responses that the UI handles by navigating to `/`.
- File preview lifecycle: `useFilePreview` creates `URL.createObjectURL(file)` in a `useEffect` keyed on `file` and revokes it in the effect cleanup, so previews never leak object URLs and never persist beyond the modal session.
- Backend recovery: on successful Mongo connection the server resets any `MdbFile` records stuck in `Processing` to `Saved`, so crashed ETL jobs do not block the UI permanently. The frontend complements this with 3-second polling while processing flags are present.
- Database as the source of truth: semester snapshots are keyed by `{ ID_Pelajar, sourceDataset }`, so switching the semester selector re-queries rather than filtering cached rows. Certificates, profile images, referrals, and student reports are read fresh on each mount or refresh. The `dist/` directory contains a stale Vite build (`index.html`, `index-C4sBUKSD.css`, `index-DyfLGFLv.js`) that is not referenced by the Next.js application and should not be treated as a cache layer.

---

Last Updated: 2026-10-06 19:05:00 UTC+8
