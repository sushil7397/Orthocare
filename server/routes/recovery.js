const { Router } = require("express");
const { v4: uuid } = require("uuid");
const db = require("../db");
const { authenticate } = require("../auth");

const router = Router();

router.get("/plans", (req, res) => {
  const plans = db.prepare("SELECT * FROM recovery_plans").all();
  res.json(plans.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    duration_days: p.duration_days,
  })));
});

router.post("/enroll/:planId", authenticate, (req, res) => {
  const plan = db.prepare("SELECT id FROM recovery_plans WHERE id = ?").get(req.params.planId);
  if (!plan) return res.status(404).json({ detail: "Plan not found" });

  const id = uuid();
  db.prepare(
    "INSERT INTO patient_recoveries (id, patient_id, plan_id) VALUES (?, ?, ?)"
  ).run(id, req.user.id, plan.id);

  const pr = db.prepare("SELECT * FROM patient_recoveries WHERE id = ?").get(id);
  res.json({ patient_recovery_id: pr.id, start_date: pr.start_date });
});

router.get("/my-tasks", authenticate, (req, res) => {
  const pr = db.prepare(
    "SELECT * FROM patient_recoveries WHERE patient_id = ? AND active = 1 LIMIT 1"
  ).get(req.user.id);
  if (!pr) return res.json([]);

  const done = new Set(
    db.prepare("SELECT recovery_task_id FROM recovery_progress WHERE patient_recovery_id = ?")
      .all(pr.id)
      .map((r) => r.recovery_task_id)
  );

  const tasks = db.prepare(
    "SELECT * FROM recovery_tasks WHERE plan_id = ? ORDER BY day_number"
  ).all(pr.plan_id);

  res.json(tasks.map((t) => ({
    id: t.id,
    day_number: t.day_number,
    kind: t.kind,
    instruction: t.instruction,
    completed: done.has(t.id),
  })));
});

router.post("/complete/:taskId", authenticate, (req, res) => {
  const pr = db.prepare(
    "SELECT * FROM patient_recoveries WHERE patient_id = ? AND active = 1 LIMIT 1"
  ).get(req.user.id);
  if (!pr) return res.status(404).json({ detail: "No active recovery plan" });

  const exists = db.prepare(
    "SELECT id FROM recovery_progress WHERE patient_recovery_id = ? AND recovery_task_id = ?"
  ).get(pr.id, req.params.taskId);

  if (!exists) {
    db.prepare(
      "INSERT INTO recovery_progress (id, patient_recovery_id, recovery_task_id) VALUES (?, ?, ?)"
    ).run(uuid(), pr.id, req.params.taskId);
  }

  res.json({ status: "completed", task_id: req.params.taskId });
});

module.exports = router;
