# Project Architecture & Technical Blueprint

## 1. System Overview & Tech Stack

**Project Name:** TVETMARA Besut — Skills Talent Development Dashboard (`tvetmara-besut-dashboard`, version `1.0.0`)
**Description:** Sistem Papan Pemuka Pintar berasaskan Next.js (SSR) untuk memantau, meramal, dan membangunkan bakat pelajar TVETMARA Besut menggunakan analitik AI.
**Architecture Style:** Monorepo with 3 deployables behind Docker Compose: Next.js SSR frontend, Express REST backend, FastAPI ML microservice, plus MongoDB persistence. Frontend never calls backend directly from browser for authenticated routes; it calls same-origin `/api/*` which is proxied server-side with HttpOnly JWT injection.
**Runtime Topology (compose.yml):** `mongodb (mongo:latest, 27017)`, `backend (Node 20, 5000)`, `ml-api (Python 3.9, 8000)`, `frontend (Node 20 standalone, 3000 mapped to host 8080)`, shared bridge network `tvet_net`. Frontend env `BACKEND_URL=http://backend:5000` in compose, `http://127.0.0.1:5000` in `.env.local`. Backend env `MONGO_URI=mongodb://mongodb:27017/ikmb-dashboard`, `ML_API_URL=http://ml-api:8000`, `JWT_SECRET=super_secret_fyp_key_2026`, `GEMINI_API_KEY=xxx`, `CORS_ORIGIN=*`.
**CI/CD (.github/workflows/ci.yml):** 4 jobs on push/PR to `main`/`master`: `frontend` (Node 20, `npm install`, `npm test` Vitest, `npm run build` with `BACKEND_URL=http://backend:5000`), `backend` (Node 20, `npm test` Jest), `ml-service` (Python 3.9, `apt-get install mdbtools`, `pip install -r requirements.txt`, `pytest test_ml.py`), `docker-build` (needs all three, builds `tvet-frontend`, `tvet-backend`, `tvet-ml-api` from `Containerfile.frontend`, `backend/Containerfile.backend`, `ML/Containerfile`).

### Core Framework & Runtime (exact versions detected)

| Layer | Runtime | Framework / Library | Version |
| :--- | :--- | :--- | :--- |
| Frontend | Node 20-alpine (Docker `deps`/`builder`/`runner`), `output: 'standalone'` | `next` | `15.1.6` |
| Frontend | — | `react` / `react-dom` | `^19.0.0` |
| Frontend | — | `chart.js` | `^4.5.1` |
| Frontend | — | `react-chartjs-2` | `^5.3.1` |
| Frontend | — | `tailwindcss` | `^3.4.19` |
| Frontend | — | `postcss` / `autoprefixer` | `^8.5.6` / `^10.4.27` |
| Frontend | — | `eslint` / `eslint-config-next` | `^9` / `15.1.6` |
| Frontend test | jsdom | `vitest` / `jsdom` / `@testing-library/react` / `@testing-library/jest-dom` / `@testing-library/user-event` | `^4.1.10` / `^29.1.1` / `^16.3.2` / `^6.9.1` / `^14.6.1` |
| Frontend types | — | `@types/node` / `@types/react` / `@types/react-dom` | `^22` / `^19` / `^19` |
| Backend | Node 20-alpine (`FROM docker.io/node:20-alpine`, `CMD ["node","server.js"]`) | `express` | `^5.2.1` |
| Backend | — | `mongoose` | `^9.3.3` |
| Backend | — | `jsonwebtoken` | `^9.0.3` |
| Backend | — | `bcryptjs` | `^3.0.3` |
| Backend | — | `multer` | `^2.2.0` |
| Backend | — | `cors` / `helmet` / `express-rate-limit` / `dotenv` | `^2.8.6` / `^8.3.0` / `^8.7.0` / `^17.3.1` |
| Backend | — | `swagger-jsdoc` / `swagger-ui-express` | `^6.3.0` / `^5.0.1` |
| Backend test | — | `jest` / `supertest` / `nodemon` / `@babel/preset-env` / `cross-env` | `^30.4.2` / `^7.2.2` / `^3.1.14` / `^7.24.7` / `^10.1.0` |
| ML service | Python 3.9-slim (`FROM docker.io/python:3.9-slim`, `CMD uvicorn ml:app --host 0.0.0.0 --port 8000`) + `apt-get mdbtools` | `fastapi` | unpinned in `requirements.txt`, installed `0.128.7` |
| ML service | — | `uvicorn` / `scikit-learn` / `joblib` / `pydantic` / `pandas` / `numpy` / `httpx` | installed `0.40.0` / `1.6.1` / `1.5.3` / `2.12.5` / `2.3.3` / `2.4.2` / `0.28.1` |
| ML service | — | `pytest` / `pytest-asyncio` / `python-multipart` | installed `8.4.2` / unpinned / unpinned |
| Database | Docker `mongo:latest`, volume `./mongodb_data:/data/db` | MongoDB database `ikmb-dashboard` via Mongoose | `latest` tag |
| Fonts/Icons | CDN + `next/font/google` | `Plus Jakarta Sans 400/500/600/700 swap`, `@phosphor-icons/web` via `<Script src="https://unpkg.com/@phosphor-icons/web" strategy="beforeInteractive">` | CDN unpinned |

### State Management & Data Fetching strategy

- No global store (no Redux, Zustand, React Query, SWR). State is component-local `useState` + `useEffect` + `useMemo` + `useRef` + `useCallback` per dashboard client.
- Server Actions (`src/app/actions.js`): `loginAction(prevState, formData)` posts to `${BACKEND_URL}/api/auth/login`, then sets two cookies and `redirect()`; `logoutAction()` deletes both cookies and redirects to `/`. Uses `cookies()` and `redirect()` from `next/headers` and `next/navigation`.
- API Proxy (`src/app/api/[...proxy]/route.js`): all client `fetch('/api/...')` calls hit same-origin Next route handlers `GET/POST/PUT/PATCH/DELETE`, which read HttpOnly `ikmbToken` via `cookies()`, inject `Authorization: Bearer <token>`, forward method/headers/body to `${BACKEND_URL}/api/<proxy path + query>`, and stream back status/body/headers. This keeps JWT out of client JS.
- Direct backend fetches only occur in Server Actions and the proxy. Browser code never hardcodes backend host.
- Chat streaming: `StaffDashboardClient` posts to `/api/ai/chat` and reads `response.body.getReader()` with `TextDecoder`, appending chunks to `aiMessages`. Fallback to JSON `{success, reply}` if stream fails.
- Polling: `StaffDashboardClient` polls MDB file list every 3 seconds while any file has status `Processing`.
- Derived data via `useMemo`: filtered student lists, risk counts, PLO averages, chart datasets, calendar cells, merged inbox sorting.

### Styling & UI Layer (libraries, styling methodologies)

- `tailwindcss@3.4.19` with `content: ["./src/app/**/*.{js,ts,jsx,tsx,mdx}", "./src/components/**/*.{js,ts,jsx,tsx,mdx}"]`, `theme.extend.fontFamily.sans: ['"Plus Jakarta Sans"','sans-serif']`, no plugins. Processed by `postcss.config.js` (`tailwindcss`, `autoprefixer`).
- `src/app/globals.css`: `@tailwind base/components/utilities` plus custom motion system with 7 `@keyframes` (`fadeIn`, `slideInLeft`, `slideInRight`, `slideUp`, `scaleIn`, `floatSoft`, `shimmer`) and `@layer utilities` helpers: `.stagger-1..8` (50–400ms delays), `.anim-fill` (`animation-fill-mode: both`), `.skeleton-shimmer` (linear-gradient `#f1f5f9/#e2e8f0`, `background-size: 200%`, `shimmer 1.5s ease-in-out infinite`), `.touch-target` (44px min per Apple HIG), `.text-responsive-sm/base/lg/xl/2xl` (`clamp()`), `.no-select`, `.scroll-smooth-mobile`, `.safe-area-top/bottom`, `.pb-safe` (`env(safe-area-inset-*)`). No Framer Motion, no styled-components, no CSS modules.
- Charts: `chart.js@4.5.1` + `react-chartjs-2@5.3.1`. Staff uses `Bar` (PLO averages, skills gap) with `CategoryScale/LinearScale/BarElement`; student uses `Radar` (`RadialLinearScale/PointElement/LineElement/Filler`); profile uses dual-axis `Bar`+`Line` (GPA line blue + attendance bar emerald, `y`/`y1`) and `Radar` (student blue vs target green dashed).
- Icons: Phosphor Icons via CSS classes (`ph ph-...`, `ph-bold ph-x`, `ph-spinner-gap animate-spin`, etc.), no React icon library. Images via `next/image` (`/logo-tvetmara.jpg`) and plain `<img>` for uploads; `public/logo-tvetmara.jpg` and `public/vite.svg`.
- Responsive methodology: mobile-first Tailwind (`grid-cols-1 sm:2 lg:3 xl:4`, `p-0 sm:p-4`, `h-full sm:max-h-[90vh] sm:rounded-2xl sm:max-w-2xl`, `hidden md:flex`, `fixed ... md:relative`), `touch-target`, safe-area padding, `overflow-x-auto` chip rows, bottom-sheet calendar on mobile vs side panel on desktop.

