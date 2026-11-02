import { invalidIniNotice, takeCatchUpNotice, unreachableNotice } from "../core/notices.ts";
import { withinMessage } from "../core/store.ts";
import { host, installHost } from "../core/host.ts";
import { parseConfigBlock } from "../core/config-block.ts";
import { fromWire, remoteWins } from "../core/docs.ts";
import { emit } from "../core/events.ts";
import { pollVariables } from "../core/poll.ts";
import { reconcileAfterReconnect } from "../core/reconnect.ts";
import { lostSessionAtStart } from "../core/session.ts";
import { boot } from "../core/store.ts";
import * as applyRemoteChange from "../features/apply-remote-change/handler.ts";
import * as applyRemoteSchema from "../features/apply-remote-schema/handler.ts";
import * as applyVariableChange from "../features/apply-variable-change/handler.ts";
import * as connect from "../features/connect/handler.ts";
import * as disconnect from "../features/disconnect/handler.ts";
import * as reconcile from "../features/reconcile/handler.ts";
import * as recordSessionLoss from "../features/record-session-loss/handler.ts";
import { COMMANDS } from "./commands.ts";
import { INI_FILE, listen, readVariable, realPorts, watchConnection } from "./gateways.ts";

// The Bridge entry point, bundled into [insert_script] by tools/build/sef.ts. It installs the real
// gateways, registers the commands, answers every Save Variable box, and runs the two loops that
// feed the handlers: the database listener (Apply Remote Change / Schema) and the variable poller
// (Apply Variable Change). Host wiring: proven on the PC tier (docs/09 Layer 3).

declare const SAMMI: {
  extCommand(
    name: string,
    color: number,
    height: number,
    boxes: Record<string, unknown>,
    triggerButton?: boolean,
    hidden?: boolean,
  ): Promise<unknown>;
  setVariable(name: string, value: unknown, buttonId?: string, instanceId?: number | string): Promise<unknown>;
  popUp(message: string): Promise<unknown>;
};
declare const sammiclient: { on(event: string, fn: (payload: { Data?: Record<string, string> }) => void): void };

const COLOR = 0x2d7ff9;
let stopListening: (() => void) | undefined;
let stopWatching: (() => void) | undefined;
let sessionLost = false;
const SESSION_LOST = "SAMMI Firebase: sign-in needed. Buttons keep reading the copy on this PC.";
let poller: ReturnType<typeof setInterval> | undefined;

const $ = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

function show(line: string): void {
  const el = $("fbStatus");
  if (el) el.textContent = line;
}

async function refreshStatus(): Promise<void> {
  const { state, ports } = host();
  show(
    state.connected
      ? `${ports.db.online() ? "Connected" : "OFFLINE, no internet: signed in"} as ${state.email} · ${[...state.mirror.values()].reduce((n, m) => n + m.size, 0)} documents · ${state.pending.size} pending${invalidIniNotice()}${unreachableNotice()}`
      : `${sessionLost ? "Connect needed" : "Not connected"} — buttons read the copy on this PC`,
  );
}

/** Feed every listener delivery through Apply Remote Change; the handler applies rules 2 and 3. */
function onDocuments(tree: Record<string, Record<string, unknown>>): void {
  void (async () => {
    const { state } = host();
    const seen = new Set<string>();
    for (const [collection, docs] of Object.entries(tree)) {
      for (const [id, wire] of Object.entries(docs ?? {})) {
        seen.add(`${collection}/${id}`);
        const doc = fromWire(wire);
        const local = state.mirror.get(collection)?.get(id);
        if (doc && (!local || remoteWins(doc, local)))
          await applyRemoteChange.handle({ collection, id, document: wire });
      }
    }
    for (const [collection, docs] of state.mirror)
      for (const id of [...docs.keys()])
        if (!seen.has(`${collection}/${id}`) && !state.pending.has(`${collection}/${id}`))
          await applyRemoteChange.handle({ collection, id, document: null });
    await refreshStatus();
  })();
}

function onSchema(tree: Record<string, Record<string, unknown>>): void {
  void (async () => {
    for (const [name, e] of Object.entries(tree)) {
      await applyRemoteSchema.handle({
        name,
        fields: e.fields as string[],
        strict: e.strict as boolean,
        twoWay: e.two_way as boolean,
        remoteTimestamp: e._t as number,
      });
    }
  })();
}

