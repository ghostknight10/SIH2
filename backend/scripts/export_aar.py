"""Export a persisted session's AAR from SQLite after the live server is stopped/restarted.

Usage:
    python scripts/export_aar.py SESSION_ID --db sih.db --out aar

Creates aar.json and aar.html in the output directory.
"""
import argparse
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))

from app.aar import assignments_from_events, build_aar, render_html
from app.config import load_settings
from app.db import Database
from app.scenario import load_scenarios


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("session_id")
    parser.add_argument("--db", default=None)
    parser.add_argument("--scenario-dir", default=None)
    parser.add_argument("--out", default="aar_export")
    args = parser.parse_args()

    settings = load_settings()
    db_path = args.db or settings.db_path
    scenario_dir = Path(args.scenario_dir or settings.scenario_dir)
    db = Database(db_path)
    row = db.get_session(args.session_id)
    if row is None:
        raise SystemExit(f"Session not found: {args.session_id}")
    scenarios = load_scenarios(scenario_dir)
    scenario = scenarios.get(row["scenario_id"])
    if scenario is None:
        raise SystemExit(f"Scenario not found: {row['scenario_id']}")

    events = db.get_events(args.session_id)
    assignments = assignments_from_events(events)
    aar = build_aar(events, assignments, {
        "id": scenario.id,
        "name": scenario.name,
        "description": scenario.description,
    })

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "aar.json").write_text(json.dumps(aar, indent=2, default=str), encoding="utf-8")
    (out / "aar.html").write_text(render_html(aar), encoding="utf-8")
    print(f"Exported {out / 'aar.json'}")
    print(f"Exported {out / 'aar.html'}")


if __name__ == "__main__":
    main()
