import { host } from "./host.ts";

export type ApplyVariableChange = (change: {
  collection: string;
  id: string;
  field: string;
  value: unknown;
}) => Promise<unknown>;

let running = false;

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
  if (running || !state.connected) return;
  running = true;
  try {
    for (const collection of [...state.published.keys()]) {
      if (state.schema.get(collection)?.twoWay === false) continue;
      let seen = state.publishes;
      const variable = await read(`fb_${collection}`);
      if (!variable || typeof variable !== "object") continue;
      const change = async (id: string, field: string, value: unknown): Promise<boolean> => {
        if (state.publishes !== seen) return false;
        await apply({ collection, id, field, value });
        seen = state.publishes;
        return true;
      };
      changes: for (const [id, fields] of Object.entries(variable as Record<string, Record<string, unknown>>)) {
        const baseline = state.published.get(collection)?.[id] ?? {};
        for (const [field, value] of Object.entries(fields ?? {})) {
          if (baseline[field] !== value && !(await change(id, field, value))) break changes;
        }
        if (!fields) continue;
        for (const field of Object.keys(baseline)) {
          if (!(field in fields) && !(await change(id, field, null))) break changes;
        }
      }
    }
  } finally {
    running = false;
  }
}
