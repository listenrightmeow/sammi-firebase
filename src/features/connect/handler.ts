import { fail, ok, refuse, type Answer } from "../../core/answers.ts";
import { emit } from "../../core/events.ts";
import { host } from "../../core/host.ts";
import type { AuthResult, FirebaseConfig } from "../../core/ports.ts";
import { run } from "../../core/run.ts";
import { status } from "../../core/status.ts";
import { documentCount, userPath } from "../../core/store.ts";
import { catchUpIniEdits, reconcile } from "../../core/sync.ts";

// SPEC-CON-001. Sign in, persist the session, catch up ini edits (rule 7), reconcile with the
// cloud, then announce Connected and MirrorReconciled (SF-ADR-003, SF-ADR-004).

export interface ConnectInput {
  config?: Record<string, unknown>;
  email?: string;
  password?: string;
}

const REQUIRED = ["apiKey", "authDomain", "projectId", "appId", "databaseURL"] as const;

function validConfig(config: Record<string, unknown> | undefined): FirebaseConfig {
  const missing = REQUIRED.find((k) => typeof config?.[k] !== "string" || config[k] === "");
  if (missing) refuse("config incomplete", missing);
  // The console shows the database URL with a trailing slash; the SDK's config value has none.
  const c = { ...config, databaseURL: String(config?.databaseURL).replace(/\/+$/, "") } as unknown as FirebaseConfig;
  const valid =
    c.apiKey.length >= 20 &&
    /\.firebaseapp\.com$/.test(c.authDomain) &&
    c.projectId.length > 0 &&
    /^1:\d+:web:[0-9a-f]+$/.test(c.appId) &&
    /^https:\/\/.+\.(firebaseio\.com|firebasedatabase\.app)$/.test(c.databaseURL);
  if (!valid) refuse("invalid config");
  return c;
}

export async function handle(input: ConnectInput = {}): Promise<Answer> {
  return run(async () => {
    const { ports, state } = host();
    if (state.connected) refuse("already connected");
    const supplied = input.config !== undefined;
    const config = validConfig(input.config ?? (state.config as Record<string, unknown> | undefined));

    let result: AuthResult;
    const email = input.email ?? state.email;
    if (input.password !== undefined) {
      result = email
        ? await ports.auth.signIn(config, email, input.password)
        : { ok: false, reason: "credentials invalid" };
    } else if (state.session) {
      result = await ports.auth.resume(config, state.session);
    } else {
      result = { ok: false, reason: "credentials invalid" };
    }
    if (!result.ok) {
      // A stored session the SDK no longer accepts means the password is needed again.
      const reason = result.reason === "session lost" ? "credentials invalid" : result.reason;
      await emit("ConnectionFailed", { reason });
      return fail(reason);
    }

    const ini = ports.ini;
    if (supplied) await ini.write("connection", "config", JSON.stringify(config));
    if (state.deviceIdNew) {
      await ini.write("connection", "device_id", state.deviceId);
      state.deviceIdNew = false;
    }
    await ini.write("connection", "session", result.record);
    await ini.write("connection", "email", result.email);
    Object.assign(state, { config, email: result.email, session: result.record, connected: true, uid: result.uid });

    const iniEdits = await catchUpIniEdits();
    const counts = await reconcile("connect", iniEdits);
    if (iniEdits.size) state.iniCatchUp = { pushed: counts.pushed, applied: counts.applied };
    await ports.db.update(userPath(result.uid, `meta/devices/${state.deviceId}`), {
      name: ports.deviceName,
      lastSeen: ports.now(),
    });

    await emit("Connected", { email: result.email, projectId: config.projectId, documents: documentCount() });
    await emit("MirrorReconciled", { ...counts, cause: "connect" });
    return ok({ answer: "ok", status: status() });
  });
}
