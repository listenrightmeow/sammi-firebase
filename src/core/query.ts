import { refuse } from "./answers.ts";
import type { Fields } from "./docs.ts";
import { host } from "./host.ts";
import { NAME, checkCollection } from "./names.ts";

// The query semantics of Query Documents and Count Documents (docs/10, ratified D15c).

export interface QueryInput {
  collection?: string;
  field?: string;
  operator?: string;
  value?: string | number;
  orderBy?: string;
  descending?: boolean;
  limit?: number;
}

const OPERATORS = ["==", "!=", ">", ">=", "<", "<=", "contains", "exists"];
const NUMERIC = /^-?(0|[1-9]\d*)(\.\d+)?$/;

function field(name: string): string {
  if (name !== "id" && !NAME.test(name)) refuse("bad field", name);
  return name;
}

/** Numeric comparison when both sides are numbers (numeric text counts), string comparison otherwise. */
function compare(a: string | number, b: string | number): number {
  const an = typeof a === "number" ? a : NUMERIC.test(a) ? Number(a) : undefined;
  const bn = typeof b === "number" ? b : NUMERIC.test(b) ? Number(b) : undefined;
  if (typeof a === "number" && bn !== undefined) return a - bn;
  if (an !== undefined && typeof b === "number") return an - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function matches(fields: Fields, name: string, op: string, value: string | number | undefined): boolean {
  if (!(name in fields)) return false;
  if (op === "exists") return true;
  const actual = fields[name] as string | number;
  const v = value ?? "";
  switch (op) {
    case "contains":
      return String(actual).toLowerCase().includes(String(v).toLowerCase());
    case "==":
      return compare(actual, v) === 0;
    case "!=":
      return compare(actual, v) !== 0;
    case ">":
      return compare(actual, v) > 0;
    case ">=":
      return compare(actual, v) >= 0;
    case "<":
      return compare(actual, v) < 0;
    default:
      return compare(actual, v) <= 0;
  }
}

export function select(input: QueryInput): Record<string, string | number>[] {
  const collection = checkCollection(input.collection);
  const filter = input.field !== undefined || input.operator !== undefined;
  if (filter && !OPERATORS.includes(input.operator ?? "")) refuse("bad operator", String(input.operator));
  const filterField = filter ? field(String(input.field)) : undefined;
  const orderBy = field(input.orderBy ?? "id");
  const rows = [...(host().state.mirror.get(collection) ?? [])]
    .filter(([, doc]) => !filterField || matches(doc.fields, filterField, input.operator as string, input.value))
    .map(([id, doc]) => ({ id, ...doc.fields }) as Record<string, string | number>);
  const sign = input.descending ? -1 : 1;
  rows.sort((x, y) => {
    const a = x[orderBy];
    const b = y[orderBy];
    if (a === undefined || b === undefined) {
      if (a !== b) return a === undefined ? 1 : -1;
    } else {
      const c = sign * compare(a, b);
      if (c !== 0) return c;
    }
    // Ties fall back to id order. Mirror order cannot be trusted for this: JavaScript objects
    // (and the SDK's snapshot.val()) iterate integer-like keys such as provider user ids numerically.
    const ix = String(x.id);
    const iy = String(y.id);
    return ix < iy ? -1 : ix > iy ? 1 : 0;
  });
  return input.limit !== undefined ? rows.slice(0, input.limit) : rows;
}
