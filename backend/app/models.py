from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def now():
    return datetime.now(timezone.utc)


def uid():
    return str(uuid4())


class Base(DeclarativeBase):
    pass


class Workspace(Base):
    __tablename__ = "workspaces"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(120))
    handle: Mapped[str] = mapped_column(String(100), default="")
    segment: Mapped[str] = mapped_column(String(120), default="")
    themes: Mapped[list] = mapped_column(JSON, default=list)
    brand: Mapped[dict] = mapped_column(JSON, default=dict)


class Membership(Base):
    __tablename__ = "memberships"
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    role: Mapped[str] = mapped_column(String(20), default="viewer")


class TenantRecord:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Evidence(TenantRecord, Base):
    __tablename__ = "evidence"
    __table_args__ = (UniqueConstraint("workspace_id", "url", name="uq_evidence_workspace_url"),)
    title: Mapped[str] = mapped_column(String(400))
    url: Mapped[str] = mapped_column(String(1800))
    excerpt: Mapped[str] = mapped_column(Text, default="")
    topic: Mapped[str] = mapped_column(String(120))
    publisher: Mapped[str] = mapped_column(String(200), default="")
    source_type: Mapped[str] = mapped_column(String(30), default="manual")
    category: Mapped[str] = mapped_column(String(30), default="article")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    score: Mapped[int] = mapped_column(Integer, default=0)
    reasons: Mapped[list] = mapped_column(JSON, default=list)


class AgentRun(TenantRecord, Base):
    __tablename__ = "agent_runs"
    agent: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(30), default="running")
    mode: Mapped[str] = mapped_column(String(30), default="rules")
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    result_count: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)


Index(
    "uq_running_agent",
    AgentRun.workspace_id,
    AgentRun.agent,
    unique=True,
    sqlite_where=text("status = 'running'"),
    postgresql_where=text("status = 'running'"),
)


class Recommendation(TenantRecord, Base):
    __tablename__ = "recommendations"
    run_id: Mapped[str] = mapped_column(ForeignKey("agent_runs.id"))
    title: Mapped[str] = mapped_column(String(300))
    rationale: Mapped[str] = mapped_column(Text)
    action: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(40), default="content")
    priority: Mapped[int] = mapped_column(Integer)
    evidence_ids: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(30), default="new")


class Content(TenantRecord, Base):
    __tablename__ = "contents"
    format: Mapped[str] = mapped_column(String(30))
    title: Mapped[str] = mapped_column(String(300))
    body: Mapped[dict] = mapped_column(JSON)
    evidence_ids: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(30), default="draft")
    version: Mapped[int] = mapped_column(Integer, default=1)
    commercial: Mapped[bool] = mapped_column(Boolean, default=False)
    approved_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    media_url: Mapped[str | None] = mapped_column(String(1800), nullable=True)
    __mapper_args__ = {"version_id_col": version}


class AgentSetting(TenantRecord, Base):
    __tablename__ = "agent_settings"
    __table_args__ = (UniqueConstraint("workspace_id", "agent", name="uq_agent_setting"),)
    agent: Mapped[str] = mapped_column(String(30))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    interval_hours: Mapped[int] = mapped_column(Integer, default=24)


class Customer(TenantRecord, Base):
    __tablename__ = "customers"
    name: Mapped[str] = mapped_column(String(120))
    contact: Mapped[str] = mapped_column(String(250), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    consent: Mapped[bool] = mapped_column(Boolean, default=False)


class Order(TenantRecord, Base):
    __tablename__ = "orders"
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"))
    description: Mapped[str] = mapped_column(String(500))
    amount_cents: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(30), default="requested")
    approved_by: Mapped[str] = mapped_column(String(100))


class MetricSnapshot(TenantRecord, Base):
    __tablename__ = "metric_snapshots"
    provider: Mapped[str] = mapped_column(String(40), default="instagram")
    account_id: Mapped[str] = mapped_column(String(100))
    metrics: Mapped[dict] = mapped_column(JSON)


class AuditEvent(TenantRecord, Base):
    __tablename__ = "audit_events"
    actor: Mapped[str] = mapped_column(String(100))
    action: Mapped[str] = mapped_column(String(80))
    target_id: Mapped[str] = mapped_column(String(100))
    details: Mapped[dict] = mapped_column(JSON, default=dict)
