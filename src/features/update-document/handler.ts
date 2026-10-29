import { ok, refuse, type Answer } from "../../core/answers.ts";
import { fieldsText } from "../../core/docs.ts";
import { checkFields, commit, current, parseFieldsBox, stamped, target } from "../../core/document.ts";
import { emit } from "../../core/events.ts";
import { run } from "../../core/run.ts";

// SPEC-DOC-003. Merge into an existing document; the cloud receives only the given fields (rule 4).
export async function handle(input: { collection?: string; id?: string; fields?: string }): Promise<Answer> {
  return run(async () => {
    const t = target(input);
    const changes = parseFieldsBox(input.fields);
    const before = current(t);
    const merged = { ...(before?.fields ?? {}), ...changes };
    checkFields(t.collection, t.id, merged, Object.keys(changes));
    if (!before) refuse("missing", `${t.collection}/${t.id}`);
    const after = stamped(merged);
    await commit(t, after, { op: "update", fields: changes, at: after.t }, () =>
      emit("DocumentUpdated", {
        collection: t.collection,
        id: t.id,
        fields: fieldsText(merged),
        previous: fieldsText(before.fields),
        changed: fieldsText(changes),
      }),
    );
    return ok({ answer: fieldsText(merged), document: merged });
  });
}
