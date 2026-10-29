import { ok, type Answer } from "../../core/answers.ts";
import { emit } from "../../core/events.ts";
import { requireConnected, run } from "../../core/run.ts";
import { reconcile } from "../../core/sync.ts";

// SPEC-CON-003. The on-demand reconcile (H2): the same rules Connect runs.
export async function handle(): Promise<Answer> {
  return run(async () => {
    requireConnected();
    const counts = await reconcile("command");
    await emit("MirrorReconciled", { ...counts, cause: "command" });
    return ok({ answer: "ok", value: counts });
  });
}
