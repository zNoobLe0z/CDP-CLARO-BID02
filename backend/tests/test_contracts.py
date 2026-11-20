from datetime import timedelta
from uuid import uuid4

import httpx
import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.auth import identity
from app.main import create_app
from app.schemas import Correction, ProductionBatch, WorkforceInput, today
from app.settings import Settings


def batch(**changes):
    return {
        "execution_date": today().isoformat(),
        "observation": "",
        "entries": [
            {
                "scope_item_id": "wall-east",
                "expected_version": 1,
                "measurement_type": "percentage",
                "daily_percentage": "25",
            }
        ],
    } | changes


@pytest.mark.parametrize("value", ["0", "100.01", "NaN", "1e2", "25,5", "1.001"])
def test_rejects_invalid_percentages(value):
    body = batch()
    body["entries"][0]["daily_percentage"] = value
    with pytest.raises(ValidationError):
        ProductionBatch.model_validate(body)


def test_rejects_duplicates_and_future_dates():
    body = batch()
    with pytest.raises(ValidationError):
        ProductionBatch.model_validate(batch(entries=body["entries"] * 2))
    with pytest.raises(ValidationError):
        ProductionBatch.model_validate(
            batch(execution_date=(today() + timedelta(days=1)).isoformat())
        )
    with pytest.raises(ValidationError):
        WorkforceInput(headcount=True)
    assert (
        Correction(
            quantity="0",
            reason="Anulação da medição",
            expected_record_version=1,
            expected_scope_version=1,
        ).quantity
        == "0"
    )


@pytest.mark.parametrize(
    "value", [0, 1732060800, "1732060800", "2026-11-20T00:00:00", "2026-02-30"]
)
def test_dates_must_be_calendar_dates(value):
    with pytest.raises(ValidationError):
        ProductionBatch.model_validate(batch(execution_date=value))


def test_supabase_validates_identity_remotely_not_from_user_metadata():
    user_id = str(uuid4())

    def handle(request):
        assert request.headers["authorization"] == "Bearer synthetic-token"
        assert request.headers["apikey"] == "test-public-key"
        return httpx.Response(200, json={"id": user_id, "user_metadata": {"role": "admin"}})

    transport = httpx.Client(transport=httpx.MockTransport(handle))
    app = create_app(
        Settings(
            database_url=None,
            supabase_url="https://auth.example.test",
            supabase_publishable_key="test-public-key",
        ),
        auth_http=transport,
    )

    @app.get("/identity-probe")
    def probe(user=Depends(identity)):
        return {"user_id": str(user.user_id)}

    with TestClient(app) as client:
        assert client.get("/identity-probe").status_code == 401
        assert client.get(
            "/identity-probe", headers={"Authorization": "Bearer synthetic-token"}
        ).json() == {"user_id": user_id}
    transport.close()


@pytest.mark.parametrize("remote_status, expected", [(401, 401), (403, 401), (500, 503)])
def test_auth_errors_do_not_become_authorized_users(remote_status, expected):
    transport = httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(remote_status)))
    app = create_app(
        Settings(
            database_url=None,
            supabase_url="https://auth.example.test",
            supabase_publishable_key="test",
        ),
        auth_http=transport,
    )

    @app.get("/identity-probe")
    def probe(user=Depends(identity)):
        return str(user.user_id)

    with TestClient(app) as client:
        assert (
            client.get("/identity-probe", headers={"Authorization": "Bearer bad"}).status_code
            == expected
        )
    transport.close()
