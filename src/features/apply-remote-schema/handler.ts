import { ok, refuse, type Answer } from "../../core/answers.ts";
import { emit } from "../../core/events.ts";
import { host } from "../../core/host.ts";
import { checkCollection } from "../../core/names.ts";
import { requireConnected, run } from "../../core/run.ts";
import { putSchema } from "../../core/store.ts";

// SPEC-COL-003. A declaration changed on another machine; newest wins. Never writes to the cloud.
export async function handle(input: {
  name: string;
  fields: string[];
  strict: boolean;
  twoWay: boolean;
  remoteTimestamp: number;
}): Promise<Answer> {
  return run(async () => {
    requireConnected();
    const name = checkCollection(input.name);
    const t = input.remoteTimestamp;
    const local = host().state.schema.get(name);
    if (local && local.t >= t) refuse("remote schema older");
    const entry = { fields: input.fields, strict: input.strict, twoWay: input.twoWay, t };
    await putSchema(name, entry);
    await emit(
      "CollectionDefined",
      { collection: name, fields: JSON.stringify(entry.fields), strict: entry.strict, twoWay: entry.twoWay },
      { source: "remote" },
    );
    return ok({ answer: "ok" });
  });
}
