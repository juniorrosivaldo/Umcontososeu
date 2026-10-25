"""Provision a tenant and its owner after creating the Supabase Auth user."""

import argparse
from uuid import UUID

from backend.app.db import SessionLocal, initialize
from backend.app.models import AgentSetting, Membership, Workspace


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", required=True)
    parser.add_argument("--handle", default="")
    parser.add_argument("--segment", required=True)
    parser.add_argument("--themes", required=True, help="Themes separated by commas")
    parser.add_argument("--owner-user-id", required=True, type=UUID)
    parser.add_argument("--voice", default="Clara, cuidadosa e baseada em evidências.")
    args = parser.parse_args()
    initialize()
    with SessionLocal() as db:
        workspace = Workspace(
            name=args.name,
            handle=args.handle,
            segment=args.segment,
            themes=[t.strip() for t in args.themes.split(",") if t.strip()],
            brand={"voice": args.voice},
        )
        db.add(workspace)
        db.flush()
        db.add(Membership(workspace_id=workspace.id, user_id=str(args.owner_user_id), role="owner"))
        for name in ["radar", "strategist", "creative"]:
            db.add(AgentSetting(workspace_id=workspace.id, agent=name, interval_hours=24))
        db.commit()
        print("Workspace criado:", workspace.id)


if __name__ == "__main__":
    main()
