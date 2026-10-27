# Project Architecture & Technical Blueprint

**Project:** TVETMARA Besut – Skills & Talent Development Dashboard (Sistem Papan Pemuka Pintar IKMB)
**Repo root:** `TVETMARA-Besut-Skills-Talent-Development-Dashboard`
**Architecture style:** Three independently-deployed services (Next.js SSR frontend, Express REST backend, FastAPI ML microservice) + one shared MongoDB, wired together over a private Docker/Podman bridge network (`tvet_net`).

---

## 1. System Overview & Tech Stack

### 1.1 Core Framework & Runtime

| Layer | Technology | Exact Version (from lockfile/manifest) | Notes |
| :--- | :--- | :--- | :--- |
| Frontend framework | **Next.js (App Router)** | `15.1.6` (pinned in root `package.json`) | SSR everywhere: every route page exports `dynamic = 'force-dynamic'`; build output is `standalone` for the Docker runner stage |
| UI runtime | **React / React DOM** | `^19.0.0` | React Server Components for pages, Client Components for all interactive dashboards; `useActionState` + `useFormStatus` for Server-Action forms |
| Language | **JavaScript (ESM)** | `"type": "module"` (both root and `backend/`) | Path alias `@/* → ./src/*` (`jsconfig.json`, mirrored in `vitest.config.js`). No TypeScript. |
| Backend framework | **Express** | `^5.2.1` (`backend/package.json`) | Entry `backend/server.js`; routers mounted at `/api/auth`, `/api/reports`, `/api/student-reports`, and `/api` (items/data/ML/`/ai/chat`) |
| ODM / Database | **Mongoose** | `^9.3.3` against **MongoDB** (`mongo:latest` container) | Database name `ikmb-dashboard`; WiredTiger datadir lives in `./mongodb_data` (host bind mount) |
| ML service | **FastAPI + Uvicorn** | Python `3.9-slim` container; `requirements.txt`: fastapi, uvicorn, scikit-learn, joblib, pydantic, pandas, numpy, httpx, pytest, pytest-asyncio, python-multipart | Entry `ML/ml.py`; model artefact `model_ai_risiko_lengkap_v4.pkl` (RandomForest, trained by `ML/train_and_evaluate_v4.py` on 3-semester real data with `GroupShuffleSplit` anti-leakage) |
| MDB extraction | **mdbtools** (`mdb-tables`, `mdb-export`) | installed in ML container image | Called via `subprocess.run` with 15–30 s hard timeouts |

### 1.2 State Management & Data Fetching Strategy

- **No external state library** (no Redux/Zustand/React Query). All state is:
  - **Local React state** (`useState`/`useEffect`) inside each `*DashboardClient` component;
  - **URL search params** as the persistence layer for cross-navigation context (`?tab=`, `?dataset=`, `?id=`, `?from=`) — written with `router.replace(..., { scroll:false })` and read back on mount, so refresh and browser Back/Forward restore the exact dashboard view;
  - **Cookies** for identity/session (see §5).
- **Data fetching:** plain `fetch()` to same-origin `/api/*`. The Next.js catch-all proxy (`src/app/api/[...proxy]/route.js`) **injects the HttpOnly JWT** into the `Authorization: Bearer …` header server-side, so client code never touches the token (`getClientToken()` returns the literal string `"proxy-handled"`).
- **Direct-to-browser file streams:** dashboard uploads use `FormData` + `fetch` (certificates, profile images, referral attachments, `.mdb` archives). AI chat consumes a **plain-text SSE-ish stream** (`res.body.getReader()`) typed character-by-character.
- **Polling:** while any `.mdb` ETL job reports `status: "Processing"`, the admin client polls `GET /api/data/mdb-files` every **3000 ms** (`StaffDashboardClient.jsx:214-218`).
- **Caching:** none by design (no SWR/memory cache); every tab mount refetches. Open handles (`URL.createObjectURL`) in `use-file-preview.js` are revoked on unmount.

### 1.3 Styling & UI Layer

| Concern | Implementation |
| :--- | :--- |
| Utility CSS | **Tailwind CSS `^3.4.19`** + **autoprefixer `^10.4.27`** via PostCSS. Content globs: `src/app/**`, `src/components/**`. |
| Custom brand palette | Extended slate/navy set used inline: `#0A1628` (ink), `#1251AA` (primary blue), `#0C2461` (deep navy header), `#5A6A85` (muted), `#EEF3FB` (page bg). Semantic Tailwind colors (blue-600, emerald, amber, rose) elsewhere. |
| Typography | **Plus Jakarta Sans** (Google font via `next/font`, weights 400/500/600/700, `display: 'swap'`, `font-sans`). |
| Icons | **Phosphor Icons web** loaded globally from `https://unpkg.com/@phosphor-icons/web` (strategy `beforeInteractive` in `layout.jsx`); CSP on the backend allows `script-src https://unpkg.com`. |
| Charts | **Chart.js `^4.5.1` + `react-chartjs-2 ^5.3.1`**. Registered controllers per page: `Bar` (institutional PLO averages, GPA/attendance trend combo), `Radar` (PLO skill gap), with `animation: { duration: 800, easing: 'easeOutQuart' }`. |
| Motion system | Hand-written CSS `@keyframes` in `src/app/globals.css` consumed through Tailwind arbitrary values — e.g. `animate-[slideUp_0.4s_ease-out]`, `animate-[floatSoft_3s_ease-in-out_infinite]`. **No Framer Motion / GSAP.** See full inventory in §4 intro. |
| Responsive/mobile | `touch-target` (44 px min), `text-responsive-*` via `clamp()`, `safe-area-top/bottom`, `pb-safe`, `no-select`, `scroll-smooth-mobile`; sidebar/backdrop/sheet patterns for < 768 px and < 1024 px breakpoints. |
| Testing UI | Vitest `^4.1.10` + jsdom + Testing Library (`@testing-library/react ^16`, `jest-dom ^6`, `user-event ^14`). |

### 1.4 Third-Party Services / External Integrations

| Service | Endpoint | Purpose | Auth mechanism |
| :--- | :--- | :--- | :--- |
| **Google Gemini (LLM)** | `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:streamGenerateContent?alt=sse` (primary), `:generateContent` (fallback) | Staff-facing student-advisor chatbot ("Pembantu Pintar TVETMARA"), grounded with an internal TVET knowledge base; system-prompt injection defence around `<DATA_PELAJAR>` block | Raw REST via `fetch` with `x-goog-api-key` header (chosen deliberately — the official SDK cannot send this header required by `AQ…`-format keys). Key = `GEMINI_API_KEY` (backend only). |
| **ML microservice (internal)** | `ML_API_URL` (`http://ml-api:8000` in compose; `127.0.0.1:8000` default) | `/predict/risk`, `/predict/batch`, `/etl/process-mdb` | Shared secret header `X-API-Key` = `ML_API_SECRET`; service fail-closed boots (exits) without it |
| **MongoDB** | `MONGO_URI` | Primary datastore (users, students, referrals, student reports, MDB ledger) | Connection string |
| **Unsplash CDN** | `images.unsplash.com` | Decorative login background (CSP `img-src` allowlisted) | public |
| **Google Fonts / unpkg** | fonts.googleapis.com, fonts.gstatic.com, unpkg.com | Font + Phosphor icon assets | public (CSP allowlisted) |
| **No SMTP/email provider exists.** | — | Password recovery is done through identity-proof questions + scoped single-use tokens delivered in the verified browser session; admin reset outputs a one-time temp password in the API response | — |

---

## 2. Directory Tree & Module Manifest

### 2.1 Tree

