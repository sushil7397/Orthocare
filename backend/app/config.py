"""Application configuration loaded from environment / .env."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Leave DATABASE_URL empty to fall back to a local SQLite file (dev/demo only).
    database_url: str = ""
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str = "dev-insecure-secret-change-me"
    jwt_alg: str = "HS256"
    access_token_expire_minutes: int = 60

    slot_hold_minutes: int = 10

    @property
    def sqlalchemy_url(self) -> str:
        return self.database_url or "sqlite:///./orthocare.db"


settings = Settings()
