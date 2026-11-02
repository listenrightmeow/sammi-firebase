import type { Fields } from "./docs.ts";
import { host } from "./host.ts";
import { DOTTED_ID, overMessage } from "./store.ts";

export type ApplyVariableChange = (change: {
  collection: string;
  id: string;
  field: string;
  value: unknown;
}) => Promise<unknown>;

let running = false;

/** How many documents one tick reads from a collection too large to read whole (D32). */
const POLL_BATCH = 10;

/** The fields of one document that differ from what was published; a missing field is a removal. */
function differences(baseline: Fields, fields: Fields): [string, unknown][] {
  const out: [string, unknown][] = Object.entries(fields).filter(([field, value]) => baseline[field] !== value);
  for (const field of Object.keys(baseline)) if (!(field in fields)) out.push([field, null]);
  return out;
}

/**
 * H5, rule 8: write what changed in a bound fb_<collection> variable. A change is a difference from
 * what the extension last published, not from the mirror: a command updates the mirror before it
 * rewrites the variable, and writing the old value back in that gap would undo the command. A reply
 * read while the variable was being rewritten is stale, so it is dropped and the next poll reads again.
 */
export async function pollVariables(
  read: (name: string) => Promise<unknown>,
  apply: ApplyVariableChange,
): Promise<void> {
  const { state } = host();
  if (running || !state.connected || state.publishing) return;
  running = true;
  try {
    for (const collection of [...state.published.keys()]) {
      if (state.schema.get(collection)?.twoWay === false) continue;
      const published = state.published.get(collection) ?? {};
      if (overMessage(published)) await pollLarge(collection, published, read, apply);
      else await pollWhole(collection, read, apply);
    }
  } finally {
    running = false;
  }
}

async function pollWhole(
  collection: string,
  read: (name: string) => Promise<unknown>,
  apply: ApplyVariableChange,
): Promise<void> {
  const { state } = host();
  let seen = state.publishes;
  const variable = await read(`fb_${collection}`);
  if (!variable || typeof variable !== "object") return;
  for (const [id, fields] of Object.entries(variable as Record<string, Fields | null>)) {
    if (!fields) continue;
    const baseline = state.published.get(collection)?.[id] ?? {};
    for (const [field, value] of differences(baseline, fields)) {
      if (state.publishes !== seen) return;
      await apply({ collection, id, field, value });
      seen = state.publishes;
    }
  }
}

/** D32: a few documents per tick, each in its own message, coming round to all of them in turn. */
async function pollLarge(
  collection: string,
  published: Record<string, Fields>,
  read: (name: string) => Promise<unknown>,
  apply: ApplyVariableChange,
): Promise<void> {
  const { state } = host();
  const ids = Object.keys(published).filter((id) => DOTTED_ID.test(id));
  const start = state.pollCursor.get(collection) ?? 0;
  state.pollCursor.set(collection, ids.length ? (start + POLL_BATCH) % ids.length : 0);
  for (let k = 0; k < Math.min(POLL_BATCH, ids.length); k++) {
    const id = ids[(start + k) % ids.length] as string;
    let seen = state.publishes;
    const fields = await read(`fb_${collection}.${id}`);
    if (!fields || typeof fields !== "object") continue;
    const baseline = state.published.get(collection)?.[id] ?? {};
    for (const [field, value] of differences(baseline, fields as Fields)) {
      if (state.publishes !== seen) return;
      await apply({ collection, id, field, value });
      seen = state.publishes;
    }
  }
}
