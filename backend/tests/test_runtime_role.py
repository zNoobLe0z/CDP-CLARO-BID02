import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import make_url

from app.auth import Identity, identity
from app.main import create_app
from app.settings import Settings, database_engine
from tests.conftest import EDITOR
from tests.test_production import PREFIX, headers, payload


def test_api_works_without_admin_privileges_and_cannot_rewrite_originals(seeded):
    sql = (Path(__file__).parents[1] / "sql/runtime_role.sql").read_text()
    with seeded.begin() as connection:
        connection.execute(text(sql))
        connection.execute(
            text("""DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cdp_api_test_login') THEN
            CREATE ROLE cdp_api_test_login LOGIN PASSWORD 'runtime-test-only' IN ROLE cdp_api;
          END IF;
        END $$;""")
        )
    url = make_url(os.environ["TEST_DATABASE_URL"]).set(
        username="cdp_api_test_login", password="runtime-test-only"
    )
    runtime = database_engine(url.render_as_string(hide_password=False))
    application = create_app(Settings(database_url=None), engine=runtime)
    application.dependency_overrides[identity] = lambda: Identity(EDITOR)
    with TestClient(application, raise_server_exceptions=False) as browser:
        response = browser.post(PREFIX + "/production-batches", json=payload(), headers=headers())
        assert response.status_code == 201, response.text
        history = browser.get(PREFIX + "/production-records").json()["items"]
        record = next(item for item in history if item["quantity"] == "2.5")
        response = browser.post(
            PREFIX + f"/production-records/{record['id']}/corrections",
            json={
                "quantity": "2",
                "reason": "Conferência em campo",
                "expected_record_version": 1,
                "expected_scope_version": 2,
            },
            headers=headers(),
        )
        assert response.status_code == 201, response.text
    with runtime.begin() as connection:
        assert connection.scalar(text("SELECT current_user")) == "cdp_api_test_login"
        assert not connection.scalar(
            text("SELECT has_schema_privilege(current_user, 'cdp', 'CREATE')")
        )
        assert not connection.scalar(
            text("SELECT has_table_privilege(current_user, 'cdp.memberships', 'UPDATE')")
        )
        assert not connection.scalar(
            text(
                "SELECT has_column_privilege(current_user, 'cdp.production_records', 'quantity', 'UPDATE')"
            )
        )
    with pytest.raises(Exception):
        with runtime.begin() as connection:
            connection.execute(text("UPDATE cdp.production_records SET quantity = 999"))
    runtime.dispose()
