const { Router } = require("express");
const { v4: uuid } = require("uuid");
const db = require("../db");
const { authenticate, requireRoles } = require("../auth");

const router = Router();

router.get("/", (req, res) => {
  const { category, body_region } = req.query;
  let sql = "SELECT * FROM precaution_content WHERE is_published = 1";
  const params = [];
  if (category) {
    sql += " AND category = ?";
    params.push(category);
  }
  if (body_region) {
    sql += " AND body_region = ?";
    params.push(body_region);
  }
  sql += " ORDER BY created_at DESC";
  const items = db.prepare(sql).all(...params);
  res.json(items);
});

router.get("/:id", (req, res) => {
  const item = db.prepare("SELECT * FROM precaution_content WHERE id = ?").get(req.params.id);
  if (!item) return res.status(404).json({ detail: "Content not found" });
  res.json(item);
});

router.post("/", authenticate, requireRoles("doctor", "admin"), (req, res) => {
  const { category, title, summary, body, media_type, media_url, body_region } = req.body;
  const id = uuid();
  db.prepare(
    `INSERT INTO precaution_content (id, category, title, summary, body, media_type, media_url, body_region)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, category, title, summary || null, body || null, media_type || "article", media_url || null, body_region || null);

  const item = db.prepare("SELECT * FROM precaution_content WHERE id = ?").get(id);
  res.status(201).json(item);
});

module.exports = router;
