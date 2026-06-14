from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Doctor, VisitMode
from ..schemas import DoctorOut, SlotOut
from ..services.scheduling import available_slots

router = APIRouter(prefix="/api/doctors", tags=["doctors"])


@router.get("", response_model=list[DoctorOut])
def list_doctors(db: Session = Depends(get_db)):
    return db.query(Doctor).all()


@router.get("/{doctor_id}", response_model=DoctorOut)
def get_doctor(doctor_id: str, db: Session = Depends(get_db)):
    doc = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return doc


@router.get("/{doctor_id}/slots", response_model=list[SlotOut])
def get_slots(
    doctor_id: str,
    day: date = Query(..., description="YYYY-MM-DD"),
    mode: VisitMode | None = None,
    db: Session = Depends(get_db),
):
    if not db.query(Doctor).filter(Doctor.id == doctor_id).first():
        raise HTTPException(status_code=404, detail="Doctor not found")
    return available_slots(db, doctor_id, day, mode)
