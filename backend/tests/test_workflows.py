from datetime import timedelta

import httpx
from sqlalchemy import select

from backend.app.agents import run_agent
from backend.app.db import LOCAL_WORKSPACE_ID
from backend.app.models import AgentRun, Content, Evidence, Workspace, now
from backend.app.research import collect, parse_feed


def create_content(client):
    run = client.post(
        "/agents/creative/run", json={"format": "story", "brief": "Uma estrela acolhedora"}
    ).json()
    assert run["status"] == "completed", run
    return client.get("/contents").json()[0]


def test_empty_database_does_not_invent_metrics_or_evidence(client):
    assert client.get("/overview").json()["counts"]["evidence"] == 0
    assert client.get("/metrics").json() == {
        "history": [],
        "delta": {},
        "unavailable": ["reach", "views", "interactions", "conversions"],
    }
    run = client.post("/agents/strategist/run").json()
    assert run["status"] == "failed"
    assert "evidências" in run["error"]
    assert not client.get("/recommendations").json()


def test_manual_evidence_is_canonical_deduplicated_and_traceable(client, evidence_payload):
    first = client.post("/evidence", json=evidence_payload)
    assert first.status_code == 201
    assert first.json()["created"] is True
    second = client.post("/evidence", json={**evidence_payload, "url": "https://example.org/leitura"})
    assert second.json()["created"] is False
    item = first.json()["item"]
    assert item["url"] == "https://example.org/leitura"
    assert item["source_type"] == "manual" and item["reasons"]
    run = client.post("/agents/strategist/run").json()
    assert run["status"] == "completed" and run["mode"] == "heuristic"
    recs = client.get("/recommendations").json()
    assert recs[0]["evidence_ids"] == [item["id"]]
    assert "Hipótese" in recs[0]["rationale"]


def test_private_or_credential_urls_rejected(client, evidence_payload):
    for url in [
        "http://example.org",
        "https://127.0.0.1/x",
        "https://localhost/x",
        "https://user:pass@example.org",
        "https://10.0.0.1/x",
    ]:
        assert client.post("/evidence", json={**evidence_payload, "url": url}).status_code == 422


def test_rss_real_parser_and_partial_network_failure(session, monkeypatch):
    feed = b"""<?xml version="1.0"?><rss version="2.0"><channel><title>Test fixture</title><item><title>Livros personalizados</title><link>https://example.org/book</link><description>Leitura infantil em familia.</description></item></channel></rss>"""
    assert parse_feed(feed, "Livros")[0]["source_type"] == "public_feed"

    def handler(request):
        return httpx.Response(403) if "Presentes" in str(request.url) else httpx.Response(200, content=feed)

    workspace = session.get(Workspace, LOCAL_WORKSPACE_ID)
    with httpx.Client(transport=httpx.MockTransport(handler)) as transport:
        rows, errors = collect(workspace, transport)
    assert len(rows) == 1 and len(errors) == 1
    monkeypatch.setattr("backend.app.agents.research.collect", lambda _: (rows, errors))
    run = run_agent(session, workspace.id, "radar")
    assert run.status == "partial" and run.result_count == 1
    assert session.scalar(select(Evidence)).url == "https://example.org/book"
    # A repeat execution does not duplicate the evidence.
    again = run_agent(session, workspace.id, "radar")
    assert again.result_count == 0 and again.details["duplicates"] == 1


def test_failed_sources_create_no_invented_results(client, monkeypatch):
    monkeypatch.setattr(
        "backend.app.agents.research.collect",
        lambda _: ([], [{"topic": "Livros", "source": "https://example.org", "error": "blocked"}]),
    )
    run = client.post("/agents/radar/run").json()
    assert run["status"] == "failed" and run["result_count"] == 0
    assert client.get("/evidence").json() == []


def test_approval_planning_edit_invalidates_approval(client):
    item = create_content(client)
    assert 50 <= len(item["body"]["text"].split()) <= 85
    assert item["status"] == "draft" and "local" in item["body"]["notes"]
    plan = {"version": item["version"], "scheduled_at": (now() + timedelta(days=1)).isoformat()}
    assert client.post(f"/contents/{item['id']}/plan", json=plan).status_code == 409
    assert (
        client.post(
            f"/contents/{item['id']}/approve", json={"version": item["version"], "confirmed": False}
        ).status_code
        == 409
    )
    approved = client.post(
        f"/contents/{item['id']}/approve", json={"version": item["version"], "confirmed": True}
    ).json()
    assert approved["status"] == "approved" and approved["approved_by"] == "local-owner"
    plan["version"] = approved["version"]
    naive = {**plan, "scheduled_at": "2099-01-01T12:00:00"}
    assert client.post(f"/contents/{item['id']}/plan", json=naive).status_code == 422
    planned = client.post(f"/contents/{item['id']}/plan", json=plan).json()
    assert planned["status"] == "planned"
    assert planned["scheduled_at"].endswith("+00:00")
    replanned = client.post(
        f"/contents/{item['id']}/plan",
        json={"version": planned["version"], "scheduled_at": (now() + timedelta(days=2)).isoformat()},
    ).json()
    assert replanned["status"] == "planned"
    edited = client.put(
        f"/contents/{item['id']}",
        json={"title": "Uma nova versão", "body": item["body"], "version": replanned["version"]},
    ).json()
    assert edited["status"] == "draft" and edited["scheduled_at"] is None and edited["approved_by"] is None
    assert (
        client.post(
            f"/contents/{item['id']}/approve", json={"version": item["version"], "confirmed": True}
        ).status_code
        == 409
    )


