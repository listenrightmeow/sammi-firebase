import { WorldAdapter, type AdapterConfig } from "../adapter.ts";

// SAMMI Core through the Bridge. Captures SetVariable { name, value } and Trigger { name, pullData }.
// Nothing to seed and no state to read: SAMMI's own variables are the extension's output only.

export function createAdapter(config: AdapterConfig = {}): WorldAdapter {
  return new WorldAdapter("sammi", config, undefined, () => null);
}
