import { ok, refuse, type Answer } from "../../core/answers.ts";
import { fieldsText } from "../../core/docs.ts";
import { checkFields, commit, current, fieldName, stamped, target } from "../../core/document.ts";
import { emit } from "../../core/events.ts";
import { run } from "../../core/run.ts";

// SPEC-DOC-005. A server-side increment, so increments from two machines both count; the answer
// is the new total: the write is the read (SF-ADR-005 §3).
export async function handle(input: {
  collection?: string;
  id?: string;
  field?: string;
  by?: unknown;
}): Promise<Answer> {
  return run(async () => {
    const t = target(input);
    const field = fieldName(input.field);
    const raw = input.by ?? 1;
    const by = typeof raw === "number" ? raw : /^-?\d+(\.\d+)?$/.test(String(raw)) ? Number(raw) : NaN;
    if (!Number.isFinite(by)) refuse("not a number", String(raw));
    const before = current(t);
    const existing = before?.fields[field];
    if (existing !== undefined && typeof existing !== "number") refuse("not a number", field);
    const total = (existing ?? 0) + by;
    const fields = { ...(before?.fields ?? {}), [field]: total };
    checkFields(t.collection, t.id, fields, [field]);
    const after = stamped(fields);
    await commit(t, after, { op: "increment", field, by, at: after.t }, () =>
      before
        ? emit("DocumentUpdated", {
            collection: t.collection,
            id: t.id,
            fields: fieldsText(fields),
            previous: fieldsText(before.fields),
            changed: fieldsText({ [field]: total }),
          })
        : emit("DocumentCreated", { collection: t.collection, id: t.id, fields: fieldsText(fields) }),
    );
    return ok({ answer: String(total), value: total });
  });
}