```
.
├── package.json                  # Frontend manifest (Next.js) + scripts dev/build/start/lint/test
├── middleware.js                 # Next.js EDGE middleware (route guard, JWT verify via jose)
├── next.config.mjs               # output:"standalone"; rewrites /uploads/* → backend:5000
├── tailwind.config.js / postcss.config.js
├── vitest.config.js              # jsdom env, globals, @ → ./src alias
├── jsconfig.json / .eslintrc.json
├── compose.yml                   # 4-service stack: mongodb, backend, ml-api, frontend
├── Containerfile.frontend        # node:20-alpine 3-stage standalone build
├── diagnostics.js                # mongosh inspection shell script (counts, dupes, ledger)
├── .env / .env.local             # root envs: JWT_*, GEMINI_API_KEY (frontend), ML secret
├── src/
│   ├── app/
│   │   ├── layout.jsx            # <html lang="ms">, font, Phosphor <Script>, globals.css
│   │   ├── globals.css           # @keyframes + motion utility layer (see §4)
│   │   ├── page.jsx              # /           → LoginForm (login)
│   │   ├── change-password/page.jsx  # /change-password → ChangePasswordForm
│   │   ├── staff-dashboard/page.jsx  # /staff-dashboard → StaffDashboardClient
│   │   ├── student-dashboard/page.jsx # /student-dashboard → StudentDashboardClient
│   │   ├── student-profile/page.jsx  # /student-profile?id&dataset&from → StudentProfileClient
│   │   ├── actions.js            # 'use server': loginAction, logoutAction, changePasswordAction
│   │   └── api/[...proxy]/route.js   # GET/POST/PUT/PATCH/DELETE proxy → BACKEND_URL/api/*
│   ├── components/
│   │   ├── auth/  LoginForm.jsx · ChangePasswordForm.jsx · ForgotPasswordModal.jsx
│   │   ├── dashboard/  StaffDashboardClient.jsx (1475 L) · StudentDashboardClient.jsx (1029 L)
│   │   │      StudentProfileClient.jsx · CounselorDashboardClient.jsx · MergedLaporanTab.jsx
│   │   │      AppointmentCalendar.jsx
│   │   ├── ui/    dashboard-kit.jsx · AttachmentPreview.jsx
│   │   ├── Sidebar.jsx · KpiCard.jsx · StudentListGrid.jsx · StudentModal.jsx
│   │   ├── JobCard.jsx · ReportFormModal.jsx · GenerateReportModal.jsx · StudentDetailModal.jsx
│   │   └── (GenerateReportModal preceded by StudentDetailModal owner: student inbox)
│   ├── lib/
│   │   ├── auth.js               # server helpers: getStoredUser, getToken, getDashboardPathForRole
│   │   ├── client-auth.js        # getClientUser (reads 'user' cookie), getClientToken (stub)
│   │   ├── roles.js              # ROLES map + getRoleLabel + isStaff
│   │   ├── heuristics.js         # calculateEmployability, calculateTopPerformerScore
│   │   └── use-file-preview.js   # useFilePreview hook (size/type validation, object URLs)
│   ├── assets/react.svg
│   └── __tests__/Login.test.jsx  # Vitest smoke test of login page
├── backend/
│   ├── server.js                 # Express bootstrap: helmet+CSP, CORS allowlist, swagger, mount
│   ├── auth.js                   # /api/auth router (login, change/reset/forgot flows, limiters)
│   ├── auth.model.js             # signTokenForUser, authenticateUser, lockout, recovery tokens
│   ├── items.js                  # /api router #1: students CRUD, certificates, MDB pipeline, /ai/chat
│   ├── item.model.js             # normaliseStudent, dataset resolution, skill-gap, ML prediction client
│   ├── reports.js                # /api/reports router (counselor referrals; multer; state machine)
│   ├── studentReports.js         # /api/student-reports router (reports/letters to student inbox)
│   ├── middleware/authMiddleware.js # verifyToken, requireAdmin, requireStaff, requireOwnershipOrAdmin
│   ├── models/  User.js · Student.js · Report.js · StudentReport.js · MdbFile.js
│   ├── seed.js                   # bootstrap students (db/data_tvet_muktamad.json) + demo accounts
│   ├── seed-admin.js             # only demo admin/counselor/user accounts
│   ├── repredict-status.js       # offline batch re-prediction script (chunks of 500)
│   ├── sync-student-assets.js    # heals profileImage/certificates across semester snapshots
│   ├── diagnostics (diag) · babel.config.json · Containerfile.backend · .env/.env.example
│   ├── db/  data_tvet_muktamad.json · mdb_extracted/{JD2025,JJ2025,JJ2026}/(CSV dumps)
│   │       prepare_ml_data_3mdb.py · relabel_option2.py · sedut_mdb_tulen.py · inspect_mdb_linux.py
│   ├── uploads/  mdb/ · certificates/ · (referrals/, reports/ created at boot)
│   └── __tests__/ auth.test.js · items.test.js   # Jest + Supertest
├── ML/
│   ├── ml.py                     # FastAPI app: /predict/risk, /predict/batch, /etl/process-mdb
│   ├── model_ai_risiko_lengkap_v4.pkl  # active RandomForest artefact (v3 kept for rollback)
│   ├── train_and_evaluate_v4.py  # trainer: GroupShuffleSplit, GridSearchCV RandomForest
│   ├── train_and_evaluate.py     # legacy v3 trainer
│   ├── test_ml.py · requirements.txt · Containerfile
├── .github/workflows/ci.yml      # 3 test jobs (Vitest/Jest/pytest) + docker build gate
├── public/  logo-tvetmara.jpg · vite.svg
└── dist/    # stale legacy Vite build artefacts (not part of the Next.js runtime)
```

### 2.2 Module Manifest

