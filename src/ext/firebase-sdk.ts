// The slice of the Firebase JS SDK 10.12.0 the gateways use, declared here instead of depending on
// the `firebase` npm package: the extension loads the browser build from gstatic at run time
// (SF-ADR-010), and the npm package's Node-side dependencies would only add advisories to audit.
// Signatures follow the SDK's published API reference for 10.12.

export interface FirebaseApp {
  name: string;
}
export interface User {
  uid: string;
  email: string | null;
}
export interface Auth {
  currentUser: User | null;
  authStateReady(): Promise<void>;
}
export interface DatabaseReference {
  key: string | null;
}
export interface DataSnapshot {
  val(): unknown;
}
export interface Database {
  app: FirebaseApp;
}

export interface AppModule {
  initializeApp(options: Record<string, unknown>, name?: string): FirebaseApp;
  getApps(): FirebaseApp[];
}
export interface AuthModule {
  initializeAuth(app: FirebaseApp, deps: { persistence: unknown }): Auth;
  browserLocalPersistence: unknown;
  signInWithEmailAndPassword(auth: Auth, email: string, password: string): Promise<{ user: User }>;
  signOut(auth: Auth): Promise<void>;
}
export interface DatabaseModule {
  getDatabase(app: FirebaseApp): Database;
  ref(db: Database, path?: string): DatabaseReference;
  get(ref: DatabaseReference): Promise<DataSnapshot>;
  set(ref: DatabaseReference, value: unknown): Promise<void>;
  update(ref: DatabaseReference, values: Record<string, unknown>): Promise<void>;
  remove(ref: DatabaseReference): Promise<void>;
  increment(delta: number): unknown;
  onValue(ref: DatabaseReference, callback: (snapshot: DataSnapshot) => void): () => void;
}
