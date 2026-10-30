import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { build as esbuild } from "esbuild";
import { SAMMI_MIN } from "../build/deck.ts";

// Builds dist/gateway-probe.sef (T-D2): a separate, throwaway extension with no commands and an
// empty deck. Its tab runs tools/probe/steps.ts against the real Bridge. Not part of the release.

export const PROBE_VERSION = "1.0.0";
const UNIQUE_ID = "sammifirebasegatewayprobe";

export function assembleProbe(script: string, tab: string): string {
  const over = {
    deck_data: JSON.stringify({
      background_color: 4210752.0,
      on: true,
      grid_y: 8.0,
      snap_grid: true,
      lb_version: SAMMI_MIN,
      background_image: "",
      sammi_version: SAMMI_MIN,
      encrypted: false,
      adaptive_resizing: true,
      unique_id: UNIQUE_ID,
      deck_name: "Gateway Probe",
      grid_x: 5.0,
      stretch: false,
      button_list: [],
    }),
    unique_id: UNIQUE_ID,
    include_image: {},
    sammi_version: SAMMI_MIN,
    bridge: true,
  };
  return [
    "[extension_name]",
    "SAMMI Firebase Gateway Probe",
    "[extension_info]",
    "Checks the SAMMI Bridge helpers SAMMI Firebase relies on (ini, variables, triggers) and reports what they return. Writes only to firebase-probe.ini and the global fb_probe. Safe to uninstall.",
    "[extension_version]",
    PROBE_VERSION,
    "[insert_external]",
    tab.trim(),
    "",
    "[insert_command]",
    "gatewayProbe.main();",
    "",
    "[insert_hook]",
    "// none",
    "",
    "[insert_script]",
    script.trim(),
    "",
    "[insert_over]",
    JSON.stringify(over),
    "",
  ].join("\n");
}

export async function bundleProbe(): Promise<string> {
  const out = await esbuild({
    entryPoints: ["tools/probe/main.ts"],
    bundle: true,
    format: "iife",
    globalName: "gatewayProbe",
    platform: "browser",
    target: "chrome127",
    write: false,
    legalComments: "none",
    define: { PROBE_VERSION: JSON.stringify(PROBE_VERSION) },
  });
  return out.outputFiles[0]?.text ?? "";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sef = assembleProbe(await bundleProbe(), readFileSync("tools/probe/tab.html", "utf8"));
  new Function(sef.slice(sef.indexOf("[insert_script]\n") + 16, sef.indexOf("[insert_over]")));
  mkdirSync("dist", { recursive: true });
  writeFileSync("dist/gateway-probe.sef", sef);
  console.log(`dist/gateway-probe.sef ${new TextEncoder().encode(sef).length} bytes`);
}
