import { randomUUID } from "node:crypto";
import { installHost } from "../../src/core/host.ts";
import type {
  AuthPort,
  AuthResult,
  DatabasePort,
  FirebaseConfig,
  IniPort,
  Ports,
  SammiPort,
} from "../../src/core/ports.ts";

// The fake world (SF-ADR-016): firebase.ini, the user's Realtime Database with its auth, and
// SAMMI's variables and triggers, in one process with a frozen clock. The three service adapters
// are views over it; it also installs the host the handlers use. Every behavior here mirrors a
// verified fact about the real surface; world.test.ts holds the list.

export type Service = "ini" | "firebase" | "sammi";

export interface CapturedRecord {
  type: string;
  key?: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

interface User {
  email: string;
  password: string;
  uid: string;
}

const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

/** Realtime Database returns children ordered by key; the fake does the same. */
function sortedClone(v: unknown): unknown {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return clone(v);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v).sort()) out[k] = sortedClone((v as Record<string, unknown>)[k]);
  return out;
}

const PUSH_CHARS = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
const SESSION_PREFIX = "opaque-sdk-record-for-";

export class World {
  now: number;
  ini = new Map<string, Map<string, string>>();
  tree: Record<string, unknown> = {};
  users: User[] = [];
  providerEnabled = true;
  projects: { apiKey: string; projectId: string }[] = [];
  variables = new Map<string, unknown>();
  /** Writes by another device that land after this Bridge's first full read, unseen by its listener. */
  later: { path: string; value: unknown }[] = [];
  /** The next N writes to document paths fail, as when the network drops. */
  outage = 0;
  log: Record<Service, CapturedRecord[]> = { ini: [], firebase: [], sammi: [] };

  constructor(clock: string | undefined) {
    this.now = clock ? Date.parse(clock) : Date.now();
    if (Number.isNaN(this.now))
      throw new Error(`Fake world clock '${clock}' is not a timestamp — configuration error.`);
  }

  reset(): void {
    this.ini = new Map();
    this.tree = {};
    this.users = [];
    this.providerEnabled = true;
    this.projects = [];
    this.variables = new Map();
    this.later = [];
    this.outage = 0;
    this.log = { ini: [], firebase: [], sammi: [] };
    installHost(this.ports());
  }

  record(service: Service, type: string, payload: Record<string, unknown>, key: string): void {
    this.log[service].push({ type, key, payload: clone(payload), timestamp: this.now });
  }

  // ---- ini ------------------------------------------------------------------------------------

  iniPayload(section: string, key: string, value: string): Record<string, unknown> {
    const payload: Record<string, unknown> = { section, key, value };
    try {
      payload.json = JSON.parse(value);
    } catch {
      // not JSON text; the raw value is the record
    }
    return payload;
  }

  iniSet(section: string, key: string, value: string): void {
    let s = this.ini.get(section);
    if (!s) this.ini.set(section, (s = new Map()));
    s.set(key, value);
  }

  // ---- database -------------------------------------------------------------------------------

  private walk(path: string, create: boolean): [Record<string, unknown> | undefined, string] {
    const parts = path.split("/").filter(Boolean);
    const last = parts.pop() as string;
    let node: Record<string, unknown> = this.tree;
    for (const p of parts) {
      let next = node[p];
      if (typeof next !== "object" || next === null) {
        if (!create) return [undefined, last];
        next = {};
        node[p] = next;
      }
      node = next as Record<string, unknown>;
    }
    return [node, last];
  }

  dbGet(path: string): unknown {
    const [parent, last] = this.walk(path, false);
    return parent?.[last];
  }

  dbSet(path: string, value: unknown): void {
    const [parent, last] = this.walk(path, true);
    (parent as Record<string, unknown>)[last] = clone(value);
  }

  private dbPrune(path: string): void {
    const [parent, last] = this.walk(path, false);
    if (parent) Reflect.deleteProperty(parent, last);
  }

