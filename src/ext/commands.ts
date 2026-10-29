import type { Answer } from "../core/answers.ts";
import * as connect from "../features/connect/handler.ts";
import * as disconnect from "../features/disconnect/handler.ts";
import * as reconcile from "../features/reconcile/handler.ts";
import * as defineCollection from "../features/define-collection/handler.ts";
import * as undefineCollection from "../features/undefine-collection/handler.ts";
import * as createDocument from "../features/create-document/handler.ts";
import * as replaceDocument from "../features/replace-document/handler.ts";
import * as updateDocument from "../features/update-document/handler.ts";
import * as setField from "../features/set-field/handler.ts";
import * as incrementField from "../features/increment-field/handler.ts";
import * as deleteField from "../features/delete-field/handler.ts";
import * as deleteDocument from "../features/delete-document/handler.ts";
import * as getDocument from "../features/get-document/handler.ts";
import * as getField from "../features/get-field/handler.ts";
import * as documentExists from "../features/document-exists/handler.ts";
import * as listDocuments from "../features/list-documents/handler.ts";
import * as queryDocuments from "../features/query-documents/handler.ts";
import * as countDocuments from "../features/count-documents/handler.ts";
import * as getStatus from "../features/get-status/handler.ts";

// The commands a deck sees (SF-ADR-005, contracts/command-boxes.json). Box tuples are
// [label, SAMMI box type, default, width]; type 14 is a text box and 37 the Save Variable box,
// the two types verified on hardware (S6). Every box arrives as text and is coerced here.

export type Box = [label: string, type: number, defaultValue: string, width: number, options?: Record<string, unknown>];

export interface CommandDef {
  name: string;
  boxes: Record<string, Box>;
  handle(input: Record<string, unknown>): Promise<Answer>;
  /** Box text → handler input. Absent means the boxes pass through as they are. */
  input?: (boxes: Record<string, string>) => Record<string, unknown>;
}

const RESULT: Box = ["Save Variable As", 37, "fbResult", 1, { timeoutAfter: 10000 }];
const text = (label: string, value = "", width = 1): Box => [label, 14, value, width];
const blankToUndefined = (v: string | undefined): string | undefined => (v === undefined || v === "" ? undefined : v);
const bool = (v: string | undefined, fallback: boolean): boolean =>
  v === undefined || v === "" ? fallback : /^(1|true|yes|on)$/i.test(v.trim());
const num = (v: string | undefined): number | undefined => (v === undefined || v === "" ? undefined : Number(v));

const DOC = { collection: text("Collection", "", 0.8), id: text("Id", "", 0.8) };

export const COMMANDS: CommandDef[] = [
  { name: "Firebase: Connect", boxes: { result: RESULT }, handle: connect.handle, input: () => ({}) },
  { name: "Firebase: Disconnect", boxes: { result: RESULT }, handle: disconnect.handle },
  { name: "Firebase: Reconcile", boxes: { result: RESULT }, handle: reconcile.handle },
  {
    name: "Firebase: Define Collection",
    boxes: {
      name: text("Collection", "", 0.8),
      fields: text("Fields (comma separated)", "", 1.2),
      strict: text("Strict (true/false)", "false", 0.5),
      twoWay: text("Two-way (true/false)", "true", 0.5),
      result: RESULT,
    },
    handle: defineCollection.handle,
    input: (b) => ({ name: b.name, fields: b.fields, strict: bool(b.strict, false), twoWay: bool(b.twoWay, true) }),
  },
  {
    name: "Firebase: Undefine Collection",
    boxes: { name: text("Collection", "", 0.8), result: RESULT },
    handle: undefineCollection.handle,
  },
  {
    name: "Firebase: Create Document",
    boxes: { ...DOC, fields: text("Fields (JSON)", "{}", 1.4), result: RESULT },
    handle: createDocument.handle,
  },
  {
    name: "Firebase: Replace Document",
    boxes: { ...DOC, fields: text("Fields (JSON)", "{}", 1.4), result: RESULT },
    handle: replaceDocument.handle,
  },
  {
    name: "Firebase: Update Document",
    boxes: { ...DOC, fields: text("Fields (JSON)", "{}", 1.4), result: RESULT },
    handle: updateDocument.handle,
  },
  {
    name: "Firebase: Set Field",
    boxes: { ...DOC, field: text("Field", "", 0.6), value: text("Value", "", 1), result: RESULT },
    handle: setField.handle,
  },
  {
    name: "Firebase: Increment Field",
    boxes: { ...DOC, field: text("Field", "", 0.6), by: text("By", "1", 0.4), result: RESULT },
    handle: incrementField.handle,
  },
  {
    name: "Firebase: Delete Field",
    boxes: { ...DOC, field: text("Field", "", 0.6), result: RESULT },
    handle: deleteField.handle,
  },
  { name: "Firebase: Delete Document", boxes: { ...DOC, result: RESULT }, handle: deleteDocument.handle },
  {
    name: "Firebase: Get Document",
    boxes: { ...DOC, unpack: text("Unpack prefix (optional)", "", 0.6), result: RESULT },
    handle: getDocument.handle,
    input: (b) => ({ collection: b.collection, id: b.id, unpack: blankToUndefined(b.unpack) }),
  },
  {
    name: "Firebase: Get Field",
    boxes: { ...DOC, field: text("Field", "", 0.6), default: text("Default (optional)", "", 0.6), result: RESULT },
    handle: getField.handle,
    input: (b) => ({ collection: b.collection, id: b.id, field: b.field, default: blankToUndefined(b.default) }),
  },
  { name: "Firebase: Document Exists", boxes: { ...DOC, result: RESULT }, handle: documentExists.handle },
  {
    name: "Firebase: List Documents",
    boxes: { collection: text("Collection", "", 0.8), result: RESULT },
    handle: listDocuments.handle,
  },
  {
    name: "Firebase: Query Documents",
    boxes: {
      collection: text("Collection", "", 0.8),
      field: text("Field (optional)", "", 0.6),
      operator: text("Operator", "", 0.4),
      value: text("Value", "", 0.6),
      orderBy: text("Order by", "id", 0.6),
      descending: text("Descending (true/false)", "false", 0.5),
      limit: text("Limit (optional)", "", 0.4),
      result: RESULT,
    },
    handle: queryDocuments.handle,
    input: (b) => ({
      collection: b.collection,
      field: blankToUndefined(b.field),
      operator: blankToUndefined(b.operator),
      value: b.value,
      orderBy: blankToUndefined(b.orderBy),
      descending: bool(b.descending, false),
      limit: num(blankToUndefined(b.limit)),
    }),
  },
  {
    name: "Firebase: Count Documents",
    boxes: {
      collection: text("Collection", "", 0.8),
      field: text("Field (optional)", "", 0.6),
      operator: text("Operator", "", 0.4),
      value: text("Value", "", 0.6),
      result: RESULT,
    },
    handle: countDocuments.handle,
    input: (b) => ({
      collection: b.collection,
      field: blankToUndefined(b.field),
      operator: blankToUndefined(b.operator),
      value: b.value,
    }),
  },
  { name: "Firebase: Get Status", boxes: { result: RESULT }, handle: getStatus.handle },
];