| Path / Module | Purpose | Key Exports / Responsibilities |
| :--- | :--- | :--- |
| `middleware.js` | Next.js Edge route guard. Verifies the HttpOnly `ikmbToken` JWT with `jose.jwtVerify` (HS256, issuer `tvetmara-backend`, audience `tvetmara-dashboard`). Redirects: anon → `/`; authenticated off a login page → role dashboard (or `/change-password` if `mcp` claim); `mcp` users out of any other page → `/change-password`; students off `/staff-dashboard|/student-profile` → `/student-dashboard`; staff off `/student-dashboard` → `/staff-dashboard`. Matcher `['/((!api\|_next/static\|_next/image\|favicon.ico\|assets).*)']` excludes the API proxy. | `middleware(request)`, `config` |
| `src/app/actions.js` | `'use server'` form actions. `loginAction` posts to `${BACKEND_URL}/api/auth/login`, then sets **two cookies**: `user` (readable JSON profile, 24 h) + `ikmbToken` (HttpOnly, SameSite=Lax, secure in prod, 24 h). Redirects by `mustChangePassword` / role. `logoutAction` deletes both cookies → `/`. `changePasswordAction` calls `/api/auth/change-password` with the bearer token, re-rotates both cookies, redirects to the role dashboard. | `loginAction(prevState, formData)`, `logoutAction()`, `changePasswordAction(prevState, formData)` |
| `src/app/api/[...proxy]/route.js` | Universal API proxy. Rebuilds upstream URL `${BACKEND_URL}/api/${path}${search}`, strips hop-by-hop headers, injects `Authorization: Bearer <ikmbToken cookie>`, streams the backend response body back verbatim (also enables the AI chat stream through the proxy). | `proxyRequest` exported as GET/POST/PUT/PATCH/DELETE |
| `src/lib/auth.js` | Server-side cookie readers used by RSCs. | `getStoredUser()`, `getToken()`, `getDashboardPathForRole(role)` |
| `src/lib/client-auth.js` | Client-side identity. Parses the JS-readable `user` cookie. | `getClientUser()`, `getClientToken()` (returns `"proxy-handled"` placeholder) |
| `src/lib/roles.js` | Single source of truth for role labels/grouping. Roles: `admin` → label **Penyelaras** (staff), `counselor` → **Kaunselor** (staff), `user` → **Pelajar** (student). | `ROLES`, `getRoleLabel()`, `isStaff()` |
| `src/lib/heuristics.js` | Pure scoring math: employability = `(CGPA/4)*40 + attendance*0.6`, capped at 100; top-performer score = `(CGPA/4)*60 + attendance*0.4`. | `calculateEmployability`, `calculateTopPerformerScore` |
| `src/lib/use-file-preview.js` | Hook validating attachments client-side (≤ 5 MB, extension/mime allowlist from `acceptTypes`), generating revocable object URLs for previews. | `useFilePreview({acceptTypes, maxBytes})`, `formatFileSize`, `MAX_ATTACHMENT_BYTES` |
| `src/components/Sidebar.jsx` | Collapsible left navigation shell shared by both dashboards: logo, nav buttons (active = blue left-border), user card with avatar/initials + logout; Escape-to-close, body-scroll lock, mobile slide (`translate-x` transform transition, duration 300). | default `Sidebar` |
| `src/components/KpiCard.jsx` | Statistic card with skeleton-shimmer loading, icon chip, and animated progress bar (width transition `duration-700 ease-out`). | default `KpiCard` |
| `src/components/StudentListGrid.jsx` | Admin student browser: search (nama/ID), course filter chips (ITW/DFK/DGA/SLR/DCG/SED/PPU), risk filter chips with live counts, responsive card grid with staggered entrance, nav to profile cards. | default `StudentListGrid` |
| `src/components/StudentModal.jsx` | Full-screen/centered create-or-edit student form (ID locked when editing). Validates nothing itself — defers to backend. Escape close + backdrop click + scroll lock. | default `StudentModal` |
| `src/components/JobCard.jsx` | Career card in student career tab (icon, match %, "Mohon Sekarang" button with icon-invert hover). | default `JobCard` |
| `src/components/ReportFormModal.jsx` | Staff **referral** composer: fetches `GET /api/auth/users` to list counselors, defaults datetime to tomorrow 09:00, priority toggle (normal/segera), reason textarea, optional PDF/JPG/PNG attachment w/ live preview; submits `multipart/form-data` → `POST /api/reports`. | default `ReportFormModal` |
| `src/components/GenerateReportModal.jsx` | Staff **student report/letter** composer: prefilled title, message body, optional **PDF-only** attachment; computes `employability` and serialises `ploScores` JSON from `skillGap.chart`; submits → `POST /api/student-reports`. Uses an open-transition ref to reset state exactly once per open. | default `GenerateReportModal` |
| `src/components/StudentDetailModal.jsx` | Read-only detail viewer for a merged laporan item (appointment or report); shows grid of student facts, referral reason/counselor notes or report message, inline `<iframe>` PDF preview, download/print buttons. | default `StudentDetailModal` |
| `src/components/ui/dashboard-kit.jsx` | Shared design atoms: `formatMsDate` (ms-MY locale), toned `Badge`, `StatCard`, `SectionCard`, `PillTabs` (scrollable pill tab row with count pills), `EmptyState`, `SkeletonList`, and the risk classifier `getRiskMeta`/`RiskBadge` (Tinggi/Sederhana/Rendah colour map). | named exports (listed left) |
| `src/components/ui/AttachmentPreview.jsx` | Attachment chip + inline image `<img>` or PDF `<iframe>` preview using the hook's object URL. | default `AttachmentPreview` |
| `src/components/dashboard/StaffDashboardClient.jsx` | The **Penyelaras/Admin + Kaunselor** shell. Loads semester ledger (`GET /api/semesters`), pins `?tab=&dataset=` into the URL, derives KPIs/PLO averages/skills-gap tables/pathway recommendations, hosts the AI chat, admin student CRUD modal, and mounts `CounselorDashboardClient` for the counselor tab. Admin sees the extra `data` (MDB management) tab. | default `StaffDashboardClient` (1475 lines) |
| `src/components/dashboard/CounselorDashboardClient.jsx` | Referral lifecycle manager: PillTabs (`calendar/pending/scheduled/completed/sent-reports/all`), `AppointmentCalendar`, accept/reject/schedule/complete/reset actions via `PATCH /api/reports/:id`, toast system (3 s auto-dismiss), schedule + complete modals, "Dihantar" list backed by `GET /api/student-reports` with delete. | default `CounselorDashboardClient` |
| `src/components/dashboard/StudentDashboardClient.jsx` | The **Pelajar** shell (5 tabs). Loads own-restricted student list, `GET /api/students/:id/skill-gap` radar, career mapping (per-course static dictionary of job cards), certificate upload/manage, and laporan inbox. Profile-image upload syncs into both `skillGap.student` and the `students` array. | default `StudentDashboardClient` (1029 lines) |
| `src/components/dashboard/MergedLaporanTab.jsx` | Student inbox merging `GET /api/student-reports` (letters/reports) + `GET /api/reports/mine` (appointments) via `normalizeLaporanItems`; unread ring/highlight + count badge; opens `StudentDetailModal` and marks reports read lazily (`GET /api/student-reports/:id`). | default + `formatLaporanDate`, `normalizeLaporanItems` |
| `src/components/dashboard/StudentProfileClient.jsx` | Staff deep-profile view per student snapshot: sticky identity card (risk badge, dataset badge, action buttons incl. `window.print()` + JSON export), tab bar (`personal/academic/skills`), dual-axis GPA/attendance combo chart, PLO radar, employability card, and 3 intervention referral cards (staff-only). Wires `ReportFormModal` + `GenerateReportModal`. "Back" restores `?tab=&dataset=` of the originating staff view. | default `StudentProfileClient` |
| `src/components/dashboard/AppointmentCalendar.jsx` | Month grid calendar (Monday-first, Malay day/month names) for scheduled/accepted referrals: day cells show up to 2 event chips (mobile: dots), urgent flags, today/selected highlight; desktop side panel with selected-day details + upcoming list; mobile fixed bottom-sheet. | default `AppointmentCalendar` |
| `backend/server.js` | Express app: helmet with explicit CSP (allowlists unpkg Phosphor script, Google fonts/styles, Unsplash images, `connectSrc 'self'`), CORS allowlist from `CORS_ORIGIN` with `credentials: true` (no-origin requests allowed for server-to-server), JSON body limit **200 KB**, creates+static-serves `uploads/{certificates,referrals,reports}`, Swagger UI at **`/api/docs`** (OpenAPI 3 from JSDoc comments), Mongo connect + recovery (stuck `MdbFile` "Processing" → "Saved"), `/api/health`, global error handler (prod hides stack traces), fail-closed if `JWT_SECRET` missing outside tests. | default `app` |
| `backend/middleware/authMiddleware.js` | **verifyToken**: Bearer-only, pins HS256 + issuer/audience, rejects `scope: "password-reset"` tokens, performs an **authoritative DB lookup** (`User.mustChangePassword`, `passwordChangedAt`), kills sessions issued before the last password change (`pwdAt` claim comparison), and gates flagged accounts to a `PASSWORD_CHANGE_WHITELIST` (login, change-password) with `403 code: PASSWORD_CHANGE_REQUIRED`. **requireAdmin / requireStaff / requireOwnershipOrAdmin** role/owner guards. | named exports as listed |
| `backend/auth.js` + `backend/auth.model.js` | Identity domain. Lockout: 5 failed bcrypt checks → `lockUntil` now+15 min, error HTTP **423**. JWT claims: `{email, role, studentId, mcp, pwdAt}`, 8 h expiry. Policy: min 8 chars + letters+digits. Admin reset: 12-char `crypto.randomBytes(9).base64url` temp password → `mustChangePassword=true`. Recovery: Step 1 `verifyStudentIdentity(ID_Pelajar + No_KP digits)` → Step 2 scoped token (`aud: tvetmara-password-reset`, 15 m, single-use because `pwdAt` binding dies on success). Rate limit 8 requests/15 min keyed on resetToken/id. | `signTokenForUser`, `authenticateUser`, `changeOwnPassword`, `adminResetPassword`, `verifyStudentIdentity`, `createPasswordResetToken`, `resetPasswordWithToken`, `validatePasswordPolicy` |
| `backend/items.js` | Student/data/ML/AI router (mounted at `/api`). Includes the **ETL orchestrator** `executeEtlAndSync` (MDB → ML service → AI batch predict → MongoDB bulk upserts), Gemlin chat endpoint with SSE passthrough, and all student CRUD/certificate/profile-image endpoints. | default router (`items.js:912`) |
| `backend/item.model.js` | Normalisation + dataset resolution layer. `getLatestDataset()` prefers the admin-flagged `isCurrentSemester` then latest `processedDate` (returns `[]`/`null` rather than mixing datasets). `normaliseStudent()` maps raw MDB schema (Malay keys) → camelCase API shape and computes refined `dropoutRisk`: **hard rules win** — `attendance < 80 \|\| cgpa < 2.0` ⇒ "Tinggi"; `Bermasalah` ⇒ "Tinggi"; `cgpa >= 3.5 \|\| Cemerlang` ⇒ "Rendah"; else "Sederhana"; `Pending AI` ⇒ "Pending". Certification score map: Tiada 35 / CompTIA 70 / Cisco CCNA 85 / AWS Cloud 90. `getRealAIPrediction` calls ML `/predict/risk` and falls back to rules on failure. | `getAllStudents`, `getStudentById`, `getStudentSkillGapById`, `getRealAIPrediction`, `createStudent`, `updateStudent`, `deleteStudent` |
| `backend/reports.js` | Counselor referral router: multer upload (≤ 5 MB, jpeg/jpg/png/pdf) to `uploads/referrals`, field validation, intervention enum (`kaunseling/klinik/softskills`), counselor existence check, `safeUnlink` cleanup on any error path; GET list with counselor scoping (`pending ∨ assigned`); GET/:id with ownership check; **PATCH state machine** — `accept | reject | reset(pending) | complete | schedule` + optional `counselorNotes`; counselors may only mutate their own or pending docs. | default router |
| `backend/studentReports.js` | Student-report router: PDF-only multer (≤ 5 MB) to `uploads/reports`; `reportType` derived (`message | letter | full`); GET list scoped by role (student → addressed to them, counselor → authored, admin → all); GET/:id with owner/author/admin check and `readByStudent` side effect; DELETE with author/admin check + path-traversal-guarded file removal. | default router |
| `backend/models/User.js` | Credential model: unique email, bcrypt hash, `role ∈ {admin, counselor, user}`, `studentId` (null for staff), password-lifecycle fields `mustChangePassword`, `passwordChangedAt`, `lastLoginAt`, `loginAttempts`, `lockUntil`. | default `User` |
| `backend/models/Student.js` | Academic snapshot: Malay-key fields (`ID_Pelajar`, `Nama`, `Kursus`, `Semester`, `Kehadiran_Pct`, `CGPA`, `Sijil_Profesional`, `PLO_1…PLO_9`, `Status_Pelajar`, `No_KP`, `No_Telefon`, `Alamat`), embedded `academicHistory[]`, embedded `uploadedCertificates[]`, `sourceDataset` (indexed), `profileImage`. **One document per (student, semester dataset).** | default `Student` |
| `backend/models/Report.js` | Counselor referral: student snapshot fields + `interventionType` enum, `reason`, `priority ∈ {urgent, normal}`, `status ∈ {pending, accepted, scheduled, completed, rejected}`, `adminEmail`, `counselorId`, `counselorNotes`, `scheduledDate`, attachment fields, timestamps. | default `Report` |
| `backend/models/StudentReport.js` | Student inbox item: snapshot fields + `ploScores[{label,value}]`, `employability`, authorship (`authorEmail/Role/Name`), `title`, `message`, attachment, `reportType ∈ {message, letter, full}`, `readByStudent`, timestamps. | default `StudentReport` |
| `backend/models/MdbFile.js` | ETL ledger: `datasetName` (admin label), `originalName`, `filePath`, `fileSize`, `status ∈ {Saved, Processing, Processed, Failed}`, `recordsProcessed`, `uploadDate`, `processedDate`, `isCurrentSemester`. | default `MdbFile` |
| `backend/seed.js` / `seed-admin.js` | Upsert seeding: `db/data_tvet_muktamad.json` students + per-student Users (`<ID>@student.ikmb.edu.my`, `password123`, flagged `mustChangePassword` only on insert) + demo admin/counselor/user accounts. `seed-admin.js` only creates the three demo accounts. | run with `npm run seed` (backend) |
| `backend/repredict-status.js` | Maintenance script: chunks every Student into ≤ 500-row batches, calls ML `/predict/batch`, writes `Status_Pelajar` back. | CLI script |
| `backend/sync-student-assets.js` | Maintenance script: copies `profileImage` / `uploadedCertificates` from the newest snapshot into older ones (asset healing). | CLI script |
| `ML/ml.py` | FastAPI service. Fail-closed `ML_API_SECRET`. Endpoints `POST /predict/risk`, `POST /predict/batch` (both build engineered features `PLO_Avg`, `PLO_Variance`, reindex to `risk_model.feature_names_in_`), `POST /etl/process-mdb` (accepts the raw `.mdb`, 100 MB cap, temp file, `mdbtools` extraction of tables `GPA`, `Pelajar`, `Daftar_Subjek`, `Detail_Result`, `Anugerah`, `Pelajar_Koko_Detail`; per-semester attendance matching into `academicHistory`; auto-excludes subjects whose `Kod_Ujian` references LO > 9, i.e. internal CLO schemes; concurrency-safe subprocess timeouts). Generic error messages (no str(e) leakage). | `app` (uvicorn target) |
| `ML/train_and_evaluate_v4.py` | Trains `model_ai_risiko_lengkap_v4.pkl` from `backend/db/ml_training_data_real.csv`: feature engineering (PLO avg/variance), label `Status_Pelajar`, **GroupShuffleSplit** by `No_Pelajar` to stop cross-semester leakage, GridSearchCV RandomForest, prints classification report. | CLI script |
| `.github/workflows/ci.yml` | CI: frontend job (Vitest + `next build` with dummy JWT env), backend job (Jest+Supertest with dummy JWT/ML env), ML job (pytest 3.9 + mdbtools), then `docker-build` job building all three Containerfiles. | — |
| `compose.yml` | Local/dev deployment: `mongodb` (mongo:latest, volume `./mongodb_data`), `backend` (port 5000, `sleep 5` then start, uploads bind-mount), `ml-api` (port 8000), `frontend` (host **8080 → container 3000**, passes JWT vars for the Edge middleware), all on `tvet_net`. | — |

