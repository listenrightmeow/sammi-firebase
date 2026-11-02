import { ok, type Answer } from "../../core/answers.ts";
import { current, localTarget } from "../../core/document.ts";
import { run } from "../../core/run.ts";

// SPEC-QRY-003. An unknown collection is false, not an error.
export async function handle(input: { collection?: string; id?: string }): Promise<Answer> {
  return run(async () => {
    const exists = current(localTarget(input)) !== undefined;
    return ok({ answer: String(exists), value: exists });
  });
}
