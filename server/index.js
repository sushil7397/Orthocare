require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const express = require("express");
const cors = require("cors");
const path = require("path");
const nodemailer = require("nodemailer");
const { v4: uuid } = require("uuid");

const app = express();
const PORT = process.env.PORT || 8000;

// ---- Middleware ----
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "frontend")));

// ---- Email config ----
// Configure with your Gmail App Password (or any SMTP)
// Set these environment variables or edit directly for testing:
const DOCTOR_EMAIL = process.env.DOCTOR_EMAIL || "doctor@example.com";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";

function createTransporter() {
  if (!SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

// ---- Google Calendar link generator ----
function googleCalendarLink({ title, startDate, startTime, durationMin, description, location }) {
  // Format: YYYYMMDDTHHmmSS
  const start = startDate.replace(/-/g, "") + "T" + startTime.replace(/:/g, "") + "00";
  const [h, m] = startTime.split(":").map(Number);
  const endMin = h * 60 + m + (durationMin || 30);
  const eh = String(Math.floor(endMin / 60)).padStart(2, "0");
  const em = String(endMin % 60).padStart(2, "0");
  const end = startDate.replace(/-/g, "") + "T" + eh + em + "00";

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${start}/${end}`,
    details: description,
    location: location || "OrthoCare Clinic",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ---- Booking endpoint ----
app.post("/api/book", async (req, res) => {
  const { name, email, phone, date, time, visitType, reason, symptoms } = req.body;

  if (!name || !email || !date || !time) {
    return res.status(400).json({ error: "Name, email, date, and time are required." });
  }

  const bookingId = uuid().slice(0, 8).toUpperCase();

  const calLink = googleCalendarLink({
    title: `OrthoCare Appointment — ${name}`,
    startDate: date,
    startTime: time,
    durationMin: 30,
    description: [
      `Patient: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone || "N/A"}`,
      `Visit Type: ${visitType || "In-Clinic"}`,
      `Reason: ${reason || "General Consultation"}`,
      `Symptoms: ${symptoms || "N/A"}`,
      `Booking ID: ${bookingId}`,
    ].join("\n"),
    location: visitType === "telehealth" ? "Telehealth (Video Call)" : "OrthoCare Clinic, 123 Orthopedic Lane",
  });

  // Build email HTML
  const emailHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#0d3b4f,#1f7a8c);padding:24px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:22px;">New Appointment Request</h1>
        <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:14px;">Booking ID: ${bookingId}</p>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:0;">
        <table style="width:100%;font-size:14px;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#6b7280;width:120px;">Patient</td><td style="padding:8px 0;font-weight:600;">${name}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Email</td><td style="padding:8px 0;">${email}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Phone</td><td style="padding:8px 0;">${phone || "N/A"}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Date</td><td style="padding:8px 0;font-weight:600;">${date}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Time</td><td style="padding:8px 0;font-weight:600;">${time}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Visit Type</td><td style="padding:8px 0;">${visitType || "In-Clinic"}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Reason</td><td style="padding:8px 0;">${reason || "General Consultation"}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Symptoms</td><td style="padding:8px 0;">${symptoms || "N/A"}</td></tr>
        </table>
      </div>
      <div style="background:#f9fafb;padding:20px 24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;text-align:center;">
        <a href="${calLink}" style="display:inline-block;background:#1f7a8c;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
          Add to Google Calendar
        </a>
      </div>
    </div>
  `;

  // Try sending email
  const transporter = createTransporter();
  let emailSent = false;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"OrthoCare" <${SMTP_USER}>`,
        to: DOCTOR_EMAIL,
        subject: `New Appointment: ${name} — ${date} at ${time}`,
        html: emailHtml,
      });
      emailSent = true;
      console.log(`EMAIL SENT to ${DOCTOR_EMAIL} for booking ${bookingId}`);
    } catch (err) {
      console.error("Email send failed:", err.message);
    }
  } else {
    console.log(`EMAIL NOT CONFIGURED — Booking ${bookingId} logged:`);
    console.log(`  Patient: ${name} | ${email} | ${phone}`);
    console.log(`  Date: ${date} ${time} | Type: ${visitType} | Reason: ${reason}`);
    console.log(`  Calendar: ${calLink}`);
  }

  res.json({
    success: true,
    bookingId,
    calendarLink: calLink,
    emailSent,
    message: emailSent
      ? "Appointment request sent! The doctor will confirm shortly."
      : "Appointment received! You can add it to your calendar below.",
  });
});

// ---- Contact form endpoint ----
app.post("/api/contact", async (req, res) => {
  const { name, email, phone, message } = req.body;
  console.log(`CONTACT FORM: ${name} <${email}> — ${message}`);

  const transporter = createTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"OrthoCare Website" <${SMTP_USER}>`,
        to: DOCTOR_EMAIL,
        subject: `Contact Form: ${name}`,
        html: `<p><b>${name}</b> (${email}, ${phone || "no phone"}) wrote:</p><p>${message}</p>`,
      });
    } catch (err) {
      console.error("Contact email failed:", err.message);
    }
  }
  res.json({ success: true });
});

// ---- Content API (for blogs section) ----
const db = require("./db");
app.get("/api/content", (req, res) => {
  const { category, body_region } = req.query;
  let sql = "SELECT * FROM precaution_content WHERE is_published = 1";
  const params = [];
  if (category) { sql += " AND category = ?"; params.push(category); }
  if (body_region) { sql += " AND body_region = ?"; params.push(body_region); }
  sql += " ORDER BY created_at DESC";
  res.json(db.prepare(sql).all(...params));
});

app.get("/api/content/:id", (req, res) => {
  const item = db.prepare("SELECT * FROM precaution_content WHERE id = ?").get(req.params.id);
  if (!item) return res.status(404).json({ detail: "Content not found" });
  res.json(item);
});

// ---- Health check ----
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", database: "sqlite", email: !!SMTP_USER });
});

// ---- SPA fallback (non-API routes only) ----
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ detail: "Not found" });
  }
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n  OrthoCare running at http://localhost:${PORT}`);
  console.log(`  Database: SQLite | Email: ${SMTP_USER ? "configured" : "NOT configured (set SMTP_USER & SMTP_PASS)"}`);
  console.log(`  Doctor email: ${DOCTOR_EMAIL}\n`);
});
