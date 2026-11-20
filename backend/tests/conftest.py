import os
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.auth import Identity, identity
from app.bootstrap import seed_demo
from app.main import create_app
from app.models import Base, Membership, Project
from app.settings import Settings, database_engine

EDITOR = UUID("11111111-1111-4111-8111-111111111111")
VIEWER = UUID("22222222-2222-4222-8222-222222222222")


@pytest.fixture(scope="session")
def engine():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Configure TEST_DATABASE_URL para testar persistência em PostgreSQL.")
    if not (make_url(url).database or "").endswith("_test"):
        raise RuntimeError("A limpeza de teste exige banco com nome terminado em _test.")
    engine = database_engine(url)
    yield engine
    engine.dispose()


@pytest.fixture
def seeded(engine):
    with Session(engine) as session, session.begin():
        for table in reversed(Base.metadata.sorted_tables):
            session.execute(delete(table))
        seed_demo(session, EDITOR)
        session.add(Project(id="other-project", name="Outra obra"))
        session.add(
            Membership(
                project_id="claro-bi02", user_id=VIEWER, role="viewer", display_name="Consulta"
            )
        )
    return engine


@pytest.fixture
def application(seeded):
    app = create_app(Settings(database_url=None), engine=seeded)
    app.dependency_overrides[identity] = lambda: Identity(EDITOR)
    return app


@pytest.fixture
def client(application):
    with TestClient(application, raise_server_exceptions=False) as client:
        yield client
