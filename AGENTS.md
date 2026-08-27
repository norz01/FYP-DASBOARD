# AGENTS.md — Guide for AI Coding Assistants

This document gives AI agents the context needed to work safely and effectively in this
repository. Read this before making changes.

## Project at a glance
Full-stack FYP dashboard for IKMB (Malaysian TVET college). **UI language is Bahasa
Melayu.** Four services: React frontend, Express backend, FastAPI ML microservice,
MongoDB. Orchestration via `compose.yml`.

## Repository map
```
src/                 React SPA (pages/, components/, utils/)
backend/             Express API (server.js, auth.js, items.js, models/, seed.js)
backend/db/          Ekspot_Senat.mdb + ETL scripts + data files
ML/                  FastAPI service (ml.py, train_and_evaluate.py, *.pkl)
compose.yml          4-service orchestration
Containerfile.frontend, nginx.conf
.github/workflows/ci.yml
```

## Commands
```bash
# Frontend (repo root)
npm run dev          # dev server
npm run build        # production build
npm test             # Vitest

# Backend
cd backend
npm run dev          # nodemon
npm run seed         # seed MongoDB from db/data_tvet_muktamad.json
npm test             # Jest + Supertest (cross-env NODE_ENV=test)

# ML
cd ML
uvicorn ml:app --port 8000
pytest test_ml.py
```

## Conventions you MUST follow
- **Database field names are Malay** (`ID_Pelajar`, `Nama`, `Kursus`, `Kehadiran_Pct`,
  `CGPA`, `Sijil_Profesional`, `PLO_1`..`PLO_9`). They are stored as **strings** in
  MongoDB and parsed to numbers at read time (`backend/item.model.js` → `normaliseStudent`).
- **API responses** use normalized English-ish keys (`id`, `nama`, `kursus`, `attendance`,
  `cgpa`, `plo1`..`plo9`, `dropoutRisk`). Keep this mapping consistent.
- **Risk mapping**: `Bermasalah→Tinggi`, `Sederhana→Sederhana`, `Cemerlang→Rendah`.
  Overrides: `attendance<80 || cgpa<2.0 → Tinggi`; `cgpa>=3.5 → Rendah`.
- **UI text must be in Bahasa Melayu.** Keep user-facing strings in BM.
- Backend routes live under `/api` and are guarded by `verifyToken` (JWT Bearer).

## Data / ETL gotchas
- The MDB student master table is **lowercase `pelajar`** (NOT `Pelajar`). `mdb-export`
  is case-sensitive. Other tables: `GPA`, `Daftar_Subjek`, `Detail_Result`, `Anugerah`,
  `Pelajar_Koko_Detail`, `Layak_Sijil`.
- Student addresses contain **embedded commas and newlines**. Always parse MDB exports
  with a real CSV parser (`csv.DictReader` / pandas), never line-splitting.
- `ML/ml.py` `process_mdb_data()` keys students off the `GPA` table first; a student must
  have at least one GPA record to appear in the output.
- The trained model is **`model_ai_risiko_lengkap_v3.pkl`** (v3). Do not switch to v2 or
  `model_ai_tvet_besut.pkl` without updating `MODEL_PATH`.
- The ML feature set must exactly match training columns:
  `CGPA, Avg_Subjek_Attendance, PLO_1..PLO_9, PLO_Avg, PLO_Variance`.

## Security rules (do NOT violate)
- **Never commit `backend/.env`** — it contains a real `JWT_SECRET`. It is gitignored.
- The legacy `backend/db/login_users.json` (plaintext passwords) has been **deleted**.
  Do not reintroduce plaintext credentials. Auth uses **bcrypt** via `backend/auth.model.js`.
- Student passwords reset to `password123` on every MDB sync (upsert `$set`). Be aware
  before changing this behavior.

## Known pitfalls / tech debt
- `GET /api/auth/users` is currently **unprotected** (returns emails/roles). Consider
  protecting it if you touch auth.
- `GET /students` returns the full collection to any logged-in user; the student
  dashboard filters client-side. Data-exposure risk — tighten if you add role checks.
- `StudentModal.jsx` course dropdown **omits `SED`** (exists in data). Add it if you edit
  that component.
- Employability % in the UI is a fixed heuristic `(CGPA/4)*40 + attendance*0.6`;
  StaffDashboard "Top Performers" uses a different formula `(CGPA/4)*60 + attendance*0.4`.
- `sedut_mdb_tulen.py` and `inspect_mdb_linux.py` now live in `backend/db/` and resolve
  the MDB path via `os.path.dirname(__file__)`. Keep that pattern.
- Compose `start:prod` does **not** auto-seed. Seed via MDB upload in the UI or
  `npm run seed`.

## Testing expectations
Any change to auth, student CRUD, or the ML contract should keep these green:
- Frontend: `src/__tests__/Login.test.jsx`
- Backend: `backend/__tests__/auth.test.js`, `backend/__tests__/items.test.js`
- ML: `ML/test_ml.py`