---

## 3. Role-Based Access Control (RBAC) & Permissions

### 3.1 Role Definitions

| Role token | populace label | Intended purpose |
| :--- | :--- | :--- |
| `admin` | **Penyelaras** | Institution coordinator. Full CRUD on student records, MDB/semester data management (upload, process, set current semester, delete), all referral reports, all student reports, admin password resets, AI chat. |
| `counselor` | **Kaunselor** | Intervention owner. Sees pending (unclaimed) referrals + referrals assigned to them; runs the accept → schedule → complete lifecycle; authors student reports/letters; can delete only their own student reports. |
| `user` | **Pelajar** | Student. Bound to exactly one `studentId` in the JWT (`studentId` claim). Read-only view of their own profile, rank/predictions; can upload/delete their own certificates and profile image (when `studentId` set); reads their inbox (reports + appointments); forced first-login password change via the `mcp` claim. |
| *(anonymous)* | — | Only the login page and the forgot-password modal flow. |

### 3.2 Permission Matrix

Legend: ✅ allowed · ❌ denied · ◐ allowed with scope restriction (ownership/filter applied server-side).

| Resource / Route / Action | Admin (`admin`) | Counselor (`counselor`) | Student (`user`) | Anonymous |
| :--- | :---: | :---: | :---: | :---: |
| `POST /api/auth/login` | ✅ | ✅ | ✅ | ✅ |
| `POST /api/auth/forgot-password`, `/complete-password-reset` (identity proof for students) | ❌ (staff directed to admin instead) | ❌ | ✅ (with valid ID + No. KP) | ✅ (rate-limited, 8/15 min) |
| `POST /api/auth/change-password` | ✅ | ✅ | ✅ (whitelisted even when flagged) | ❌ |
| `POST /api/auth/reset-password` (issue temp password) | ✅ | ❌ | ❌ | ❌ |
| `GET /api/auth/users` | ✅ | ✅ | ❌ | ❌ |
| `GET /api/health`, `/api/docs` (Swagger) | ✅ | ✅ | ✅ | ✅ |
| `GET /api/students` (list) | ✅ (all students of chosen dataset) | ✅ | ◐ (exactly one document: own `studentId` snapshot; empty array if unbound) | ❌ |
| `POST /api/students` (create) | ✅ | ✅ | ❌ | ❌ |
| `PUT /api/students/:studentId` | ✅ | ✅ | ❌ | ❌ |
| `DELETE /api/students/:studentId` (also deletes child user accounts) | ✅ | ✅ | ❌ | ❌ |
| `GET /api/students/:studentId` | ✅ | ❌ (requireOwnershipOrAdmin) | ◐ (only own `studentId` claim match) | ❌ |
| `GET /api/students/:studentId/skill-gap` | ✅ | ❌ | ◐ (own only) | ❌ |
| `POST /api/students/:studentId/certificates` (upload) | ✅ | ❌ | ◐ (own only) | ❌ |
| `DELETE /api/students/:studentId/certificates/:certId` | ✅ | ❌ | ◐ (own only) | ❌ |
| `POST /api/students/:studentId/profile-image` | ✅ | ❌ | ◐ (own only) | ❌ |
| `POST /api/predict/manual` (AI what-if) | ✅ | ✅ | ❌ | ❌ |
| `GET /data-mdb block → POST /api/data/upload-mdb` | ✅ | ❌ | ❌ | ❌ |
| `GET /api/data/mdb-files` (ledger) | ✅ | ❌ | ❌ | ❌ |
| `POST /api/data/process-mdb/:id` (trigger ETL + AI) | ✅ (409 if already Processing) | ❌ | ❌ | ❌ |
| `PATCH /api/data/set-current-semester/:id` | ✅ | ❌ | ❌ | ❌ |
| `DELETE /api/data/mdb-files/:id` | ✅ (blocked during Processing) | ❌ | ❌ | ❌ |
| `GET /api/semesters` | ✅ | ✅ | ✅ | ❌ |
| `POST /api/reports` (create referral) | ✅ | ✅ | ❌ | ❌ |
| `GET /api/reports` | ✅ (all) | ◐ (`status=pending` ∨ `counselorId=me`) | ❌ | ❌ |
| `GET /api/reports/mine` (upcoming appointments) | ❌ (effectively none: no studentId → `[]`) | ❌ | ✅ (status ∈ {accepted, scheduled}) | ❌ |
| `GET /api/reports/:id` | ✅ | ◐ (own or pending) | ❌ | ❌ |
| `PATCH /api/reports/:id` (state machine) | ✅ (any incl. reset→pending) | ◐ (own or pending only) | ❌ | ❌ |
| `POST /api/student-reports` (report/letter to student) | ✅ | ✅ | ❌ | ❌ |
| `GET /api/student-reports` | ✅ (all) | ◐ (authored by them) | ◐ (addressed to their studentId) | ❌ |
| `GET /api/student-reports/:id` | ✅ | ◐ (author) | ◐ (owner, marks `readByStudent=true`) | ❌ |
| `DELETE /api/student-reports/:id` | ✅ | ◐ (author only) | ❌ | ❌ |
| `POST /api/ai/chat` (Gemini advisor) | ✅ (rate-limited 15/min per email) | ✅ (same limiter) | ❌ | ❌ |
| Frontend `/staff-dashboard` | ✅ | ✅ | ❌ (redirected to `/student-dashboard`) | ❌ (→ `/`) |
| Frontend `/student-profile` | ✅ | ❌ (middleware redirects to `/student-dashboard`) | ❌ | ❌ |
| Frontend `/student-dashboard` | ❌ (redirected to `/staff-dashboard`) | ❌ (redirected to `/staff-dashboard`) | ✅ | ❌ |
| Frontend `/change-password` | ✅ (+ forced when `mcp`) | ✅ (+ forced when `mcp`) | ✅ (+ forced when `mcp`) | ❌ (→ `/`) |

