import { ok, type Answer } from "../../core/answers.ts";
import { run } from "../../core/run.ts";
import { status } from "../../core/status.ts";

// SPEC-QRY-007. Works in every state, so a deck can branch before it writes.
export async function handle(): Promise<Answer> {
  return run(async () => {
    const s = status();
    return ok({ answer: JSON.stringify(s), status: s });
  });
}
