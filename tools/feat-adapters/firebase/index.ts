import { WorldAdapter, type AdapterConfig, type SeedRecord } from "../adapter.ts";
import type { CapturedRecord, World } from "../world.ts";

// The user's Realtime Database and its Authentication. Captures set, update, remove and increment.
// Seeds: node { path, value } (database contents), user { email, password, uid },
// provider { name, enabled } (Email/Password switched off in the console),
// project { apiKey, projectId } (the API key the project actually has), later { path, value } (a write
// by another device arriving after the Bridge's first full read), outage { writes } (the next N
// document writes fail as if the network dropped).

function seed(w: World, r: SeedRecord): void {
  const v = r.values;
  switch (r.type) {
    case "node":
      w.dbSet(v.path as string, v.value);
      return;
    case "later":
      w.later.push({ path: v.path as string, value: v.value });
      return;
    case "outage":
      w.outage = v.writes as number;
      return;
    case "user":
      w.users.push({ email: v.email as string, password: v.password as string, uid: v.uid as string });
      return;
    case "provider":
      w.providerEnabled = v.enabled as boolean;
      return;
    case "project":
      w.projects.push({ apiKey: v.apiKey as string, projectId: v.projectId as string });
      return;
    default:
      throw new Error(`firebase cannot seed '${r.type}' — configuration error.`);
  }
}

function read(w: World): CapturedRecord[] {
  return [{ type: "node", key: "", payload: { path: "", value: w.tree }, timestamp: w.now }];
}

export function createAdapter(config: AdapterConfig = {}): WorldAdapter {
  return new WorldAdapter("firebase", config, seed, read);
}
