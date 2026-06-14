const { Router } = require("express");
const db = require("../db");

const router = Router();

const URGENT_MSG = "Your answers suggest you should be seen promptly. We recommend booking an urgent appointment. If you have severe deformity, loss of sensation, or cannot bear weight, seek emergency care now.";
const ROUTINE_MSG = "Your symptoms may benefit from a clinical review. We suggest booking a routine consultation.";
const SELFCARE_MSG = "Your symptoms look mild. Try the self-care and prevention guidance below, and book a visit if things don't improve in 7-10 days.";

router.post("/", (req, res) => {
  const { body_region, pain_level, swelling, duration_days, trauma, numbness } = req.body;

  const urgent =
    (trauma && (swelling || pain_level >= 7)) || numbness || pain_level >= 9;
  const routine = pain_level >= 5 || swelling || duration_days >= 14;

  let triage, message;
  if (urgent) {
    triage = "urgent_booking";
    message = URGENT_MSG;
  } else if (routine) {
    triage = "routine_booking";
    message = ROUTINE_MSG;
  } else {
    triage = "self_care";
    message = SELFCARE_MSG;
  }

  const recs = db.prepare(
    "SELECT id FROM precaution_content WHERE is_published = 1 AND body_region = ? LIMIT 3"
  ).all(body_region || "");

  res.json({
    triage,
    message,
    recommended_content_ids: recs.map((r) => r.id),
  });
});

module.exports = router;
