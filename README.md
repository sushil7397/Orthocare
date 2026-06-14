# OrthoCare

Appointment booking + injury-prevention hub for an orthopedic surgeon's practice.
This repo contains a **runnable MVP foundation** plus the full **[technical blueprint](BLUEPRINT.md)**.

```
OrthoCare/
├── BLUEPRINT.md          # architecture, schema, API list, roadmap, compliance
├── README.md             # this file
├── backend/              # FastAPI + SQLAlchemy
│   ├── app/
│   │   ├── main.py       # app entry, routers, CORS, health
│   │   ├── config.py     # env settings (SQLite fallback for demo)
│   │   ├── database.py   # engine / session / Base
│   │   ├── models.py     # ORM models (mirror of sql/schema.sql)
│   │   ├── schemas.py    # Pydantic request/response models
│   │   ├── security.py   # bcrypt + JWT + role guards
│   │   ├── routers/      # auth, doctors, appointments, content, screener, records, recovery
│   │   └── services/     # scheduling (slot gen), locks (Redis), notifications
│   ├── sql/schema.sql    # production PostgreSQL DDL
│   ├── seed.py           # demo data + logins
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    └── index.html        # single-file React web client (no build step)
```

## Run the backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python seed.py                 # creates orthocare.db (SQLite) + demo data
uvicorn app.main:app --reload  # http://localhost:8000  ·  docs at /docs
```

No setup needed for a demo: leave `DATABASE_URL` empty and it uses a local **SQLite** file.
For production, copy `.env.example` → `.env` and point `DATABASE_URL` at PostgreSQL (and run
`sql/schema.sql` or wire up Alembic). Redis is optional in dev — the slot lock falls back to an
in-process lock and `/api/health` reports which backend is active.

**Demo logins** (after `seed.py`):
- Patient — `patient@orthocare.test` / `Passw0rd!`
- Doctor  — `doctor@orthocare.test` / `Passw0rd!`

## Run the frontend

The backend allows all CORS origins in dev, so just open the file:

```bash
# easiest: open frontend/index.html directly in a browser
# or serve it:
cd frontend && python -m http.server 5173   # then visit http://localhost:5173
```

It expects the API at `http://localhost:8000`. To point elsewhere, run this in the browser
console once: `localStorage.setItem('orthocare_api','https://your-api')` and reload.

## What works end-to-end in this MVP
Register/login (JWT) · browse doctors · real-time slot generation · book in-clinic/telehealth
with anti-double-booking · view/cancel appointments · prevention-hub content by category ·
non-diagnostic symptom screener with triage · recovery-plan enrollment + daily checklist.

## Status / honesty note
The backend was written but **not executed in this session** — the sandbox's Linux VM was
unavailable (host virtualization disabled), so I could not run `seed.py`/`uvicorn` to smoke-test.
The code was reviewed statically. If anything fails on first run, it'll be an environment/dependency
detail; the commands above are the intended path. See `BLUEPRINT.md` §5 for what's deliberately
left to Phase 2/3 (native mobile, real Twilio/Zoom, payments, admin console, migrations, tests).
```
```