  // ---- ports ----------------------------------------------------------------------------------

  ports(): Ports {
    const ini: IniPort = {
      read: async (section, key) => this.ini.get(section)?.get(key),
      write: async (section, key, value) => {
        this.iniSet(section, key, value);
        this.record("ini", "IniWrite", this.iniPayload(section, key, value), `${section}/${key}`);
      },
      remove: async (section, key) => {
        this.ini.get(section)?.delete(key);
        this.record("ini", "IniDelete", { section, key }, `${section}/${key}`);
      },
    };

    const check = (config: FirebaseConfig): AuthResult | undefined => {
      if (!this.providerEnabled) return { ok: false, reason: "provider disabled" };
      const project = this.projects.find((p) => p.projectId === config.projectId);
      if (project && project.apiKey !== config.apiKey) return { ok: false, reason: "api key invalid" };
      return undefined;
    };
    const signedIn = (u: User): AuthResult => ({
      ok: true,
      uid: u.uid,
      email: u.email,
      record: SESSION_PREFIX + u.uid,
    });

    const auth: AuthPort = {
      signIn: async (config, email, password) => {
        const refused = check(config);
        if (refused) return refused;
        const user = this.users.find((u) => u.email === email && u.password === password);
        return user ? signedIn(user) : { ok: false, reason: "credentials invalid" };
      },
      resume: async (config, record) => {
        const refused = check(config);
        if (refused) return refused;
        const user = this.users.find((u) => record === SESSION_PREFIX + u.uid);
        return user ? signedIn(user) : { ok: false, reason: "session lost" };
      },
      signOut: async () => undefined,
    };

    const offline = (path: string): void => {
      if (this.outage > 0 && path.includes("/collections/")) {
        this.outage--;
        throw new Error(`network unavailable (fake outage) writing ${path}`);
      }
    };
    const db: DatabasePort = {
      read: async (path) => {
        const value = sortedClone(this.dbGet(path));
        if (path.endsWith("/collections")) {
          for (const w of this.later.splice(0)) this.dbSet(w.path, w.value);
        }
        return value;
      },
      set: async (path, value) => {
        offline(path);
        this.dbSet(path, value);
        this.record("firebase", "set", { path, value }, path);
      },
      update: async (path, fields) => {
        offline(path);
        for (const [k, v] of Object.entries(fields)) {
          if (v === null) this.dbPrune(`${path}/${k}`);
          else this.dbSet(`${path}/${k}`, v);
        }
        this.record("firebase", "update", { path, fields }, path);
      },
      remove: async (path) => {
        offline(path);
        this.dbPrune(path);
        this.record("firebase", "remove", { path }, path);
      },
      increment: async (path, field, by) => {
        offline(path);
        const current = this.dbGet(`${path}/${field}`);
        this.dbSet(`${path}/${field}`, (typeof current === "number" ? current : 0) + by);
        this.record("firebase", "increment", { path, field, by }, path);
      },
    };

    const sammi: SammiPort = {
      setVariable: async (name, value) => {
        this.variables.set(name, clone(value));
        this.record("sammi", "SetVariable", { name, value }, name);
      },
      trigger: async (name, pullData) => {
        this.record("sammi", "Trigger", { name, pullData }, name);
      },
    };

    return {
      ini,
      auth,
      db,
      sammi,
      now: () => this.now,
      uuid: () => randomUUID(),
      pushId: () => Array.from({ length: 20 }, () => PUSH_CHARS[Math.floor(Math.random() * 64)]).join(""),
      deviceName: "feat harness",
    };
  }
}

const KEY = Symbol.for("sammi-firebase.world");
type Slot = { [KEY]?: World };

/** One world per process, shared by the three adapters and the handlers. */
export function world(clock?: string): World {
  const slot = globalThis as Slot;
  if (!slot[KEY]) {
    slot[KEY] = new World(clock);
    slot[KEY].reset();
  }
  return slot[KEY];
}
