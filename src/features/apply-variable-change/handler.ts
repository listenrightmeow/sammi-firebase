import { fail, ok, refuse, Refusal, type Answer } from "../../core/answers.ts";
import { fieldsText, without } from "../../core/docs.ts";
import { checkFields, commit, current, fieldName, fieldValue, stamped, target } from "../../core/document.ts";
import { emit } from "../../core/events.ts";
import { host } from "../../core/host.ts";
import { run } from "../../core/run.ts";
import { publish } from "../../core/store.ts";

// SPEC-DOC-009. Issued by the poller for each field of a bound fb_<collection> variable that
// differs from the last snapshot (H5, SF-ADR-007 §3). Same invariants as Set Field; a refused
// change is reverted in the variable and announced by WriteRejected (compensating).
export async function handle(input: {
  collection?: string;
  id?: string;
  field?: string;
  value?: unknown;
}): Promise<Answer> {
  return run(async () => {
    const h = host();
    const t = target(input);
    const schema = h.state.schema.get(t.collection);
    if (schema && !schema.twoWay) refuse("not two-way", t.collection);
    const previousCause = h.cause;
    h.cause = "variable";
    try {
      return await apply(t, input);
    } catch (e) {
      if (!(e instanceof Refusal)) throw e;
      await publish(t.collection, { resend: t.id });
      await emit("WriteRejected", {
        collection: t.collection,
        id: t.id,
        field: input.field,
        reason: e.message,
      });
      return fail(e.reason, e.detail);
    } finally {
      h.cause = previousCause;
    }
  });
}

async function apply(t: ReturnType<typeof target>, input: { field?: string; value?: unknown }): Promise<Answer> {
  const field = fieldName(input.field);
  const before = current(t);
  if (input.value === null) {
    if (!before || !(field in before.fields)) refuse("missing", `${t.collection}/${t.id} ${field}`);
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
  }
  const value = fieldValue(field, input.value);
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
}
