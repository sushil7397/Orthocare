# OrthoCare — Technical Blueprint

A web + mobile platform for an orthopedic surgeon's practice, built around two pillars:
**(1) seamless appointment booking** and **(2) a proactive injury-prevention & precaution hub**.

This document is the architecture and roadmap. A runnable MVP foundation (FastAPI backend +
web frontend) ships alongside it in `backend/` and `frontend/` — see `README.md` to run it.

---

## 1. System Architecture

### 1.1 High-level topology

```
                          ┌──────────────────────────────────────────┐
   Patients (mobile)      │                CLIENTS                    │
   ┌──────────────┐       │  React Native app (iOS/Android)           │
   │ React Native │──────►│  Next.js web app (patients)               │
   └──────────────┘       │  Next.js admin/doctor console             │
   Doctor / Admin (web)   └───────────────┬──────────────────────────┘
   ┌──────────────┐                       │ HTTPS / JSON (JWT)
   │   Next.js    │──────►  API Gateway / CDN (TLS, WAF, rate limit)
   └──────────────┘                       │
                                          ▼
                         ┌────────────────────────────────────┐
                         │     FastAPI application (stateless)  │
                         │  auth · scheduling · content · ...   │
                         └───┬───────────┬───────────┬─────────┘
                             │           │           │
            ┌────────────────┘     ┌─────┘     ┌─────┴─────────────┐
            ▼                      ▼           ▼                   ▼
     PostgreSQL (RDS)       Redis (locks/    Object store      Background worker
     relational PHI         cache/queues)    S3 (SSE-KMS)      (Celery/RQ)
                                              encrypted X-ray/   reminders, emails,
                                              MRI uploads        SMS, push, follow-ups
```

### 1.2 Components

**Frontend**
- **Mobile (patients): React Native (Expo).** One codebase for iOS + Android — the right call because users consume fitness/precaution tips on the go. Push via FCM/APNs.
- **Web (patients) + Admin/Doctor console: Next.js (React).** SSR for SEO on the public prevention-hub content; the doctor/admin console is an authenticated SPA area.
- Shared design system and a generated TypeScript API client (from the OpenAPI schema FastAPI emits).

**Backend**
- **FastAPI (Python).** Async, automatic OpenAPI docs, Pydantic validation. Stateless app servers behind a load balancer so they scale horizontally.
- **Auth:** JWT access tokens + refresh tokens; role-based access control (patient / doctor / admin). Passwords hashed with bcrypt.
- **Scheduling engine:** generates open slots from recurring availability rules minus booked appointments and time-off; a Redis lock plus a DB `UNIQUE(doctor_id, starts_at)` constraint together prevent double-booking.
- **Background worker (Celery or RQ on Redis):** reminders (24 h before), confirmations, follow-ups, and any heavy/slow work kept off the request path.

**Data**
- **PostgreSQL** — all relational/transactional data (users, appointments, records, content).
- **Redis** — slot locks, hot caches (doctor lists, published content), and the job queue.
- **Object storage (S3 or equivalent), encrypted with SSE-KMS** — large PHI blobs (X-ray/MRI/PDFs). The database stores only a pointer (`file_key`) + checksum; uploads/downloads use short-lived pre-signed URLs so PHI never transits the app servers.

**Third-party integrations**
- **Video consults:** Twilio Programmable Video (token-per-room) or the Zoom Meeting SDK. The API creates a room at booking time and stores the join URL on the appointment.
- **Notifications:** Twilio / MSG91 (SMS), SendGrid / Amazon SES (email), FCM + APNs (push).
- **Payments (Phase 2):** Stripe / Razorpay for consult fees and deposits.
- **Observability:** OpenTelemetry traces, Sentry for errors, structured JSON logs shipped to a SIEM.

---

## 2. Database Schema (PostgreSQL)

Full DDL lives in `backend/sql/schema.sql`; the SQLAlchemy ORM mirror is `backend/app/models.py`.
The five core tables the brief asked for, summarized:

### `users`  (patients, doctors, admins — single table + `role`)
| column | type | notes |
|---|---|---|
| id | UUID PK | |
| role | enum(patient,doctor,admin) | RBAC |
| full_name, email (unique), phone | varchar | |
| password_hash | varchar | bcrypt |
| date_of_birth | date | |
| is_active, created_at | bool, timestamptz | |

### `doctors`  (1:1 extension of a user with `role=doctor`)
`id`, `user_id → users`, `specialty`, `bio`, `qualifications`, `consult_fee`, `telehealth_enabled`.
Supporting: `availability_rules` (recurring weekly templates), `time_off` (overrides/holidays),
`reasons_for_visit` (Knee Pain, Fracture Follow-up, Sports Injury, …).

### `appointments`
`id`, `patient_id → users`, `doctor_id → doctors`, `reason_id`, `mode` (in_clinic/telehealth),
`status` (pending/confirmed/completed/cancelled/no_show), `starts_at`, `ends_at`, `symptoms`,
`telehealth_url`, `created_at`.
**`UNIQUE(doctor_id, starts_at)`** is the hard anti-double-booking guard.

### `medical_records`  (digital intake + imaging pointers)
`id`, `patient_id → users`, `appointment_id`, `record_type` (intake/xray/mri/note),
`title`, `notes`, `medications`, `file_key` (encrypted object-store pointer),
`file_sha256` (integrity), `created_at`. Companion: `prescriptions`.

