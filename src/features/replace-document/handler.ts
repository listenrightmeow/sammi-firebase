import { ok, type Answer } from "../../core/answers.ts";
import { fieldsText } from "../../core/docs.ts";
import { checkFields, commit, current, parseFieldsBox, stamped, target } from "../../core/document.ts";
import { emit } from "../../core/events.ts";
import { run } from "../../core/run.ts";

// SPEC-DOC-002. The whole record; creates the document when absent (upsert).
export async function handle(input: { collection?: string; id?: string; fields?: string }): Promise<Answer> {
  return run(async () => {
    const t = target(input);
    const fields = parseFieldsBox(input.fields);
    checkFields(t.collection, t.id, fields, Object.keys(fields));
    const before = current(t);
    const after = stamped(fields);
    await commit(t, after, { op: "replace", fields, at: after.t }, () =>
      before
        ? emit("DocumentReplaced", {
            collection: t.collection,
            id: t.id,
            fields: fieldsText(fields),
            previous: fieldsText(before.fields),
          })
        : emit("DocumentCreated", { collection: t.collection, id: t.id, fields: fieldsText(fields) }),
    );
    return ok({ answer: fieldsText(fields), document: fields });
  });
}
