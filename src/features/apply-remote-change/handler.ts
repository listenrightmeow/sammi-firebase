import { ok, refuse, type Answer } from "../../core/answers.ts";
import { fieldsText, fromWire, remoteWins, sameFields, type Fields } from "../../core/docs.ts";
import { current, target } from "../../core/document.ts";
import { emit } from "../../core/events.ts";
import { host } from "../../core/host.ts";
import { run } from "../../core/run.ts";
import { dropDoc, publish, putDoc, writeHashes } from "../../core/store.ts";

// SPEC-DOC-008. Issued by the database listener for every delivery. Rule 2 (newer wins, ties keep
// local, an edit that leaves the stamps as they were is applied), rule 3 (own echoes are ignored), rule 5 (a null snapshot is a remote delete). Never
// writes to the cloud.
export async function handle(input: { collection?: string; id?: string; document?: unknown }): Promise<Answer> {
  return run(async () => {
    const t = target(input);
    const before = current(t);
    if (input.document === null || input.document === undefined) {
      if (before) {
        await dropDoc(t.collection, t.id);
        await writeHashes();
        await publish(t.collection);
        await emit(
          "DocumentDeleted",
          { collection: t.collection, id: t.id, previous: fieldsText(before.fields) },
          { source: "remote", deviceId: "unknown" },
        );
      }
      return ok({ answer: "ok" });
    }
    const doc = fromWire(input.document);
    if (!doc) refuse("bad field");
    if (before && doc.d === host().state.deviceId && doc.t === before.t && sameFields(doc.fields, before.fields)) {
      refuse("own echo");
    }
    if (before && !remoteWins(doc, before)) refuse("remote older");
    await putDoc(t.collection, t.id, doc);
    await writeHashes();
    await publish(t.collection);
    const changed: Fields = {};
    for (const [k, v] of Object.entries(doc.fields)) if (before?.fields[k] !== v) changed[k] = v;
    await emit(
      before ? "DocumentUpdated" : "DocumentCreated",
      before
        ? {
            collection: t.collection,
            id: t.id,
            fields: fieldsText(doc.fields),
            previous: fieldsText(before.fields),
            changed: fieldsText(changed),
          }
        : { collection: t.collection, id: t.id, fields: fieldsText(doc.fields) },
      { source: "remote", deviceId: doc.d },
    );
    return ok({ answer: "ok" });
  });
}
