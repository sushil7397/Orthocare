"""SQLAlchemy ORM models for OrthoCare.

Mirrors backend/sql/schema.sql. PostgreSQL is the production target; the same
models run on SQLite for local/demo use.
"""
import enum
import uuid
from datetime import datetime, date, time

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum, ForeignKey, Integer, Numeric,
    String, Text, Time, UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class Role(str, enum.Enum):
    patient = "patient"
    doctor = "doctor"
    admin = "admin"


class VisitMode(str, enum.Enum):
    in_clinic = "in_clinic"
    telehealth = "telehealth"


class AppointmentStatus(str, enum.Enum):
    pending = "pending"          # slot held, awaiting confirmation
    confirmed = "confirmed"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=_uuid)
    role = Column(Enum(Role), nullable=False, default=Role.patient, index=True)
    full_name = Column(String(160), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(32))
    password_hash = Column(String(255), nullable=False)
    date_of_birth = Column(Date)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    doctor_profile = relationship("Doctor", back_populates="user", uselist=False)
    appointments = relationship("Appointment", back_populates="patient",
                                foreign_keys="Appointment.patient_id")
    medical_records = relationship("MedicalRecord", back_populates="patient",
                                   foreign_keys="MedicalRecord.patient_id")


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), unique=True, nullable=False)
    specialty = Column(String(120), default="Orthopedic Surgery")
    bio = Column(Text)
    qualifications = Column(String(255))
    consult_fee = Column(Numeric(10, 2), default=0)
    telehealth_enabled = Column(Boolean, default=True)

    user = relationship("User", back_populates="doctor_profile")
    availability = relationship("AvailabilityRule", back_populates="doctor",
                                cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="doctor")


class AvailabilityRule(Base):
    """Recurring weekly availability template. Slots are generated from these."""
    __tablename__ = "availability_rules"

    id = Column(String(36), primary_key=True, default=_uuid)
    doctor_id = Column(String(36), ForeignKey("doctors.id"), nullable=False, index=True)
    weekday = Column(Integer, nullable=False)            # 0=Mon .. 6=Sun
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    slot_minutes = Column(Integer, default=30)
    mode = Column(Enum(VisitMode), default=VisitMode.in_clinic)

    doctor = relationship("Doctor", back_populates="availability")


class TimeOff(Base):
    """Admin/doctor schedule overrides (holidays, blocks)."""
    __tablename__ = "time_off"

    id = Column(String(36), primary_key=True, default=_uuid)
    doctor_id = Column(String(36), ForeignKey("doctors.id"), nullable=False, index=True)
    starts_at = Column(DateTime, nullable=False)
    ends_at = Column(DateTime, nullable=False)
    reason = Column(String(255))


class ReasonForVisit(Base):
    __tablename__ = "reasons_for_visit"

    id = Column(String(36), primary_key=True, default=_uuid)
    label = Column(String(120), nullable=False)           # e.g. "Knee Pain"
    is_urgent_default = Column(Boolean, default=False)


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (
        # A doctor cannot have two active appointments at the same start time.
        UniqueConstraint("doctor_id", "starts_at", name="uq_doctor_slot"),
    )

    id = Column(String(36), primary_key=True, default=_uuid)
    patient_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    doctor_id = Column(String(36), ForeignKey("doctors.id"), nullable=False, index=True)
    reason_id = Column(String(36), ForeignKey("reasons_for_visit.id"))
    mode = Column(Enum(VisitMode), default=VisitMode.in_clinic)
    status = Column(Enum(AppointmentStatus), default=AppointmentStatus.pending, index=True)

    starts_at = Column(DateTime, nullable=False, index=True)
    ends_at = Column(DateTime, nullable=False)

    symptoms = Column(Text)
    telehealth_url = Column(String(512))                  # Twilio/Zoom room link
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("User", back_populates="appointments",
                           foreign_keys=[patient_id])
    doctor = relationship("Doctor", back_populates="appointments")
    reason = relationship("ReasonForVisit")
    prescriptions = relationship("Prescription", back_populates="appointment",
                                 cascade="all, delete-orphan")


class MedicalRecord(Base):
    """Intake data + uploaded imaging references (X-ray/MRI) and medications."""
    __tablename__ = "medical_records"

    id = Column(String(36), primary_key=True, default=_uuid)
    patient_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    appointment_id = Column(String(36), ForeignKey("appointments.id"))
    record_type = Column(String(60), default="intake")    # intake|xray|mri|note
    title = Column(String(200))
    notes = Column(Text)
    medications = Column(Text)                             # JSON/text list
    # Files live in encrypted object storage (S3 SSE-KMS); we store a pointer + checksum.
    file_key = Column(String(512))
    file_sha256 = Column(String(64))
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("User", back_populates="medical_records",
                           foreign_keys=[patient_id])


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(String(36), primary_key=True, default=_uuid)
    appointment_id = Column(String(36), ForeignKey("appointments.id"), nullable=False)
    doctor_id = Column(String(36), ForeignKey("doctors.id"), nullable=False)
    body = Column(Text, nullable=False)                   # structured Rx text/JSON
    created_at = Column(DateTime, default=datetime.utcnow)

    appointment = relationship("Appointment", back_populates="prescriptions")


# ---- Precaution & Injury Prevention Hub ----

class ContentCategory(str, enum.Enum):
    sports_fitness = "sports_fitness"
    ergonomics = "ergonomics"
    age_specific = "age_specific"
    post_op = "post_op"


class PrecautionContent(Base):
    __tablename__ = "precaution_content"

    id = Column(String(36), primary_key=True, default=_uuid)
    category = Column(Enum(ContentCategory), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    summary = Column(String(500))
    body = Column(Text)                                   # markdown/html
    media_type = Column(String(20), default="article")    # article|video|gif
    media_url = Column(String(512))
    body_region = Column(String(60))                      # knee|back|shoulder...
    is_published = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class RecoveryPlan(Base):
    """Template recovery track, e.g. 'ACL Reconstruction'."""
    __tablename__ = "recovery_plans"

    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(160), nullable=False)            # ACL Reconstruction
    description = Column(Text)
    duration_days = Column(Integer, default=42)


class RecoveryTask(Base):
    __tablename__ = "recovery_tasks"

    id = Column(String(36), primary_key=True, default=_uuid)
    plan_id = Column(String(36), ForeignKey("recovery_plans.id"), nullable=False, index=True)
    day_number = Column(Integer, nullable=False)
    kind = Column(String(20), default="exercise")         # exercise|avoid|checkin
    instruction = Column(Text, nullable=False)


class PatientRecovery(Base):
    """An assignment of a recovery plan to a patient."""
    __tablename__ = "patient_recoveries"

    id = Column(String(36), primary_key=True, default=_uuid)
    patient_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    plan_id = Column(String(36), ForeignKey("recovery_plans.id"), nullable=False)
    start_date = Column(Date, default=date.today)
    active = Column(Boolean, default=True)


class RecoveryProgress(Base):
    __tablename__ = "recovery_progress"
    __table_args__ = (
        UniqueConstraint("patient_recovery_id", "recovery_task_id",
                         name="uq_recovery_task_done"),
    )

    id = Column(String(36), primary_key=True, default=_uuid)
    patient_recovery_id = Column(String(36), ForeignKey("patient_recoveries.id"),
                                 nullable=False, index=True)
    recovery_task_id = Column(String(36), ForeignKey("recovery_tasks.id"), nullable=False)
    completed_at = Column(DateTime, default=datetime.utcnow)
