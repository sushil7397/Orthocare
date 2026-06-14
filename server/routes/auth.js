const { Router } = require("express");
const { v4: uuid } = require("uuid");
const db = require("../db");
const { hashPassword, verifyPassword, createToken, authenticate } = require("../auth");

const router = Router();

function userOut(u) {
  return { id: u.id, role: u.role, full_name: u.full_name, email: u.email, phone: u.phone || null };
}

router.post("/register", (req, res) => {
  const { full_name, email, password, phone, date_of_birth, role } = req.body;
  if (!full_name || !email || !password) {
    return res.status(400).json({ detail: "full_name, email, and password are required" });
  }
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return res.status(409).json({ detail: "Email already registered" });

  const id = uuid();
  const userRole = role || "patient";
  db.prepare(
    `INSERT INTO users (id, role, full_name, email, phone, date_of_birth, password_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userRole, full_name, email, phone || null, date_of_birth || null, hashPassword(password));

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  const token = createToken(user.id, user.role);
  res.status(201).json({ access_token: token, token_type: "bearer", user: userOut(user) });
});

// OAuth2-compatible login (form-urlencoded with username+password)
router.post("/login", (req, res) => {
  let email, password;
  // Support both JSON and form-urlencoded
  if (req.body.username) {
    email = req.body.username;
    password = req.body.password;
  } else {
    email = req.body.email;
    password = req.body.password;
  }
  if (!email || !password) return res.status(400).json({ detail: "Email and password required" });

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ detail: "Invalid email or password" });
  }
  const token = createToken(user.id, user.role);
  res.json({ access_token: token, token_type: "bearer", user: userOut(user) });
});

router.get("/me", authenticate, (req, res) => {
  res.json(userOut(req.user));
});

module.exports = router;
