"""OrthoCare API — FastAPI application entry point."""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .services.locks import backend_name
from .routers import (
    auth, doctors, appointments, content, screener, records, recovery,
)

logging.basicConfig(level=logging.INFO)

# Dev convenience: auto-create tables. In production use Alembic migrations.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="OrthoCare API",
    version="0.1.0",
    description="Appointment booking + injury-prevention hub for an orthopedic practice.",
)

# Lock CORS down to your real web/mobile origins in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth, doctors, appointments, content, screener, records, recovery):
    app.include_router(r.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "slot_lock_backend": backend_name()}
