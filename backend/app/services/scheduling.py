"""Slot generation: expand weekly availability rules into concrete open slots,
subtracting booked appointments and time-off."""
from datetime import datetime, timedelta, date, time

from sqlalchemy.orm import Session

from ..models import (
    Doctor, AvailabilityRule, Appointment, TimeOff, AppointmentStatus, VisitMode,
)


def _combine(d: date, t: time) -> datetime:
    return datetime.combine(d, t)


def available_slots(db: Session, doctor_id: str, day: date,
                    mode: VisitMode | None = None) -> list[dict]:
    rules = (
        db.query(AvailabilityRule)
        .filter(AvailabilityRule.doctor_id == doctor_id,
                AvailabilityRule.weekday == day.weekday())
        .all()
    )
    if mode:
        rules = [r for r in rules if r.mode == mode]

    day_start = _combine(day, time.min)
    day_end = day_start + timedelta(days=1)

    booked = {
        a.starts_at
        for a in db.query(Appointment).filter(
            Appointment.doctor_id == doctor_id,
            Appointment.starts_at >= day_start,
            Appointment.starts_at < day_end,
            Appointment.status.in_([AppointmentStatus.pending,
                                    AppointmentStatus.confirmed]),
        )
    }
    offs = db.query(TimeOff).filter(
        TimeOff.doctor_id == doctor_id,
        TimeOff.starts_at < day_end,
        TimeOff.ends_at > day_start,
    ).all()

    def in_time_off(s: datetime, e: datetime) -> bool:
        return any(o.starts_at < e and o.ends_at > s for o in offs)

    now = datetime.utcnow()
    slots: list[dict] = []
    for r in rules:
        cursor = _combine(day, r.start_time)
        end = _combine(day, r.end_time)
        step = timedelta(minutes=r.slot_minutes)
        while cursor + step <= end:
            slot_end = cursor + step
            if (cursor not in booked and cursor > now
                    and not in_time_off(cursor, slot_end)):
                slots.append({"starts_at": cursor, "ends_at": slot_end,
                              "mode": r.mode})
            cursor = slot_end
    slots.sort(key=lambda s: s["starts_at"])
    return slots