### Third-party Services / External Integrations

| Integration | Direction | Implementation |
| :--- | :--- | :--- |
| Google Gemini `gemini-3.5-flash-lite` | Backend `backend/items.js` → `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent` and `:streamGenerateContent?alt=sse` with header `x-goog-api-key: GEMINI_API_KEY`, body `{systemInstruction, contents, generationConfig: {temperature:0.4, maxOutputTokens:1024}}`, SSE parsing `data:` lines → `candidates[0].content.parts[0].text` | Staff AI chat (`POST /api/ai/chat`); PII stripped (`No_KP,No_Telefon,Alamat` excluded); hardening `AI_MAX_MESSAGE_LENGTH=1500`, `AI_MAX_HISTORY=16`, `aiRateLimiter 15/min per email`, `sanitizeHistory` user/model alternation |
| ML microservice | Backend → `ML_API_URL` (`http://ml-api:8000` compose, `http://127.0.0.1:8000` fallback) `POST /predict/risk`, `POST /predict/batch`, `POST /etl/process-mdb` | Risk inference on student CRUD/skill-gap/manual-predict/ETL sync; ETL uploads `.mdb` as `FormData Blob` |
| MongoDB | Backend Mongoose → `MONGO_URI` | Collections `users`, `students`, `reports`, `studentreports`, `mdbfiles` |
| Swagger UI | Backend serves | `GET /api/docs` from `swagger-jsdoc` scanning `./auth.js,./items.js,./reports.js,./studentReports.js` |
| Phosphor CDN | Frontend layout | `<Script src="https://unpkg.com/@phosphor-icons/web">` |
| Google Fonts | Frontend `next/font/google` | `Plus_Jakarta_Sans` subsets `latin` |

---

## 2. Directory Tree & Module Manifest

Indented tree of key source directories (build artifacts `node_modules`, `.next`, `dist`, `mongodb_data`, uploaded binaries, and extracted CSV dumps omitted for brevity; full upload/extract paths listed in manifest where behaviorally relevant):

```
TVETMARA-Besut-Skills-Talent-Development-Dashboard/
├── package.json
├── next.config.mjs
├── tailwind.config.js
├── postcss.config.js
├── jsconfig.json (@/* -> ./src/*)
├── vitest.config.js
├── middleware.js
├── Containerfile.frontend
├── compose.yml
├── .env.local (BACKEND_URL, GEMINI_API_KEY)
├── .eslintrc.json
├── .github/workflows/ci.yml
├── public/logo-tvetmara.jpg, public/vite.svg
├── src/
│   ├── app/
│   │   ├── layout.jsx
│   │   ├── page.jsx (GET /)
│   │   ├── globals.css
│   │   ├── actions.js (loginAction, logoutAction)
│   │   ├── api/[...proxy]/route.js
│   │   ├── staff-dashboard/page.jsx (GET /staff-dashboard)
│   │   ├── student-dashboard/page.jsx (GET /student-dashboard)
│   │   └── student-profile/page.jsx (GET /student-profile?id=)
│   ├── components/
│   │   ├── Sidebar.jsx
│   │   ├── KpiCard.jsx
│   │   ├── StudentModal.jsx
│   │   ├── StudentDetailModal.jsx
│   │   ├── StudentListGrid.jsx
│   │   ├── JobCard.jsx
│   │   ├── GenerateReportModal.jsx
│   │   ├── ReportFormModal.jsx
│   │   ├── auth/LoginForm.jsx
│   │   ├── ui/dashboard-kit.jsx
│   │   ├── ui/AttachmentPreview.jsx
│   │   └── dashboard/
│   │       ├── StaffDashboardClient.jsx
│   │       ├── StudentDashboardClient.jsx
│   │       ├── CounselorDashboardClient.jsx
│   │       ├── StudentProfileClient.jsx
│   │       ├── AppointmentCalendar.jsx
│   │       └── MergedLaporanTab.jsx
│   ├── lib/
│   │   ├── auth.js
│   │   ├── client-auth.js
│   │   ├── roles.js
│   │   ├── heuristics.js
│   │   └── use-file-preview.js
│   ├── __tests__/Login.test.jsx
│   └── assets/react.svg
├── backend/
│   ├── server.js
│   ├── auth.js (router /api/auth)
│   ├── auth.model.js
│   ├── items.js (router /api)
│   ├── reports.js (router /api/reports)
│   ├── studentReports.js (router /api/student-reports)
│   ├── item.model.js
│   ├── middleware/authMiddleware.js
│   ├── models/User.js, Models/Student.js, Models/Report.js, Models/StudentReport.js, Models/MdbFile.js
│   ├── repredict-status.js
│   ├── seed.js, seed-admin.js
│   ├── package.json
│   ├── .env, .env.example
│   ├── Containerfile.backend, babel.config.json
│   ├── __tests__/auth.test.js, __tests__/items.test.js
│   ├── uploads/certificates/, uploads/referrals/, uploads/reports/, uploads/mdb/
│   └── db/sedut_mdb_tulen.py, db/inspect_mdb_linux.py, db/prepare_ml_data_3mdb.py, db/relabel_option2.py, db/data_tvet_muktamad.json, db/mdb_extracted/{JJ2025,JJ2026,JD2025}/*.csv
└── ML/
    ├── ml.py (FastAPI app)
    ├── requirements.txt
    ├── Containerfile
    ├── train_and_evaluate.py, train_and_evaluate_v4.py
    ├── test_ml.py
    └── model_ai_risiko_lengkap_v3.pkl, model_ai_risiko_lengkap_v4.pkl (active)
```

