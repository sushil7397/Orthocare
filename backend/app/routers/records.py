"""Medical records & digital intake.

File uploads (X-ray/MRI) should go directly to encrypted object storage via a
short-lived pre-signed URL; the API only stores a pointer (file_key) + checksum.
This keeps large PHI blobs out of the app servers. A presign stub is included.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import MedicalRecord, Appointment, User, Role
from ..schemas import MedicalRecordCreate, MedicalRecordOut
from ..security import get_current_user

router = APIRouter(prefix="/api/records", tags=["records"])


@router.post("/upload-url")
def get_upload_url(filename: str, content_type: str = "application/octet-stream",
                   user: User = Depends(get_current_user)):
    """Return a (stubbed) pre-signed upload URL + the object key to store later.
    Replace with boto3 generate_presigned_url against an SSE-KMS bucket."""
    key = f"phi/{user.id}/{uuid.uuid4()}-{filename}"
    return {
        "upload_url": f"https://storage.orthocare.example/{key}?X-Amz-Signature=STUB",
        "file_key": key,
        "expires_in": 900,
    }


@router.post("", response_model=MedicalRecordOut, status_code=201)
def create_record(payload: MedicalRecordCreate,
                  user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    rec = MedicalRecord(patient_id=user.id, **payload.model_dump())
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


@router.get("/patient/{patient_id}", response_model=list[MedicalRecordOut])
def list_records(patient_id: str, user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    # Patients see only their own records; doctors/admins may view any.
    if user.role == Role.patient and user.id != patient_id:
        raise HTTPException(status_code=403, detail="Not allowed")
    return (db.query(MedicalRecord)
            .filter(MedicalRecord.patient_id == patient_id)
            .order_by(MedicalRecord.created_at.desc()).all())
