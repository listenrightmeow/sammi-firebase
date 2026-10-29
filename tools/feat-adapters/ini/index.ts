import { WorldAdapter, type AdapterConfig, type SeedRecord } from "../adapter.ts";
import type { CapturedRecord, World } from "../world.ts";

// firebase.ini. Captures IniWrite { section, key, value, json? } and IniDelete { section, key }.
// Seeds IniWrite records (value, or json written as JSON text).

function seed(w: World, r: SeedRecord): void {
  if (r.type !== "IniWrite") throw new Error(`ini seeds IniWrite records, not '${r.type}' — configuration error.`);
  const { section, key, value, json } = r.values as { section: string; key: string; value?: string; json?: unknown };
  w.iniSet(section, key, value ?? JSON.stringify(json));
}

function read(w: World): CapturedRecord[] {
  const out: CapturedRecord[] = [];
  for (const [section, keys] of w.ini)
    for (const [key, value] of keys)
      out.push({
        type: "IniWrite",
        key: `${section}/${key}`,
        payload: w.iniPayload(section, key, value),
        timestamp: w.now,
      });
  return out;
}

export function createAdapter(config: AdapterConfig = {}): WorldAdapter {
  return new WorldAdapter("ini", config, seed, read);
}
