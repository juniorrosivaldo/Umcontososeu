import csv
import io
import os
from contextlib import asynccontextmanager
from datetime import timedelta, timezone

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Response
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError

from .agents import AgentError, run_agent
from .auth import Actor, editor, owner, require_actor
from .config import get_settings
from .db import get_db, initialize
from .instagram import account_metrics, readiness
from .models import (
    AgentRun,
    AgentSetting,
    AuditEvent,
    Content,
    Customer,
    Evidence,
    MetricSnapshot,
    Order,
    Recommendation,
    Workspace,
    now,
)
from .research import store_evidence
from .schemas import (
    ApprovalInput,
    ContentEdit,
    CreativeInput,
    CustomerInput,
    EvidenceInput,
    OrderInput,
    OrderUpdate,
    PlanInput,
    SettingInput,
)


@asynccontextmanager
async def lifespan(app):
    initialize()
    yield


app = FastAPI(
    title="Um Conto · Growth API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if get_settings().app_mode == "local" else None,
)


@app.exception_handler(StaleDataError)
async def stale_update(request, exc):
    return JSONResponse(
        status_code=409, content={"detail": "Outra pessoa alterou o conteúdo. Atualize antes de continuar."}
    )


def encode(row):
    data = {col.name: getattr(row, col.name) for col in row.__table__.columns}
    for key, value in data.items():
        if hasattr(value, "tzinfo") and value.tzinfo is None:
            data[key] = value.replace(tzinfo=timezone.utc)
    return jsonable_encoder(data)


def scoped(db, model, actor, limit=100):
    return list(
        db.scalars(
            select(model)
            .where(model.workspace_id == actor.workspace_id)
            .order_by(model.created_at.desc())
            .limit(limit)
        )
    )


def record(db, model, item_id, actor):
    item = db.scalar(select(model).where(model.id == item_id, model.workspace_id == actor.workspace_id))
    if not item:
        raise HTTPException(404, "Registro não encontrado.")
    return item


def audit(db, actor, action, target, details=None):
    db.add(
        AuditEvent(
            workspace_id=actor.workspace_id,
            actor=actor.user_id,
            action=action,
            target_id=target,
            details=details or {},
        )
    )


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(select(1))
    return {"status": "ok", "database": "connected"}


@app.get("/overview")
def overview(actor: Actor = Depends(require_actor), db: Session = Depends(get_db)):
    workspace = db.get(Workspace, actor.workspace_id)
    if not workspace:
        raise HTTPException(404, "Empresa não encontrada.")
    counts = {
        name: db.scalar(
            select(func.count()).select_from(model).where(model.workspace_id == actor.workspace_id)
        )
        for name, model in [
            ("evidence", Evidence),
            ("recommendations", Recommendation),
            ("contents", Content),
            ("customers", Customer),
        ]
    }
    return {
        "workspace": encode(workspace),
        "counts": counts,
        "role": actor.role,
        "mode": get_settings().app_mode,
        "database": "sqlite" if get_settings().database_url.startswith("sqlite") else "postgresql",
        "runs": [encode(x) for x in scoped(db, AgentRun, actor, 8)],
        "recommendations": [
            encode(x)
            for x in db.scalars(
                select(Recommendation)
                .where(Recommendation.workspace_id == actor.workspace_id)
                .order_by(Recommendation.created_at.desc(), Recommendation.priority.desc())
                .limit(5)
            )
        ],
    }


@app.get("/evidence")
def evidence(
    q: str = Query("", max_length=200),
    category: str = "",
    topic: str = "",
    limit: int = Query(100, ge=1, le=500),
    actor: Actor = Depends(require_actor),
    db: Session = Depends(get_db),
):
    query = select(Evidence).where(Evidence.workspace_id == actor.workspace_id)
    if q:
        query = query.where(Evidence.title.icontains(q, autoescape=True))
    if category:
        query = query.where(Evidence.category == category)
    if topic:
        query = query.where(Evidence.topic == topic)
    return [encode(x) for x in db.scalars(query.order_by(Evidence.created_at.desc()).limit(limit))]


@app.post("/evidence", status_code=201)
def add_evidence(data: EvidenceInput, actor: Actor = Depends(editor), db: Session = Depends(get_db)):
    item, added = store_evidence(
        db, db.get(Workspace, actor.workspace_id), {**data.model_dump(), "source_type": "manual"}
    )
    if added:
        audit(db, actor, "evidence.added", item.id)
    db.commit()
    return {"item": encode(item), "created": added}


@app.get("/runs")
def runs(actor: Actor = Depends(require_actor), db: Session = Depends(get_db)):
    return [encode(x) for x in scoped(db, AgentRun, actor)]


@app.post("/agents/{agent}/run")
def execute(
    agent: str,
    data: CreativeInput | None = None,
    actor: Actor = Depends(editor),
    db: Session = Depends(get_db),
):
    try:
        return encode(run_agent(db, actor.workspace_id, agent, data))
    except AgentError as e:
        raise HTTPException(409, str(e)) from None


