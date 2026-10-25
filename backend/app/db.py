from pathlib import Path

from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker

from .config import get_settings
from .models import AgentSetting, Base, Workspace

LOCAL_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001"


def make_engine(url):
    sqlite = url.startswith("sqlite")
    if sqlite and url != "sqlite://":
        Path("data").mkdir(exist_ok=True)
    engine = create_engine(
        url, connect_args={"check_same_thread": False, "timeout": 20} if sqlite else {}, pool_pre_ping=True
    )
    if sqlite:

        @event.listens_for(engine, "connect")
        def pragmas(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")

    return engine


engine = make_engine(get_settings().database_url)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def initialize():
    settings = get_settings()
    settings.validate_runtime()
    if settings.app_mode != "local":
        # Production migrations and memberships are provisioned explicitly.
        with SessionLocal() as db:
            db.execute(select(Workspace.id).limit(1))
        return
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if not db.get(Workspace, LOCAL_WORKSPACE_ID):
            db.add(
                Workspace(
                    id=LOCAL_WORKSPACE_ID,
                    name="Um Conto Só Seu",
                    handle="@umcontososeu",
                    segment="Literatura infantil personalizada",
                    themes=[
                        "Literatura infantil",
                        "Livros personalizados",
                        "Histórias para dormir",
                        "Maternidade",
                        "Educação infantil",
                        "Presentes personalizados",
                    ],
                    brand={
                        "signature": "A aventura começa com o seu nome.",
                        "audience": "Pais e responsáveis por crianças de 4 a 8 anos",
                        "voice": "Acolhedora, imaginativa e gentil. Personagens fictícios; sem promessas terapêuticas ou ofertas não confirmadas.",
                    },
                )
            )
            db.flush()
            for agent in ["radar", "strategist", "creative"]:
                db.add(
                    AgentSetting(
                        workspace_id=LOCAL_WORKSPACE_ID,
                        agent=agent,
                        interval_hours=24 if agent == "radar" else 48,
                    )
                )
            db.commit()


def get_db():
    with SessionLocal() as session:
        yield session
