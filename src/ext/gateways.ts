import type { AppModule, Auth, AuthModule, DatabaseModule, FirebaseApp } from "./firebase-sdk.ts";
import type { AuthPort, AuthResult, DatabasePort, FirebaseConfig, IniPort, Ports, SammiPort } from "../core/ports.ts";

// The real gateways (SF-ADR-011): SAMMI Bridge helpers and the Firebase JS SDK. Host wiring,
// exercised on the streaming PC (docs/09 Layer 3), excluded from coverage by name (SF-ADR-017).

declare const SAMMI: {
  saveIni(file: string, section: string, key: string, value: string, type?: string): Promise<unknown>;
  loadIni(file: string, section: string, key: string, type?: string): Promise<unknown>;
  setVariable(name: string, value: unknown, buttonId?: string, instanceId?: number | string): Promise<unknown>;
  getVariable(name: string, buttonId?: string): Promise<unknown>;
  triggerExt(trigger: string, data: Record<string, unknown>): Promise<unknown>;
};

export const INI_FILE = "firebase.ini";
const SDK = "https://www.gstatic.com/firebasejs/10.12.0";
const APP_NAME = "sammi-firebase";

/** A Bridge reply carries its value in .Value (SAMMI's example extension); T-D2 confirms loadIni. */
export const replyValue = (reply: unknown): unknown =>
  reply && typeof reply === "object"
    ? ((reply as Record<string, unknown>).Value ?? (reply as Record<string, unknown>).value)
    : reply;

// The Bridge has no ini delete helper (S10 lists save and load only): a removed key is written
// empty and an empty value reads as absent. The [index] lists are authoritative. T-D2 decides.
export const ini: IniPort = {
  read: async (section, key) => {
    const v = replyValue(await SAMMI.loadIni(INI_FILE, section, key, "text"));
    return typeof v === "string" && v !== "" ? v : undefined;
  },
  write: async (section, key, value) => void (await SAMMI.saveIni(INI_FILE, section, key, value, "text")),
  remove: async (section, key) => void (await SAMMI.saveIni(INI_FILE, section, key, "", "text")),
};

export const sammi: SammiPort = {
  setVariable: async (name, value) => void (await SAMMI.setVariable(name, value, "global")),
  trigger: async (name, pullData) => void (await SAMMI.triggerExt(name, pullData)),
};

type Sdk = { app: AppModule; auth: AuthModule; db: DatabaseModule };
let sdk: Sdk | undefined;
async function load(): Promise<Sdk> {
  sdk ??= {
    app: (await import(/* @vite-ignore */ `${SDK}/firebase-app.js`)) as AppModule,
    auth: (await import(/* @vite-ignore */ `${SDK}/firebase-auth.js`)) as AuthModule,
    db: (await import(/* @vite-ignore */ `${SDK}/firebase-database.js`)) as DatabaseModule,
  };
  return sdk;
}

let session: { app: FirebaseApp; auth: Auth } | undefined;
async function open(config: FirebaseConfig) {
  const s = await load();
  if (session) return session;
  const app = s.app.getApps().find((a) => a.name === APP_NAME) ?? s.app.initializeApp(config, APP_NAME);
  const auth = s.auth.initializeAuth(app, { persistence: s.auth.browserLocalPersistence });
  session = { app, auth };
  return session;
}

const recordKey = (config: FirebaseConfig): string => `firebase:authUser:${config.apiKey}:${APP_NAME}`;

function failure(code: string): AuthResult {
  if (/operation-not-allowed/.test(code)) return { ok: false, reason: "provider disabled" };
  if (/api-key/.test(code)) return { ok: false, reason: "api key invalid" };
  return { ok: false, reason: "credentials invalid" };
}

const signedIn = (config: FirebaseConfig, uid: string, email: string): AuthResult => ({
  ok: true,
  uid,
  email,
  record: localStorage.getItem(recordKey(config)) ?? "",
});

export const auth: AuthPort = {
  signIn: async (config, email, password) => {
    try {
      const { auth: a } = await open(config);
      const cred = await (await load()).auth.signInWithEmailAndPassword(a, email, password);
      return signedIn(config, cred.user.uid, cred.user.email ?? email);
    } catch (e) {
      return failure(String((e as { code?: string }).code ?? e));
    }
  },
  resume: async (config, record) => {
    // SF-ADR-003 §3: restore the SDK's own record before Auth initializes.
    if (!localStorage.getItem(recordKey(config))) localStorage.setItem(recordKey(config), record);
    try {
      const { auth: a } = await open(config);
      await a.authStateReady();
      const user = a.currentUser;
      return user ? signedIn(config, user.uid, user.email ?? "") : { ok: false, reason: "session lost" };
    } catch (e) {
      return failure(String((e as { code?: string }).code ?? e));
    }
  },
  signOut: async () => {
    if (session) await (await load()).auth.signOut(session.auth);
  },
};

async function ref(path: string) {
  const s = await load();
  if (!session) throw new Error("not signed in");
  return s.db.ref(s.db.getDatabase(session.app), path);
}

let online = true;

/** Reports each change of .info/connected. It starts false before the first connection, which is not a drop. */
export async function watchConnection(onChange: (online: boolean) => void): Promise<() => void> {
  const s = await load();
  let everOnline = false;
  const off = s.db.onValue(await ref(".info/connected"), (snap) => {
    const now = snap.val() === true;
    if (!now && !everOnline) return;
    const first = now && !everOnline;
    everOnline = everOnline || now;
    online = now;
    if (!first) onChange(now);
  });
  return () => {
    off();
    online = true;
  };
}

export const db: DatabasePort = {
  online: () => online,
  read: async (path) => (await (await load()).db.get(await ref(path))).val(),
  set: async (path, value) => (await load()).db.set(await ref(path), value),
  update: async (path, fields) => (await load()).db.update(await ref(path), fields),
  remove: async (path) => (await load()).db.remove(await ref(path)),
  increment: async (path, field, by, stamp) => {
    const s = await load();
    await s.db.update(await ref(path), { [field]: s.db.increment(by), ...stamp });
  },
};

/** Subscribe to the whole user tree; every delivery is diffed against the mirror by the caller. */
export async function listen(
  uid: string,
  onDocuments: (tree: Record<string, Record<string, unknown>>) => void,
  onSchema: (tree: Record<string, Record<string, unknown>>) => void,
): Promise<() => void> {
  const s = await load();
  const offDocs = s.db.onValue(await ref(`users/${uid}/collections`), (snap) =>
    onDocuments((snap.val() ?? {}) as Record<string, Record<string, unknown>>),
  );
  const offSchema = s.db.onValue(await ref(`users/${uid}/meta/schema`), (snap) =>
    onSchema((snap.val() ?? {}) as Record<string, Record<string, unknown>>),
  );
  return () => {
    offDocs();
    offSchema();
  };
}

export async function readVariable(name: string): Promise<unknown> {
  return replyValue(await SAMMI.getVariable(name, "global"));
}

const PUSH = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";

export function realPorts(): Ports {
  return {
    ini,
    auth,
    db,
    sammi,
    // Rule 1: the button is answered first, and the SDK holds a write's promise open while the network is down.
    background: async () => undefined,
    now: () => Date.now(),
    uuid: () => crypto.randomUUID(),
    pushId: () => {
      const bytes = crypto.getRandomValues(new Uint8Array(20));
      return Array.from(bytes, (b) => PUSH[b % 64]).join("");
    },
    deviceName: (navigator.userAgent.match(/OBS[^ ]*/)?.[0] ?? "SAMMI Bridge").slice(0, 64),
  };
}
