"""Scenario files: loading and validation (pipeline step 1).

A scenario is a JSON file describing teams, units and timed events. Validation is strict
and fails at startup so a bad file is caught immediately, not mid-exercise.
"""
import json
from dataclasses import dataclass
from pathlib import Path

SIDES = ("friendly", "enemy")


class ScenarioError(ValueError):
    pass


@dataclass(frozen=True)
class Team:
    id: str
    name: str
    side: str


@dataclass(frozen=True)
class Unit:
    id: str
    name: str
    team: str
    kind: str
    lat: float
    lon: float


@dataclass(frozen=True)
class Scenario:
    id: str
    name: str
    description: str
    teams: tuple[Team, ...]
    units: tuple[Unit, ...]
    events: tuple[dict, ...]

    @property
    def friendly_team_ids(self) -> tuple[str, ...]:
        return tuple(t.id for t in self.teams if t.side == "friendly")

    def side_of(self, team_id: str) -> str:
        for t in self.teams:
            if t.id == team_id:
                return t.side
        raise KeyError(team_id)


def _req(d, key, where):
    if not isinstance(d, dict):
        raise ScenarioError(f"{where}: expected an object")
    if key not in d:
        raise ScenarioError(f"{where}: missing '{key}'")
    return d[key]


def _str(d, key, where) -> str:
    v = _req(d, key, where)
    if not isinstance(v, str) or not v.strip():
        raise ScenarioError(f"{where}: '{key}' must be a non-empty string")
    return v.strip()


def _num(d, key, where, lo=None, hi=None) -> float:
    v = _req(d, key, where)
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        raise ScenarioError(f"{where}: '{key}' must be a number")
    if (lo is not None and v < lo) or (hi is not None and v > hi):
        raise ScenarioError(f"{where}: '{key}' out of range")
    return float(v)


def _list(d, key, where, allow_empty=False) -> list:
    v = _req(d, key, where)
    if not isinstance(v, list) or (not v and not allow_empty):
        raise ScenarioError(f"{where}: '{key}' must be a{'' if allow_empty else ' non-empty'} list")
    return v


def parse_scenario(data: dict, source: str = "scenario") -> Scenario:
    sid = _str(data, "id", source)
    name = _str(data, "name", source)
    description = data.get("description", "")
    if not isinstance(description, str):
        raise ScenarioError(f"{source}: 'description' must be a string")

    teams, seen_teams = [], set()
    for i, t in enumerate(_list(data, "teams", source)):
        where = f"{source}: teams[{i}]"
        tid = _str(t, "id", where)
        side = _str(t, "side", where)
        if side not in SIDES:
            raise ScenarioError(f"{where}: 'side' must be one of {SIDES}")
        if tid in seen_teams:
            raise ScenarioError(f"{where}: duplicate team id {tid!r}")
        seen_teams.add(tid)
        teams.append(Team(tid, _str(t, "name", where), side))
    if not any(t.side == "friendly" for t in teams):
        raise ScenarioError(f"{source}: needs at least one friendly team")

    units, seen_units = [], set()
    for i, u in enumerate(_list(data, "units", source)):
        where = f"{source}: units[{i}]"
        uid = _str(u, "id", where)
        team = _str(u, "team", where)
        if uid in seen_units:
            raise ScenarioError(f"{where}: duplicate unit id {uid!r}")
        if team not in seen_teams:
            raise ScenarioError(f"{where}: unknown team {team!r}")
        seen_units.add(uid)
        units.append(Unit(uid, _str(u, "name", where), team, _str(u, "kind", where),
                          _num(u, "lat", where, -90, 90), _num(u, "lon", where, -180, 180)))

    friendly_ids = {t.id for t in teams if t.side == "friendly"}
    events = []
    for i, e in enumerate(_list(data, "events", source, allow_empty=True) if "events" in data else []):
        where = f"{source}: events[{i}]"
        _num(e, "at", where, lo=0)
        kind = _str(e, "kind", where)
        if kind == "report":
            _str(e, "text", where)
            to = _list(e, "to", where)
            bad = [t for t in to if not isinstance(t, str) or t not in friendly_ids]
            if bad:
                raise ScenarioError(f"{where}: 'to' must list friendly team ids (bad: {bad})")
            if "alt_text" in e:
                _str(e, "alt_text", where)
            if "conflict_prob" in e:
                _num(e, "conflict_prob", where, lo=0, hi=1)
        events.append(dict(e))
    events.sort(key=lambda e: e["at"])

    return Scenario(sid, name, description, tuple(teams), tuple(units), tuple(events))


def load_scenarios(directory) -> dict[str, Scenario]:
    directory = Path(directory)
    if not directory.is_dir():
        raise ScenarioError(f"scenario directory not found: {directory}")
    found: dict[str, Scenario] = {}
    for path in sorted(directory.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ScenarioError(f"{path.name}: invalid JSON ({exc})") from exc
        scenario = parse_scenario(data, source=path.name)
        if scenario.id in found:
            raise ScenarioError(f"{path.name}: duplicate scenario id {scenario.id!r}")
        found[scenario.id] = scenario
    if not found:
        raise ScenarioError(f"no scenario files found in {directory}")
    return found
