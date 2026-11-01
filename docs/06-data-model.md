# Data model

Three stores hold the same documents: the Firebase tree, the ini mirror, and the in-memory map. This document fixes the shape of each and the rules that keep them consistent. The vocabulary (collection, document, field) is defined in [10-domain-model.md](10-domain-model.md).

## Names and values

| Thing | Rule | Why |
| --- | --- | --- |
| Collection name | `[a-z][a-z0-9_]{0,31}` | Valid as a Firebase key, an ini section, and a SAMMI variable prefix without escaping |
| Document id | `[A-Za-z0-9_-]{1,64}`; blank on `CreateDocument` means generated (Firebase push id, time-ordered). For a person, the id is the streaming provider's user id from the trigger's pull data; the display name is a field | Provider ids are stable, names are not; push ids sort by creation time, which `ListDocuments` relies on |
| Field name | `[a-z][a-z0-9_]{0,31}`; names starting with `_` are reserved | `_t` and `_d` are the extension's own fields |
| Field value | string or number; a string at most 4 KB; a document at most 8 KB after merge | SAMMI's websocket drops large messages (S12) |
| Nested objects | not in the first release; store JSON text in a string field | Keeps field-level merge rules trivial |

SAMMI hands the extension text. Numbers: a field value that is a number in the fields JSON stays a number in Firebase; a value typed into a `SetField` box is stored as a number when it parses as one, otherwise as a string. `IncrementField` requires a number.

## Firebase tree (Realtime Database)

```
users/
  {uid}/
    meta/
      version: 1
      devices/{deviceId}: { name, lastSeen }
      schema/
        example:     { fields: ["ip","scene_1"], strict: true,  two_way: true, _t: 1761700000000 }
        viewers: { fields: ["name","points","tier"], strict: false, two_way: true, _t: 1761700012000 }
    collections/
      viewers/
        alice:   { points: 120, tier: "gold", _t: 1761700000000, _d: "a1b2" }
        bob:     { points: 40,  tier: "none", _t: 1761700012000, _d: "a1b2" }
      example/
        settings: { ip: "192.168.1.20", scene_1: "3f2c…", _t: 1761700020000, _d: "c3d4" }
      counters/
        deaths:  { value: 7, _t: 1761700030000, _d: "a1b2" }
```

- A document is a node whose children are its fields plus `_t` (server timestamp of the last write, set with `ServerValue.TIMESTAMP`) and `_d` (the writing device).
- `UpdateDocument`, `SetField`, `DeleteField` and `IncrementField` use a multi-location `update()` that touches only the named fields and `_t`, `_d`. Two devices updating different fields of one document therefore never clobber each other on the server. `IncrementField` uses `ServerValue.increment`.
- `ReplaceDocument` and `CreateDocument` use `set()`.
- `DeleteDocument` removes the node. Empty collections vanish on their own.
- `meta/version` lets a later release migrate; every release reads every earlier version (D8).
- `meta/schema/<collection>` is the deck's declared shape, written by `DefineCollection` (H1 ruling). On connect the extension merges it into `[schema]`, cloud wins by `_t`, so a second machine inherits the declaration before its own startup button runs.

Firebase is schema-less and stays that way: the tree accepts whatever fields the commands send. The invariants are enforced by the extension before sending.

## Ini mirror (`firebase.ini` in the SAMMI folder)

Written and read only through `SAMMI.saveIni` and `SAMMI.loadIni` (S10). One section per collection holding one key per document, so a button can read a whole document with `INI: Load Text` while the Bridge is closed (S15), then `Parse` it.

```ini
[connection]
config={"apiKey":"…","authDomain":"…","databaseURL":"…","projectId":"…","appId":"…"}
email=streamer@example.com
device_id=a1b2
device_name=Streaming PC
session=<opaque SDK session record, see 05-auth-flow.md>

[schema]
viewers={"fields":["name","points","tier"],"strict":false,"two_way":true,"_t":1761700012000}
example={"fields":["ip","scene_1"],"strict":true,"two_way":true,"_t":1761700000000}

[collection:viewers]
alice={"points":120,"tier":"gold","_t":1761700000000,"_d":"a1b2"}
bob={"points":40,"tier":"none","_t":1761700012000,"_d":"a1b2"}

[collection:example]
settings={"ip":"192.168.1.20","scene_1":"3f2c…","_t":1761700020000,"_d":"c3d4"}

[index]
collections=["viewers","example","counters"]
viewers=["alice","bob"]
example=["settings"]
counters=["deaths"]
hashes={"viewers/alice":"9f1c","viewers/bob":"3a77","example/settings":"c0de","counters/deaths":"51b2"}
last_sync=1761700100000

[pending]
viewers/alice={"op":"update","fields":{"points":130},"at":1761700040000}
counters/deaths={"op":"increment","field":"value","by":1,"at":1761700041000}
```

Why this shape:

