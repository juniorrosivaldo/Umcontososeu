from dataclasses import dataclass

import httpx
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .db import LOCAL_WORKSPACE_ID, get_db
from .models import Membership


@dataclass
class Actor:
    workspace_id: str
    user_id: str
    role: str


def require_actor(request: Request, db: Session = Depends(get_db)):
    settings = get_settings()
    if settings.app_mode == "local":
        if request.client is None or request.client.host not in ("127.0.0.1", "::1", "testclient"):
            raise HTTPException(403, "Modo local aceita somente conexões locais.")
        if request.url.hostname not in ("127.0.0.1", "localhost", "::1", "testserver"):
            raise HTTPException(403, "Host não permitido no modo local.")
        origin = request.headers.get("origin")
        if origin:
            from urllib.parse import urlsplit

            if urlsplit(origin).hostname not in ("localhost", "127.0.0.1", "::1"):
                raise HTTPException(403, "Origem não permitida.")
        return Actor(LOCAL_WORKSPACE_ID, "local-owner", "owner")
    auth = request.headers.get("authorization", "")
    workspace = request.headers.get("x-workspace-id", "")
    if not auth.startswith("Bearer ") or not workspace:
        raise HTTPException(401, "Entre com Supabase e selecione sua empresa.")
    try:
        response = httpx.get(
            settings.supabase_url.rstrip("/") + "/auth/v1/user",
            headers={"Authorization": auth, "apikey": settings.supabase_anon_key},
            timeout=10,
        )
        if response.status_code != 200:
            raise HTTPException(401, "Sessão inválida ou expirada.")
        user_id = response.json()["id"]
    except (httpx.HTTPError, KeyError, ValueError):
        raise HTTPException(503, "Não foi possível validar a sessão.") from None
    member = db.scalar(
        select(Membership).where(Membership.workspace_id == workspace, Membership.user_id == user_id)
    )
    if not member:
        raise HTTPException(403, "Sem acesso a esta empresa.")
    return Actor(workspace, user_id, member.role)


def editor(actor: Actor = Depends(require_actor)):
    if actor.role not in ("owner", "editor"):
        raise HTTPException(403, "Esta ação exige papel de editor.")
    return actor


def owner(actor: Actor = Depends(require_actor)):
    if actor.role != "owner":
        raise HTTPException(403, "Aprovação exige o responsável pela empresa.")
    return actor
