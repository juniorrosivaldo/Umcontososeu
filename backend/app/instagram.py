import re

import httpx

from .config import get_settings


def readiness(workspace_id):
    s = get_settings()
    return bool(
        s.meta_access_token
        and s.meta_ig_user_id
        and s.meta_workspace_id == workspace_id
        and re.fullmatch(r"v\d+\.\d+", s.meta_api_version)
    )


def account_metrics(workspace_id):
    s = get_settings()
    if not readiness(workspace_id):
        raise ValueError("Configure token oficial, ID da conta, empresa vinculada e versão da API Meta.")
    # Instagram API with Instagram Login. Token stays in the server, never in browser or logs.
    url = f"https://graph.instagram.com/{s.meta_api_version}/me"
    response = httpx.get(
        url,
        headers={"Authorization": f"Bearer {s.meta_access_token}"},
        params={"fields": "user_id,username,media_count,followers_count"},
        timeout=20,
    )
    response.raise_for_status()
    account = response.json()
    if str(account.get("user_id")) != s.meta_ig_user_id:
        raise ValueError("A API retornou uma conta diferente da configurada.")
    metrics = {
        key: account[key]
        for key in ("followers_count", "media_count")
        if type(account.get(key)) is int and account[key] >= 0
    }
    if not metrics:
        raise ValueError("A API não retornou métricas compatíveis; verifique versão e permissões.")
    return {"account_id": str(account["user_id"]), "metrics": metrics}