| Path / Module | Purpose | Key Exports / Responsibilities |
| :--- | :--- | :--- |
| `package.json` | Frontend manifest, Next 15 SSR scripts | Scripts `dev: next dev`, `build: next build`, `start: next start`, `lint: next lint`, `test: vitest run src/__tests__`; deps pinned above |
| `next.config.mjs` | Next standalone + upload passthrough | `output: 'standalone'`; `rewrites(): [{source: "/uploads/:path*", destination: "http://backend:5000/uploads/:path*"}]`; comment notes `/api` rewrite removed in favor of proxy route |
| `tailwind.config.js` | Tailwind content + font | `content` covers `src/app` + `src/components`; `fontFamily.sans: Plus Jakarta Sans` |
| `postcss.config.js` | PostCSS pipeline | Plugins `tailwindcss`, `autoprefixer` (ESM `export default`) |
| `jsconfig.json` / `vitest.config.js` | Path alias + test runner | `@/*` → `./src/*`; Vitest `environment: jsdom`, `include: src/**/*.{test,spec}.{js,jsx}`, `globals: true`, alias `@` → `./src` |
| `middleware.js` (root, Next Edge) | Route guards for all non-API/static paths | `middleware(request)`, `config.matcher: ['/((?!api\|_next/static\|_next/image\|favicon.ico\|assets).*)']`; parses `user` cookie JSON; `/`+`/login` redirect logged-in staff → `/staff-dashboard`, students → `/student-dashboard`; unauthenticated → `/`; `/staff-dashboard`+`/student-profile` require staff else → `/student-dashboard`; `/student-dashboard` rejects staff → `/staff-dashboard` |
| `Containerfile.frontend` | 3-stage Next production image | `deps: node:20-alpine npm install`; `builder: copy + NEXT_TELEMETRY_DISABLED=1 + npm run build`; `runner: nodejs:1001/nextjs:1001, copy .next/standalone + .next/static + public, EXPOSE 3000, CMD ["node","server.js"]` |
| `compose.yml` | Local/prod orchestration | 4 services + `tvet_net` bridge; backend `sleep 5 && npm run start:prod`; frontend `BACKEND_URL=http://backend:5000` |
| `.env.local` / `backend/.env` / `backend/.env.example` | Environment schema | Frontend: `BACKEND_URL`, `GEMINI_API_KEY`; Backend real: `PORT, MONGO_URI, JWT_SECRET, ML_API_URL, GEMINI_API_KEY, CORS_ORIGIN`; Example omits `ML_API_URL,GEMINI_API_KEY` and uses `PORT=5001`, `JWT_SECRET=your_secret_key_herea` |
| `.eslintrc.json` | Lint rules | `extends: next/core-web-vitals`; off `react/no-unescaped-entities`, `@next/next/no-img-element` |
| `.github/workflows/ci.yml` | CI pipeline | Jobs `frontend`, `backend`, `ml-service`, `docker-build` as detailed in §1 |
| `public/logo-tvetmara.jpg`, `public/vite.svg` | Static assets | Logo rendered at `w-64` login and `192x48` sidebar via `next/image`; `vite.svg` unused legacy |
| `src/app/layout.jsx` | Root HTML shell | `metadata {title: 'TVETMARA Besut - Papan Pemuka Pintar', description: 'Skills & Talent Development Dashboard'}`; `RootLayout({children})` → `<html lang="ms">` + Jakarta font class + Phosphor `<Script>` |
| `src/app/page.jsx` | Login entry `GET /` | `dynamic='force-dynamic'`; `LoginPage() => <LoginForm/>`; no auth/fetch, defers to `middleware.js` |
| `src/app/globals.css` | Motion + mobile utilities | 7 keyframes + `.stagger-1..8`, `.anim-fill`, `.skeleton-shimmer`, `.touch-target`, `.text-responsive-*`, `.no-select`, `.scroll-smooth-mobile`, `.safe-area-*`, `.pb-safe` |
| `src/app/actions.js` | Auth server actions | `loginAction(prevState,formData)`: `POST BACKEND_URL/api/auth/login {email,password}`, sets `user` (non-HttpOnly, `maxAge:86400`, `path:/`) + `ikmbToken` (HttpOnly, `secure: prod`, `sameSite: lax`, `maxAge:86400`), redirects by role; `logoutAction()`: deletes both, redirects `/` |
| `src/app/api/[...proxy]/route.js` | Authenticated reverse proxy | `GET/POST/PUT/PATCH/DELETE proxyRequest`: `GET /api/* → BACKEND_URL/api/<joined + query>`; reads `ikmbToken`, sets `Authorization: Bearer`; strips `host/connection/content-length`; forwards `body: blob` for non-GET/HEAD; returns `NextResponse(backendRes.body,{status,headers})`; `500 {message:'Proxy connection failed'}` |
| `src/app/staff-dashboard/page.jsx` | Staff shell `GET /staff-dashboard` | `StaffDashboardPage() => <StaffDashboardClient/>`; no logic |
| `src/app/student-dashboard/page.jsx` | Student shell `GET /student-dashboard` | `dynamic='force-dynamic'`; `StudentDashboardPage() => <StudentDashboardClient/>`; no logic |
| `src/app/student-profile/page.jsx` | Detail shell `GET /student-profile?id=` | `StudentProfilePage({searchParams})`: `await searchParams`, defaults `id='TVET001'`, renders `<StudentProfileClient studentId>` |
| `src/components/Sidebar.jsx` | Responsive nav drawer | `Sidebar({navItems,activeTab,setActiveTab,isSidebarOpen,setIsSidebarOpen,currentUser,handleLogout,profileImage})`; `getRoleLabel`, initials avatar, `Escape` close, `body overflow hidden` on mobile open; backdrop `bg-black/50 backdrop-blur-sm`, aside `w-64 transition-transform duration-300 translate-x-0/-full`; active `bg-blue-50 text-blue-600 border-l-4` |
| `src/components/KpiCard.jsx` | KPI stat card | `KpiCard({title,value,isLoading,icon,iconBg,iconColor,barColor,barWidth,subtitle,delay})`; `slideUp .4s anim-fill`, `hover:shadow-md hover:-translate-y-0.5`, `skeleton-shimmer` when loading, progress bar `transition-all duration-700` |
| `src/components/StudentModal.jsx` | Add/edit student form | `StudentModal({isOpen,onClose,editingStudent,formData,handleInputChange,handleSubmit})`; `Escape` + backdrop-click close, `body overflow hidden`; fields `ID_Pelajar,Nama,Kehadiran_Pct,CGPA,Sijil[Tiada/CompTIA/CCNA/AWS],Kursus[ITW/DGA/DFK/PPU/SLR/DCG/SED],Status[Bermasalah/Sederhana/Cemerlang]`; sticky header/footer |
| `src/components/StudentDetailModal.jsx` | Read-only inbox detail | `StudentDetailModal({kind,appointment,report,item,onClose,onDownload,onPrint,onShare})`; resolves `item.itemType`; grids Pelajar/Kursus/CGPA/Kehadiran; appointment box `bg-purple-50` + SEGERA/NORMAL; report `whitespace-pre-wrap` + PDF iframe `h-64 sm:h-96`; sticky footer download/print |
| `src/components/StudentListGrid.jsx` | Searchable student grid | `StudentListGrid({students,onViewProfile,onAddStudent,readOnly})`; `search/filter/riskFilter` state, `useMemo filteredStudents`; `courseMap` short→full; risk chips with counts; cards `hover:shadow-lg hover:-translate-y-1 slideUp delay min(index*60,480)ms`, header `bg-[#0C2461]`, avatar `bg-[#1251AA]` |
| `src/components/JobCard.jsx` | Career recommendation | `JobCard({job:{icon,match,title,company}})`; `group-hover:bg-blue-600`, match pill `bg-green-50`, CTA `hover:bg-blue-600 active:scale-95` |
| `src/components/GenerateReportModal.jsx` | Staff→student letter + PDF | `GenerateReportModal({isOpen,onClose,student,skillGap})`; `POST /api/student-reports FormData{studentId,studentName,course,cgpa,attendance,riskLevel,semester,title,message,ploScores,employability,file}`; `useFilePreview([pdf])`, auto title `Laporan Prestasi & Intervensi: <nama>`; toast `scaleIn`; dropzone `border-dashed`; submit emerald with `animate-spin` |
| `src/components/ReportFormModal.jsx` | Staff→counselor referral | `ReportFormModal({isOpen,onClose,student,interventionType})`; `GET /api/auth/users` filter `role==counselor`; `POST /api/reports FormData{studentId,studentName,course,cgpa,attendance,riskLevel,interventionType,reason,priority,scheduledDate,counselorId,file}`; defaults tomorrow 09:00; priority toggle Normal/Segera; dropzone `pdf/jpeg/png/jpg` |
| `src/components/auth/LoginForm.jsx` | Login UI | `LoginForm()`, `SubmitButton()` with `useActionState(loginAction)` + `useFormStatus pending`; split layout: left `hidden lg:flex w-1/2 bg-blue-600 slideInLeft` (Unsplash overlay, `floatSoft` brain icon/orbs), right `slideInRight` logo + `envelope/lock-key` inputs + `hover:scale-1.02 active .98` button + `bg-red-50 scaleIn` error |
| `src/components/ui/dashboard-kit.jsx` | Shared primitives | `formatMsDate(value,withTime)` (ms-MY), `Badge({tone})`, `StatCard`, `SectionCard`, `PillTabs`, `EmptyState`, `SkeletonList({rows=3})`, `getRiskMeta(risk)`, `RiskBadge`; tones blue/purple/green/amber/rose/slate; risk Tinggi red `warning-octagon`, Sederhana amber `clock`, Rendah emerald `check-circle` |
| `src/components/ui/AttachmentPreview.jsx` | File preview row | `AttachmentPreview({file,previewUrl,onRemove})`; `formatFileSize`; PDF red vs image blue header, `object-contain max-h-48 sm:64`, PDF iframe `h-48 sm:64 bg-slate-200`, Buka + remove `hover:bg-red-50` |
| `src/components/dashboard/StaffDashboardClient.jsx` | Admin/counselor console | Tabs `overview/prediction/skills/pathways/management/counselor/data`; fetches `GET /api/students`, `GET /api/data/mdb-files`, `POST /api/data/process-mdb/:id`, `DELETE /api/data/mdb-files/:id`, `POST /api/data/upload-mdb`, CRUD `/api/students[/:id]`, `POST /api/ai/chat` streaming; derives `highRisk`, `employability`, `ploAverages`, `pathwayMappings PLO1..9`; AI selector with risk filter; MDB ETL banner; Chart.js `Bar` |
| `src/components/dashboard/StudentDashboardClient.jsx` | Student self-service | Tabs `dashboard/profile/reports/career/courses`; fetches `GET /api/students`, `GET /api/students/:id/skill-gap`, `GET /api/students/:id`, `POST /api/students/:id/profile-image`, `POST/DELETE /api/students/:id/certificates[/:certId]`; `careerMapping ITW/DFK/DGA/SLR/DCG/SED/PPU`, `getFullCourseName`; Chart.js `Radar`; dark career card `bg-slate-900`; `MergedLaporanTab` for inbox |
| `src/components/dashboard/CounselorDashboardClient.jsx` | Referral workflow | `CounselorDashboardClient({currentUser})`; tabs `calendar/pending/scheduled/completed/sent-reports/all`; `GET /api/reports`, `GET /api/student-reports`, `PATCH /api/reports/:_id {accepted/rejected/scheduled/completed/pending + scheduledDate+counselorNotes}`, `DELETE /api/student-reports/:id`; `INTERVENTION_LABELS`, `STATUS_CONFIG`; `AppointmentCalendar` + `Badge/formatMsDate/SkeletonList/EmptyState` |
| `src/components/dashboard/StudentProfileClient.jsx` | Single-student 360 view | `StudentProfileClient({studentId})`; tabs `personal/academic/skills`; `GET /api/students/:studentId/skill-gap`; derives `cgpaColor`, `trendData` (GPA line + attendance bar dual-axis), `radarData`, `employabilityScore`; actions `window.print`, JSON download `Profil_Pelajar_<id>.json`; embeds `ReportFormModal`, `GenerateReportModal`; `isStaff` gates intervention cards |
| `src/components/dashboard/AppointmentCalendar.jsx` | Month calendar | `AppointmentCalendar({reports,onComplete})`; pure from `reports` prop; `dayKey YYYY-MM-DD`, `DAY_NAMES Isn..Ahd`, `MONTH_NAMES Januari..`; Monday-first cells, `prevMonth/nextMonth`, mobile bottom-sheet vs desktop side panel, upcoming list sorted asc |
| `src/components/dashboard/MergedLaporanTab.jsx` | Student inbox merger | `formatLaporanDate`, `normalizeLaporanItems(reports,appointments)`, `MergedLaporanTab({user})`; `GET /api/student-reports` + `GET /api/reports/mine` in `Promise.all`, `GET /api/student-reports/:_id` marks read; filters `all/report/appointment`, `unreadCount !readByStudent`; unread `border-blue-300 bg-blue-50/30` |
| `src/lib/auth.js` | Server cookie helpers | `getStoredUser()` (`cookies().get('user')` JSON, null-safe), `getToken()` (`ikmbToken`), `getDashboardPathForRole(role)` (staff → `/staff-dashboard` else `/student-dashboard`) |
| `src/lib/client-auth.js` | Client cookie reader (`"use client"`) | `getClientUser()` parses `document.cookie user=`, `getClientToken() => 'proxy-handled'` (real JWT stays HttpOnly, proxy injects) |
| `src/lib/roles.js` | Role labels | `ROLES {admin:{Penyelaras,staff}, counselor:{Kaunselor,staff}, user:{Pelajar,student}}`; `getRoleLabel`, `isStaff` |
| `src/lib/heuristics.js` | Employability formulas | `calculateEmployability(cgpa,attendance)=round(min100(cgpa/4*40+att*0.6))`; `calculateTopPerformerScore=round(min100(cgpa/4*60+att*0.4))` |
| `src/lib/use-file-preview.js` | Upload validation | `MAX_ATTACHMENT_BYTES=5MB`, `formatFileSize`, `useFilePreview({acceptTypes=[pdf,jpeg,png,jpg]}) → {file,previewUrl,error,selectFile,clear}`; `URL.createObjectURL/revoke`, ext+mime check, Malay error strings |
| `src/__tests__/Login.test.jsx` | Frontend smoke test | Mocks `next/navigation useRouter`, `next/script`, `@/app/actions loginAction`; asserts `Selamat Kembali`, `Emel Pengguna`, `Kata Laluan`, `Log Masuk Dashboard` via Vitest + Testing Library |
| `backend/server.js` | Express entry | Exports `app`; `helmet({csp:false})`, `cors`, `express.json({limit:200kb})`; mounts `/api/auth`, `/api/reports`, `/api/student-reports`, `/api`; static `/uploads/certificates|referrals|reports`; `GET /api/docs` Swagger; `mongoose.connect(MONGO_URI)` skipped in test; crash recovery `MdbFile.updateMany({Processing→Saved})`; `PORT‖5000`; ensures upload dirs |
| `backend/auth.js` / `backend/auth.model.js` | Login + user list | Router delegates to model; `readLoginDatabase/getAllLoginUsers/getPublicLoginUsers/authenticateUser(email,password)`: `User.find`, lowercase-trim match, `bcrypt.compare`, `jwt.sign({email,role,studentId},{JWT_SECRET},{expiresIn:8h})`, returns `{user:{email,role,displayName,studentId},token}` |
| `backend/middleware/authMiddleware.js` | JWT guards | `verifyToken` (401 `Tiada token`/`Token tidak sah`, secret `JWT_SECRET‖super_secret_fyp_key_2026`, sets `req.user`), `requireAdmin` (403 unless `admin`), `requireStaff` (403 unless `admin‖counselor`), `requireOwnershipOrAdmin` (staff OR `req.user.studentId==req.params.studentId`) |
| `backend/models/User.js` | Auth collection | `email{required,unique}, password{required}, role{enum:[admin,counselor,user],default:user}, displayName, studentId{default:null}`; hashing manual in seed/ETL, no pre-save hook |
| `backend/models/Student.js` | Student collection | `ID_Pelajar,Nama,Kursus,Semester:Number,Kehadiran_Pct:String,CGPA:String,Sijil_Profesional:String,PLO_1..9:String,Status_Pelajar:String,No_KP/No_Telefon/Alamat{default:''},academicHistory[{semester,gpa,cgpa,attendance}],uploadedCertificates[{name,issuer,fileName,filePath,uploadDate}],profileImage:String` |
| `backend/models/Report.js` | Referral collection | `studentId{required,index},studentName{required},course,cgpa,attendance,riskLevel,interventionType{enum:[kaunseling,klinik,softskills],required},reason{required},priority{enum:[urgent,normal],default:normal},status{enum:[pending,accepted,scheduled,completed,rejected],default:pending},adminEmail{required},counselorId{default:null},counselorNotes,scheduledDate:Date,fileName,filePath,timestamps` |
| `backend/models/StudentReport.js` | Staff letter collection | `studentId{required,index},studentName,course,cgpa,attendance,riskLevel,semester,ploScores[{label,value}],employability{0-100},authorEmail,authorRole{enum:[admin,counselor]},authorName,title{required},message,fileName,filePath,reportType{enum:[message,letter,full]},readByStudent{default:false},timestamps` |
| `backend/models/MdbFile.js` | ETL ledger | `datasetName{required},originalName,filePath,fileSize,status{enum:[Saved,Processing,Processed,Failed],default:Saved},recordsProcessed,uploadDate,processedDate` |
| `backend/item.model.js` | Student normalization + ML wrapper | `getRealAIPrediction(features)` (`POST ML/predict/risk`, map `Bermasalah→Tinggi` etc., heuristic fallback), `getAllStudents/getStudentById/getStudentSkillGapById/createStudent/updateStudent/deleteStudent`; `normaliseStudent` maps `Bermasalah/Sederhana/Cemerlang/Pending AI → Tinggi/Sederhana/Rendah/Pending`, overrides `attendance<80‖cgpa<2→Tinggi`, `cgpa≥3.5‖Cemerlang→Rendah` (except Bermasalah stays Tinggi); `certificationScore{Tiada:35,CompTIA:70,CCNA:85,AWS:90,else:50}` |
| `backend/items.js` | Students/MDB/AI router (`/api`) | Multer certificates (`uploads/certificates`, 5MB, `jpeg\|jpg\|png\|pdf`), MDB (`uploads/mdb`, 100MB, `.mdb` only); `executeEtlAndSync` (Processing→`POST ML/etl/process-mdb`→`POST ML/predict/batch`→`deleteMany nin newIds`→`bulkWrite upsert Students+Users password123`→Processed/Failed); Gemini `callGeminiAPI/callGeminiStreamAPI` |
| `backend/reports.js` | Referral router (`/api/reports`) | Multer referrals (`uploads/referrals`, 5MB, image+pdf); `safeUnlink`; validates `studentId,studentName,interventionType,reason,scheduledDate,counselorId`, counselor exists, sets `status:scheduled, adminEmail:req.user.email` |
| `backend/studentReports.js` | Letter router (`/api/student-reports`) | Multer reports (`uploads/reports`, 5MB, PDF only); parses `ploScores` JSON, clamps `employability 0-100`, derives `reportType full/letter/message`; path-traversal guard `resolved.startsWith(uploadsRoot+sep)` on delete |
| `backend/repredict-status.js` | Batch re-predict CLI | Connects `MONGO_URI‖mongodb://127.0.0.1:27017/ikmb-dashboard`, chunks 500 → `POST ML/predict/batch`, `bulkWrite Status_Pelajar`, no fallback |
| `backend/seed.js` / `backend/seed-admin.js` | Seed scripts | `seed.js`: reads `db/data_tvet_muktamad.json`, `findOneAndUpdate upsert` Students (preserves certs/profile) + Users (`<ID>@student.ikmb.edu.my/password123`), then upserts `admin@ikmb.edu.my/admin`, `counselor@ikmb.edu.my/counselor`, `user@ikmb.edu.my/user`; `seed-admin.js`: same 3 accounts only |
| `backend/__tests__/auth.test.js` / `items.test.js` | Backend tests | `auth`: mocks `auth.model`, `POST /api/auth/login` 200 with token / 401 null; `items`: real app `NODE_ENV=test`, `GET /api/students` 401 without/invalid token |
| `ML/ml.py` | FastAPI inference + ETL | `GET /` (`AI Server V4 is running`), `POST /predict/risk` (`StudentFeatures{CGPA,Attendance,PLO_1..9,Sijil} → {success,prediction:Cemerlang\|Sederhana\|Bermasalah,raw_output}`), `POST /predict/batch`, `POST /etl/process-mdb` (`.mdb` only → `process_mdb_data` via `mdb-export`/`mdb-tables` → `ID_Pelajar...PLO_1..9,academicHistory,Status_Pelajar:Pending AI`); features `plo_avg=np.mean`, `plo_variance=np.var(ddof=0)`; loads `model_ai_risiko_lengkap_v4.pkl` (`RandomForest 100 trees`) |
| `ML/train_and_evaluate.py` / `train_and_evaluate_v4.py` | Training pipelines | Source `../backend/db/ml_training_data_real.csv`; coerce `CGPA median`, `Attendance 80`, `PLO 0`; engineer `PLO_Avg mean`, `PLO_Variance var(ddof=1)`; `X 13 features`, `y Status_Pelajar`; `train_test_split 0.2 random 42` (v4 uses `GroupShuffleSplit` if `No_Pelajar` duplicated); `GridSearchCV cv 5/3/2 scoring f1_weighted` over `n_estimators[100,200,300], max_depth[None,10,20], min_samples_split[2,5,10], class_weight[balanced,None]`; save `model_ai_risiko_lengkap_v4.pkl` |
| `ML/test_ml.py` / `ML_TEST_RESULTS.md` | ML tests | `test_health_check` (200 + V4), `test_predict_risk_valid_data` (CGPA 3.9/100/95s ∈ 3 labels), `test_predict_risk_invalid_data` (missing PLO → 422); doc claims 3/3 passed |
| `backend/db/*.py` | ETL/training data prep | `prepare_ml_data_3mdb.py` (multi-MDB → `ml_training_data_real.csv` via Option2 labels), `relabel_option2.py` (in-place relabel), `sedut_mdb_tulen.py` (single `Ekspot_Senat.mdb` → `data_tvet_muktamad.json`), `inspect_mdb_linux.py` (schema dump) |

