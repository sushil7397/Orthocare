"""SQLAlchemy engine, session, and declarative base."""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings

connect_args = {}
if settings.sqlalchemy_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(settings.sqlalchemy_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