### 3.3 Enforcement Mechanism

Three concentric layers, all validating the **same JWT**:

1. **Edge (`middleware.js`, every page route)** — `jose.jwtVerify` with pinned HS256 + issuer/audience; derives `isStaff = role ∈ {admin, counselor}`; applies the page-level redirects in the matrix above; enforces the `mcp` (must-change-password) gate as a UX layer. This middleware **never sees `/api/*`** (matcher exclusion).
2. **Origin proxy (`src/app/api/[...proxy]/route.js`)** — the only path to the backend from the browser. Reads the HttpOnly `ikmbToken` cookie **server-side** and injects `Authorization: Bearer …`, so the raw token is never exposed to JS (XSS containment).
3. **Backend (`backend/middleware/authMiddleware.js` on every route)** —
   - `verifyToken`: verifies signature/claims again, **refuses scoped reset tokens** (`scope !== password-reset` check), then does a **live DB read** of the user: if `passwordChangedAt` moved past the token's `pwdAt` claim → the session is dead (401 "Sesi tamat"); if `mustChangePassword` and the route is not whitelisted → 403 `PASSWORD_CHANGE_REQUIRED` (this is the authoritative forced-change gate; every dashboard client also detects this code and `window.location.href = '/change-password'`).
   - `requireAdmin`, `requireStaff` (admin ∨ counselor), `requireOwnershipOrAdmin` (staff ∨ `req.user.studentId === req.params.studentId`).
   - Resource-level extra checks inside routers: counselor filter scoping on `GET /api/reports`, counselor mutation ownership on `PATCH /api/reports/:id`, author/owner logic in `studentReports.js`.
4. **JWT claim anatomy:** `{ email, role, studentId (null for staff), mcp, pwdAt }` signed HS256, 8 h expiry, issuer `tvetmara-backend`, audience `tvetmara-dashboard`. Recovery tokens are a *third* token class with audience `tvetmara-password-reset` and `scope: password-reset` so they can never authenticate API calls.
5. **Credential defence:** per-account lockout (5 fails → 15 min, HTTP 423), generic error strings to prevent enumeration, IP-less rate limiting (keyed on email / resetToken tail) to avoid IPv6 validation errors, strict request validation (types and lengths) on all sensitive input.

---

## 4. Page Breakdown, UI Behaviors & Animations

### Motion system inventory (read this once — §4 references it)

`src/app/globals.css` defines **7 keyframes** + utility layer used by every page:

| Keyframe | Definition | Typical props |
| :--- | :--- | :--- |
| `fadeIn` | opacity 0→1, `translateY(6px)`→0 | `0.2–0.5s ease-out/ease-in-out` |
| `slideInLeft` | `translateX(-32px)`→0 + fade | `0.4–0.6s ease-out` |
| `slideInRight` | `translateX(32px)`→0 + fade | `0.4–0.6s ease-out` |
| `slideUp` | `translateY(20px)`→0 + fade (cards, KPI, chat bubbles, rows) | `0.3–0.4s ease-out`, inline `animationDelay` stagger |
| `scaleIn` | `scale(0.92)`→1 + fade (modals, badges, error boxes, avatars) | `0.2–0.3s ease-out` |
| `floatSoft` | looped `translateY(0)→-8px→0` (decorative orbs, empty-state icons, chat avatar) | `3–8s ease-in-out infinite [delay]` |
| `shimmer` | `background-position -200%→200%` (skeleton fill via `.skeleton-shimmer`, `1.5s ease-in-out infinite`) | — |

Utility classes: `stagger-1…stagger-8` (50–400 ms delays), `anim-fill` (`animation-fill-mode: both` so pre-delay elements are invisible), `skeleton-shimmer`, `touch-target` (44 px), `text-responsive-sm|base|lg|xl|2xl` (`clamp()`), `no-select`, `scroll-smooth-mobile`, `safe-area-top/bottom`, `pb-safe`. Native Tailwind motion also used: `animate-spin` (spinner-gap icons), `animate-pulse` (streaming caret, "Memproses…" badges), `animate-bounce` with arbitrary `[animation-delay:0.2s/0.4s]` (typing dots). Chart.js runs its own JS animation (`duration: 800, easing 'easeOutQuart'`). Hover micro-interactions rely on Tailwind `transition-*` utilities (`hover:shadow-md`, `hover:-translate-y-1`, `hover:translate-x-1`, `active:scale-95`, `group-hover:opacity-100`). **All routing is client-conditional tab rendering (`{activeTab === 'x' && …}`), so a "page/tab transition" is the mount of the tab's root element carrying an entrance animation.**

---

### 4.1 Login (src/app/page.jsx → src/components/auth/LoginForm.jsx)

- **Route:** `/` (also reachable as `/login` — middleware treats both as login surface)
- **Access Level:** Public only. Authenticated visitors are bounced to `/change-password` (`mcp`) or their role dashboard by middleware.
- **Primary Function & User Flow:**
  1. Two-panel desktop layout: left = AI-themed brand panel (Unsplash background at opacity 40 + `mix-blend-overlay`, headline "Revolusi Bakat TVET dengan Kuasa AI", floating brain icon chip, two blurred gradient orbs); right = white form panel with IKMB logo, "Selamat Kembali" heading.
  2. Dev-only demo-credential hint (`process.env.NODE_ENV !== 'production'`) pre-fills `admin@ikmb.edu.my` / `password123`.
  3. Submit goes through `useActionState(loginAction)` — the **Server Action** fetches `/api/auth/login` on the server side, sets both cookies, and redirects (`mustChangePassword` → `/change-password`; staff → `/staff-dashboard`; else `/student-dashboard`). Failure returns `{ error }` rendered in a red inline alert box.
  4. "Lupa kata laluan?" opens `ForgotPasswordModal` (student-only recovery; staff directed to contact the coordinator — modal footnote).
- **Components Used:** `LoginForm`, `ForgotPasswordModal`, Server Actions (`loginAction`).
- **Animations & Visual Transitions:**
  - *Page entrance:* left panel `animate-[slideInLeft_0.6s_ease-out] anim-fill`; right panel `animate-[slideInRight_0.6s_ease-out] anim-fill`.
  - *Staggered content:* headline `slideUp 0.5s ease-out 0.2s`, paragraph 0.35s, header block 0.15s, email field 0.25s, password field 0.35s, submit 0.45s — all `anim-fill`.
  - *Idle ambient:* brain icon + both orbs `floatSoft` 3 s / 6 s / 8 s infinite (right orb delayed 1 s).
  - *Pending spinner:* submit button swaps label to "Memproses..." with `ph-spinner-gap animate-spin` (via `useFormStatus().pending`); button transitions `hover:scale-[1.02] active:scale-[0.98]`, `duration-300`.
  - *Error appearance:* `scaleIn 0.3s ease-out` pop-in of red alert.
  - *Input focus:* `transition-all duration-200` ring (`focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500`).

#### ForgotPasswordModal (src/components/auth/ForgotPasswordModal.jsx)
- **Access Level:** Public (student identity-verified; 2-step wizard: Step 1 → `POST /api/auth/forgot-password` needs `idPelajar`+`noKP`; Step 2 → `POST /api/auth/complete-password-reset` consumes `resetToken`).
- **User Flow:** identity check → scoped 15-min single-use token → new password + live policy checklist (≥8 chars; letters+digits) → confirm field turns red on mismatch → success closes and refocuses the login password field. On token errors the wizard resets to Step 1.
- **Animations:** overlay `fadeIn 0.2s` + `bg-black/50 backdrop-blur-sm`; card `slideUp 0.3s`; key icon `floatSoft 3s infinite`; autofill `scaleIn` for error box; live-rule icons crossfade via `transition-colors duration-200`; buttons `active:scale-95`; Step 1→2 swap via per-form `fadeIn 0.3s`.

---

### 4.2 Change Password (src/app/change-password/page.jsx → src/components/auth/ChangePasswordForm.jsx)

