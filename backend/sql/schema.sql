-- OrthoCare — PostgreSQL schema (production reference)
-- Mirrors app/models.py. Run against a fresh database.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- ---------- Enums ----------
CREATE TYPE role            AS ENUM ('patient','doctor','admin');
CREATE TYPE visit_mode      AS ENUM ('in_clinic','telehealth');
CREATE TYPE appt_status     AS ENUM ('pending','confirmed','completed','cancelled','no_show');
CREATE TYPE content_category AS ENUM ('sports_fitness','ergonomics','age_specific','post_op');

-- ---------- Users & roles ----------
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role          role NOT NULL DEFAULT 'patient',
    full_name     VARCHAR(160) NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    phone         VARCHAR(32),
    password_hash VARCHAR(255) NOT NULL,
    date_of_birth DATE,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_users_role ON users(role);

CREATE TABLE doctors (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    specialty          VARCHAR(120) DEFAULT 'Orthopedic Surgery',
    bio                TEXT,
    qualifications     VARCHAR(255),
    consult_fee        NUMERIC(10,2) DEFAULT 0,
    telehealth_enabled BOOLEAN DEFAULT TRUE
);

-- ---------- Scheduling ----------
CREATE TABLE availability_rules (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id    UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    weekday      SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),  -- 0=Mon
    start_time   TIME NOT NULL,
    end_time     TIME NOT NULL,
    slot_minutes INT DEFAULT 30,
    mode         visit_mode DEFAULT 'in_clinic'
);
CREATE INDEX idx_avail_doctor ON availability_rules(doctor_id);

CREATE TABLE time_off (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at   TIMESTAMPTZ NOT NULL,
    reason    VARCHAR(255)
);

CREATE TABLE reasons_for_visit (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label             VARCHAR(120) NOT NULL,
    is_urgent_default BOOLEAN DEFAULT FALSE
);

-- ---------- Appointments ----------
CREATE TABLE appointments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id    UUID NOT NULL REFERENCES users(id),
    doctor_id     UUID NOT NULL REFERENCES doctors(id),
    reason_id     UUID REFERENCES reasons_for_visit(id),
    mode          visit_mode DEFAULT 'in_clinic',
    status        appt_status DEFAULT 'pending',
    starts_at     TIMESTAMPTZ NOT NULL,
    ends_at       TIMESTAMPTZ NOT NULL,
    symptoms      TEXT,
    telehealth_url VARCHAR(512),
    created_at    TIMESTAMPTZ DEFAULT now(),
    -- Hard guard against double-booking the same doctor at the same instant.
    CONSTRAINT uq_doctor_slot UNIQUE (doctor_id, starts_at)
);
CREATE INDEX idx_appt_patient ON appointments(patient_id);
CREATE INDEX idx_appt_doctor_time ON appointments(doctor_id, starts_at);
CREATE INDEX idx_appt_status ON appointments(status);

-- ---------- Medical records ----------
CREATE TABLE medical_records (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id),
    record_type    VARCHAR(60) DEFAULT 'intake',   -- intake|xray|mri|note
    title          VARCHAR(200),
    notes          TEXT,
    medications    TEXT,
    file_key       VARCHAR(512),                    -- pointer to encrypted object store
    file_sha256    CHAR(64),
    created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_records_patient ON medical_records(patient_id);

CREATE TABLE prescriptions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    doctor_id      UUID NOT NULL REFERENCES doctors(id),
    body           TEXT NOT NULL,
    created_at     TIMESTAMPTZ DEFAULT now()
);

-- ---------- Precaution & prevention hub ----------
CREATE TABLE precaution_content (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category     content_category NOT NULL,
    title        VARCHAR(200) NOT NULL,
    summary      VARCHAR(500),
    body         TEXT,
    media_type   VARCHAR(20) DEFAULT 'article',     -- article|video|gif
    media_url    VARCHAR(512),
    body_region  VARCHAR(60),                        -- knee|back|shoulder...
    is_published BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_content_cat ON precaution_content(category);
CREATE INDEX idx_content_pub ON precaution_content(is_published);

-- ---------- Recovery tracking ----------
CREATE TABLE recovery_plans (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(160) NOT NULL,
    description   TEXT,
    duration_days INT DEFAULT 42
);

CREATE TABLE recovery_tasks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id     UUID NOT NULL REFERENCES recovery_plans(id) ON DELETE CASCADE,
    day_number  INT NOT NULL,
    kind        VARCHAR(20) DEFAULT 'exercise',       -- exercise|avoid|checkin
    instruction TEXT NOT NULL
);

CREATE TABLE patient_recoveries (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id    UUID NOT NULL REFERENCES recovery_plans(id),
    start_date DATE DEFAULT CURRENT_DATE,
    active     BOOLEAN DEFAULT TRUE
);

CREATE TABLE recovery_progress (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_recovery_id UUID NOT NULL REFERENCES patient_recoveries(id) ON DELETE CASCADE,
    recovery_task_id    UUID NOT NULL REFERENCES recovery_tasks(id),
    completed_at        TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_recovery_task_done UNIQUE (patient_recovery_id, recovery_task_id)
);

-- ---------- Audit log (HIPAA/GDPR access trail) ----------
CREATE TABLE audit_log (
    id         BIGSERIAL PRIMARY KEY,
    actor_id   UUID REFERENCES users(id),
    action     VARCHAR(80) NOT NULL,        -- e.g. 'record.view'
    target     VARCHAR(120),                -- e.g. 'medical_record:<id>'
    ip         INET,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_audit_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_time ON audit_log(created_at);
