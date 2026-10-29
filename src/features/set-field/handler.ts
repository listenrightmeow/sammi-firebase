import { ok, type Answer } from "../../core/answers.ts";
import { fieldsText } from "../../core/docs.ts";
import { boxValue, checkFields, commit, current, fieldName, stamped, target } from "../../core/document.ts";
import { emit } from "../../core/events.ts";
import { run } from "../../core/run.ts";

// SPEC-DOC-004. One field without JSON; creates the document when absent.
export async function handle(input: {
  collection?: string;
  id?: string;
  field?: string;
  value?: unknown;
}): Promise<Answer> {
  return run(async () => {
    const t = target(input);
    const field = fieldName(input.field);
    const value = boxValue(input.value);
    const before = current(t);
    const fields = { ...(before?.fields ?? {}), [field]: value };
    checkFields(t.collection, t.id, fields, [field]);
    const after = stamped(fields);
    await commit(
      t,
      after,
      { op: "set_field", field, value, at: after.t },
      () =>
        before
          ? emit("DocumentUpdated", {
              collection: t.collection,
              id: t.id,
              fields: fieldsText(fields),
              previous: fieldsText(before.fields),
              changed: fieldsText({ [field]: value }),
            })
          : emit("DocumentCreated", { collection: t.collection, id: t.id, fields: fieldsText(fields) }),
      { wholeDocument: !before },
    );
    return ok({ answer: String(value), value });
  });
}