async function afterConnect(): Promise<void> {
  sessionLost = false;
  const catchUp = takeCatchUpNotice();
  if (catchUp) void SAMMI.popUp(catchUp);
  const { state, ports } = host();
  stopListening?.();
  stopListening = await listen(state.uid as string, onDocuments, onSchema);
  stopWatching?.();
  stopWatching = await watchConnection((isOnline) => {
    void (async () => {
      if (isOnline && host().state.connected) {
        try {
          await reconcileAfterReconnect({
            stopListening: () => {
              stopListening?.();
              stopListening = undefined;
            },
            reconcile: () => reconcile.handle(),
            startListening: async () => {
              stopListening?.();
              if (host().state.connected) stopListening = await listen(state.uid as string, onDocuments, onSchema);
            },
          });
        } catch {
          // What could not be decided stays in [pending] for the next reconcile.
        }
      }
      await refreshStatus();
    })();
  });
  clearInterval(poller);
  const ms = Number((await ports.ini.read("connection", "poll_ms")) ?? 500);
  poller = setInterval(
    () => {
      void pollVariables(readVariable, (change) => applyVariableChange.handle(change));
      void refreshStatus();
    },
    Math.min(10000, Math.max(100, ms)),
  );
  await refreshStatus();
}

function afterDisconnect(): void {
  stopListening?.();
  stopListening = undefined;
  stopWatching?.();
  stopWatching = undefined;
  clearInterval(poller);
  void refreshStatus();
}

async function register(): Promise<void> {
  for (const def of COMMANDS) {
    await SAMMI.extCommand(def.name, COLOR, 52, def.boxes, false, false);
    sammiclient.on(def.name, (payload) => {
      void (async () => {
        const d = payload.Data ?? {};
        const h = host();
        h.cause = String(d.instanceId ?? "command");
        const boxes = Object.fromEntries(
          Object.keys(def.boxes)
            .filter((k) => k !== "result")
            .map((k) => [k, d[k] ?? ""]),
        );
        let answer: string;
        try {
          const res = await def.handle(def.input ? def.input(boxes) : boxes);
          answer = String(res.body.answer);
          const vars = res.body.variables as Record<string, unknown> | undefined;
          for (const [name, value] of Object.entries(vars ?? {}))
            await SAMMI.setVariable(name, value, d.FromButton, d.instanceId);
        } catch (e) {
          answer = `error: ${(e as Error).message}`;
        } finally {
          h.cause = "command";
        }
        // MIR-09: always answer, so an absent variable can only mean the Bridge was not running.
        if (d.result) await SAMMI.setVariable(d.result, withinMessage(answer), d.FromButton, d.instanceId);
        if (def.name === "Firebase: Connect" && host().state.connected) await afterConnect();
        if (def.name === "Firebase: Disconnect") afterDisconnect();
      })();
    });
  }
}

function wireTab(): void {
  $("fbConnect")?.addEventListener("click", () => {
    void (async () => {
      const raw = ($<HTMLTextAreaElement>("fbConfig")?.value ?? "").trim();
      let config: Record<string, unknown> | undefined;
      if (raw) {
        config = parseConfigBlock(raw);
        if (!config) {
          show("That does not look like the config block from step 5 of the setup guide.");
          return;
        }
      }
      const res = await connect.handle({
        ...(config ? { config } : {}),
        email: $<HTMLInputElement>("fbEmail")?.value || undefined,
        password: $<HTMLInputElement>("fbPassword")?.value || undefined,
      });
      const pw = $<HTMLInputElement>("fbPassword");
      if (pw) pw.value = "";
      if (res.status === "OK") await afterConnect();
      else show(String(res.body.answer));
    })();
  });
  $("fbDisconnect")?.addEventListener("click", () => {
    void disconnect.handle().then(afterDisconnect);
  });
}

export async function main(): Promise<void> {
  installHost(realPorts());
  await boot();
  wireTab();
  await register();
  window.addEventListener("fb-session-lost", (e) => {
    void recordSessionLoss.handle({ code: String((e as CustomEvent).detail ?? "") }).then(() => {
      sessionLost = true;
      afterDisconnect();
      void SAMMI.popUp(SESSION_LOST);
    });
  });
  const hadSession = Boolean(host().state.session);
  const res = await connect.handle({});
  if (res.status === "OK") await afterConnect();
  else {
    if (lostSessionAtStart(hadSession, res)) {
      sessionLost = true;
      await emit("Disconnected", { reason: "session" });
      void SAMMI.popUp(SESSION_LOST);
    }
    await refreshStatus();
  }
}

void INI_FILE;
