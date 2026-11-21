from datetime import timedelta
from decimal import Decimal

from app.schemas import today
from tests.test_production import PREFIX, headers, payload


def test_timeline_closing_matches_official_summary_and_has_no_fabricated_plan(client):
    day = today().isoformat()
    timeline = client.get(PREFIX + "/dashboard/timeline", params={"reference_date": day}).json()
    summary = client.get(PREFIX + "/dashboard", params={"reference_date": day}).json()
    assert timeline["points"][-1]["executed_percentage"] == summary["overall_percentage"]
    assert timeline["planned_available"] is False
    assert all(point["planned_percentage"] is None for point in timeline["points"])
    assert timeline["record_count"] == 2
    assert timeline["baseline_percentage"] == "0"


def test_period_delta_uses_prior_day_baseline_and_bounded_series(client):
    old = (today() - timedelta(days=500)).isoformat()
    response = client.post(
        PREFIX + "/production-batches", json=payload() | {"execution_date": old}, headers=headers()
    )
    assert response.status_code == 201
    params = {
        "reference_date": today().isoformat(),
        "start_date": (today() - timedelta(days=30)).isoformat(),
    }
    series = client.get(PREFIX + "/dashboard/timeline", params=params).json()
    assert Decimal(series["baseline_percentage"]) == Decimal("7.5")
    assert Decimal(series["delta_percentage_points"]) == Decimal("32")
    wide = client.get(
        PREFIX + "/dashboard/timeline",
        params={
            "reference_date": today().isoformat(),
            "start_date": (today() - timedelta(days=5000)).isoformat(),
        },
    ).json()
    assert len(wide["points"]) <= 62
    assert wide["points"][-1]["date"] == today().isoformat()


def test_stages_weighted_and_historical_not_current_balance(client):
    params = {"reference_date": today().isoformat()}
    response = client.get(PREFIX + "/dashboard/stages", params=params)
    assert response.status_code == 200
    rows = response.json()["items"]
    painting = next(row for row in rows if row["activity_id"] == "painting")
    assert painting["percentage"] == "20"
    assert painting["budget"] is None and painting["schedule_deviation"] is None
    assert painting["status"] == "in_progress"
    earlier = client.get(
        PREFIX + "/dashboard/stages",
        params={"reference_date": (today() - timedelta(days=1)).isoformat()},
    ).json()
    assert all(row["percentage"] == "0" for row in earlier["items"])


def test_analytics_validate_period_context_and_membership(client):
    future = (today() + timedelta(days=1)).isoformat()
    for endpoint in ("timeline", "stages"):
        path = PREFIX + "/dashboard/" + endpoint
        assert client.get(path, params={"reference_date": future}).status_code == 422
        assert (
            client.get(
                path, params={"reference_date": today().isoformat(), "environment_id": "unknown"}
            ).status_code
            == 422
        )
        assert (
            client.get(
                path.replace("claro-bi02", "other-project"),
                params={"reference_date": today().isoformat()},
            ).status_code
            == 403
        )
    assert (
        client.get(
            PREFIX + "/dashboard/timeline",
            params={"reference_date": today().isoformat(), "start_date": future},
        ).status_code
        == 422
    )


def test_filtered_timeline_and_record_deep_link(client):
    params = {
        "reference_date": today().isoformat(),
        "activity_id": "painting",
        "scope_item_id": "wall-east",
    }
    assert (
        client.get(PREFIX + "/dashboard/timeline", params=params).json()["points"][-1][
            "executed_percentage"
        ]
        == "40"
    )
    record = client.get(PREFIX + "/production-records").json()["items"][0]
    result = client.get(PREFIX + "/production-records", params={"search": record["id"]}).json()
    assert result["total"] == 1
    assert result["items"][0]["id"] == record["id"]
