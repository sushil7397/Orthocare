const { Router } = require("express");
const { v4: uuid } = require("uuid");
const db = require("../db");
const { authenticate } = require("../auth");
const { availableSlots, slotMinutes } = require("../scheduling");

const router = Router();

router.get("/reasons", (req, res) => {
  const reasons = db.prepare("SELECT * FROM reasons_for_visit").all();
  res.json(reasons.map((r) => ({
    id: r.id,
    label: r.label,
    is_urgent_default: !!r.is_urgent_default,
  })));
});

router.post("/appointments", authenticate, (req, res) => {
  const { doctor_id, reason_id, starts_at, mode, symptoms } = req.body;

  const doctor = db.prepare("SELECT id FROM doctors WHERE id = ?").get(doctor_id);
  if (!doctor) return res.status(404).json({ detail: "Doctor not found" });

  // Validate slot is open
  const day = starts_at.slice(0, 10);
  const openSlots = availableSlots(doctor_id, day);
  const openStarts = new Set(openSlots.map((s) => s.starts_at));
  if (!openStarts.has(starts_at)) {
    return res.status(409).json({ detail: "Slot is not available" });
  }

  // Compute end time
  const d = new Date(starts_at);
  const weekday = (d.getDay() + 6) % 7;
  const mins = slotMinutes(doctor_id, weekday);
  const endDate = new Date(d.getTime() + mins * 60000);
  const ends_at = endDate.toISOString().replace(/\.\d{3}Z$/, "").replace("Z", "");

  const id = uuid();
  const visitMode = mode || "in_clinic";
  let telehealthUrl = null;
  if (visitMode === "telehealth") {
    telehealthUrl = `https://video.orthocare.example/room/${id}`;
  }

  try {
    db.prepare(
      `INSERT INTO appointments (id, patient_id, doctor_id, reason_id, mode, status, starts_at, ends_at, symptoms, telehealth_url)
       VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?)`
    ).run(id, req.user.id, doctor_id, reason_id || null, visitMode, starts_at, ends_at, symptoms || null, telehealthUrl);
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      return res.status(409).json({ detail: "Slot just got taken" });
    }
    throw err;
  }

  const appt = db.prepare("SELECT * FROM appointments WHERE id = ?").get(id);
  console.log(`CONFIRMATION -> appointment ${appt.id} at ${appt.starts_at}`);
  res.status(201).json(appt);
});

router.get("/appointments/me", authenticate, (req, res) => {
  let appts;
  if (req.user.role === "patient") {
    appts = db.prepare("SELECT * FROM appointments WHERE patient_id = ? ORDER BY starts_at DESC").all(req.user.id);
  } else if (req.user.role === "doctor") {
    const doc = db.prepare("SELECT id FROM doctors WHERE user_id = ?").get(req.user.id);
    appts = doc
      ? db.prepare("SELECT * FROM appointments WHERE doctor_id = ? ORDER BY starts_at DESC").all(doc.id)
      : [];
  } else {
    appts = db.prepare("SELECT * FROM appointments ORDER BY starts_at DESC").all();
  }
  res.json(appts);
});

router.post("/appointments/:id/cancel", authenticate, (req, res) => {
  const appt = db.prepare("SELECT * FROM appointments WHERE id = ?").get(req.params.id);
  if (!appt) return res.status(404).json({ detail: "Appointment not found" });

  const isOwner = appt.patient_id === req.user.id;
  const isStaff = ["doctor", "admin"].includes(req.user.role);
  if (!isOwner && !isStaff) return res.status(403).json({ detail: "Not allowed" });

  db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(appt.id);
  const updated = db.prepare("SELECT * FROM appointments WHERE id = ?").get(appt.id);
  res.json(updated);
});

module.exports = router;