def test_financial_record_requires_explicit_confirmation(client):
    customer = client.post("/customers", json={"name": "Responsável fictício", "consent": True}).json()
    order = {
        "customer_id": customer["id"],
        "description": "Pedido de teste",
        "amount_cents": 100,
        "confirmed": False,
    }
    assert client.post("/orders", json=order).status_code == 422
    assert client.post("/orders", json={**order, "confirmed": True, "amount_cents": -1}).status_code == 422
    created = client.post("/orders", json={**order, "confirmed": True})
    assert created.status_code == 201
    item_id = created.json()["id"]
    assert client.put(f"/orders/{item_id}", json={"status": "paid", "confirmed": False}).status_code == 422
    assert (
        client.put(f"/orders/{item_id}", json={"status": "paid", "confirmed": True}).json()["status"]
        == "paid"
    )
    assert client.delete(f"/customers/{customer['id']}").status_code == 204
    assert client.get("/orders").json() == []


def test_cross_tenant_content_and_evidence_are_inaccessible(client, session):
    other = Workspace(name="Outra empresa", themes=[], brand={})
    session.add(other)
    session.flush()
    item = Content(workspace_id=other.id, title="Privado", format="caption", body={})
    evidence = Evidence(
        workspace_id=other.id, title="Privado", url="https://example.org/private", topic="Outro"
    )
    session.add_all([item, evidence])
    session.commit()
    assert client.get("/contents").json() == []
    assert client.get("/evidence").json() == []
    assert (
        client.post(f"/contents/{item.id}/approve", json={"version": 1, "confirmed": True}).status_code == 404
    )
    run = client.post(
        "/agents/creative/run",
        json={"format": "caption", "brief": "Tentativa de referência cruzada", "evidence_ids": [evidence.id]},
    ).json()
    assert run["status"] == "failed"


def test_agent_pause_and_concurrent_run_guard(client, session):
    assert client.put("/agents/radar", json={"enabled": False, "interval_hours": 24}).status_code == 200
    assert client.post("/agents/radar/run").status_code == 409
    session.add(AgentRun(workspace_id=LOCAL_WORKSPACE_ID, agent="strategist", status="running"))
    session.commit()
    assert client.post("/agents/strategist/run").status_code == 409


def test_csv_export_escapes_formula_injection(client, evidence_payload):
    client.post("/evidence", json={**evidence_payload, "title": '=HYPERLINK("x")'})
    report = client.get("/opportunities.csv")
    assert report.status_code == 200
    assert "'=HYPERLINK" in report.text


def test_local_mode_rejects_host_and_origin_rebinding(client):
    assert client.get("/overview", headers={"host": "attacker.example"}).status_code == 403
    assert client.post("/agents/radar/run", headers={"origin": "https://attacker.example"}).status_code == 403


def test_instagram_is_not_claimed_ready_without_credentials(client):
    info = client.get("/integrations").json()
    assert info["instagram"]["publishing_enabled"] is False
    assert client.post("/instagram/sync").status_code == 409


def test_optional_search_uses_official_api_without_fetching_profiles(session, monkeypatch):
    from backend.app.config import Settings

    monkeypatch.setattr(
        "backend.app.research.get_settings",
        lambda: Settings(search_enabled=True, brave_search_api_key="test-only"),
    )
    visited = []
    feed = b'<?xml version="1.0"?><rss version="2.0"><channel><title>Empty fixture</title></channel></rss>'

    def handler(request):
        visited.append(request.url.host)
        if request.url.host == "news.google.com":
            return httpx.Response(200, content=feed)
        assert request.url.host == "api.search.brave.com"
        assert request.headers["X-Subscription-Token"] == "test-only"
        return httpx.Response(
            200,
            json={
                "web": {
                    "results": [
                        {
                            "url": "https://www.instagram.com/example_business/",
                            "title": "Fixture profissional",
                            "description": "Resultado sintético de teste.",
                        }
                    ]
                }
            },
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as transport:
        rows, errors = collect(session.get(Workspace, LOCAL_WORKSPACE_ID), transport)
    assert not errors and len(rows) == 2
    assert rows[0]["category"] == "professional" and rows[0]["source_type"] == "search_candidate"
    assert "www.instagram.com" not in visited


def test_content_version_prevents_lost_update(session):
    import pytest
    from sqlalchemy.orm import Session
    from sqlalchemy.orm.exc import StaleDataError

    item = Content(workspace_id=LOCAL_WORKSPACE_ID, title="Versão de teste", format="caption", body={})
    session.add(item)
    session.commit()
    with Session(session.bind) as other:
        concurrent = other.get(Content, item.id)
        item.title = "Edição que chega primeiro"
        session.commit()
        concurrent.title = "Edição concorrente obsoleta"
        with pytest.raises(StaleDataError):
            other.commit()