---

## 3. Role-Based Access Control (RBAC) & Permissions

### Role Definitions

| Role value | Malay label (`ROLES`) | Group (`isStaff`) | Intended purpose |
| :--- | :--- | :--- | :--- |
| `admin` | Penyelaras | staff | Full staff console: student CRUD, manual predict, MDB upload/process/delete, all referrals and letters, AI chat with any student, ETL sync creates student logins |
| `counselor` | Kaunselor | staff | Counseling workflow: view assigned + pending referrals, accept/schedule/complete/reject, manage sent letters, AI chat, student profiles and interventions; cannot access MDB ETL admin endpoints |
| `user` | Pelajar | student | Self-service only: own dashboard, own skill-gap, own certificates/profile image, own inbox (`reports/mine` + own `student-reports`); `studentId` in JWT scopes ownership; restricted users (`role==user && studentId`) hide student selector and see only own record |

Guest (no `user` cookie / no JWT) is implicitly a fourth role handled by redirects and 401s.

Default seeded credentials (all password `password123`, bcrypt salt 10): `admin@ikmb.edu.my/admin`, `counselor@ikmb.edu.my/counselor`, `user@ikmb.edu.my/user`, plus per-student `<ID_Pelajar>@student.ikmb.edu.my/user` created during ETL/seed.

