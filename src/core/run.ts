import { fail, Refusal, type Answer } from "./answers.ts";
import { boot } from "./store.ts";
import { host } from "./host.ts";
import { refuse } from "./answers.ts";

/** Every handler: boot the mirror once, then turn a refusal anywhere inside into its answer. */
export async function run(body: () => Promise<Answer>): Promise<Answer> {
  try {
    await boot();
    return await body();
  } catch (e) {
    if (e instanceof Refusal) return fail(e.reason, e.detail);
    throw e;
  }
}

export function requireConnected(): string {
  const { state } = host();
  if (!state.connected || !state.uid) refuse("not connected");
  return state.uid;
}
