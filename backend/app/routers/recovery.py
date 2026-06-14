"""Post-injury / post-op recovery tracking."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    RecoveryPlan, RecoveryTask, PatientRecovery, RecoveryProgress, User,
)
from ..schemas import RecoveryTaskOut
from ..security import get_current_user

router = APIRouter(prefix="/api/recovery", tags=["recovery"])


@router.get("/plans")
def list_plans(db: Session = Depends(get_db)):
    return [{"id": p.id, "name": p.name, "description": p.description,
             "duration_days": p.duration_days}
            for p in db.query(RecoveryPlan).all()]


@router.post("/enroll/{plan_id}")
def enroll(plan_id: str, user: User = Depends(get_current_user),
           db: Session = Depends(get_db)):
    if not db.query(RecoveryPlan).filter(RecoveryPlan.id == plan_id).first():
        raise HTTPException(status_code=404, detail="Plan not found")
    pr = PatientRecovery(patient_id=user.id, plan_id=plan_id)
    db.add(pr)
    db.commit()
    db.refresh(pr)
    return {"patient_recovery_id": pr.id, "start_date": str(pr.start_date)}


@router.get("/my-tasks", response_model=list[RecoveryTaskOut])
def my_tasks(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pr = (db.query(PatientRecovery)
          .filter(PatientRecovery.patient_id == user.id,
                  PatientRecovery.active == True)  # noqa: E712
          .first())
    if not pr:
        return []
    done = {p.recovery_task_id for p in db.query(RecoveryProgress)
            .filter(RecoveryProgress.patient_recovery_id == pr.id)}
    tasks = (db.query(RecoveryTask)
             .filter(RecoveryTask.plan_id == pr.plan_id)
             .order_by(RecoveryTask.day_number).all())
    return [RecoveryTaskOut(id=t.id, day_number=t.day_number, kind=t.kind,
                            instruction=t.instruction, completed=t.id in done)
            for t in tasks]


@router.post("/complete/{task_id}")
def complete_task(task_id: str, user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    pr = (db.query(PatientRecovery)
          .filter(PatientRecovery.patient_id == user.id,
                  PatientRecovery.active == True)  # noqa: E712
          .first())
    if not pr:
        raise HTTPException(status_code=404, detail="No active recovery plan")
    exists = (db.query(RecoveryProgress)
              .filter(RecoveryProgress.patient_recovery_id == pr.id,
                      RecoveryProgress.recovery_task_id == task_id).first())
    if not exists:
        db.add(RecoveryProgress(patient_recovery_id=pr.id, recovery_task_id=task_id))
        db.commit()
    return {"status": "completed", "task_id": task_id}
