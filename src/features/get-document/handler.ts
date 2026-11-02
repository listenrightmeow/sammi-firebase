import { ok, refuse, type Answer } from "../../core/answers.ts";
import { fieldsText } from "../../core/docs.ts";
import { current, localTarget } from "../../core/document.ts";
import { run } from "../../core/run.ts";

// SPEC-QRY-001. From the mirror only; unpack returns the per-field variables for the host to set.
export async function handle(input: { collection?: string; id?: string; unpack?: string }): Promise<Answer> {
  return run(async () => {
    const t = localTarget(input);
    const doc = current(t);
    if (!doc) refuse("missing", `${t.collection}/${t.id}`);
    const variables = input.unpack
      ? Object.fromEntries(Object.entries(doc.fields).map(([k, v]) => [`${input.unpack}_${k}`, v]))
      : undefined;
    return ok({ answer: fieldsText(doc.fields), document: { ...doc.fields }, ...(variables ? { variables } : {}) });
  });
}
