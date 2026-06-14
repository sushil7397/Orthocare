"""Pydantic request/response models."""
from datetime import datetime, date, time
from typing import Optional, List
from pydantic import BaseModel, EmailStr, ConfigDict

from .models import (
    Role, VisitMode, AppointmentStatus, ContentCategory,
)


# ---- Auth / Users ----
class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    date_of_birth: Optional[date] = None
    role: Role = Role.patient


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    role: Role
    full_name: str
    email: EmailStr
    phone: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ---- Doctors / Availability ----
class DoctorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    specialty: str
    bio: Optional[str] = None
    qualifications: Optional[str] = None
    consult_fee: Optional[float] = None
    telehealth_enabled: bool


class SlotOut(BaseModel):
    starts_at: datetime
    ends_at: datetime
    mode: VisitMode


# ---- Appointments ----
class AppointmentCreate(BaseModel):
    doctor_id: str
    reason_id: Optional[str] = None
    starts_at: datetime
    mode: VisitMode = VisitMode.in_clinic
    symptoms: Optional[str] = None


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    doctor_id: str
    patient_id: str
    mode: VisitMode
    status: AppointmentStatus
    starts_at: datetime
    ends_at: datetime
    symptoms: Optional[str] = None
    telehealth_url: Optional[str] = None


# ---- Reasons ----
class ReasonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    label: str
    is_urgent_default: bool


# ---- Medical records ----
class MedicalRecordCreate(BaseModel):
    appointment_id: Optional[str] = None
    record_type: str = "intake"
    title: Optional[str] = None
    notes: Optional[str] = None
    medications: Optional[str] = None
    file_key: Optional[str] = None
    file_sha256: Optional[str] = None


class MedicalRecordOut(MedicalRecordCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    patient_id: str
    created_at: datetime


# ---- Content hub ----
class ContentCreate(BaseModel):
    category: ContentCategory
    title: str
    summary: Optional[str] = None
    body: Optional[str] = None
    media_type: str = "article"
    media_url: Optional[str] = None
    body_region: Optional[str] = None


class ContentOut(ContentCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str


# ---- Symptom screener ----
class ScreenerAnswer(BaseModel):
    body_region: str                       # knee|back|shoulder|wrist...
    pain_level: int                        # 0-10
    swelling: bool = False
    duration_days: int = 0
    trauma: bool = False                   # recent injury/accident
    numbness: bool = False


class ScreenerResult(BaseModel):
    triage: str                            # self_care | routine_booking | urgent_booking
    message: str
    recommended_content_ids: List[str] = []


# ---- Recovery ----
class RecoveryTaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    day_number: int
    kind: str
    instruction: str
    completed: bool = False
