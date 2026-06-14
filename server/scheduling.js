const db = require("./db");

/**
 * Generate available slots for a doctor on a given day.
 * Subtracts booked appointments and time-off blocks.
 */
function availableSlots(doctorId, dayStr, mode) {
  const dayDate = new Date(dayStr + "T00:00:00");
  const weekday = (dayDate.getDay() + 6) % 7; // JS: 0=Sun, convert to 0=Mon

  let rules = db.prepare(
    "SELECT * FROM availability_rules WHERE doctor_id = ? AND weekday = ?"
  ).all(doctorId, weekday);

  if (mode) {
    rules = rules.filter((r) => r.mode === mode);
  }

  const dayStart = dayStr + "T00:00:00";
  const dayEnd = dayStr + "T23:59:59";

  const booked = new Set(
    db.prepare(
      `SELECT starts_at FROM appointments
       WHERE doctor_id = ? AND starts_at >= ? AND starts_at <= ?
       AND status IN ('pending','confirmed')`
    ).all(doctorId, dayStart, dayEnd).map((a) => a.starts_at)
  );

  const offs = db.prepare(
    `SELECT starts_at, ends_at FROM time_off
     WHERE doctor_id = ? AND starts_at <= ? AND ends_at >= ?`
  ).all(doctorId, dayEnd, dayStart);

  const now = new Date().toISOString();
  const slots = [];

  for (const rule of rules) {
    const [sh, sm] = rule.start_time.split(":").map(Number);
    const [eh, em] = rule.end_time.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const step = rule.slot_minutes;

    for (let m = startMin; m + step <= endMin; m += step) {
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      const slotStart = `${dayStr}T${hh}:${mm}:00`;

      const endM = m + step;
      const ehh = String(Math.floor(endM / 60)).padStart(2, "0");
      const emm = String(endM % 60).padStart(2, "0");
      const slotEnd = `${dayStr}T${ehh}:${emm}:00`;

      if (booked.has(slotStart)) continue;
      if (slotStart <= now) continue;

      const inOff = offs.some(
        (o) => o.starts_at < slotEnd && o.ends_at > slotStart
      );
      if (inOff) continue;

      slots.push({ starts_at: slotStart, ends_at: slotEnd, mode: rule.mode });
    }
  }

  slots.sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1));
  return slots;
}

function slotMinutes(doctorId, weekday) {
  const rule = db.prepare(
    "SELECT slot_minutes FROM availability_rules WHERE doctor_id = ? AND weekday = ?"
  ).get(doctorId, weekday);
  return rule ? rule.slot_minutes : 30;
}

module.exports = { availableSlots, slotMinutes };
