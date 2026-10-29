#!/usr/bin/env python3
"""Regenerate the Facet directory from the Moment model and check it the way Facet will.

Runs `moment simulate model --out-dir model/facet --all` with the ADR-038 CLI, then replicates
Facet's scenario check: every event type must be in its topology's eventRouting or start with one
of Facet's synthetic prefixes (SYNTHETIC_PREFIXES in facet/packages/client/src/contracts/
moment-ir-validation.ts; SimQuery accepted since mmmnt/facet 27b1a40, 2026-10-29). A command or
query placed on a branch lane has no lane context, so the simulator emits its bare name and Facet
rejects the scenario; keep such nodes on the context lane inside the when block.

Usage: python3 tools/export_facet.py [path-to-moment-adr037]
"""
import json, pathlib, subprocess, sys, re

HERE = pathlib.Path(__file__).resolve().parent.parent
ADR = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path("/Volumes/Storage/development/projects/complai/moment-adr037")
CLI = ADR / "packages/cli/dist/moment.mjs"
OUT = HERE / "model/facet"

if not CLI.exists():
    sys.exit(f"ADR-038 CLI not found at {CLI}; pass the moment-adr037 worktree path as the first argument")

subprocess.run(["rm", "-rf", str(OUT)], check=True)
r = subprocess.run(["node", str(CLI), "simulate", str(HERE / "model"), "--out-dir", str(OUT), "--all"], capture_output=True, text=True)
print(r.stdout.strip() or r.stderr.strip())
if r.returncode != 0:
    sys.exit(r.returncode)

PREFIXES = ("SimAction", "SimProcess", "SimSaga", "SimBranch", "SimProjection", "SimQuery", "SimOutput", "SimExternal", "SimFailure")
routing = {}
for f in OUT.glob("topology-*.json"):
    t = json.loads(f.read_text()); routing[t["flowId"]] = set(t["eventRouting"].keys())
rejected = []
for f in sorted(OUT.glob("scenario-*.json")):
    s = json.loads(f.read_text()); known = routing.get(s.get("flowId") or s.get("topologyId"), set())
    bad = sorted({e["eventType"] for e in s["events"] if e["eventType"] not in known and not e["eventType"].startswith(tuple(p + "." for p in PREFIXES))})
    if bad: rejected.append((f.name, bad))
for name, bad in rejected: print(f"FACET WOULD REJECT {name}: {', '.join(bad)}")
print(f"scenarios Facet would reject: {len(rejected)}")
m = json.loads((OUT / "manifest.json").read_text())
print("manifest flows:", len(m["flows"]), "| scenarios:", sum(len(fl.get("scenarios", [])) for fl in m["flows"]))