@app.get("/agents")
def agents(actor: Actor = Depends(require_actor), db: Session = Depends(get_db)):
    settings = get_settings()
    result = []
    for name in ["radar", "strategist", "creative"]:
        setting = db.scalar(
            select(AgentSetting).where(
                AgentSetting.workspace_id == actor.workspace_id, AgentSetting.agent == name
            )
        )
        last = db.scalar(
            select(AgentRun)
            .where(AgentRun.workspace_id == actor.workspace_id, AgentRun.agent == name)
            .order_by(AgentRun.created_at.desc())
            .limit(1)
        )
        result.append(
            {
                "name": name,
                "enabled": setting.enabled if setting else True,
                "interval_hours": setting.interval_hours if setting else 24,
                "level": 2 if name == "creative" else 1,
                "mode": "public_rss"
                if name == "radar"
                else "openai"
                if settings.ai_enabled and settings.openai_api_key
                else "editorial_template"
                if name == "creative"
                else "heuristic",
                "last_run": encode(last) if last else None,
                "next_run": None,
                "schedule_note": "Manual para conteúdos."
                if name == "creative"
                else "GitHub Actions deve ser habilitado no repositório; execução a cada 6h respeita o intervalo.",
            }
        )
    return result


@app.put("/agents/{agent}")
def agent_settings(
    agent: str, data: SettingInput, actor: Actor = Depends(owner), db: Session = Depends(get_db)
):
    if agent not in ("radar", "strategist", "creative"):
        raise HTTPException(404, "Agente não encontrado.")
    setting = db.scalar(
        select(AgentSetting).where(
            AgentSetting.workspace_id == actor.workspace_id, AgentSetting.agent == agent
        )
    )
    if not setting:
        setting = AgentSetting(workspace_id=actor.workspace_id, agent=agent)
        db.add(setting)
    setting.enabled, setting.interval_hours = data.enabled, data.interval_hours
    audit(db, actor, "agent.configured", agent, data.model_dump())
    db.commit()
    return encode(setting)


@app.get("/recommendations")
def recommendations(actor: Actor = Depends(require_actor), db: Session = Depends(get_db)):
    return [encode(x) for x in scoped(db, Recommendation, actor)]


@app.get("/contents")
def contents(actor: Actor = Depends(require_actor), db: Session = Depends(get_db)):
    return [encode(x) for x in scoped(db, Content, actor)]


@app.put("/contents/{item_id}")
def edit_content(
    item_id: str, data: ContentEdit, actor: Actor = Depends(editor), db: Session = Depends(get_db)
):
    item = record(db, Content, item_id, actor)
    if item.version != data.version:
        raise HTTPException(409, "O conteúdo mudou. Atualize antes de salvar.")
    item.title, item.body = data.title, data.body.model_dump()
    item.version += 1
    item.status, item.approved_by, item.approved_at, item.scheduled_at = "draft", None, None, None
    audit(db, actor, "content.edited", item.id, {"version": item.version})
    db.commit()
    return encode(item)


@app.post("/contents/{item_id}/approve")
def approve_content(
    item_id: str, data: ApprovalInput, actor: Actor = Depends(owner), db: Session = Depends(get_db)
):
    item = record(db, Content, item_id, actor)
    if not data.confirmed or item.version != data.version:
        raise HTTPException(409, "Confirme a versão atual para aprovar.")
    if item.status != "draft":
        raise HTTPException(409, "Somente rascunhos podem ser aprovados.")
    item.status, item.approved_by, item.approved_at = "approved", actor.user_id, now()
    audit(db, actor, "content.approved", item.id, {"version": item.version, "commercial": item.commercial})
    db.commit()
    return encode(item)


@app.post("/contents/{item_id}/plan")
def plan_content(
    item_id: str, data: PlanInput, actor: Actor = Depends(editor), db: Session = Depends(get_db)
):
    item = record(db, Content, item_id, actor)
    if item.status not in ("approved", "planned") or item.version != data.version or not item.approved_by:
        raise HTTPException(409, "A versão atual precisa ser aprovada pelo responsável.")
    if not data.scheduled_at.tzinfo or data.scheduled_at <= now() + timedelta(minutes=5):
        raise HTTPException(422, "Informe um horário com fuso e pelo menos 5 minutos no futuro.")
    # SQLite drops timezone offsets. Persist UTC so the serializer can restore an
    # unambiguous instant; PostgreSQL also accepts the normalized aware value.
    item.scheduled_at, item.status = data.scheduled_at.astimezone(timezone.utc), "planned"
    audit(
        db,
        actor,
        "content.planned",
        item.id,
        {"scheduled_at": data.scheduled_at.isoformat(), "external_publication": False},
    )
    db.commit()
    return encode(item)