### `precaution_content`  (prevention hub)
`id`, `category` enum (sports_fitness / ergonomics / age_specific / post_op),
`title`, `summary`, `body`, `media_type` (article/video/gif), `media_url`,
`body_region` (knee/back/shoulder/…), `is_published`, `created_at`.

### Recovery tracking
`recovery_plans` → `recovery_tasks` (per-day exercise/avoid/checkin) → `patient_recoveries`
(assignment) → `recovery_progress` (per-task completion, unique per patient+task).

### Compliance
`audit_log` (actor, action, target, ip, time) records every PHI access for HIPAA/GDPR trails.

---

## 3. API Endpoints (REST)

Base path `/api`. Auth via `Authorization: Bearer <jwt>`. Interactive docs at `/docs`.

**Auth**
- `POST /auth/register` — create account → token
- `POST /auth/login` — OAuth2 password form → token
- `GET  /auth/me` — current user

**Doctors & availability**
- `GET  /doctors` · `GET /doctors/{id}`
- `GET  /doctors/{id}/slots?day=YYYY-MM-DD&mode=` — real-time open slots

**Booking**
- `GET  /reasons` — reasons for visit
- `POST /appointments` — book (validates slot, Redis lock, creates telehealth room)
- `GET  /appointments/me` — my appointments (patient) / my schedule (doctor)
- `POST /appointments/{id}/cancel`

**Medical records / intake**
- `POST /records/upload-url` — pre-signed encrypted-upload URL
- `POST /records` — save intake / imaging pointer + medications
- `GET  /records/patient/{patient_id}` — owner or clinician only

**Prevention hub**
- `GET  /content?category=&body_region=` · `GET /content/{id}`
- `POST /content` — create (doctor/admin)

**Symptom pre-screener**
- `POST /screener` — non-diagnostic triage → self_care | routine_booking | urgent_booking + content suggestions

**Recovery**
- `GET  /recovery/plans` · `POST /recovery/enroll/{plan_id}`
- `GET  /recovery/my-tasks` · `POST /recovery/complete/{task_id}`

**Ops**
- `GET /api/health`

---

## 4. Data Privacy & Compliance

Designed to satisfy **HIPAA** (US) and **GDPR** (EU/UK) simultaneously; the same controls map onto
India's DPDP Act / ABDM if that's the target market.

**Encryption**
- In transit: TLS 1.2+ everywhere; HSTS; certificate pinning in the mobile app.
- At rest: PostgreSQL encrypted (KMS-managed keys); object store with SSE-KMS for every X-ray/MRI.
- Imaging uploads use short-lived pre-signed URLs — PHI bypasses app servers entirely. Each object is checksummed (SHA-256) for integrity.
- Application-level field encryption for the most sensitive free-text PHI is a Phase-2 hardening step.

**Access control & accountability**
- RBAC (patient / doctor / admin); patients can read only their own records.
- Every PHI read/write is written to `audit_log` (who, what, when, source IP) — immutable, shipped to a SIEM.
- Principle of least privilege for service credentials; secrets in a vault (AWS Secrets Manager), never in code.

**Governance**
- Sign **BAAs** with every vendor touching PHI (cloud host, Twilio/Zoom, SendGrid, SMS gateway). Use HIPAA-eligible service tiers only.
- GDPR: explicit consent capture, data-subject access/erasure endpoints (Phase 2), documented data-residency and a defined retention schedule.
- Network: private subnets for DB/Redis, WAF + rate limiting at the edge, automated dependency/secret scanning in CI.
- Backups encrypted and tested; documented incident-response and breach-notification runbook.

> The symptom screener is explicitly **non-diagnostic** and must carry a visible medical disclaimer;
> triage thresholds should be reviewed and signed off by the supervising clinician.

---

## 5. Development Roadmap

### MVP (≈ weeks 1–8) — *foundation shipped in this repo*
- Accounts + JWT auth + RBAC (patient/doctor). ✅
- Doctor profile, recurring availability, real-time slot generation. ✅
- Booking flow: reason → slot → symptoms → confirm, with anti-double-booking (lock + DB constraint). ✅
- In-clinic + telehealth appointment modes (video room link stub). ✅
- Prevention hub: categorized content browse/read. ✅
- Non-diagnostic symptom pre-screener with triage routing. ✅
- Recovery plans: enroll + daily checklist completion. ✅
- Web client exercising all of the above. ✅
- *To finish MVP:* email/SMS confirmations live (worker), Alembic migrations, automated tests, deploy to staging.

### Phase 2 (≈ weeks 9–16) — engagement & operations
- React Native mobile app with push notifications.
- Real Twilio/Zoom video integration; in-app pre-call test.
- 24 h reminders + follow-ups via background worker.
- Clinic-admin console: check-in, schedule overrides, no-show handling.
- Digital prescriptions; secure imaging upload UI with viewer.
- Payments (Stripe/Razorpay): consult fees, deposits, refunds.
- GDPR data-export & erasure; field-level PHI encryption.

### Phase 3 (≈ weeks 17+) — scale & intelligence
- Multi-doctor / multi-clinic tenancy and role expansion.
- Analytics dashboards (utilization, no-show rates, content engagement).
- Smarter screener (clinician-tuned rules → optional ML triage assist, human-in-the-loop).
- Wearable / Apple Health / Google Fit integration for recovery adherence.
- EHR interoperability (FHIR / ABDM), e-prescription network, insurance claims.
- Localization, accessibility (WCAG 2.1 AA) audit, and load/penetration testing.
```
```
