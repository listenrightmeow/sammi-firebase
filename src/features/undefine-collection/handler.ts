import { ok, refuse, type Answer } from "../../core/answers.ts";
import { emit } from "../../core/events.ts";
import { host } from "../../core/host.ts";
import { checkCollection } from "../../core/names.ts";
import { requireConnected, run } from "../../core/run.ts";
import { userPath } from "../../core/store.ts";

// SPEC-COL-002. Removes the declaration only; documents are never touched (COL-02).
export async function handle(input: { name?: string }): Promise<Answer> {
  return run(async () => {
    const uid = requireConnected();
    const name = checkCollection(input.name);
    const { ports, state } = host();
    if (!state.schema.has(name)) refuse("not defined", name);
    state.schema.delete(name);
    await ports.ini.remove("schema", name);
    await ports.db.remove(userPath(uid, `meta/schema/${name}`));
    await emit("CollectionUndefined", { collection: name });
    return ok({ answer: "ok" });
  });
}