- `[collection:<name>]` is the user-visible part and is frozen from the first release: file `firebase.ini`, section `collection:viewers`, key `alice`, value the document as JSON.
- `[index]` exists because `loadIni` reads one key at a time (S10) and cannot enumerate a section.
- `[schema]` mirrors `meta/schema` in the cloud (H1 ruling); `DefineCollection` writes both, connect merges cloud into local by `_t`. The startup button still declares the shape so a deck is self-describing, but a second machine already has it after its first connect.
- `[pending]` is the durable write queue, because the SDK's offline queue is memory only (F8). Pending operations are stored as the command that produced them, so replay re-runs the same code path.
- `[index] hashes` is a short hash (CRC32 of the JSON) of every document as the extension last wrote it. It is how the extension notices, on start, that a deck edited a document with `INI: Save Text` while the Bridge was closed (D10, rule 7).

Test plan item T-D1 checks that GameMaker's ini functions accept `:` in section names and `/` in `[pending]` keys. If not, `collection_viewers` and `viewers.alice` are the fallbacks and the README says so.

## SAMMI variables (the projection's interface)

One global object variable per collection, `fb_<collection>`, written with `SAMMI.setVariable` on connect and on every change:

```
fb_example     = { settings: { ip: "192.168.1.20", scene_1: "3f2c…" } }
fb_viewers = { "12345678": { name: "alice", points: 120, tier: "gold" }, "87654321": { name: "bob", points: 40, tier: "none" } }
```

`_t` and `_d` are stripped from the variable. For a `two_way` collection the variable is also a write surface: the extension keeps a snapshot of what it last wrote, polls the variable every `poll_ms` (default 500, `[connection] poll_ms`), and turns each field that differs from the snapshot into `UpdateDocument` or `DeleteField` on that document; a rejected change is written back from the mirror and `WriteRejected` fires. Own rewrites never loop because the snapshot is updated before the variable is. Buttons read a static document as `/$fb_example.settings.ip$/` and a person's document as `/$fb_viewers./$userId$/.points$/`, where SAMMI resolves the inner variable first (S17). When the button has just written the document, it already holds the result in the command's Save Variable box and needs neither. The variable is rewritten whole per collection on each change; if a collection grows past SAMMI's message limit (S12), the fallback is one variable per document, `fb_example_settings`, decided by measurement in test T-V1. Variables are SAMMI globals: they survive a Bridge restart within one SAMMI session and are absent after a SAMMI restart until the Bridge reconnects, which is why the ini fallback exists for the Bridge-closed case.

## In-memory map

`Map<collection, Map<id, document>>`, loaded from the ini on start and updated on every event. Queries read it. `QueryDocuments` filters and sorts here, which is why it needs no Firebase indexes and works offline.

## Consistency rules

1. **Order of a local command:** validate against the map → apply to the map → write the ini (collection section, index, pending) → rewrite `fb_<collection>` → answer the button → send to Firebase → on acknowledgement, remove from pending. If the Bridge dies between ini and Firebase, pending replays it on the next start.
2. **Document-level last write wins by `_t`.** On a remote change, replace the local document only if remote `_t` > local `_t`. Field-level merges happen on the server through `update()`; the rule here only decides which snapshot the mirror keeps.
3. **Own echoes:** a remote change with `_d === deviceId` and `_t` equal to the mirror's is the server confirming our write; the mirror takes the server `_t`, no event is emitted.
4. **Replaying pending:** each pending operation is re-sent as the same command. For `update`, `set_field`, `delete_field` and `increment` the server merges, so order does not matter. For `replace` and `create`, if the remote `_t` is newer than the pending `at`, the pending operation is dropped and a `DocumentUpdated` with `source: remote` tells the deck.
5. **Delete** is a tombstone in pending until acknowledged; the mirror entry goes at once.
6. **Reconcile on connect:** one read of `collections/`, rule 2 per document, then rule 4 per pending entry, then subscribe. Remote changes that happened while offline arrive as one burst of events; the README warns policy authors.
8. **Bound-variable writes:** a difference between a two-way collection's variable and the extension's last-written snapshot is a local command (rule 1 applies in full). A remote change that lands between two polls updates the snapshot and the variable together, so it is never read back as a local write.
7. **Edits made while the extension was not running:** on start, before connecting, hash every document in the ini and compare with `[index] hashes`. A document whose hash differs and whose value is valid JSON becomes a pending `replace` with `at` = now and keeps its fields; `_t` and `_d` are dropped and reassigned on push. Because `at` is now, rule 4 lets it win over remote changes made meanwhile. Invalid JSON is left in place and reported in the tab. A document removed from the ini by hand is not treated as a delete.

Why local wins in rule 7: the user was acting on the only copy they could see, and the alternative, silently discarding what they did during the stream, is the failure this project exists to prevent.

## What a deck author declares

In the deck's startup button:

```
Firebase: Define Collection   name: example      fields: ip, scene_1, scene_1_name   strict: yes
Firebase: Define Collection   name: viewers  fields: points, tier                strict: no
```

That is the deck's schema. Firebase never sees it; the extension enforces it on this machine; the README table of the deck documents it for humans.
