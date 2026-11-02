import { ok, refuse, type Answer } from "../../core/answers.ts";
import { fieldsText } from "../../core/docs.ts";
import { checkFields, commit, current, parseFieldsBox, stamped, target } from "../../core/document.ts";
import { emit } from "../../core/events.ts";
import { run } from "../../core/run.ts";

// SPEC-DOC-001. A blank id is a generated push id; an existing id is refused (DOC-01).
export async function handle(input: { collection?: string; id?: string; fields?: string }): Promise<Answer> {
  return run(async () => {
    const t = target(input, { blankId: true });
    const fields = parseFieldsBox(input.fields);
    checkFields(t.collection, t.id, fields, Object.keys(fields));
    if (current(t)) refuse("exists", `${t.collection}/${t.id}`);
    const after = stamped(fields);
    await commit(t, after, { op: "create", fields, at: after.t }, () =>
      emit("DocumentCreated", { collection: t.collection, id: t.id, fields: fieldsText(fields) }),
    );
    // The answer is all a button receives, so a generated id has to be in it.
    if (input.id === "") return ok({ answer: JSON.stringify({ ...fields, id: t.id }), document: fields, value: t.id });
    return ok({ answer: fieldsText(fields), document: fields });
  });
}
