import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { build as esbuild } from "esbuild";
import { deck, extensionCommands, SAMMI_MIN } from "./deck.ts";

// Assembles dist/sammi-firebase.sef (SF-ADR-010, SF-ADR-011) and, with --check, enforces the
// build gates of SF-ADR-017: the bundle parses, the deck parses, every deck command is synchronous,
// no http:// URL, the SDK URL appears once, the file fits the size cap.

export interface Parts {
  version: string;
  script: string;
  tab: string;
  uniqueId: string;
}

export const NAME = "SAMMI Firebase";
const INFO =
  "Keeps your SAMMI records in your own Firebase project: read locally, written through to the cloud, announced as triggers when they change anywhere. MIT licensed.";

export function assemble(p: Parts): string {
  const deckData = deck(p.uniqueId);
  const over = {
    deck_data: JSON.stringify(deckData),
    unique_id: p.uniqueId,
    include_image: {},
    sammi_version: SAMMI_MIN,
    bridge: true,
  };
  return [
    "[extension_name]",
    NAME,
    "[extension_info]",
    INFO,
    "[extension_version]",
    p.version,
    "[insert_external]",
    p.tab.trim(),
    "",
    "[insert_command]",
    "sammiFirebase.main();",
    "",
    "[insert_hook]",
    "// none",
    "",
    "[insert_script]",
    p.script.trim(),
    "",
    "[insert_over]",
    JSON.stringify(over),
    "",
  ].join("\n");
}

const section = (sef: string, name: string): string => {
  const start = sef.indexOf(`[${name}]\n`);
  if (start < 0) return "";
  const body = sef.slice(start + name.length + 3);
  const next = body.search(
    /^\[(extension_name|extension_info|extension_version|insert_external|insert_command|insert_hook|insert_script|insert_over)\]$/m,
  );
  return (next < 0 ? body : body.slice(0, next)).trim();
};

export const SEF_MAX = 204800;
const SDK_URL = "https://www.gstatic.com/firebasejs/";

/** The build gates. Returns the problems found; empty means the .sef passes. */
export function check(sef: string): string[] {
  const problems: string[] = [];
  try {
    new Function(section(sef, "insert_script"));
  } catch (e) {
    problems.push(`[insert_script] does not parse: ${(e as Error).message}`);
  }
  let over: { deck_data?: string; sammi_version?: string; bridge?: boolean } = {};
  try {
    over = JSON.parse(section(sef, "insert_over")) as typeof over;
  } catch {
    problems.push("[insert_over] is not JSON");
  }
  if (over.sammi_version !== SAMMI_MIN) problems.push(`sammi_version must be ${SAMMI_MIN}`);
  if (over.bridge !== true) problems.push("bridge must be true");
  try {
    const deckData = JSON.parse(over.deck_data ?? "") as Record<string, unknown>;
    for (const c of extensionCommands(deckData))
      if (c.async !== 0) problems.push(`deck command '${c.name}' must carry "async": 0.0 (S6)`);
  } catch {
    problems.push("deck_data is not JSON");
  }
  if (sef.includes("http://")) problems.push("the .sef contains an http:// URL");
  const sdk = sef.split(SDK_URL).length - 1;
  if (sdk !== 1) problems.push(`the Firebase SDK URL must appear exactly once, found ${sdk}`);
  const size = new TextEncoder().encode(sef).length;
  if (size > SEF_MAX) problems.push(`the .sef is ${size} bytes, over the ${SEF_MAX} cap`);
  return problems;
}

export async function bundle(entry = "src/ext/main.ts"): Promise<string> {
  const out = await esbuild({
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    globalName: "sammiFirebase",
    platform: "browser",
    target: "chrome127",
    write: false,
    minify: false,
    legalComments: "none",
  });
  return out.outputFiles[0]?.text ?? "";
}

export async function run(argv: string[]): Promise<number> {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
  const sef = assemble({
    version: pkg.version,
    script: await bundle(),
    tab: readFileSync("src/ext/tab.html", "utf8"),
    uniqueId: `sammifirebase${pkg.version.replace(/\D/g, "")}`,
  });
  mkdirSync("dist", { recursive: true });
  writeFileSync("dist/sammi-firebase.sef", sef);
  console.log(`dist/sammi-firebase.sef ${new TextEncoder().encode(sef).length} bytes`);
  if (!argv.includes("--check")) return 0;
  const problems = check(sef);
  for (const p of problems) console.error(`build check: ${p}`);
  return problems.length ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(await run(process.argv.slice(2)));