- **Route:** `/change-password`
- **Access Level:** All authenticated roles. **Forced** here while JWT claim `mcp = true` (middleware + backend whitelist both enforce); also self-service entry point (stale-session escape hatch).
- **Primary Function & User Flow:**
  1. Card centered on `slate-50` with two decorative gradient orbs, lock icon, account email pill (from `getClientUser()`).
  2. Live password meter (3 rules: ≥8 chars; letters AND numbers; symbol "disyorkan") refreshing as you type; confirm field gets red border + "Kata laluan tidak sepadan" on mismatch.
  3. Submit = Server Action `changePasswordAction`: client-side confirm-match check → backend `POST /api/auth/change-password` (Bearer injected from cookie) → **both cookies rotated** with fresh token (`mcp` now false, `pwdAt` bumped so older sessions die) → redirect to role dashboard.
- **Components Used:** `ChangePasswordForm`, `changePasswordAction`.
- **Animations & Visual Transitions:** card `scaleIn 0.3s ease-out`; fields stagger `slideUp 0.4s` at 0.1/0.2/0.3/0.4/0.5 s with `anim-fill`; orbs `floatSoft` 6 s + 8 s (delayed); icon chip `floatSoft 3s infinite`; mismatch hint `fadeIn 0.2s`; pending spinner as in login; buttons `hover:scale-[1.02] active:scale-[0.98] duration-300`.

---

### 4.3 Staff Dashboard (src/app/staff-dashboard/page.jsx → StaffDashboardClient.jsx)

- **Route:** `/staff-dashboard?tab=<overview|prediction|skills|pathways|management|counselor|data>&dataset=<name>` (both params continuously rewritten into the URL with `router.replace({scroll:false})` so refresh/back preserves state; `?dataset` is restored/deep-linked).
- **Access Level:** Admin + Counselor (middleware). Counselor is scoped first-burger: tab `data` hidden, redirect forced to other tabs if reached.
- **Primary Function & User Flow:**
  1. On mount: read `user` cookie, load semester ledger `/api/semesters` (any `403 PASSWORD_CHANGE_REQUIRED` hard-redirects to `/change-password`), select active dataset: restored from URL → admin-flagged `isCurrentSemester` → latest processed. Admin additionally fetches MDB ledger.
  2. Active dataset change refetches `/api/students?dataset=<name>` (scoped per dataset; never a mixed view).
  3. **Tab `overview`:** 3 KPI cards (total students, average employability by `calculateEmployability`, high-risk count where `dropRatio Tinggi ∨ attendance < 80 ∨ cgpa < 2.0`), Chart.js `Bar` chart "Purata Pencapaian PLO vs Sasaran" (avg per PLO 1–9 vs 8× target series), "Pelajar Berisiko Tinggi" list (top 5, reason tag shows kehadiran/CGPA/AI) and "Top Performers" (top 5 by CGPA with `calculateTopPerformerScore`, award/cert caption). Rows are clickable → `/student-profile?id=<id>&dataset=<activeDataset>&from=overview`.
  4. **Tab `prediction`:** AI advisor workspace, 3-column split. Left "Konteks Pelajar": searchable combobox (search + risk-category chips **Semua/Tinggi/Sederhana/Rendah** with counts), dropdown result rows (avatar/img, risk badge), clear button; context card (avatar, name, risk, kursus, CGPA, kehadiran, weakest PLO < 80 flagged "Fokus Pemantauan"); 3 quick prompts. Right: chat panel with welcome message, messages list, streaming answers. Sending posts `/api/ai/chat` `{studentId, userMessage, chatHistory, dataset}`; JSON fallback and SSE stream handled distinctly; token stream appends into the last message with caret. Outside-click + Escape close the combobox.
  5. **Tab `skills`:** skills-gap table (per-PLO average, gap to 80, status chips Selamat / Perlu Peningkatan / Kritikal).
  6. **Tab `pathways`:** recommendation cards for every PLO with a positive gap, sorted by gap desc, mapped to intervention course names ("Kursus Komunikasi Efektif", "Bengkel Pengaturcaraan", "Latihan OSH", …).
  7. **Tab `management`:** `StudentListGrid` (search, course chips, risk chips; cards clickable → profile; "Tambah" opens `StudentModal`; card hover reveals nothing destructive — delete happens via modal edit path and `window.confirm` in `handleDelete`).
  8. **Tab `counselor`:** renders `CounselorDashboardClient` (§4.4).
  9. **Tab `data` (admin only):** MDB management — upload form (dataset name + `.mdb` ≤ 100 MB), archive table of files with status chips (Saved/Processing/Processed w/ record count + "Semasa" star badge/Failed), actions: process (with confirm + spinner), set current semester (star), delete (confirm; blocked while Processing). Live 3 s polling while any job is Processing; skeleton rows while ledger loads; success/error toast bar.
  10. Edit flow: `openEditModal` reuses `StudentModal`; `handleSubmit` PUT/POST `/api/students` then `router.refresh()`; delete `window.confirm` → `DELETE /api/students/:id` and locally filter out.
- **Components Used:** `Sidebar`, `KpiCard`, `StudentListGrid`, `StudentModal`, `CounselorDashboardClient`, `RiskBadge`/`getRiskMeta`, Chart.js `Bar`.
- **Animations & Visual Transitions:**
  - *Tab mount:* each tab root `animate-[fadeIn_0.3s_ease-in-out]` (overview/skills/pathways/management/data) or split-slide for prediction (`slideInLeft 0.4s ease-out` left panel + `slideInRight 0.4s ease-out` right panel).
  - *Overview:* section cards staggered `slideUp 0.4s` at 0.2/0.3/0.35 s; list rows `slideUp 0.3s` inline-delayed `350 + idx*60 ms` and `400 + idx*60 ms`; row hovers `hover:bg-red-100/yellow-100 hover:shadow-sm hover:translate-x-1 transition-all duration-200`; KPI cards staggered by `delay` prop (0/100/200 ms) with `slideUp 0.4s`, `hover:shadow-md hover:-translate-y-0.5 duration-300`, inner bar width `transition-all duration-700 ease-out`, icon chip `hover:scale-110; skeleton-shimmer` while loading.
  - *Chart:* Chart.js `animation: {duration: 800, easing: 'easeOutQuart'}`.
  - *Prediction:* context card `scaleIn 0.3s`; combobox dropdown `fadeIn 0.2s`, filter chips `active:scale-95 transition-all duration-200`; chat bubbles `slideUp 0.3s anim-fill` per message, `hover:shadow-md` on bubbles; typing indicator = three `animate-bounce` dots (delays 0/0.2/0.4 s) → transition to a `animate-pulse` block caret while streaming; quick-prompt buttons `hover:bg-emerald/blue/purple-100 hover:shadow-sm active:scale-[0.98] disabled:opacity-50`; header avatar `floatSoft 3s infinite`; empty-state icon `fadeIn 0.5s` + `floatSoft 4s infinite`.
  - *Skills table:* rows `slideUp 0.3s` at `150 + idx*40 ms`, `hover:bg-slate-50 duration-200`.
  - *Pathways:* cards `slideUp 0.4s` at `100 + idx*80 ms`, `hover:shadow-md hover:-translate-y-1 duration-300`.
  - *Data tab:* status chips `fadeIn 0.4s`; "Semasa" badge `fadeIn 0.3s`; ETL banner `animate-pulse` + `ph-spinner-gap animate-spin`; processing row keeps `bg-yellow-50/60` with `transition-colors duration-300`; skeleton rows `animate-pulse`; upload/disable state transitions.

#### 4.3.a CounselorDashboardClient (src/components/dashboard/CounselorDashboardClient.jsx) — mounted as tab `counselor`
- **Access Level:** staff; behavior dims by role (`isAdmin` shows all + reset action).
- **Primary Function & User Flow:** PillTabs (Kalendar / Menunggu / Dijadualkan / Selesai / Dihantar / Semua, each with live counts) → `AppointmentCalendar` for Kalendar; report cards for the rest with contextual buttons: `Terima` (accepted), `Tolak` (rejected), `Jadualkan`/`Ubah Tarikh` opens schedule modal (datetime + notes; default tomorrow 09:00), `Selesai` opens complete modal (counselorNotes), `Set Semula` (**admin-only**, sends `action: "pending"` for completed/rejected). "Dihantar" lists `GET /api/student-reports` cards with type badge (Laporan Penuh/Surat/Mesej), preview, PDF link, and delete. Toast top-right 3 s.
- **Components Used:** `PillTabs`, `Badge`, `EmptyState`, `SkeletonList`, `formatMsDate`, `AppointmentCalendar`.
- **Animations:** toast `fadeIn 0.3s`; report cards `slideUp 0.3s anim-fill` staggered `index*50 ms`, `hover:shadow-md transition`; modals — overlay `fadeIn 0.2s` + `backdrop-blur-sm`, sheet `slideUp 0.3s`, full-screen on mobile with `safe-area-*` and sticky header/footer; action buttons `touch-target active:scale-95`; pending spinners `animate-spin`.

