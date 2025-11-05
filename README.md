Doc Locker — Smart Document Vault
=================================

Overview
--------
Doc Locker is a full‑stack document management system with AI‑generated one‑page user profiles. Users can sign up, log in, upload documents (PDF/JPG/PNG), and view a generated professional profile synthesized by Google Gemini from their uploaded content. Admins can audit, regenerate, and manage user data with role‑based access control.

Tech Stack
---------
- Frontend: React 18 + TypeScript, Vite, shadcn/ui (Radix), Tailwind CSS
- Backend: Flask 3, Flask‑SQLAlchemy, Flask‑CORS, PyMySQL
- AI: Google Gemini (gemini‑2.5‑flash)
- Database: MySQL 8.x

Repository Structure
--------------------
- backend/ — Flask app, models, routes, AI/processing
- frontend/ — React app and UI components
- backend/migrations/ — SQL migrations (e.g., admin/versioning schema)
- uploads/ — File storage (local dev)

Prerequisites
-------------
- Node.js 18+
- Python 3.10+ (3.13 supported)
- MySQL 8.x

Quick Start
-----------
1) Database
- Create DB:
  - CREATE DATABASE doclocker_db;
- Run migration for admin/versioning schema:
  - mysql -u root -p doclocker_db < backup.sql
- (Optional) To format database run:
  - mysql -u root -p doclocker_db < refresh_db.sql

2) Backend
- cd backend
- python3 -m venv venv && source venv/bin/activate
- pip install -r requirements.txt
- Export your Gemini key (or edit app.py default):
  - export GEMINI_API_KEY="<YOUR_KEY>"
- Configure DB url if needed (default is mysql+pymysql://root:password@localhost/doclocker_db). To override:
  - export DATABASE_URL="mysql+pymysql://root:<PASS>@127.0.0.1:3306/doclocker_db"
- Start server:
  - python3 app.py
- Server runs at http://localhost:5000

3) Frontend
- cd frontend
- npm install
- npm run dev
- Dev server: http://localhost:8080 (proxy to backend /api)

Environment
-----------
Backend respects environment variables:
- GEMINI_API_KEY — Google Gemini API key
- DATABASE_URL — SQLAlchemy URL (fallback in config.py)
- SECRET_KEY, JWT_SECRET_KEY — secrets for sessions/JWT (defaults provided for dev)

Security Notes (Current State)
------------------------------
- Development build. Passwords are stored in plaintext (per initial requirement). Do not use in production as-is.
- Files are stored locally in backend/uploads/ without encryption at rest (dev only).
- HTTPS/TLS termination not included (run behind a reverse proxy in prod).

Features — User
----------------
- Sign up, log in, log out (session-based)
- Upload documents: PDF/JPG/PNG with text extraction (PyPDF2 / Tesseract as available)
- View own documents; download protected by session
- AI one‑page profile (name, email, summary, education, skills, certifications, achievements)
- Regenerate Profile button (re-calls Gemini using a variation seed)

Features — Admin
-----------------
- Admin Dashboard (/admin/dashboard):
  - Search users by name/email, filter by status (All/Active/Locked), pagination
  - Masked emails on list (PII minimization)
  - Excludes admin accounts from the grid
- Admin User Detail (/admin/users/:id):
  - Overview tab only (Profile is integrated here):
    - User status, counts (files/failed), latest profile version
    - Actions: Lock/Unlock, Regenerate Profile
    - Renders the same one‑page profile layout as user panel
  - Files tab: list user files with Delete / Re-extract
  - Activity tab: audit log for admin actions

RBAC & Sessions
---------------
- Session-based auth; admin endpoints require role=admin (server‑enforced)
- Middleware updates users.last_active on authenticated requests

Profile Generation (AI)
-----------------------
- Uses gemini‑2.5‑flash
- On document upload, extracts text; profile is generated across all user docs (combined text)
- On-demand generation: If a profile is empty, endpoints regenerate on the fly
- Regeneration uses a random variation_seed to encourage different outputs

Admin Schema (Optional Migration)
---------------------------------
Run backend/migrations/2025_11_04_admin.sql to enable:
- users: role ('user'|'admin'), status ('active'|'locked'|'deleted'), last_active
- documents: mime_type, size_bytes, status ('uploaded'|'processing'|'done'|'failed') with index (user_id, status)
- profile_versions: versioned profiles keyed by (user_id, version)
- user_profile: current_version pointer (FK to profile_versions) — code also works without this column
- admin_events: audit trail for admin actions
- Optional: tags, user_tags, admin_notes, and view v_users_masked

API Endpoints (Selected)
------------------------
User-facing
- POST /api/signup — Register
- POST /api/login — Login
- POST /api/logout — Logout
- GET /api/verify — Session check
- GET /api/documents — List my documents
- POST /api/upload — Upload document
- GET /api/profile/:userId — Get current profile (auto-generate if empty)
- POST /api/profile/regenerate — Regenerate current user’s profile (AI)

Admin
- GET /api/admin/users — Paginated users list (search/status/sort)
- GET /api/admin/users/:id/overview — Summary & counts
- GET /api/admin/users/:id/profile — Current profile (versioned or fallback)
- GET /api/admin/users/:id/files — Paginated files
- GET /api/admin/users/:id/activity — Audit events
- POST /api/admin/users/:id/actions — { LOCK | UNLOCK | REGENERATE | DELETE_FILE | REEXTRACT }

Local Storage & Files
----------------------
- Uploads saved under backend/uploads/
- Backend serves downloads through protected routes (session required)

Development Tips
----------------
- If you see 401/403 on admin pages, re-login as an admin account
- If you see JSON parse errors in FE admin detail, backend likely returned HTML (auth error); the UI will show a clearer toast now
- If profiles look identical after regenerate, upload additional documents or modify content to provide more context for variation

Runbook
-------
1) DB: create DB and (optionally) run migration
2) Backend: install deps, set GEMINI_API_KEY, start server
3) Frontend: install, run dev, open http://localhost:8080
4) Promote admin user (SQL): UPDATE users SET role='admin' WHERE email='admin@doclocker.com';
5) Use /admin and /admin/users/:id to manage users and profiles

Testing (Backend)
-----------------
- pytest is configured; example tests in backend/tests/
- Run tests:
  - cd backend && source venv/bin/activate
  - pytest -q

Roadmap / Hardening for Production
----------------------------------
- Hash passwords (bcrypt/argon2)
- Encrypt files at rest (KMS/SSE), move storage to S3/GCS
- HTTPS/TLS, secure cookies, HSTS
- Secrets management and rotation
- Rate limiting for admin actions
- Background job queue for long AI tasks

License
-------
For internal/educational use. Review and adjust before any production deployment.


