import { ok, refuse, type Answer } from "../../core/answers.ts";
import { fieldsText } from "../../core/docs.ts";
import { commit, current, target } from "../../core/document.ts";
import { emit } from "../../core/events.ts";
import { host } from "../../core/host.ts";
import { run } from "../../core/run.ts";

// SPEC-DOC-007. The pending entry is the tombstone until the cloud acknowledges (rule 5).
export async function handle(input: { collection?: string; id?: string }): Promise<Answer> {
  return run(async () => {
    const t = target(input);
    const before = current(t);
    if (!before) refuse("missing", `${t.collection}/${t.id}`);
    await commit(t, undefined, { op: "delete", at: host().ports.now() }, () =>
      emit("DocumentDeleted", { collection: t.collection, id: t.id, previous: fieldsText(before.fields) }),
    );
    return ok({ answer: "ok" });
  });
}
