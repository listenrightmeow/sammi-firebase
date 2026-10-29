import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// The count assertions (SF-ADR-012 stages 5 and 6, SF-ADR-017): a gate that can pass with zero
// work executed is broken, so the pipeline proves the work happened. Generated suites must equal
// spec files, and executed tests must equal declared scenarios.

export function walk(dir: string, suffix: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path, suffix));
    else if (entry.endsWith(suffix)) out.push(path);
  }
  return out;
}

export function scenarioCount(specs: string[]): number {
  return specs.reduce((n, f) => n + (readFileSync(f, "utf8").match(/^scenario /gm) ?? []).length, 0);
}

/** Totals from a JUnit report: the root's tests and failures attributes. */
export function junitTotals(xml: string): { tests: number; failures: number } {
  const root = /<testsuites[^>]*>/.exec(xml)?.[0] ?? "";
  const attr = (name: string): number => Number(new RegExp(`${name}="(\\d+)"`).exec(root)?.[1] ?? NaN);
  return { tests: attr("tests"), failures: attr("failures") + (attr("errors") || 0) };
}

export function counts(specDir: string, junitPath: string): string[] {
  const problems: string[] = [];
  const specs = walk(specDir, ".feat");
  const suites = walk(specDir, ".test.ts");
  const scenarios = scenarioCount(specs);
  if (specs.length === 0) problems.push("no .feat specs found");
  if (suites.length !== specs.length) problems.push(`generated suites ${suites.length} != specs ${specs.length}`);
  const { tests, failures } = junitTotals(readFileSync(junitPath, "utf8"));
  if (!(tests > 0)) problems.push("the run executed zero tests");
  else if (tests !== scenarios) problems.push(`executed tests ${tests} != scenarios ${scenarios}`);
  if (failures > 0) problems.push(`${failures} generated test(s) failed`);
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = counts("specs", ".feature/run/feat-junit.xml");
  for (const p of problems) console.error(`counts: ${p}`);
  if (!problems.length) console.log("counts: suites = specs, executed tests = scenarios");
  process.exit(problems.length ? 1 : 0);
}
