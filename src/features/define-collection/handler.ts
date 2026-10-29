import { ok, refuse, type Answer } from "../../core/answers.ts";
import { emit } from "../../core/events.ts";
import { host } from "../../core/host.ts";
import { NAME, checkCollection } from "../../core/names.ts";
import { requireConnected, run } from "../../core/run.ts";
import { putSchema, userPath } from "../../core/store.ts";

// SPEC-COL-001. Declared locally and in meta/schema so another machine inherits it (H1).
export async function handle(input: {
  name?: string;
  fields?: string;
  strict?: boolean;
  twoWay?: boolean;
}): Promise<Answer> {
  return run(async () => {
    const uid = requireConnected();
    const name = checkCollection(input.name);
    const fields = (input.fields ?? "")
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean);
    for (const f of fields) if (!NAME.test(f)) refuse("bad collection name", f);
    const entry = { fields, strict: input.strict ?? false, twoWay: input.twoWay ?? true, t: host().ports.now() };
    await putSchema(name, entry);
    await host().ports.db.set(userPath(uid, `meta/schema/${name}`), {
      fields,
      strict: entry.strict,
      two_way: entry.twoWay,
      _t: entry.t,
    });
    await emit("CollectionDefined", {
      collection: name,
      fields: JSON.stringify(fields),
      strict: entry.strict,
      twoWay: entry.twoWay,
    });
    return ok({ answer: "ok" });
  });
}
