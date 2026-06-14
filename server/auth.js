const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const SECRET = process.env.JWT_SECRET || "dev-insecure-secret-change-me";
const ALG = "HS256";
const EXPIRES_IN = "1h";

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function createToken(userId, role) {
  return jwt.sign({ sub: userId, role }, SECRET, { algorithm: ALG, expiresIn: EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET, { algorithms: [ALG] });
}

/** Express middleware — attaches req.user */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ detail: "Missing or invalid token" });
  }
  try {
    const payload = verifyToken(header.slice(7));
    const db = require("./db");
    const user = db.prepare("SELECT id, role, full_name, email, phone, is_active FROM users WHERE id = ?").get(payload.sub);
    if (!user || !user.is_active) return res.status(401).json({ detail: "User not found or inactive" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ detail: "Could not validate credentials" });
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ detail: "Insufficient permissions" });
    }
    next();
  };
}

module.exports = { hashPassword, verifyPassword, createToken, authenticate, requireRoles };