---

### 4.4 Student Dashboard (src/app/student-dashboard/page.jsx → StudentDashboardClient.jsx)

- **Route:** `/student-dashboard`
- **Access Level:** Student (`user`) only — middleware redirects staff here from `/student-dashboard` to `/staff-dashboard`.
- **Primary Function & User Flow:**
  1. Header on mobile (logo + burger). Sidebar tabs: **Profil & Prestasi**, **Kemaskini Sijil Saya**, **Laporan & Temujanji**, **Padanan Kerjaya (AI)**, **Kursus Cadangan**.
  2. Data bootstrap: `/api/semesters` → active dataset (current-semester flag or latest); `/api/students?dataset=` — backend already restricts a bound student to a single-element array (extra client-side filter by `user.studentId` as belt-and-braces); selection auto-picks the first/kept id.
  3. **Tab `dashboard`:** welcome row with avatar + risk pill (Tinggi red / Sederhana yellow / else green "Good Standing"); current-semester badge; 3 stat boxes (employability via heuristic, attendance, CGPA); radar chart (`skillGap.chart.current` vs target 80, dashed target line) with caption of `insight.message` (weakest-PLO AI commentary) and student selector (multi-student users only); dark "Peluang Kerjaya Teratas" card showing top 2 mapped jobs for the student's course code (static `careerMapping` dictionary, e.g. DFK → Cloud Engineer AWS / DevOps Maxis) + CTA to career tab.
  4. **Tab `profile`:** profile-image circle upload (label wraps hidden file input; hover overlay "Tukar Gambar") → `POST /api/students/:id/profile-image` → optimistic state sync into `students` + `skillGap.student`; disabled identity fields (nama, ID, course); certificate form (nama, issuer, file PDF/PNG/JPG ≤ 5 MB) → `POST /api/students/:id/certificates`; certificate cards list with open-in-new-tab link + delete → `DELETE …/certificates/:certId`.
  5. **Tab `reports`:** `MergedLaporanTab` (§4.4.b).
  6. **Tab `career`:** full job grid `JobCard` per course mapping (title, company, match %, apply button).
  7. **Tab `courses`:** two course cards; the "Disyorkan AI" one is derived from `skillGap.insight.weakestSkill` → `courseMappings[PLO x]` (title/desc/color per PLO); static second card "AWS Cloud Practitioner Essentials".
- **Components Used:** `Sidebar` (with `profileImage`), `MergedLaporanTab`, `JobCard`, Chart.js `Radar`, `calculateEmployability`.
- **Animations & Visual Transitions:** every tab root `animate-[fadeIn_0.3s_ease-in-out]` on mount; radar chart Chart.js default + options; avatar/hover transitions; camera overlay `group-hover:opacity-100` (opacity transition); dropzone `hover:bg-slate-100 transition`; certificate cards `hover:shadow-md transition` with red-hover delete; mobile sidebar = backdrop `bg-black/50` + panel slide (`transition-transform duration-300 ease-out`, `-translate-x-full ⇄ translate-x-0`), Escape closes, body scroll locked, backdrop `fadeIn 0.2s`; risk pill and buttons standard `transition` + `active:scale-95` on actions.

#### 4.4.a MergedLaporanTab (src/components/dashboard/MergedLaporanTab.jsx)
- **Access Level:** any authenticated caller; contents already role-scoped server-side (student → own, counselor → authored, admin → all).
- **Primary Function & User Flow:** parallel `Promise.all` of `GET /api/student-reports` + `GET /api/reports/mine`, merged & sorted by `displayDate` desc via `normalizeLaporanItems`; filter pills (Semua/Laporan/Temujanji with counts); item rows show type icon tile (blue report / purple appointment), unread blue ring + dot, author/class metadata, priority "Segera" badge, relative timestamp, 2-line italic preview; opening a report marks it read (`GET /api/student-reports/:id` mutates `readByStudent`) and opens `StudentDetailModal` (message block + embedded PDF iframe + download/print); refresh button re-pulls.
- **Animations:** unread badge `scaleIn 0.3s`; rows `slideUp 0.3s anim-fill` staggered `index*50 ms`, `touch-target active:scale-[0.98] hover:shadow-md`; `SkeletonList` shimmer rows while loading; `EmptyState` with `floatSoft` icon; modal per `StudentDetailModal` (`fadeIn` overlay + `slideUp` sheet + sticky download/print bar).

---

### 4.5 Student Profile — Staff deep view (src/app/student-profile/page.jsx → StudentProfileClient.jsx)

- **Route:** `/student-profile?id=<ID_Pelajar>&dataset=<datasetName>&from=<originTab>` (defaults id `TVET001`, forwarded from server component `searchParams`).
- **Access Level:** Staff (admin + counselor) — middleware enforcement. Students redirected away.
- **Primary Function & User Flow:**
  1. Loads `/api/students/:id/skill-gap?dataset=` (elicits fresh live AI prediction inside the backend and the weakest-PLO insight); `403 PASSWORD_CHANGE_REQUIRED` → hard redirect. Loading = full-page spinner; not found = inline "Pelajar tidak dijumpai."
  2. **Left sticky identity card:** navy header bar with brand + `StatusBadge` risk chip; overlapping avatar (image or initial, `scaleIn`); name/monospaced ID/dataset badge "Sesi: <dataset>"; fact rows (Kursus full name via local course-name decoder, Semester, Sijil, Kehadiran); action trio: **Edit** (styled button, no-op placeholder), **Print** (`window.print()`), **Download** (assembles JSON blob `{studentDetails, academicHistory, aiInsight, employabilityScore, ploScores}` → `<a download>` click), plus full-width **"Jana Laporan / Surat"** button opening `GenerateReportModal`.
  3. **Right card with 3 tabs:**
     - `personal` — email (`<id>@student.ikmb.edu.my`), phone, No. KP, address (PII from the snapshot; only staff sees this page).
     - `academic` — CGPA hero with color-coded progress bar (`emerald ≥3.5 / amber ≥2.5 / red`), `transition-all duration-700 ease-out` width; dual-axis combo chart GPA line + attendance bars from `academicHistory` (fallback to current single point), Chart.js `duration: 800 easeOutQuart`.
     - `skills` — dark gradient "Ramalan Kebolehpasaran (AI)" card (heuristic score + `insight.message`, ghost `magic-wand` watermark floating), PLO radar (current vs target; "DATA PLO BELUM LENGKAP" chip if any score 0), and **staff-only** 3 intervention referral cards (Kaunseling / Klinik Akademik / Soft Skills) each opening `ReportFormModal` with the chosen `interventionType`.
  4. Breadcrumb "Senarai Pelajar / <name>" — back button restores the originating staff tab + dataset via `?from`/`?dataset` params → `router.push('/staff-dashboard?tab=…&dataset=…')`.
- **Components Used:** `ReportFormModal`, `GenerateReportModal`, Chart.js `Bar` + `Radar`, local `StatusBadge`, ` getClientUser`/`getClientToken`.
- **Animations & Visual Transitions:** page `fadeIn 0.4s ease-out`; left card `slideInLeft 0.5s ease-out 0.1s anim-fill`, right card `slideInRight 0.5s ease-out 0.15s anim-fill`; avatar `scaleIn 0.4s ease-out 0.3s`; tabs use active bottom-border + `transition-all duration-200`; each tab content `fadeIn 0.3s` with inner blocks `slideUp 0.4s` staggered 0/0.1/0.15/0.2/0.3/0.4 s; intervention cards `hover:shadow-md hover:-translate-y-0.5 duration-300`; water-mark icon `floatSoft 4s infinite`; status chip `scaleIn`; progress bars width-transition 700 ms; all profile-page charts share Chart.js `easeOutQuart` entrances.

#### 4.5.a ReportFormModal & GenerateReportModal (src/components/ReportFormModal.jsx, GenerateReportModal.jsx)
- **Access Level:** staff (mounted from profile; backend enforces `requireStaff`).
- **Primary Function & User Flow:** both are mobile-full / desktop-centered sheets attached to the profile page.
  - `ReportFormModal` (referral): pulls counselor roster (`GET /api/auth/users` → filter role `counselor`, preselect first), pre-fills datetime = tomorrow 09:00, priority segmented toggle (Normal/Segera), mandatory reason, optional attachment (PDF/JPG/PNG ≤ 5 MB with live preview via `useFilePreview` + `AttachmentPreview`), posts multipart `POST /api/reports`; success toast auto-closes at 1.5 s.
  - `GenerateReportModal` (student report/letter): title pre-filled "Laporan Prestasi & Intervensi: <name>", message body, **PDF-only** attachment, serialises `ploScores` JSON from the skill-gap chart, computes `employability`, posts `POST /api/student-reports`; toast + auto-close. Reset behavior triggered only on the closed→open transition (ref-guarded effect).
