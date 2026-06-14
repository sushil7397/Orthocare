from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import PrecautionContent, ContentCategory, Role, User
from ..schemas import ContentOut, ContentCreate
from ..security import require_roles

router = APIRouter(prefix="/api/content", tags=["content"])


@router.get("", response_model=list[ContentOut])
def list_content(category: ContentCategory | None = None,
                 body_region: str | None = None,
                 db: Session = Depends(get_db)):
    q = db.query(PrecautionContent).filter(PrecautionContent.is_published == True)  # noqa: E712
    if category:
        q = q.filter(PrecautionContent.category == category)
    if body_region:
        q = q.filter(PrecautionContent.body_region == body_region)
    return q.order_by(PrecautionContent.created_at.desc()).all()


@router.get("/{content_id}", response_model=ContentOut)
def get_content(content_id: str, db: Session = Depends(get_db)):
    item = db.query(PrecautionContent).filter(PrecautionContent.id == content_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    return item


@router.post("", response_model=ContentOut, status_code=201)
def create_content(payload: ContentCreate,
                   user: User = Depends(require_roles(Role.doctor, Role.admin)),
                   db: Session = Depends(get_db)):
    item = PrecautionContent(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
