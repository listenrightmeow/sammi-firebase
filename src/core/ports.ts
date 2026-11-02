// The gateway interface (SF-ADR-011). Handlers reach the host only through these ports, so the
// Bridge wiring (src/ext) and the Feature harness's fake world (tools/feat-adapters) are
// interchangeable.

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  databaseURL: string;
  [extra: string]: unknown;
}

/** firebase.ini through SAMMI.saveIni / loadIni. Keys are read one at a time (S10). */
export interface IniPort {
  read(section: string, key: string): Promise<string | undefined>;
  write(section: string, key: string, value: string): Promise<void>;
  remove(section: string, key: string): Promise<void>;
}

export type AuthFailure = "credentials invalid" | "provider disabled" | "api key invalid" | "session lost";

export type AuthResult = { ok: true; uid: string; email: string; record: string } | { ok: false; reason: AuthFailure };

/** Firebase Authentication, Email/Password only (SF-ADR-003). */
export interface AuthPort {
  signIn(config: FirebaseConfig, email: string, password: string): Promise<AuthResult>;
  resume(config: FirebaseConfig, record: string): Promise<AuthResult>;
  signOut(): Promise<void>;
}

/** The user's Realtime Database. Paths are absolute from the root. */
export interface DatabasePort {
  /** False once the database has reported the connection down. A write sent then would be queued by the SDK and replayed without rule 4. */
  online(): boolean;
  read(path: string): Promise<unknown>;
  set(path: string, value: unknown): Promise<void>;
  update(path: string, fields: Record<string, unknown>): Promise<void>;
  remove(path: string): Promise<void>;
  /** A server-side increment and the document's stamps, written together so no snapshot shows one without the other. */
  increment(path: string, field: string, by: number, stamp: { _t: number; _d: string }): Promise<void>;
}

/** SAMMI Core through the Bridge: global variables and extension triggers. */
export interface SammiPort {
  setVariable(name: string, value: unknown): Promise<void>;
  trigger(name: string, pullData: Record<string, unknown>): Promise<void>;
}

export interface Ports {
  /** Holds a cloud write the command does not wait for. The real host lets it run; the harness awaits it so its records are captured. */
  background(task: Promise<unknown>): Promise<void>;
  ini: IniPort;
  auth: AuthPort;
  db: DatabasePort;
  sammi: SammiPort;
  now(): number;
  uuid(): string;
  pushId(): string;
  deviceName: string;
}
