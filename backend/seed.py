"""Seed the database with a doctor, availability, reasons, content, and a
recovery plan. Run from the backend/ dir:  python seed.py
Demo logins:  doctor@orthocare.test / Passw0rd!   patient@orthocare.test / Passw0rd!
"""
from datetime import time

from app.database import Base, engine, SessionLocal
from app.models import (
    User, Doctor, AvailabilityRule, ReasonForVisit, PrecautionContent,
    RecoveryPlan, RecoveryTask, Role, VisitMode, ContentCategory,
)
from app.security import hash_password


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == "doctor@orthocare.test").first():
            print("Already seeded.")
            return

        doc_user = User(role=Role.doctor, full_name="Dr. Aisha Rao",
                        email="doctor@orthocare.test", phone="+10000000001",
                        password_hash=hash_password("Passw0rd!"))
        patient = User(role=Role.patient, full_name="Sam Patient",
                       email="patient@orthocare.test", phone="+10000000002",
                       password_hash=hash_password("Passw0rd!"))
        db.add_all([doc_user, patient])
        db.flush()

        doctor = Doctor(user_id=doc_user.id,
                        specialty="Orthopedic Surgery (Sports & Joint)",
                        bio="20+ years in arthroscopic knee and shoulder surgery.",
                        qualifications="MBBS, MS Ortho, Fellowship (Sports Medicine)",
                        consult_fee=120, telehealth_enabled=True)
        db.add(doctor)
        db.flush()

        # Mon-Fri, in-clinic mornings + telehealth afternoons.
        for wd in range(0, 5):
            db.add(AvailabilityRule(doctor_id=doctor.id, weekday=wd,
                                    start_time=time(9, 0), end_time=time(12, 0),
                                    slot_minutes=30, mode=VisitMode.in_clinic))
            db.add(AvailabilityRule(doctor_id=doctor.id, weekday=wd,
                                    start_time=time(14, 0), end_time=time(17, 0),
                                    slot_minutes=30, mode=VisitMode.telehealth))

        for label, urgent in [("Knee Pain", False), ("Fracture Follow-up", False),
                              ("Sports Injury", False), ("Back/Neck Pain", False),
                              ("Acute Injury / Trauma", True),
                              ("Post-Op Review", False)]:
            db.add(ReasonForVisit(label=label, is_urgent_default=urgent))

        content = [
            ("sports_fitness", "Dynamic Warm-Up Before Running", "knee",
             "video", "A 5-minute routine to prep knees and hips before a run."),
            ("sports_fitness", "Safe Barbell Squat Form", "back",
             "gif", "Bracing and depth cues to protect your lower back."),
            ("ergonomics", "Desk Posture Reset", "back",
             "article", "Monitor height, chair, and micro-break guidance."),
            ("ergonomics", "Wrist Care for Typists", "wrist",
             "article", "Neutral wrist positioning and stretches."),
            ("age_specific", "Fall Prevention for Seniors", "knee",
             "article", "Home hazard checklist and balance exercises."),
            ("age_specific", "Bone Density Optimization", "back",
             "article", "Nutrition and weight-bearing exercise basics."),
            ("post_op", "ACL: What to Avoid in Week 1", "knee",
             "article", "Movements and loads to skip early after ACL surgery."),
        ]
        for cat, title, region, mtype, summary in content:
            db.add(PrecautionContent(category=ContentCategory(cat), title=title,
                                     body_region=region, media_type=mtype,
                                     summary=summary, body=summary,
                                     media_url="https://media.orthocare.example/demo"))

        plan = RecoveryPlan(name="ACL Reconstruction Recovery",
                            description="6-week guided post-op track.",
                            duration_days=42)
        db.add(plan)
        db.flush()
        for day, kind, instr in [
            (1, "avoid", "Avoid bearing full weight without crutches."),
            (1, "exercise", "Ankle pumps: 3 sets of 15."),
            (2, "exercise", "Quad sets: 3 sets of 10, hold 5s."),
            (3, "checkin", "Rate pain & swelling 0-10."),
            (7, "exercise", "Heel slides: 2 sets of 10."),
            (14, "exercise", "Stationary bike, light resistance, 10 min."),
        ]:
            db.add(RecoveryTask(plan_id=plan.id, day_number=day, kind=kind,
                                instruction=instr))

        db.commit()
        print("Seeded: doctor, patient, availability, reasons, content, recovery plan.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
