import { ok, refuse, type Answer } from "../../core/answers.ts";
import { fieldsText, without } from "../../core/docs.ts";
import { commit, current, fieldName, stamped, target } from "../../core/document.ts";
import { emit } from "../../core/events.ts";
import { run } from "../../core/run.ts";

// SPEC-DOC-006. Remove one field of an existing document.
export async function handle(input: { collection?: string; id?: string; field?: string }): Promise<Answer> {
  return run(async () => {
    const t = target(input);
    const field = fieldName(input.field);
    const before = current(t);
    if (!before) refuse("missing", `${t.collection}/${t.id}`);
    if (!(field in before.fields)) refuse("missing", `${t.collection}/${t.id} ${field}`);
    const fields = without(before.fields, field);
    const after = stamped(fields);
    await commit(t, after, { op: "delete_field", field, at: after.t }, () =>
      emit("DocumentUpdated", {
        collection: t.collection,
        id: t.id,
        fields: fieldsText(fields),
        previous: fieldsText(before.fields),
        removed: field,
      }),
    );
    return ok({ answer: "ok", document: fields });
  });
}
