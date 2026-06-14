"""Non-diagnostic symptom pre-screener.

Rule-based triage ONLY. This is not a medical diagnosis; it routes the user to
self-care content, a routine booking, or an urgent booking. All thresholds are
conservative and should be reviewed by the supervising clinician.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import PrecautionContent
from ..schemas import ScreenerAnswer, ScreenerResult

router = APIRouter(prefix="/api/screener", tags=["screener"])

URGENT_MSG = ("Your answers suggest you should be seen promptly. We recommend "
              "booking an urgent appointment. If you have severe deformity, "
              "loss of sensation, or cannot bear weight, seek emergency care now.")
ROUTINE_MSG = ("Your symptoms may benefit from a clinical review. We suggest "
               "booking a routine consultation.")
SELFCARE_MSG = ("Your symptoms look mild. Try the self-care and prevention "
                "guidance below, and book a visit if things don't improve in "
                "7-10 days.")


@router.post("", response_model=ScreenerResult)
def screen(ans: ScreenerAnswer, db: Session = Depends(get_db)):
    urgent = (
        ans.trauma and (ans.swelling or ans.pain_level >= 7)
        or ans.numbness
        or ans.pain_level >= 9
    )
    routine = (
        ans.pain_level >= 5
        or ans.swelling
        or ans.duration_days >= 14
    )

    if urgent:
        triage, message = "urgent_booking", URGENT_MSG
    elif routine:
        triage, message = "routine_booking", ROUTINE_MSG
    else:
        triage, message = "self_care", SELFCARE_MSG

    recs = (
        db.query(PrecautionContent)
        .filter(PrecautionContent.is_published == True,  # noqa: E712
                PrecautionContent.body_region == ans.body_region)
        .limit(3).all()
    )
    return ScreenerResult(
        triage=triage, message=message,
        recommended_content_ids=[c.id for c in recs],
    )
