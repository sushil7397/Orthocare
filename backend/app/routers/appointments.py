from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Appointment, Doctor, AvailabilityRule, ReasonForVisit,
    AppointmentStatus, User, Role, VisitMode,
)
from ..schemas import AppointmentCreate, AppointmentOut, ReasonOut
from ..security import get_current_user, require_roles
from ..services.locks import acquire_slot, release_slot
from ..services.scheduling import available_slots
from ..services import notifications

router = APIRouter(prefix="/api", tags=["appointments"])


@router.get("/reasons", response_model=list[ReasonOut])
def list_reasons(db: Session = Depends(get_db)):
    return db.query(ReasonForVisit).all()


def _slot_minutes(db: Session, doctor_id: str, weekday: int) -> int:
    rule = (db.query(AvailabilityRule)
            .filter(AvailabilityRule.doctor_id == doctor_id,
                    AvailabilityRule.weekday == weekday).first())
    return rule.slot_minutes if rule else 30


@router.post("/appointments", response_model=AppointmentOut, status_code=201)
def book(payload: AppointmentCreate, user: User = Depends(get_current_user),
         db: Session = Depends(get_db)):
    doctor = db.query(Doctor).filter(Doctor.id == payload.doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    # Validate the requested slot is genuinely open for that day.
    day = payload.starts_at.date()
    open_starts = {s["starts_at"] for s in available_slots(db, doctor.id, day)}
    if payload.starts_at not in open_starts:
        raise HTTPException(status_code=409, detail="Slot is not available")

    iso = payload.starts_at.isoformat()
    if not acquire_slot(doctor.id, iso):
        raise HTTPException(status_code=409, detail="Slot is being booked by someone else")

    try:
        minutes = _slot_minutes(db, doctor.id, payload.starts_at.weekday())
        appt = Appointment(
            patient_id=user.id,
            doctor_id=doctor.id,
            reason_id=payload.reason_id,
            mode=payload.mode,
            status=AppointmentStatus.confirmed,
            starts_at=payload.starts_at,
            ends_at=payload.starts_at + timedelta(minutes=minutes),
            symptoms=payload.symptoms,
        )
        if payload.mode == VisitMode.telehealth:
            # Placeholder; replace with Twilio Video / Zoom room creation.
            appt.telehealth_url = f"https://video.orthocare.example/room/{appt.id}"
        db.add(appt)
        db.commit()
        db.refresh(appt)
    except IntegrityError:
        db.rollback()
        release_slot(doctor.id, iso)
        raise HTTPException(status_code=409, detail="Slot just got taken")

    notifications.send_appointment_confirmation(appt)
    notifications.schedule_reminder(appt)  # 24h-before reminder (enqueue)
    return appt


@router.get("/appointments/me", response_model=list[AppointmentOut])
def my_appointments(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(Appointment)
    if user.role == Role.patient:
        q = q.filter(Appointment.patient_id == user.id)
    elif user.role == Role.doctor and user.doctor_profile:
        q = q.filter(Appointment.doctor_id == user.doctor_profile.id)
    return q.order_by(Appointment.starts_at.desc()).all()


@router.post("/appointments/{appt_id}/cancel", response_model=AppointmentOut)
def cancel(appt_id: str, user: User = Depends(get_current_user),
           db: Session = Depends(get_db)):
    appt = db.query(Appointment).filter(Appointment.id == appt_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    is_owner = appt.patient_id == user.id
    is_staff = user.role in (Role.doctor, Role.admin)
    if not (is_owner or is_staff):
        raise HTTPException(status_code=403, detail="Not allowed")
    appt.status = AppointmentStatus.cancelled
    db.commit()
    release_slot(appt.doctor_id, appt.starts_at.isoformat())
    db.refresh(appt)
    return appt
