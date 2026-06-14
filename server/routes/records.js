const { Router } = require("express");
const { v4: uuid } = require("uuid");
const db = require("../db");
const { authenticate } = require("../auth");

const router = Router();

router.post("/upload-url", authenticate, (req, res) => {
  const { filename, content_type } = req.query;
  const key = `phi/${req.user.id}/${uuid()}-${filename || "file"}`;
  res.json({
    upload_url: `https://storage.orthocare.example/${key}?X-Amz-Signature=STUB`,
    file_key: key,
    expires_in: 900,
  });
});

router.post("/", authenticate, (req, res) => {
  const { appointment_id, record_type, title, notes, medications, file_key, file_sha256 } = req.body;
  const id = uuid();
  db.prepare(
    `INSERT INTO medical_records (id, patient_id, appointment_id, record_type, title, notes, medications, file_key, file_sha256)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, req.user.id, appointment_id || null, record_type || "intake", title || null, notes || null, medications || null, file_key || null, file_sha256 || null);

  const rec = db.prepare("SELECT * FROM medical_records WHERE id = ?").get(id);
  res.status(201).json(rec);
});

router.get("/patient/:patientId", authenticate, (req, res) => {
  if (req.user.role === "patient" && req.user.id !== req.params.patientId) {
    return res.status(403).json({ detail: "Not allowed" });
  }
  const records = db.prepare(
    "SELECT * FROM medical_records WHERE patient_id = ? ORDER BY created_at DESC"
  ).all(req.params.patientId);
  res.json(records);
});

module.exports = router;
