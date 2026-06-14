const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "orthocare.db");
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'patient' CHECK(role IN ('patient','doctor','admin')),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT NOT NULL,
    date_of_birth TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS doctors (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL REFERENCES users(id),
    specialty TEXT DEFAULT 'Orthopedic Surgery',
    bio TEXT,
    qualifications TEXT,
    consult_fee REAL DEFAULT 0,
    telehealth_enabled INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS availability_rules (
    id TEXT PRIMARY KEY,
    doctor_id TEXT NOT NULL REFERENCES doctors(id),
    weekday INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    slot_minutes INTEGER DEFAULT 30,
    mode TEXT DEFAULT 'in_clinic' CHECK(mode IN ('in_clinic','telehealth'))
  );

  CREATE TABLE IF NOT EXISTS time_off (
    id TEXT PRIMARY KEY,
    doctor_id TEXT NOT NULL REFERENCES doctors(id),
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    reason TEXT
  );

  CREATE TABLE IF NOT EXISTS reasons_for_visit (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    is_urgent_default INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES users(id),
    doctor_id TEXT NOT NULL REFERENCES doctors(id),
    reason_id TEXT REFERENCES reasons_for_visit(id),
    mode TEXT DEFAULT 'in_clinic' CHECK(mode IN ('in_clinic','telehealth')),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','completed','cancelled','no_show')),
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    symptoms TEXT,
    telehealth_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(doctor_id, starts_at)
  );

  CREATE TABLE IF NOT EXISTS medical_records (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES users(id),
    appointment_id TEXT REFERENCES appointments(id),
    record_type TEXT DEFAULT 'intake',
    title TEXT,
    notes TEXT,
    medications TEXT,
    file_key TEXT,
    file_sha256 TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS prescriptions (
    id TEXT PRIMARY KEY,
    appointment_id TEXT NOT NULL REFERENCES appointments(id),
    doctor_id TEXT NOT NULL REFERENCES doctors(id),
    body TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS precaution_content (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL CHECK(category IN ('sports_fitness','ergonomics','age_specific','post_op')),
    title TEXT NOT NULL,
    summary TEXT,
    body TEXT,
    media_type TEXT DEFAULT 'article',
    media_url TEXT,
    body_region TEXT,
    is_published INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recovery_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    duration_days INTEGER DEFAULT 42
  );

  CREATE TABLE IF NOT EXISTS recovery_tasks (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES recovery_plans(id),
    day_number INTEGER NOT NULL,
    kind TEXT DEFAULT 'exercise',
    instruction TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS patient_recoveries (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES users(id),
    plan_id TEXT NOT NULL REFERENCES recovery_plans(id),
    start_date TEXT DEFAULT (date('now')),
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS recovery_progress (
    id TEXT PRIMARY KEY,
    patient_recovery_id TEXT NOT NULL REFERENCES patient_recoveries(id),
    recovery_task_id TEXT NOT NULL REFERENCES recovery_tasks(id),
    completed_at TEXT DEFAULT (datetime('now')),
    UNIQUE(patient_recovery_id, recovery_task_id)
  );
`);

module.exports = db;
