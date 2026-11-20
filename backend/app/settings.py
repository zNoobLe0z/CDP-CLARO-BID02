from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: SecretStr | None = None
    migration_database_url: SecretStr | None = None
    supabase_url: str = ""
    supabase_publishable_key: SecretStr | None = None
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]


def database_engine(url: str):
    parsed = make_url(url)
    if parsed.drivername in ("postgres", "postgresql"):
        parsed = parsed.set(drivername="postgresql+psycopg")
    if parsed.drivername != "postgresql+psycopg":
        raise ValueError("Configure uma conexão PostgreSQL com psycopg.")
    return create_engine(
        parsed,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        pool_timeout=10,
        connect_args={"prepare_threshold": None},
    )
