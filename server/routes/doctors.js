const { Router } = require("express");
const db = require("../db");
const { availableSlots } = require("../scheduling");

const router = Router();

router.get("/", (req, res) => {
  const docs = db.prepare("SELECT * FROM doctors").all();
  res.json(docs.map((d) => ({
    id: d.id,
    specialty: d.specialty,
    bio: d.bio,
    qualifications: d.qualifications,
    consult_fee: d.consult_fee,
    telehealth_enabled: !!d.telehealth_enabled,
  })));
});

router.get("/:id", (req, res) => {
  const doc = db.prepare("SELECT * FROM doctors WHERE id = ?").get(req.params.id);
  if (!doc) return res.status(404).json({ detail: "Doctor not found" });
  res.json({
    id: doc.id,
    specialty: doc.specialty,
    bio: doc.bio,
    qualifications: doc.qualifications,
    consult_fee: doc.consult_fee,
    telehealth_enabled: !!doc.telehealth_enabled,
  });
});

router.get("/:id/slots", (req, res) => {
  const doc = db.prepare("SELECT id FROM doctors WHERE id = ?").get(req.params.id);
  if (!doc) return res.status(404).json({ detail: "Doctor not found" });
  const { day, mode } = req.query;
  if (!day) return res.status(400).json({ detail: "day query parameter required (YYYY-MM-DD)" });
  const slots = availableSlots(doc.id, day, mode || null);
  res.json(slots);
});

module.exports = router;
