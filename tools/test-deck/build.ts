import { mkdirSync, writeFileSync } from "node:fs";
import { buildStamp } from "../build/stamp.ts";
import { testDeck } from "./deck.ts";

// pnpm build:test-deck → dist/sammi-firebase-tests.sef. The commands come from SAMMI Firebase itself,
// so install that first. This file adds a deck and a one-line tab. It has the same sections as the
// gateway probe: with an empty script and command section, SAMMI did not offer to uninstall it.

const UNIQUE_ID = "sammifirebasetestdeck";

export function assembleTestDeck(stamp = buildStamp()): string {
  const over = {
    deck_data: JSON.stringify(testDeck(UNIQUE_ID, stamp)),
    unique_id: UNIQUE_ID,
    include_image: {},
    sammi_version: "2025.2.0",
    bridge: true,
  };
  return [
    "[extension_name]",
    "SAMMI Firebase Test Deck",
    "[extension_info]",
    "The on-PC test deck for SAMMI Firebase (tools/test-deck/README.md). Needs SAMMI Firebase installed. Not part of a release.",
    "[extension_version]",
    "1.0.0",
    "[insert_external]",
    '<div style="font-family: system-ui, sans-serif; font-size: 13px">SAMMI Firebase Test Deck, build ' +
      stamp +
      ". Adds a deck and nothing else.</div>",
    "",
    "[insert_command]",
    "sammiFirebaseTestDeck.main();",
    "",
    "[insert_hook]",
    "// none",
    "",
    "[insert_script]",
    `var sammiFirebaseTestDeck = { main: function () { console.log("SAMMI Firebase Test Deck ${stamp}"); } };`,
    "",
    "[insert_over]",
    JSON.stringify(over),
    "",
  ].join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sef = assembleTestDeck();
  mkdirSync("dist", { recursive: true });
  writeFileSync("dist/sammi-firebase-tests.sef", sef);
  console.log(`dist/sammi-firebase-tests.sef ${new TextEncoder().encode(sef).length} bytes`);
}
