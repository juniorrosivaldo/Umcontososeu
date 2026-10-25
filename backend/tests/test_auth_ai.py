import httpx

from backend.app.config import Settings
from backend.app.db import LOCAL_WORKSPACE_ID
from backend.app.models import Membership
from backend.app.schemas import StrategyOutput


def test_production_auth_requires_verified_user_and_membership(client, session, monkeypatch):
    config = Settings(
        app_mode="production",
        supabase_url="https://example.supabase.co",
        supabase_anon_key="test-placeholder",
    )
    monkeypatch.setattr("backend.app.auth.get_settings", lambda: config)
    assert client.get("/overview").status_code == 401

    def verified(*args, **kwargs):
        return httpx.Response(200, json={"id": "test-user"})

    monkeypatch.setattr("backend.app.auth.httpx.get", verified)
    headers = {"Authorization": "Bearer test-only", "X-Workspace-Id": LOCAL_WORKSPACE_ID}
    assert client.get("/overview", headers=headers).status_code == 403
    session.add(Membership(workspace_id=LOCAL_WORKSPACE_ID, user_id="test-user", role="viewer"))
    session.commit()
    assert client.get("/overview", headers=headers).status_code == 200
    assert client.post("/agents/radar/run", headers=headers).status_code == 403
    assert client.post("/customers", headers=headers, json={"name": "Fictício"}).status_code == 403
    assert (
        client.get("/overview", headers={**headers, "X-Workspace-Id": "another-workspace"}).status_code == 403
    )


def test_ai_rejects_hallucinated_evidence_ids(client, evidence_payload, monkeypatch):
    client.post("/evidence", json=evidence_payload)
    config = Settings(ai_enabled=True, openai_api_key="test-only-not-a-real-key")
    monkeypatch.setattr("backend.app.agents.get_settings", lambda: config)
    monkeypatch.setattr(
        "backend.app.agents.ai.generate",
        lambda *args: StrategyOutput.model_validate(
            {
                "recommendations": [
                    {
                        "title": "Recomendação de teste",
                        "rationale": "Justificativa sintética com fonte inexistente.",
                        "action": "Teste sintético de integridade de evidências.",
                        "category": "content",
                        "priority": 60,
                        "evidence_ids": ["invented-id"],
                    }
                ]
            }
        ),
    )
    run = client.post("/agents/strategist/run").json()
    assert run["status"] == "failed" and "inexistentes" in run["error"]
    assert client.get("/recommendations").json() == []


def test_production_configuration_fails_closed():
    import pytest

    with pytest.raises(RuntimeError, match="PostgreSQL"):
        Settings(app_mode="production", database_url="sqlite:///test.db").validate_runtime()


def test_sanitized_openai_errors_do_not_leak_credentials(client, evidence_payload, monkeypatch):
    client.post("/evidence", json=evidence_payload)
    monkeypatch.setattr(
        "backend.app.agents.get_settings", lambda: Settings(ai_enabled=True, openai_api_key="test-secret")
    )

    def fail(*args):
        request = httpx.Request(
            "POST", "https://api.openai.com/v1/responses", headers={"Authorization": "Bearer test-secret"}
        )
        response = httpx.Response(429, request=request)
        raise httpx.HTTPStatusError("sensitive test-secret", request=request, response=response)

    monkeypatch.setattr("backend.app.agents.ai.generate", fail)
    run = client.post("/agents/strategist/run").json()
    assert run["status"] == "failed" and "429" in run["error"] and "test-secret" not in str(run)


def test_official_instagram_read_binds_expected_account(monkeypatch):
    import pytest

    from backend.app.instagram import account_metrics

    config = Settings(
        meta_access_token="test-only",
        meta_ig_user_id="12345",
        meta_workspace_id=LOCAL_WORKSPACE_ID,
        meta_api_version="v26.0",
    )
    monkeypatch.setattr("backend.app.instagram.get_settings", lambda: config)

    def response(url, **kwargs):
        assert url == "https://graph.instagram.com/v26.0/me"
        assert kwargs["params"]["fields"].startswith("user_id,")
        return httpx.Response(
            200,
            request=httpx.Request("GET", url),
            json={"user_id": "12345", "followers_count": 10, "media_count": 2},
        )

    monkeypatch.setattr("backend.app.instagram.httpx.get", response)
    assert account_metrics(LOCAL_WORKSPACE_ID)["metrics"]["followers_count"] == 10
    with pytest.raises(ValueError, match="Configure"):
        account_metrics("another-company")
    config.meta_ig_user_id = "99999"
    with pytest.raises(ValueError, match="diferente"):
        account_metrics(LOCAL_WORKSPACE_ID)
