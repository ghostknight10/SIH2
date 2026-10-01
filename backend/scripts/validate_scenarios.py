"""Validate all scenario JSON files exactly as the server does at startup."""
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))

from app.scenario import load_scenarios

scenarios = load_scenarios(root / "scenarios")
for scenario in scenarios.values():
    print(f"OK  {scenario.id}: {len(scenario.teams)} teams, {len(scenario.units)} units, {len(scenario.events)} timed events")
print(f"Validated {len(scenarios)} scenario(s).")
