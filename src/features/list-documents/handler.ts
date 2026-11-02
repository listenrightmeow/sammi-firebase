import { ok, type Answer } from "../../core/answers.ts";
import { host } from "../../core/host.ts";
import { checkCollection } from "../../core/names.ts";
import { run } from "../../core/run.ts";

// SPEC-QRY-004. Ids sorted; [] for an unknown collection.
export async function handle(input: { collection?: string }): Promise<Answer> {
  return run(async () => {
    const collection = checkCollection(input.collection);
    const ids = [...(host().state.mirror.get(collection)?.keys() ?? [])].sort();
    return ok({ answer: JSON.stringify(ids), ids });
  });
}
