import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from backend.app import main
from backend.app.config import get_settings
from backend.app.db import LOCAL_WORKSPACE_ID, get_db, make_engine
from backend.app.models import AgentSetting, Base, Workspace


@pytest.fixture
def session(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path}/test.db")
    Base.metadata.create_all(engine)
    with sessionmaker(engine, expire_on_commit=False)() as db:
        db.add(
            Workspace(
                id=LOCAL_WORKSPACE_ID,
                name="Um Conto Só Seu",
                handle="@umcontososeu",
                themes=["Literatura infantil", "Presentes personalizados"],
                segment="Livros",
                brand={"voice": "Acolhedora"},
            )
        )
        db.flush()
        for name in ["radar", "strategist", "creative"]:
            db.add(AgentSetting(workspace_id=LOCAL_WORKSPACE_ID, agent=name))
        db.commit()
        yield db
    engine.dispose()


@pytest.fixture
def client(session, monkeypatch):
    # Override database and configuration so tests never touch development data or live APIs.
    settings = get_settings().model_copy(
        update={"app_mode": "local", "ai_enabled": False, "openai_api_key": ""}
    )
    for module in [
        "backend.app.auth",
        "backend.app.agents",
        "backend.app.main",
        "backend.app.ai",
        "backend.app.instagram",
    ]:
        monkeypatch.setattr(module + ".get_settings", lambda: settings)
    main.app.dependency_overrides[get_db] = lambda: session
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


@pytest.fixture
def evidence_payload():
    return {
        "title": "Leitura infantil em família: exemplo de teste",
        "url": "https://example.org/leitura?utm_source=test",
        "excerpt": "Fixture sintética para testes: livros personalizados e leitura infantil.",
        "topic": "Literatura infantil",
        "publisher": "Fonte sintética de teste",
        "category": "article",
    }
