import html
import re
import unicodedata
from datetime import datetime, timezone
from urllib.parse import quote, urlsplit

import feedparser
import httpx
from sqlalchemy import select

from .config import get_settings
from .models import Evidence
from .schemas import public_url


def normalize(value):
    return "".join(c for c in unicodedata.normalize("NFKD", value.lower()) if not unicodedata.combining(c))


def classify(title, excerpt, topic, themes):
    corpus = normalize(title + " " + excerpt)
    matched = [t for t in themes if any(w in corpus for w in normalize(t).split() if len(w) > 4)]
    commercial = any(w in corpus for w in ["personaliz", "presente", "livro", "compra"])
    score = min(100, 20 + min(4, len(matched)) * 15 + (20 if commercial else 0))
    reasons = [f"Afinidade temática com {t}." for t in matched[:4]]
    if commercial:
        reasons.append("Vocabulário relacionado a livros, presentes ou personalização.")
    if not reasons:
        reasons.append(f"Fonte registrada em {topic}; afinidade ainda fraca.")
    reasons.append("Pontuação heurística de afinidade; não mede demanda, receita ou tamanho de audiência.")
    return score, reasons


def store_evidence(db, workspace, data):
    url = public_url(data["url"])
    existing = db.scalar(select(Evidence).where(Evidence.workspace_id == workspace.id, Evidence.url == url))
    if existing:
        return existing, False
    score, reasons = classify(data["title"], data.get("excerpt", ""), data["topic"], workspace.themes)
    record = Evidence(workspace_id=workspace.id, **{**data, "url": url}, score=score, reasons=reasons)
    db.add(record)
    db.flush()
    return record, True


def parse_feed(data: bytes, topic: str):
    feed = feedparser.parse(data)
    if not feed.get("version"):
        raise ValueError("A fonte não retornou um feed RSS/Atom válido.")
    result = []
    for entry in feed.entries[:12]:
        try:
            url = public_url(entry.get("link", ""))
        except ValueError:
            continue
        title = html.unescape(entry.get("title", "")).strip()[:400]
        if not title:
            continue
        summary = html.unescape(re.sub(r"<[^>]*>", "", entry.get("summary", "")))[:1000]
        published = entry.get("published_parsed")
        result.append(
            {
                "title": title,
                "url": url,
                "excerpt": summary,
                "topic": topic,
                "publisher": entry.get("source", {}).get("title", feed.feed.get("title", ""))[:200],
                "published_at": datetime(*published[:6], tzinfo=timezone.utc) if published else None,
                "source_type": "public_feed",
                "category": "article",
            }
        )
    return result


def collect(workspace, client=None):
    # Only a fixed public RSS endpoint is fetched. User-provided evidence URLs are never fetched.
    own_client = client is None
    client = client or httpx.Client(
        timeout=12, follow_redirects=False, headers={"User-Agent": "UmContoResearch/0.1 (public RSS reader)"}
    )
    rows, errors = [], []
    try:
        for topic in workspace.themes[:6]:
            url = f"https://news.google.com/rss/search?q={quote(topic)}&hl=pt-BR&gl=BR&ceid=BR:pt-419"
            try:
                response = client.get(url)
                response.raise_for_status()
                if len(response.content) > 2_000_000:
                    raise ValueError("Feed excedeu o limite de tamanho.")
                rows.extend(parse_feed(response.content, topic))
            except (httpx.HTTPError, ValueError) as exc:
                status = getattr(getattr(exc, "response", None), "status_code", None)
                errors.append(
                    {
                        "topic": topic,
                        "source": url,
                        "error": f"Fonte indisponível ({status or type(exc).__name__}). Verifique rede e disponibilidade.",
                    }
                )
        settings = get_settings()
        if settings.search_enabled:
            if not settings.brave_search_api_key:
                errors.append(
                    {
                        "topic": "Busca web",
                        "source": "https://api.search.brave.com",
                        "error": "Busca web habilitada sem chave. RSS permanece independente.",
                    }
                )
            else:
                # Two bounded queries, through the official search API. No scraping or following accounts.
                for suffix in [
                    "marcas empresas livros personalizados"
                    if workspace.handle == "@umcontososeu"
                    else "empresas marcas",
                    "criadores profissionais comunidades site:instagram.com",
                ]:
                    query = workspace.segment + " " + suffix
                    try:
                        response = client.get(
                            "https://api.search.brave.com/res/v1/web/search",
                            params={"q": query, "count": 10, "country": "BR", "search_lang": "pt-br"},
                            headers={
                                "X-Subscription-Token": settings.brave_search_api_key,
                                "Accept": "application/json",
                            },
                        )
                        response.raise_for_status()
                        for result in response.json().get("web", {}).get("results", [])[:10]:
                            try:
                                url = public_url(result.get("url", ""))
                            except ValueError:
                                continue
                            title = html.unescape(result.get("title", ""))[:400]
                            if not title:
                                continue
                            host = urlsplit(url).hostname or ""
                            rows.append(
                                {
                                    "title": title,
                                    "url": url,
                                    "excerpt": html.unescape(
                                        re.sub(r"<[^>]*>", "", result.get("description", ""))
                                    )[:1000],
                                    "topic": workspace.themes[0] if workspace.themes else workspace.segment,
                                    "publisher": host,
                                    "source_type": "search_candidate",
                                    "category": "professional"
                                    if host in ("instagram.com", "www.instagram.com")
                                    else "article",
                                }
                            )
                    except (httpx.HTTPError, ValueError) as exc:
                        errors.append(
                            {
                                "topic": query,
                                "source": "https://api.search.brave.com",
                                "error": f"Busca web indisponível ({type(exc).__name__}). Verifique configuração e cota.",
                            }
                        )
    finally:
        if own_client:
            client.close()
    return rows, errors
