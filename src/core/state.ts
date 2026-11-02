import type { Fields } from "./docs.ts";
import type { FirebaseConfig } from "./ports.ts";

/** A document as stored: fields plus the last writer's timestamp and device (docs/06). */
export interface StoredDoc {
  fields: Record<string, string | number>;
  t: number;
  d: string;
}

export interface SchemaEntry {
  fields: string[];
  strict: boolean;
  twoWay: boolean;
  t: number;
}

export type PendingOp =
  | { op: "create" | "replace" | "update"; fields: Record<string, string | number>; at: number }
  | { op: "set_field"; field: string; value: string | number; at: number }
  | { op: "increment"; field: string; by: number; at: number }
  | { op: "delete_field"; field: string; at: number }
  | { op: "delete"; at: number };

export interface State {
  booted: boolean;
  deviceId: string;
  /** true when the device id was generated this session and not yet written to the ini. */
  deviceIdNew: boolean;
  config: FirebaseConfig | undefined;
  email: string | undefined;
  session: string | undefined;
  connected: boolean;
  uid: string | undefined;
  lastSync: number | undefined;
  schema: Map<string, SchemaEntry>;
  /** collection → id → document, in index order. */
  mirror: Map<string, Map<string, StoredDoc>>;
  /** '<collection>/<id>' → the raw ini text last read or written. */
  raw: Map<string, string>;
  /** What each fb_<collection> variable was last rewritten to: the poller's baseline (rule 8). */
  published: Map<string, Record<string, Fields>>;
  /** Counts those rewrites, so a reply read before one is known to be stale. */
  publishes: number;
  /** Cloud writes sent and not yet acknowledged. */
  inflight: Set<Promise<void>>;
  hashes: Map<string, string>;
  pending: Map<string, PendingOp>;
  /** ini documents that are not valid JSON, by '<collection>/<id>' (rule 7). */
  invalidIni: string[];
}

export function newState(): State {
  return {
    booted: false,
    deviceId: "",
    deviceIdNew: false,
    config: undefined,
    email: undefined,
    session: undefined,
    connected: false,
    uid: undefined,
    lastSync: undefined,
    schema: new Map(),
    mirror: new Map(),
    raw: new Map(),
    published: new Map(),
    publishes: 0,
    inflight: new Set(),
    hashes: new Map(),
    pending: new Map(),
    invalidIni: [],
  };
}
