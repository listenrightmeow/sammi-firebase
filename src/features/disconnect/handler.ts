import { ok, type Answer } from "../../core/answers.ts";
import { emit } from "../../core/events.ts";
import { host } from "../../core/host.ts";
import { requireConnected, run } from "../../core/run.ts";

// SPEC-CON-002. Forget the session; keep the config, the schema and the mirror.
export async function handle(): Promise<Answer> {
  return run(async () => {
    requireConnected();
    await endSession("user");
    return ok({ answer: "ok" });
  });
}

export async function endSession(reason: "user" | "session", detail: Record<string, unknown> = {}): Promise<void> {
  const { ports, state } = host();
  await ports.auth.signOut();
  await ports.ini.remove("connection", "session");
  Object.assign(state, { connected: false, uid: undefined, session: undefined });
  await emit("Disconnected", { reason, ...detail });
}
