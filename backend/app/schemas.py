import ipaddress
from datetime import datetime
from typing import Literal
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import BaseModel, Field, field_validator


def public_url(value: str) -> str:
    url = urlsplit(value.strip())
    host = url.hostname or ""
    if url.scheme != "https" or not host or url.username or url.password or url.port not in (None, 443):
        raise ValueError("Use uma URL pública HTTPS sem credenciais.")
    if host in ("localhost",) or host.endswith((".local", ".internal")) or "." not in host:
        raise ValueError("Endereço privado não permitido.")
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        raise ValueError("Use um domínio público, não um endereço IP.")
    query = urlencode([(k, v) for k, v in parse_qsl(url.query) if not k.lower().startswith("utm_")])
    return urlunsplit(("https", host.lower(), url.path or "/", query, ""))


class EvidenceInput(BaseModel):
    title: str = Field(min_length=5, max_length=400)
    url: str = Field(max_length=1800)
    excerpt: str = Field(min_length=20, max_length=1500)
    topic: str = Field(min_length=3, max_length=120)
    publisher: str = Field(default="", max_length=200)
    category: Literal["article", "competitor", "creator", "community", "professional"] = "article"
    _url = field_validator("url")(public_url)


class CreativeInput(BaseModel):
    format: Literal["reel", "caption", "carousel", "stories", "story", "campaign"] = "story"
    brief: str = Field(min_length=5, max_length=1500)
    evidence_ids: list[str] = Field(default_factory=list, max_length=10)


class ContentBody(BaseModel):
    text: str = Field(max_length=12000)
    caption: str = Field(max_length=3000)
    scenes: list[str] = Field(max_length=12)
    slides: list[str] = Field(max_length=10)
    hashtags: list[str] = Field(max_length=10)
    cover_prompt: str = Field(max_length=2000)
    notes: str = Field(max_length=2000)


class ContentEdit(BaseModel):
    title: str = Field(min_length=3, max_length=300)
    body: ContentBody
    version: int = Field(ge=1)


class ApprovalInput(BaseModel):
    version: int = Field(ge=1)
    confirmed: bool


class PlanInput(BaseModel):
    scheduled_at: datetime
    version: int = Field(ge=1)


class SettingInput(BaseModel):
    enabled: bool
    interval_hours: int = Field(ge=6, le=168)


class CustomerInput(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    contact: str = Field(default="", max_length=250)
    notes: str = Field(default="", max_length=2000)
    consent: bool = False


class OrderInput(BaseModel):
    customer_id: str
    description: str = Field(min_length=3, max_length=500)
    amount_cents: int = Field(ge=0, le=100000000)
    confirmed: bool


class OrderUpdate(BaseModel):
    status: Literal["requested", "in_progress", "delivered", "paid", "canceled"]
    confirmed: bool


class StrategyItem(BaseModel):
    title: str = Field(min_length=5, max_length=300)
    rationale: str = Field(min_length=20, max_length=2000)
    action: str = Field(min_length=10, max_length=2000)
    category: Literal["content", "positioning", "engagement", "conversion", "growth"]
    priority: int = Field(ge=0, le=100)
    evidence_ids: list[str] = Field(min_length=1, max_length=10)


class StrategyOutput(BaseModel):
    recommendations: list[StrategyItem] = Field(min_length=1, max_length=5)


class CreativeOutput(BaseModel):
    title: str = Field(min_length=3, max_length=300)
    body: ContentBody