- **Animations:** overlay `fadeIn 0.2s` + blur; sheet `slideUp 0.3s`; dropzone dashed `hover:bg-slate-100`; attachment chip `scaleIn 0.2s`; toast `scaleIn 0.2s`; submit spinner `animate-spin`; sticky footer `pb-safe`.

---

### 4.6 Machine-Readable Route/Table Summary

| Route | File | Access | Notable interactive behaviors |
| :--- | :--- | :--- | :--- |
| `/` | `src/app/page.jsx` → `LoginForm.jsx` | Public | Server-Action login, cookie bootstrap, forgot-password wizard, demo autofill |
| `/change-password` | `change-password/page.jsx` → `ChangePasswordForm.jsx` | All (forced if `mcp`) | Live policy meter, cookie rotation on success |
| `/staff-dashboard` | `staff-dashboard/page.jsx` → `StaffDashboardClient.jsx` | Admin, Counselor | 7 tabs, AI SSE chat, ETL polling, KPI/chart analytics, student CRUD |
| `/student-dashboard` | `student-dashboard/page.jsx` → `StudentDashboardClient.jsx` | Student | 5 tabs, radar, certificates, inbox, career, recommended courses |
| `/student-profile` | `student-profile/page.jsx` → `StudentProfileClient.jsx` | Staff only | Identity card, 3 tabs, referral/report modals, print/JSON export |
| `/api/docs` (backend port) | `backend/server.js` | public | Swagger UI generated from JSDoc |

---

## 5. Data Flow & State Lifecycles

### 5.1 Authentication & Session (cookie pair)

1. `loginAction` (Server Action) → backend `JWT` response` → SSR sets:
   - `user` — **not HttpOnly** (readable by UI/middleware helpers), JSON `{email, role, displayName, studentId}`, maxAge 24 h, `secure` in production;
   - `ikmbToken` — **HttpOnly**, SameSite=Lax, secure in prod, 24 h. JWT itself carries the authoritative claims `{email, role, studentId, mcp, pwdAt}` with 8 h expiry (the longer cookie maxAge is harmless because the backend rejects expired/rotated tokens, though note the asymmetry: a stale readable cookie alone cannot authenticate anything).
2. Every subsequent request resolves identity from:
   - *Server components / middleware:* JWT verify (middleware) or `user` cookie (RSC helpers);
   - *Client components:* `getClientUser()` (deserialized `user` cookie); token never touched client-side.
3. Password change rotates **both** cookies and bumps `passwordChangedAt`; backend middleware kills any older-token request (`pwdAt < changedAt` → 401); forced-change accounts are functionally quarantined (403 whitelist) until they comply.
4. Logout deletes both cookies via `logoutAction` (no server-side revocation list — a stolen token dies naturally at 8 h or at next password change).

### 5.2 Read path (backend → component)

```
MongoDB ──▶ Mongoose model ──▶ item.model.js normaliseStudent()
   (sourceDataset-scoped query; isCurrentSemester → fallback latest processed)
      ──▶ Express route (/api/students*, /api/reports*, /api/student-reports*)
             (role scoping inside route handler)
                ──▶ GET /api/<path> from browser
                      ──▶ Next.js catch-all proxy (inject Bearer from cookie)
                             ──▶ client useEffect → useState (per-dashboard copy)
```

- The skill-gap pipeline is the one server-computed composite: `getStudentSkillGapById` re-runs a **live ML prediction** (`getRealAIPrediction`) each time it is opened, overrides `student.dropoutRisk`, then builds `{chart:{labels,current,target}}` (target = 80 across PLO 1–9) and the weakest-PLO `insight` text ("belum direkodkan" message when weakest value is 0).
- Frontend persistence of context is only in the URL (`?dataset`, `?tab`, `?from`, `?id`) — nothing is persisted in `localStorage`/`sessionStorage` anywhere in the codebase.
- Error surfacing: every dashboard specifically recognises `403 { code: "PASSWORD_CHANGE_REQUIRED" }` and navigates clients to `/change-password`.

### 5.3 Write paths

| Action | Flow |
| :--- | :--- |
| **Student CRUD (staff)** | `StudentModal` → JSON → `POST/PUT/DELETE /api/students/:id` → `updateStudent` applies `$set` to **all** semester snapshots of that `ID_Pelajar`; DELETE removes snapshots + all `User` docs bound to that ID. |
| **Certificates / avatar** | FormData → ownership check → multer (≤ 5 MB, pdf/jpg/png) → `Student.updateMany({ID_Pelajar}, {$push|$set})` so the asset appears in **every** snapshot; delete resolves physical path with an uploads-root containment check before `fs.unlinkSync`. |
| **Referral (Report)** | Profile page → `ReportFormModal` multipart → multer `uploads/referrals` → validation (fields, enum, date, counselor exists; on any failure `safeUnlink`) → `Report` saved `pending` → counselor acts (accept/schedule/complete/reject/reset) through the PATCH state machine → student sees accepted/scheduled items via `/api/reports/mine`. |
| **Student report (inbox)** | Profile page → `GenerateReportModal` multipart (PDF attachment optional) → `uploads/reports` → `StudentReport` (`reportType` derived) → unread until the student opens it (`readByStudent` flip on GET/:id). |
| **Student password recovery** | No email channel: identity proof (`ID_Pelajar` + digit-normalised `No_KP` matched against `Student`) → `createPasswordResetToken` (audience-isolated, pwdAt-bound) → `resetPasswordWithToken` enforces policy + replay protection (pwdAt binding) → `mustChangePassword=false`, sessions/older tokens invalidated via `passwordChangedAt=new Date()`. |
| **Admin password reset** | `POST /api/auth/reset-password` → 12-char base64url temp password returned **once** in the response; account flagged `mcp` → recipient is forced to set a real password on first login. |

### 5.4 ETL & dataset lifecycle (the most stateful flow)

```
Admin (tab data) ── upload .mdb ─▶ POST /api/data/upload-mdb
                                   └ MdbFile{status:"Saved"} + binary kept at backend/uploads/mdb/
Admin ── process ─▶ POST /api/data/process-mdb/:id
   ├ guard: not already "Processing" (409), file exists
   ├ executeEtlAndSync:
   │   1. MdbFile → "Processing"                       (UI starts 3s polling)
   │   2. POST ml_service /etl/process-mdb  (X-API-Key) ── mdbtools ETL returns student rows
   │   3. POST ml_service /predict/batch               ── Status_Pelajar per row (skip silently if AI down)
   │   4. Asset carry-forward map built from existing Student docs
   │      (profileImage, uploadedCertificates → STUDENT-level, not semester-level)
   │   5. bulkWrite Student upserts  filter {ID_Pelajar, sourceDataset}  ← compound key = new semester snapshot each process
   │   6. bulkWrite User upserts  $set {role:"user", displayName, studentId}
   │      $setOnInsert {password: 32-chr random bcrypt, mustChangePassword:true}  ← never overwrites exist users' passwords
   │   7. MdbFile → "Processed" + recordsProcessed + processedDate
   │      (crash path → "Failed"; boot recovery resets stuck "Processing" → "Saved")
   └ Admin can flag exactly one dataset isCurrentSemester (PATCH /data/set-current-semester) →
     drives default selection for staff + student dashboards and dataset resolution in item.model.js
```

- Reads always filter `Student.sourceDataset = <dataset>`; absent filter resolution never mixes datasets (empty array if nothing processed).
- AI risk normalisation on read (rules override AI label when attendance/CGPA breach thresholds) — see `item.model.js:normaliseStudent`.
- Offline tooling: `repredict-status.js` (batch re-run predictions), `sync-student-assets.js` (asset healing), `diagnostics.js` (mongosh inspection of counts/duplicates/ledger), seed scripts.

### 5.5 Global vs local state recap

| Concern | Where it lives |
| :--- | :--- |
| Identity/role | `user` cookie (read-only UI use) + JWT claims (validation use) |
| Session credential | `ikmbToken` HttpOnly cookie; injected by proxy; never client-readable |
| Active tab | `activeTab` useState + `?tab=` URL param on staff dashboard |
| Active dataset/semester | `activeDataset` useState + `?dataset=` URL param; server default = flagged current semester |
| Profile context crossing pages | `?id&dataset&from` params carried into `/student-profile` and back |
| Dashboard data (students, reports, skillGap, mdbFiles…) | local `useState` per dashboard client; refetch on relevant deps; **no store, no cache layer, no sessionStorage** |
| Streaming chat transcript | local `aiMessages` array with progressive last-message updates |
| Upload previews | `URL.createObjectURL` in `useFilePreview` (revoked on change/unmount) — transient only |

---

**Last Updated:** 2026-10-26 10:06:00 UTC+8
