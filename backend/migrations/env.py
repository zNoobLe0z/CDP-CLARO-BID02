import os

from alembic import context
from sqlalchemy import text

from app.models import Base
from app.settings import Settings, database_engine

settings = Settings()
url = os.environ.get("MIGRATION_DATABASE_URL") or (
    settings.database_url.get_secret_value() if settings.database_url else None
)
if not url:
    raise RuntimeError("Configure MIGRATION_DATABASE_URL ou DATABASE_URL antes de migrar.")

if context.is_offline_mode():
    context.configure(
        url=url, target_metadata=Base.metadata, literal_binds=True, version_table_schema="cdp"
    )
    with context.begin_transaction():
        context.execute("CREATE SCHEMA IF NOT EXISTS cdp")
        context.execute("REVOKE ALL ON SCHEMA cdp FROM PUBLIC")
        context.run_migrations()
else:
    engine = database_engine(url)
    with engine.connect() as connection:
        connection.execute(text("CREATE SCHEMA IF NOT EXISTS cdp"))
        connection.execute(text("REVOKE ALL ON SCHEMA cdp FROM PUBLIC"))
        connection.commit()
        context.configure(
            connection=connection, target_metadata=Base.metadata, version_table_schema="cdp"
        )
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()