### Permission Matrix

Frontend route matrix (enforced by `middleware.js` Edge + client guards):

| Resource / Route / Action | Guest | user (Pelajar) | counselor (Kaunselor) | admin (Penyelaras) |
| :--- | :---: | :---: | :---: | :---: |
| `GET /` + `GET /login` (LoginForm) | ✅ | ➡️ redirect own dashboard | ➡️ redirect `/staff-dashboard` | ➡️ redirect `/staff-dashboard` |
| `GET /student-dashboard` | ➡️ `/` | ✅ | ➡️ `/staff-dashboard` | ➡️ `/staff-dashboard` |
| `GET /staff-dashboard` | ➡️ `/` | ➡️ `/student-dashboard` | ✅ | ✅ |
| `GET /student-profile?id=` | ➡️ `/` | ➡️ `/student-dashboard` (middleware treats as staff route) | ✅ | ✅ |
| `POST` Login via `loginAction` | ✅ | ✅ | ✅ | ✅ |
| Staff tab `data` (MDB ETL UI) | ❌ | ❌ | ❌ hidden (`navItems` filters `data` unless `admin`) | ✅ |
| Student selector (view any student) | ❌ | ❌ hidden if `role==user && studentId` | ✅ | ✅ |
| Intervention cards on profile (kaunseling/klinik/softskills + report) | ❌ | ❌ (`isStaff` gate) | ✅ | ✅ |

Backend API matrix (enforced by `verifyToken` + `requireAdmin`/`requireStaff`/`requireOwnershipOrAdmin` + query scoping):

| Resource / Route / Action | Guest (no/invalid JWT) | user | counselor | admin |
| :--- | :---: | :---: | :---: | :---: |
| `GET /api/health` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/docs` (Swagger) | ✅ | ✅ | ✅ | ✅ |
| `POST /api/auth/login {email,password}` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/auth/users` | ❌ 401 | ❌ 403 | ✅ | ✅ |
| `GET /api/students` | ❌ 401 | ✅ own `[student]` only (or `[]` if no `studentId`) | ✅ all | ✅ all |
| `POST /api/students` | ❌ 401 | ❌ 403 | ✅ | ✅ |
| `PUT /api/students/:studentId` | ❌ 401 | ❌ 403 | ✅ | ✅ |
| `DELETE /api/students/:studentId` | ❌ 401 | ❌ 403 | ✅ | ✅ |
| `GET /api/students/:studentId` | ❌ 401 | ✅ own only | ✅ any | ✅ any |
| `GET /api/students/:studentId/skill-gap` | ❌ 401 | ✅ own only | ✅ any | ✅ any |
| `POST /api/students/:studentId/certificates` (multipart `file` 5MB image/pdf) | ❌ 401 | ✅ own only | ✅ any | ✅ any |
| `DELETE /api/students/:studentId/certificates/:certId` | ❌ 401 | ✅ own only | ✅ any | ✅ any |
| `POST /api/students/:studentId/profile-image` (multipart `file`) | ❌ 401 | ✅ own only | ✅ any | ✅ any |
| `POST /api/predict/manual` | ❌ 401 | ❌ 403 | ✅ | ✅ |
| `POST /api/data/upload-mdb` (multipart `.mdb` 100MB + `datasetName`) | ❌ 401 | ❌ 403 | ❌ 403 | ✅ |
| `GET /api/data/mdb-files` | ❌ 401 | ❌ 403 | ❌ 403 | ✅ |
| `POST /api/data/process-mdb/:id` (409 if Processing) | ❌ 401 | ❌ 403 | ❌ 403 | ✅ |
| `DELETE /api/data/mdb-files/:id` (409 if Processing) | ❌ 401 | ❌ 403 | ❌ 403 | ✅ |
| `POST /api/ai/chat {studentId,userMessage,chatHistory}` (15/min per email) | ❌ 401 | ❌ 403 | ✅ | ✅ |
| `POST /api/reports/` (multipart referral + `scheduledDate,counselorId`) | ❌ 401 | ❌ 403 | ✅ | ✅ |
| `GET /api/reports/` | ❌ 401 | ❌ 403 | ✅ pending OR `counselorId==email` | ✅ all |
| `GET /api/reports/mine` | ❌ 401 | ✅ own `accepted/scheduled` sorted date | ✅ `[]` unless has `studentId` | ✅ `[]` unless has `studentId` |
| `GET /api/reports/:id` | ❌ 401 | ❌ 403 | ✅ unless non-pending assigned to other counselor | ✅ |
| `PATCH /api/reports/:id {accept/reject/schedule/complete/reset + date/notes}` | ❌ 401 | ❌ 403 | ✅ with ownership check above | ✅ |
| `POST /api/student-reports/` (multipart PDF-only 5MB) | ❌ 401 | ❌ 403 | ✅ (`authorEmail/role/name` from JWT) | ✅ |
| `GET /api/student-reports/` | ❌ 401 | ✅ filter `studentId==own` | ✅ filter `authorEmail==own` | ✅ all |
| `GET /api/student-reports/:id` (owner read sets `readByStudent=true`) | ❌ 401 | ✅ owner only | ✅ author OR admin (owner student also allowed) | ✅ |
| `DELETE /api/student-reports/:id` | ❌ 401 | ❌ 403 | ✅ author or admin only | ✅ |
| Static `GET /uploads/certificates|referrals|reports/*` via `next.config.mjs` rewrite + Express static | ✅ (no auth) | ✅ | ✅ | ✅ |

### Enforcement Mechanism

