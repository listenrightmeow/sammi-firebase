import { ok, refuse, type Answer } from "../../core/answers.ts";
import { current, fieldName, target } from "../../core/document.ts";
import { run } from "../../core/run.ts";

// SPEC-QRY-002. The default answers for a missing document or field, so a deck never sees undefined.
export async function handle(input: {
  collection?: string;
  id?: string;
  field?: string;
  default?: string;
}): Promise<Answer> {
  return run(async () => {
    const t = target(input);
    const field = fieldName(input.field);
    const doc = current(t);
    const value = doc?.fields[field];
    if (value === undefined) {
      if (input.default !== undefined) return ok({ answer: input.default, value: input.default });
      refuse("missing", doc ? `${t.collection}/${t.id} ${field}` : `${t.collection}/${t.id}`);
    }
    return ok({ answer: String(value), value });
  });
}
