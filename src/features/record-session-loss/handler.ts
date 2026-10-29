import { ok, type Answer } from "../../core/answers.ts";
import { requireConnected, run } from "../../core/run.ts";
import { endSession } from "../disconnect/handler.ts";

// SPEC-CON-004. The SDK reported the session revoked (O7): Disconnected with reason session.
export async function handle(input: { code: string }): Promise<Answer> {
  return run(async () => {
    requireConnected();
    await endSession("session", { code: input.code });
    return ok({ answer: "ok" });
  });
}