- **Edge middleware (`middleware.js`):** runs on every path matching `/((?!api|_next/static|_next/image|favicon.ico|assets).*)`. Reads `user` cookie (non-HttpOnly JSON `{email,role,studentId,displayName}` set by `loginAction`). `JSON.parse` in try/catch → `null` on tamper. Login pages redirect authenticated users to role dashboard. All other pages redirect `null` user to `/`. Staff paths (`/staff-dashboard`, `/student-profile`) reject `!isStaff` to `/student-dashboard`. Student path (`/student-dashboard`) rejects `isStaff` to `/staff-dashboard`. Note: trusts client-readable cookie, so it is UX routing only; real authorization is backend JWT.
- **JWT issuance (`backend/auth.model.js:authenticateUser`):** `bcrypt.compare(password, hash)` after lowercase-trim email lookup in `users`. On success `jwt.sign({email,role,studentId}, JWT_SECRET, {expiresIn: '8h'})` (no fallback secret here). Returns sanitized user without password. Login route `POST /api/auth/login` returns `{message,user,token}` or `401 {message}`.
- **JWT verification (`backend/middleware/authMiddleware.js:verifyToken`):** requires `Authorization: Bearer <token>`, else `401 {message:'Tiada token'}`. Verifies with `JWT_SECRET || 'super_secret_fyp_key_2026'`, sets `req.user = decoded`, catch → `401 {message:'Token tidak sah'}`. `requireAdmin` checks `role==='admin'` else 403. `requireStaff` checks `admin||counselor` else 403. `requireOwnershipOrAdmin` passes if staff OR `req.user.studentId===req.params.studentId` else 403; applied to single-student reads, skill-gap, certificate and profile-image routes.
- **Proxy token bridging (`src/app/api/[...proxy]/route.js` + `src/app/actions.js`):** `loginAction` stores JWT in HttpOnly `ikmbToken` (`secure: NODE_ENV==='production'`, `sameSite: lax`, `maxAge: 86400`) and role snapshot in readable `user` cookie (`httpOnly: false`). Browser fetches same-origin `/api/...` with cookies automatically; proxy reads `ikmbToken` via `cookies()` and sets `Authorization` header. `getClientToken()` intentionally returns `'proxy-handled'` because real token is inaccessible to JS. `logoutAction` deletes both cookies.
- **Client guards (`src/lib/client-auth.js`, `src/lib/roles.js`, dashboard clients):** `getClientUser()` parses `document.cookie`, returns `null` during SSR. `getRoleLabel`/`isStaff` drive labels and tab visibility. `StaffDashboardClient` pushes to `/` if no user, filters `data` nav unless `admin`, and calls `logoutAction` on logout. `StudentDashboardClient` restricts to own record if `role==='user' && studentId`, hides selector, and scopes inbox to own `studentId`. `StudentProfileClient` gates intervention UI behind `admin||counselor` and pushes to `/` if no token.
- **Query scoping in handlers:** `GET /api/students` returns `[own]` for students; `GET /api/reports` filters counselor view; `GET /api/student-reports` filters by `studentId`/`authorEmail`; `GET /api/reports/mine` returns `[]` for staff without `studentId`. `PATCH /api/reports/:id` enforces counselor ownership unless `pending`. `DELETE /api/student-reports/:id` allows only `admin` or original `authorEmail`.

---

## 4. Page Breakdown, UI Behaviors & Animations

Global motion contract (`src/app/globals.css`): `fadeIn (opacity + translateY 6px)`, `slideInLeft (-32px)`, `slideInRight (+32px)`, `slideUp (+20px)`, `scaleIn (0.92)`, `floatSoft (-8px mid)`, `shimmer (bg-pos -200%→200%)`. Helpers `.stagger-1..8`, `.anim-fill`, `.skeleton-shimmer`, `.touch-target`, `.text-responsive-*`, `.no-select`, `.scroll-smooth-mobile`, `.safe-area-*`. Charts animate `800ms easeOutQuart`. No Framer Motion. Icons are Phosphor CSS. All modals share shell: `fixed inset-0 z-50/100 p-0 sm:p-4 bg-black/50-60 backdrop-blur-sm animate fadeIn` + panel `w-full h-full sm:max-w-lg/2xl sm:max-h-[90vh] sm:rounded-2xl animate slideUp .3s scroll-smooth-mobile safe-area` + sticky header/footer.

### Login Page (`src/app/page.jsx` → `src/components/auth/LoginForm.jsx`)

- Route: `GET /` (also `/login` handled by middleware, no dedicated file; both render login flow, `/` is canonical).
- Access Level: Public (authenticated users redirected by `middleware.js` to role dashboard).
- Primary Function & User Flow: User enters `Emel Pengguna` + `Kata Laluan` → presses `Log Masuk Dashboard` (or Enter) → `loginAction` server action posts to backend → on success cookies set + redirect to `/staff-dashboard` (admin/counselor) or `/student-dashboard` (user); on failure red error box shows `state.error` without navigation. Uses `useActionState` + `useFormStatus pending` to disable button and show spinner.
- Components Used: `LoginForm`, internal `SubmitButton`; `next/script` Phosphor; no Sidebar/KPI.
- Animations & Visual Transitions:
  - Type: Split-panel entrance + ambient float + button feedback + error pop.
  - Implementation: Left brand `animate slideInLeft .6s`, headline/body `slideUp .5s delays .2/.35`, brain icon + blurred orbs `floatSoft 3s/6s/8s`, right form `animate slideInRight`; inputs `transition focus:ring-2 blue`; button `hover:bg-blue-700 hover:scale-1.02 active .98 transition-all`, pending `ph-spinner-gap animate-spin`; error `bg-red-50 scaleIn`.
  - Trigger: Route mount; button hover/press/pending; failed login.
  - Configuration/Props: Unsplash overlay `opacity-40 mix-blend`; orbs `blur-3xl`; no stagger classes here, hardcoded delays.

### Student Dashboard (`src/app/student-dashboard/page.jsx` → `src/components/dashboard/StudentDashboardClient.jsx` + `MergedLaporanTab.jsx`)

- Route: `/student-dashboard` (`dynamic='force-dynamic'` shell, all logic in client).
- Access Level: Protected, `user` only (staff redirected to `/staff-dashboard` by middleware; unauthenticated to `/`).
- Primary Function & User Flow: Student lands on `dashboard` tab (radar skill-gap, risk badge, employability, certificates summary) → switches `PillTabs` to `profile` (personal + academic + upload profile image), `reports` (merged inbox via `MergedLaporanTab`), `career` (matched `JobCard` list from `careerMapping` by `Kursus`), `courses` (course cards). Restricted users see only own record; unrestricted (e.g. demo `user` without `studentId`) can select from dropdown. Upload flow: pick certificate `name/issuer/file` → `POST .../certificates` → list refresh; delete via trash → `DELETE`; profile image via camera input → `POST .../profile-image`. Inbox items open `StudentDetailModal`.
- Components Used: `StudentDashboardClient`, `Sidebar` (tabs `dashboard/profile/reports/career/courses`), `RiskBadge`, `StatCard`/`SectionCard`/`PillTabs`/`EmptyState`/`SkeletonList` (dashboard-kit), `JobCard`, `MergedLaporanTab` → `StudentDetailModal`, Chart.js `Radar`.
- Animations & Visual Transitions:
  - Type: Page fade, card rise, radar draw, skeleton shimmer, modal pop.
  - Implementation: Container `bg-[#F8FAFC] animate fadeIn`; cards `rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all slideUp`; Radar `h-64` with Chart.js animation; loading `SkeletonList` (`skeleton-shimmer h-16 slideUp delay 80ms`); risk badge `scaleIn`; career dark card `bg-slate-900`; course cards `bg-blue-600/slate-900/purple-600`; Phosphor `radar/user-circle/tray/briefcase/certificate/camera/upload/file-pdf/trash`.
  - Trigger: Route mount, tab switch (`PillTabs` active `bg-blue-600 shadow-blue`), data load, inbox open, upload/delete.
  - Configuration/Props: `initialSkillGap` placeholder; `getFullCourseName` maps `ITW→Teknologi Maklumat (ITW)` etc.; `careerMapping` per course lists `{icon,match,title,company}`.

### Staff Dashboard (`src/app/staff-dashboard/page.jsx` → `src/components/dashboard/StaffDashboardClient.jsx` + `CounselorDashboardClient.jsx`)