@app.get("/customers")
def customers(actor: Actor = Depends(require_actor), db: Session = Depends(get_db)):
    return [encode(x) for x in scoped(db, Customer, actor)]


@app.post("/customers", status_code=201)
def add_customer(data: CustomerInput, actor: Actor = Depends(editor), db: Session = Depends(get_db)):
    item = Customer(workspace_id=actor.workspace_id, **data.model_dump())
    db.add(item)
    db.flush()
    audit(db, actor, "customer.added", item.id)
    db.commit()
    return encode(item)


@app.delete("/customers/{item_id}", status_code=204)
def delete_customer(item_id: str, actor: Actor = Depends(owner), db: Session = Depends(get_db)):
    item = record(db, Customer, item_id, actor)
    for order in db.scalars(
        select(Order).where(Order.workspace_id == actor.workspace_id, Order.customer_id == item_id)
    ):
        db.delete(order)
    db.flush()
    db.delete(item)
    audit(db, actor, "customer.deleted", item_id)
    db.commit()


@app.get("/orders")
def orders(actor: Actor = Depends(require_actor), db: Session = Depends(get_db)):
    return [encode(x) for x in scoped(db, Order, actor)]


@app.post("/orders", status_code=201)
def add_order(data: OrderInput, actor: Actor = Depends(owner), db: Session = Depends(get_db)):
    if not data.confirmed:
        raise HTTPException(422, "O responsável deve confirmar o registro financeiro.")
    record(db, Customer, data.customer_id, actor)
    item = Order(
        workspace_id=actor.workspace_id, **data.model_dump(exclude={"confirmed"}), approved_by=actor.user_id
    )
    db.add(item)
    db.flush()
    audit(db, actor, "order.recorded", item.id, {"amount_cents": item.amount_cents})
    db.commit()
    return encode(item)


@app.put("/orders/{item_id}")
def update_order(
    item_id: str, data: OrderUpdate, actor: Actor = Depends(owner), db: Session = Depends(get_db)
):
    if not data.confirmed:
        raise HTTPException(422, "Confirme a atualização administrativa do pedido.")
    item = record(db, Order, item_id, actor)
    previous = item.status
    item.status = data.status
    audit(
        db, actor, "order.status_changed", item.id, {"from": previous, "to": item.status, "no_charge": True}
    )
    db.commit()
    return encode(item)


@app.get("/metrics")
def metrics(actor: Actor = Depends(require_actor), db: Session = Depends(get_db)):
    rows = scoped(db, MetricSnapshot, actor, 90)
    delta = {}
    if len(rows) >= 2:
        delta = {
            key: rows[0].metrics[key] - rows[1].metrics[key]
            for key in rows[0].metrics.keys() & rows[1].metrics.keys()
        }
    return {
        "history": [encode(x) for x in rows],
        "delta": delta,
        "unavailable": ["reach", "views", "interactions", "conversions"],
    }


@app.get("/integrations")
def integrations(actor: Actor = Depends(require_actor)):
    s = get_settings()
    return {
        "openai": {"configured": bool(s.openai_api_key), "enabled": s.ai_enabled, "model": s.openai_model},
        "instagram": {
            "configured": readiness(actor.workspace_id),
            "connection_verified": False,
            "publishing_enabled": False,
        },
        "supabase": {"configured": bool(s.supabase_url), "auth_mode": s.app_mode},
        "search": {"provider": "Google News RSS", "credentials_required": False},
        "automation": {
            "enabled_in_this_process": os.environ.get("ENABLE_AGENT_AUTOMATION") == "true",
            "provider": "GitHub Actions",
            "cron": "17 */6 * * *",
        },
    }


@app.post("/instagram/sync")
def sync_instagram(actor: Actor = Depends(editor), db: Session = Depends(get_db)):
    try:
        data = account_metrics(actor.workspace_id)
    except ValueError as e:
        raise HTTPException(409, str(e)) from None
    except httpx.HTTPError:
        raise HTTPException(502, "Falha na API Meta. Verifique token, permissões, versão e rede.") from None
    item = MetricSnapshot(workspace_id=actor.workspace_id, **data)
    db.add(item)
    db.commit()
    return encode(item)


@app.get("/opportunities.csv")
def report(actor: Actor = Depends(require_actor), db: Session = Depends(get_db)):
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(["Título", "Tema", "Afinidade", "Justificativa", "Fonte", "Origem", "Registrado em"])
    for e in scoped(db, Evidence, actor, 500):

        def safe(value):
            value = str(value)
            return "'" + value if value.lstrip().startswith(("=", "+", "-", "@")) else value

        writer.writerow(
            [
                safe(v)
                for v in [
                    e.title,
                    e.topic,
                    e.score,
                    " ".join(e.reasons),
                    e.url,
                    e.source_type,
                    e.created_at.isoformat(),
                ]
            ]
        )
    return Response(
        "\ufeff" + stream.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="oportunidades.csv"'},
    )
