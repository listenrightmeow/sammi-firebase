import { ok, type Answer } from "../../core/answers.ts";
import { requireConnected, run } from "../../core/run.ts";
import { select, type QueryInput } from "../../core/query.ts";

// SPEC-QRY-006. The same filter as Query Documents; the count as text.
export async function handle(input: QueryInput): Promise<Answer> {
  return run(async () => {
    requireConnected();
    const count = select({
      collection: input.collection,
      field: input.field,
      operator: input.operator,
      value: input.value,
    }).length;
    return ok({ answer: String(count), count });
  });
}