- Route: `/staff-dashboard` (shell, all logic in client; embeds counselor workflow as `counselor` tab).
- Access Level: Protected, staff only (`admin` + `counselor`); students redirected to `/student-dashboard`. `data` tab additionally gated to `admin` in UI and API.
- Primary Function & User Flow: Staff lands on `overview` (KPI cards: total students, high-risk, average CGPA/attendance; PLO bar chart; top-performer list) → `prediction` (AI chat: select student via searchable dropdown with risk filter → type message → streaming reply with `**bold/*italic/•` rendering, auto-scroll to `chatEndRef`) → `skills` (PLO averages bar + skills-gap table) → `pathways` (PLO→career mappings) → `management` (searchable `StudentListGrid` → view profile `/student-profile?id=`, add via `StudentModal` → `POST`, edit → `PUT`, delete → `DELETE` with confirm) → `counselor` (embedded `CounselorDashboardClient`: calendar/pending/scheduled/completed/sent-reports/all, accept/schedule/complete/reject via modals) → `data` (admin only: upload `.mdb` with `datasetName` → `POST /api/data/upload-mdb` → list `GET /api/data/mdb-files` → process `POST /api/data/process-mdb/:id` with 3s polling → delete `DELETE`). Sidebar collapses on mobile with backdrop; `Escape` closes; logout via `logoutAction`.
- Components Used: `StaffDashboardClient`, `Sidebar`, `KpiCard` (delays 0/100/200), `StudentListGrid`, `StudentModal`, `CounselorDashboardClient` → `AppointmentCalendar`, `ReportFormModal`/`GenerateReportModal` (launched from profile, not dashboard directly), Chart.js `Bar` (`CategoryScale/LinearScale/BarElement`), dashboard-kit primitives.
- Animations & Visual Transitions:
  - Type: Layout slide, KPI stagger, chart draw, chat bubbles, dropdown, ETL pulse, skeleton shimmer.
  - Implementation: Layout `flex h-screen bg-[#F8FAFC]`; sidebar `transition-transform duration-300`; KpiCards `slideUp .4s anim-fill`; charts `h-80 animation 800 easeOutQuart`; lists `slideUp delay 350+idx*60ms`; AI panels `slideInLeft/Right`, bubbles emerald (user) vs white (AI), typing dots `bounce` + cursor `pulse`; selector dropdown `fadeIn`, outside-click/`Escape` close; MDB table `pulse` skeleton, status badges green/blue/yellow `pulse`/red, ETL banner `pulse`; `calculateEmployability/TopPerformerScore` drive bars `transition-all duration-700`.
  - Trigger: Route mount, tab switch, search/filter, CRUD modal open/close, AI send/receive, MDB upload/process/delete, polling.
  - Configuration/Props: `highRisk = dropoutRisk Tinggi || attendance<80 || cgpa<2`; `ploChartData` blue vs target 80 gray; `aiRiskCounts/aiFilteredStudents`; `renderAiText` markdown-lite.

### Student Profile (`src/app/student-profile/page.jsx` → `src/components/dashboard/StudentProfileClient.jsx`)

- Route: `GET /student-profile?id=TVET001` (defaults to `TVET001` if missing; `searchParams` awaited).
- Access Level: Protected, staff only (`admin`/`counselor`); students hitting URL are bounced to `/student-dashboard` by middleware.
- Primary Function & User Flow: Staff opens from management grid → sees breadcrumb back to `/staff-dashboard` → header card (avatar, `ID_Pelajar`, `Nama`, `Kursus` full name, `Semester`, CGPA bar with red/amber/emerald color, attendance, risk `StatusBadge`, employability) → switches tabs `personal` (No_KP/telefon/alamat, certificates, profile image) / `academic` (trend dual-axis GPA line + attendance bar from `academicHistory`, semester table) / `skills` (radar student blue vs target green dashed, PLO table, `hasZeroScore` warning, AI insight card `gradient slate-900→800`) → clicks intervention cards (kaunseling/klinik/softskills → `ReportFormModal` with `interventionType`; `GenerateReportModal` for letter) → submits with attachment → toast → print (`window.print`) or download JSON (`Profil_Pelajar_<id>.json` Blob).
- Components Used: `StudentProfileClient`, `ReportFormModal`, `GenerateReportModal`, `StatusBadge` (internal), Chart.js `Bar`+`Line` and `Radar`, dashboard-kit `Badge`.
- Animations & Visual Transitions:
  - Type: Page fade, two-column slide, avatar pop, bar grow, AI float, card stagger.
  - Implementation: Container `bg-[#EEF3FB] p-6 fadeIn`; left card `slideInLeft rounded-xl border hover:shadow-md`, header `bg-[#0C2461]`, avatar `w-24 rounded-full border-4 scaleIn`; right `slideInRight`, tab bar `border-b active border-[#1251AA]`; CGPA bar `transition-all 700`; AI card `gradient floatSoft wand`; intervention cards red/orange/blue `hover:-translate-y-0.5 slideUp stagger .2/.3/.4`.
  - Trigger: Route mount with `?id=`, tab switch, modal open/close/submit, print/download.
  - Configuration/Props: `employabilityScore = min100(cgpa/4*40+att*0.6)`; `trendData` dual `y/y1`; `radarData` dashed target.

### Counseling Workflow (embedded tab, `src/components/dashboard/CounselorDashboardClient.jsx` + `AppointmentCalendar.jsx`)

- Route: No separate URL; rendered inside staff dashboard `counselor` tab. Data routes are API-only.
- Access Level: Protected staff; `isAdmin` shows reset action and different subtitle; counselors see only `pending OR counselorId==own`.
- Primary Function & User Flow: Counselor opens `calendar` (month grid, click day → side panel/bottom-sheet list → `onComplete`) → `pending` (accept → scheduled with date/notes, or reject with notes) → `scheduled` (complete with notes, or reschedule) → `completed` (read-only + reset to pending if admin) → `sent-reports` (view/delete letters) → `all` (combined). All mutations via `PATCH /api/reports/:_id {action,scheduledDate,counselorNotes}`; toasts confirm for 3s. `AppointmentCalendar` derives `scheduledReports` from prop, groups by `dayKey`, Monday-first cells, prev/next month, mobile detection `<1024px`.
- Components Used: `CounselorDashboardClient`, `AppointmentCalendar`, `PillTabs`, `SkeletonList`, `EmptyState`, `Badge`, `formatMsDate`.
- Animations & Visual Transitions:
  - Type: Toast pop, card stagger, calendar select, bottom-sheet slide, modal pop, spinner.
  - Implementation: Toast `fixed top z-60 emerald/red fadeIn`; cards `rounded-2xl hover:shadow-md slideUp delay idx*50`; priority `SEGERA rose`; modals `fixed z-50 slideUp safe-area` with `datetime-local` + textarea; buttons `touch-target active:scale-95`, submitting `animate-spin`; calendar cells `h-12 sm:h-16 rounded-lg border selected bg-blue-50 ring/blue vs today blue-50/50 vs hover slate`, event pills purple/red `text-[8/9px] truncate + dot`; mobile sheet `fixed bottom rounded-t-2xl max-h-[70vh] slideUp`, desktop panel `fadeIn`, upcoming `max-h-64 overflow-y-auto`.
  - Trigger: Tab switch, day click (toggle on mobile), month nav, modal open/close, PATCH/DELETE, resize.
  - Configuration/Props: `INTERVENTION_LABELS {kaunseling,klinik,softskills}`; `STATUS_CONFIG {pending,accepted,scheduled,completed,rejected}`; `DAY_NAMES Isn..Ahd`, `MONTH_NAMES Januari..`; `formatTime ms-MY HH:MM`.

### Merged Inbox (student tab, `src/components/dashboard/MergedLaporanTab.jsx` + `StudentDetailModal.jsx`)

- Route: No separate URL; student dashboard `reports` tab.
- Access Level: Protected `user`; fetches only when `user` present.
- Primary Function & User Flow: Student opens `reports` → sees header (tray icon + red `baharu` badge for `unreadCount` + reload) → filters `PillTabs all/report/appointment` → clicks item (unread `border-blue-300 bg-blue-50/30`) → `StudentDetailModal kind=itemType` opens → reads message/appointment (SEGERA/NORMAL, `formatMsDate`, PDF iframe) → triggers `GET /api/student-reports/:_id` marking `readByStudent=true` → list refreshes, badge decrements → actions download/print/share.
- Components Used: `MergedLaporanTab`, `StudentDetailModal`, `PillTabs`, `SkeletonList`, `EmptyState`, `Badge`, `formatLaporanDate`/`normalizeLaporanItems`.
- Animations & Visual Transitions:
  - Type: List stagger, unread ring, modal pop, badge pop.
  - Implementation: Items `w-full text-left rounded-2xl border hover:shadow-md slideUp delay idx*50 touch-target active .98`, unread ring-blue; icons blue file vs purple calendar; badges blue/purple/green `Dibaca`/rose `Segera`; preview `line-clamp-2 italic`; modal shell as §4 global; report iframe `h-64 sm:h-96`; appointment box `bg-purple-50`.
  - Trigger: Tab mount, filter change, item click, mark-read, reload.
  - Configuration/Props: `normalizeLaporanItems` sorts `displayDate desc`; `readByStudent` drives unread.

### Shared Modals & Grids (used across pages)

