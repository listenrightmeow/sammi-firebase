import type { Ports } from "./ports.ts";
import { newState, type State } from "./state.ts";

// The host is installed once by whoever runs the handlers: src/ext/main.ts in the Bridge, the fake
// world in the Feature harness. It lives on globalThis under a registered symbol because the
// harness imports handler modules natively and module identity across loaders is not guaranteed
// (SF-ADR-016 §2).
const KEY = Symbol.for("sammi-firebase.host");

export interface Host {
  ports: Ports;
  state: State;
  /** The SAMMI button instance that issued the current command; the causationId of its events. */
  cause: string;
}

type Slot = { [KEY]?: Host };

export function installHost(ports: Ports): Host {
  const host: Host = { ports, state: newState(), cause: "command" };
  (globalThis as Slot)[KEY] = host;
  return host;
}

export function host(): Host {
  const h = (globalThis as Slot)[KEY];
  if (!h) throw new Error("SAMMI Firebase host is not installed — configuration error.");
  return h;
}
