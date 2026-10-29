import { readFileSync, existsSync } from "node:fs";
import libCoverage from "istanbul-lib-coverage";

// The coverage gate (SF-ADR-012 stage 8, SF-ADR-017): the spec run and the unit run measured
// together against the constants in contracts/quality-gates.json. A missing report is a failure,
// never a pass, and the uncovered lines are named so a CI-only miss identifies itself.

interface Gates {
  const: { coverage: { lines: number; branches: number; scope: string[] } };
}

export interface GateResult {
  ok: boolean;
  lines: number;
  branches: number;
  report: string[];
}

const globToRegex = (glob: string): RegExp =>
  new RegExp(
    "/" +
      glob
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*\//g, "(?:.*/)?")
        .replace(/\*\*/g, ".*")
        .replace(/\*/g, "[^/]*") +
      "$",
  );

export function gate(reports: string[], gatesPath = "contracts/quality-gates.json"): GateResult {
  const gates = (JSON.parse(readFileSync(gatesPath, "utf8")) as Gates).const.coverage;
  const report: string[] = [];
  const map = libCoverage.createCoverageMap({});
  for (const file of reports) {
    if (!existsSync(file)) {
      return { ok: false, lines: 0, branches: 0, report: [`missing coverage report ${file}`] };
    }
    map.merge(JSON.parse(readFileSync(file, "utf8")) as libCoverage.CoverageMapData);
  }
  const scope = gates.scope.map(globToRegex);
  const summary = libCoverage.createCoverageSummary();
  for (const file of map.files()) {
    if (!scope.some((r) => r.test(file))) continue;
    const fc = map.fileCoverageFor(file);
    summary.merge(fc.toSummary());
    const uncovered = fc.getUncoveredLines();
    if (uncovered.length) report.push(`${file}: lines ${uncovered.join(",")}`);
  }
  const lines = summary.lines.pct;
  const branches = summary.branches.pct;
  const ok = summary.lines.total > 0 && lines >= gates.lines && branches >= gates.branches;
  report.unshift(`coverage: lines ${lines}% (floor ${gates.lines}), branches ${branches}% (floor ${gates.branches})`);
  return { ok, lines, branches, report };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = gate(["coverage/spec/coverage-final.json", "coverage/unit/coverage-final.json"]);
  for (const line of result.report) console.log(line);
  process.exit(result.ok ? 0 : 1);
}