- `StudentModal`: add/edit student; backdrop `bg-black/60 z-[100]`; panel `sm:max-w-2xl`; inputs `focus:ring-2 blue`; buttons `active:scale-95`; `Escape`/backdrop close; `body overflow hidden`.
- `StudentListGrid`: search + course + risk filters (`bg-[#0C2461]` active, risk dots red/amber/emerald + counts, `overflow-x-auto`); cards `grid 1/2/3/4 hover:shadow-lg hover:-translate-y-1 slideUp delay min(index*60,480)ms`; header `h-20 bg-[#0C2461]`, Sem badge `bg-white/15 backdrop-blur`, avatar `w-24 bg-[#1251AA] border-4 white`; `readOnly` hides Add; `onViewProfile` pushes profile route.
- `ReportFormModal`/`GenerateReportModal`: referral vs letter; counselor fetch + tomorrow-09:00 default vs auto title; priority toggle Normal blue vs Segera red; dropzones (`pdf/png/jpg` vs `pdf` only, 5MB via `useFilePreview`); `AttachmentPreview` inline; toasts `scaleIn`; submits blue vs emerald with spinner.
- `Sidebar`/`KpiCard`/`JobCard`/`AttachmentPreview`/dashboard-kit: drawer `duration-300 translate`, KPI `slideUp + skeleton-shimmer + bar duration-700`, job `group-hover` icon/CTA, attachment `scaleIn` + `object-contain`/iframe, kit `Badge scaleIn`, `StatCard/SectionCard slideUp`, `PillTabs rounded-full active shadow-blue`, `EmptyState floatSoft`, `SkeletonList shimmer`.

---

## 5. Data Flow & State Lifecycles

### How data flows from backend/API into components

1. **Login:** `LoginForm` → `loginAction(formData)` (server) → `POST BACKEND_URL/api/auth/login {email,password}` → `auth.model.authenticateUser` (Mongo `users` + `bcrypt.compare` + `jwt.sign 8h`) → `{user,token}` → server sets `user` + `ikmbToken` cookies → `redirect()` by `getDashboardPathForRole`. Client never sees JWT.
2. **Authenticated read:** Browser `fetch('/api/students', {credentials: include})` → Next `api/[...proxy]` reads `ikmbToken`, sets `Authorization: Bearer`, forwards to `BACKEND_URL/api/students` → Express `verifyToken` → handler scopes by `req.user` (`user` gets own `[student]`, staff gets all via `item.model.getAllStudents` with `normaliseStudent` + live ML override) → proxy streams JSON back → `useEffect` in `StaffDashboardClient`/`StudentDashboardClient`/`StudentProfileClient`/`CounselorDashboardClient`/`MergedLaporanTab` sets `useState` → `useMemo` derives charts/filters → render. Writes follow same path with `POST/PUT/PATCH/DELETE` + `FormData` for files.
3. **Risk inference:** `item.model.getRealAIPrediction({CGPA,Attendance,PLO_1..9,Sijil})` → `POST ML_API_URL/predict/risk` → FastAPI `RandomForest v4` (`CGPA,Avg_Subjek_Attendance,PLO_1..9,PLO_Avg,PLO_Variance`) → `Cemerlang|Sederhana|Bermasalah` → mapped to `Rendah|Sederhana|Tinggi` for UI (`getRiskMeta`/`RiskBadge`). Batch path `POST /predict/batch` used by ETL and `repredict-status.js`. Heuristic fallback on ML error: `attendance<80||cgpa<2→Tinggi; cgpa≥3.5→Rendah; else Sederhana`, plus `normaliseStudent` override preserving `Bermasalah→Tinggi`.
4. **MDB ETL:** Admin selects `.mdb` + `datasetName` → `POST /api/data/upload-mdb` (Multer 100MB, `.mdb` only, `MdbFile Saved`) → `POST /api/data/process-mdb/:id` (sets `Processing`, `FormData Blob` → `POST ML/etl/process-mdb` via `mdb-export` parsing GPA/Pelajar/Daftar_Subjek/Detail_Result/Anugerah/Koko → `POST ML/predict/batch` → `Student.deleteMany nin newIds` full replace + `bulkWrite upsert` Students + Users with `password123`) → `Processed/Failed`, `recordsProcessed`, `processedDate`. Frontend polls `GET /api/data/mdb-files` every 3s while `Processing`.
5. **AI chat:** Staff selects `aiStudentId` → types `aiInput` → `POST /api/ai/chat {studentId,userMessage,chatHistory}` (rate-limited 15/min, sanitized history, PII stripped, full student context + skill-gap server-side) → `callGeminiStreamAPI` SSE chunks decoded via `ReadableStream.getReader()` → appended to `aiMessages`, auto-scroll to `chatEndRef`; fallback JSON `{reply}` if stream fails.
6. **Referrals/letters:** Staff `ReportFormModal` → `POST /api/reports FormData` (validates counselor exists, sets `status:scheduled, adminEmail`) → counselor `GET /api/reports` → `PATCH .../:id {accepted/rejected/scheduled/completed/pending}` state machine → student `GET /api/reports/mine` sees `accepted/scheduled`. Staff `GenerateReportModal` → `POST /api/student-reports FormData` (PDF-only, derives `full/letter/message`, clamps employability) → student `GET /api/student-reports` + `GET .../:id` (sets `readByStudent`) → `MergedLaporanTab` merges both feeds sorted `displayDate desc`.
7. **Files:** Certificates/referrals/reports/profile-images stored under `backend/uploads/{certificates,referrals,reports}/` + `uploads/mdb/`, served statically and via `next.config.mjs` `/uploads/:path*` rewrite to `http://backend:5000`. Uploads validated by Multer (5MB except MDB 100MB; certs image+pdf, referrals image+pdf, reports PDF-only, MDB `.mdb` only) + `useFilePreview` client pre-check (5MB, ext+mime) + `AttachmentPreview` with `URL.createObjectURL`. Deletes guard path traversal and `safeUnlink` temp files on validation failure.

### Global state vs Local state handling

- No global store. Each dashboard client owns its slice: `StaffDashboardClient` (`user,students,isLoading,activeTab,searchTerm,formData,ai*,mdb*`), `StudentDashboardClient` (`user,students,selectedStudentId,skillGap,customCerts,newCert,activeTab`), `CounselorDashboardClient` (`reports,sentReports,activeTab,selectedReport,modalAction,scheduleDate,notes`), `StudentProfileClient` (`skillGap,loading,error,activeTab,currentUser,interventionModal,generateReportOpen`), `AppointmentCalendar` (`currentMonth,selectedDay,isMobile`), `MergedLaporanTab` (`items,isLoading,activeFilter,selectedItem`), modals (`title/message/reason/priority/dates/counselors/toast/isSubmitting`), `StudentListGrid` (`search/filter/riskFilter`), `Sidebar` (props only + `Escape`/overflow effects).
- Cross-cutting helpers are stateless: `getStoredUser/getToken/getDashboardPathForRole` (server cookies), `getClientUser/getClientToken` (document.cookie), `ROLES/getRoleLabel/isStaff`, `calculateEmployability/calculateTopPerformerScore`, `formatMsDate/Badge/StatCard/SectionCard/PillTabs/EmptyState/SkeletonList/getRiskMeta/RiskBadge`, `useFilePreview/formatFileSize`. Navigation state is URL (`/student-profile?id=`) + `router.push`, tab state is local `activeTab`.
- Server is source of truth; `useMemo`/`useCallback` derive filtered lists, counts, chart datasets, calendar cells, merged inbox without duplicating fetch logic. No optimistic updates; mutations await response then refetch (`fetchReports`, student list reload, inbox reload).

### Caching, local storage, or session persistence patterns

- **Cookies (primary persistence):** `user` (readable JSON, `maxAge: 86400`, `path:/`) for Edge middleware + client UI; `ikmbToken` (HttpOnly JWT, `secure` in prod, `sameSite: lax`, `maxAge: 86400`) for proxy auth. Both cleared on `logoutAction`. No `localStorage`/`sessionStorage` usage anywhere; `document.cookie` is only client read path.
- **No HTTP caching:** pages set `dynamic='force-dynamic'` (`page.jsx`, `student-dashboard`); proxy forwards without cache headers; `fetch` calls use default no-store server-action semantics. `useMemo` memoizes derived views per render only.
- **Ephemeral caches:** `URL.createObjectURL` previews revoked on file change/unmount; chat auto-scroll ref; MDB polling stops when no `Processing`; `MdbFile` crash recovery resets `Processing→Saved` on backend boot; `academicHistory` and `uploadedCertificates` persist in Mongo, not client.
- **Test isolation:** backend `NODE_ENV=test` skips DB connect/listen; frontend Vitest mocks `loginAction`/`useRouter`; ML tests hit live FastAPI `TestClient` with real `v4.pkl`.

---

Last Updated: 2026-10-04 13:08:10 UTC+8
