"""Create and verify a consistent SQLite backup without stopping the application."""

import argparse
import hashlib
import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default="data/umconto.db")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    source = Path(args.source).resolve()
    output = Path(args.output).resolve()
    if not source.is_file():
        raise SystemExit(f"Banco não encontrado: {source}")
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        raise SystemExit(f"Destino já existe; escolha outro nome: {output}")
    with sqlite3.connect(f"file:{source}?mode=ro", uri=True) as origin, sqlite3.connect(output) as target:
        origin.backup(target)
        integrity = target.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise RuntimeError(f"Backup inválido: {integrity}")
        tables = {
            row[0]: target.execute(f'SELECT count(*) FROM "{row[0]}"').fetchone()[0]
            for row in target.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        }
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    manifest = {
        "created_at": datetime.now(UTC).isoformat(),
        "source": str(source),
        "backup": str(output),
        "sha256": digest,
        "size_bytes": output.stat().st_size,
        "integrity_check": "ok",
        "table_counts": tables,
    }
    manifest_path = output.with_suffix(output.suffix + ".manifest.json")
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(manifest, ensure_ascii=False))


if __name__ == "__main__":
    main()
