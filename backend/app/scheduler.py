"""One-shot scheduler. Called by GitHub Actions, never a permanently running agent."""

import os
import sys
from datetime import timedelta, timezone

from sqlalchemy import select

from .agents import run_agent
from .db import SessionLocal, initialize
from .models import AgentRun, AgentSetting, Workspace, now


def main():
    initialize()
    workspace_id = os.environ.get("WORKSPACE_ID", "")
    if not workspace_id:
        raise RuntimeError("WORKSPACE_ID é obrigatório; execução sem empresa foi recusada.")
    failed = False
    with SessionLocal() as db:
        if not db.get(Workspace, workspace_id):
            raise RuntimeError("Empresa não provisionada.")
        for agent in ("radar", "strategist"):
            setting = db.scalar(
                select(AgentSetting).where(
                    AgentSetting.workspace_id == workspace_id, AgentSetting.agent == agent
                )
            )
            if setting and not setting.enabled:
                print(agent, "paused")
                continue
            last = db.scalar(
                select(AgentRun)
                .where(AgentRun.workspace_id == workspace_id, AgentRun.agent == agent)
                .order_by(AgentRun.created_at.desc())
                .limit(1)
            )
            interval = setting.interval_hours if setting else 24
            if last and last.created_at.replace(tzinfo=timezone.utc) + timedelta(hours=interval) > now():
                print(agent, "not_due")
                continue
            result = run_agent(db, workspace_id, agent)
            print(agent, result.status, "results", result.result_count)
            failed = failed or result.status in ("failed", "partial")
    return int(failed)


if __name__ == "__main__":
    sys.exit(main())
