# Architecture

How the pieces fit, what runs where, and the exact path of a read, a write and a cloud change. Every claim about SAMMI, OBS or Firebase here is a verified row in [02-verification-list.md](02-verification-list.md).

## Pieces

```
SAMMI Core (GameMaker, port 9425)  <-- websocket -->  SAMMI Bridge (bridge.html, OBS dock, file://)
      |                                                       |
      | ini files in the SAMMI folder                          | our extension (.sef): JavaScript + a tab
      | (mirror, config, pending queue)                        |     |
      |                                                       |     +-- Firebase JS SDK (ES modules, dynamic import from gstatic)
      v                                                       |           |
  buttons: Firebase: commands and queries                     |           +-- Auth (email/password)
  triggers: Firebase: events                                  |           +-- Realtime Database (websocket to *.firebaseio.com)
                                                              v
                                                    user's own Firebase project
```

- **SAMMI Core** runs buttons. It knows nothing about the cloud. It sees the extension's commands, queries and triggers, and it reads and writes ini files when the extension asks (S10) or when a button uses SAMMI's own INI commands.
- **SAMMI Bridge** hosts the extension. It is a page from a `file://` URL inside OBS's Chromium (S7, O1). It must be open for the commands to answer (S15). The dock may be hidden; hidden docks keep running (O8).
- **The extension** is one `.sef`. Its script owns four things: the two Firebase gateways, the connection, the mirror, and the command handlers. Its tab is the only UI: config box, email and password, Connect, status line, log.
- **The user's Firebase project** holds one subtree per user, `users/{uid}`. Rules allow only that user (F9).

## Modules inside the extension

| Module | Responsibility | Depends on |
| --- | --- | --- |
| `gateway/firebase.js` | The two gateways: Auth (sign in, resume) and Database (set, update, remove, increment, initial read, listener). The only file that imports Firebase. | SDK via dynamic `import()` (S14) |
| `connection.js` | The Connection aggregate: state machine, `Connect`/`Disconnect`, silent resume from the stored session, events. | gateway, `store.js` |
| `mirror.js` | The projection: in-memory collections and documents; persists every change to the ini through the Bridge; loads it on start; keeps the pending queue and the local schema. | `store.js` |
| `store.js` | Thin wrapper over `SAMMI.saveIni` / `SAMMI.loadIni` with the ini layout from [06-data-model.md](06-data-model.md). | Bridge helpers (S10) |
| `sync.js` | Reconcile on connect, turn remote changes into domain events, replay pending commands. Document-level last write wins by server timestamp (D5). | gateway, mirror |
| `commands.js` | Register the commands, queries and triggers (S3), enforce the Document and Collection invariants, answer through the Save Variable box (S6), emit events. | mirror, sync |
| `tab.js` + `tab.html` | The SAMMI Firebase tab. | everything above |

The provider interface is deliberately tiny so option 1 of D2 (a hosted preset) or another backend is a second file, not a rewrite:

```
init(config) -> void
signIn(email, password) / resume() / signOut() -> session or throws
setDocument(collection, id, fields) / updateFields(collection, id, fields) / removeDocument(collection, id) / incrementField(collection, id, field, by) -> promise
readAll() -> promise of {collection: {id: document}}
subscribe(onDocumentChange(collection, id, document | null)) -> unsubscribe
```

## Commands, queries and events

The full surface, with invariants and payloads, is [10-domain-model.md](10-domain-model.md). All of it is registered with `SAMMI.extCommand` (S3), ships in the bundled deck with `"async": 0.0`, and is answered through a Save Variable box (S6). Every handler answers within the box timeout, always, with `error: <reason>` if it has to (S15).

| Kind | SAMMI name | Answer in the Save Variable box |
| --- | --- | --- |
| Commands (write side) | `Firebase: Create Document`, `Replace Document`, `Update Document`, `Set Field`, `Increment Field`, `Delete Field`, `Delete Document`, `Define Collection`, `Undefine Collection`, `Connect`, `Disconnect`, `Reconcile` | the resulting document as JSON, the new value for Increment, counts for Reconcile, or `error: <reason>` |
| Write side, by variable | setting a field inside a two-way collection's `fb_<collection>` variable; the extension polls, diffs and issues the command itself (H5 ruling) | none; `WriteRejected` fires on an invariant violation |
| Read side, primary | the global variables `fb_<collection>` written by the extension; any button reads `/$fb_hue.settings.ip$/` with no command (maintainer ruling, Oct 29, 2026) | not a command |
| Queries (read side, secondary) | `Firebase: Get Document`, `Get Field`, `Document Exists`, `List Documents`, `Query Documents`, `Count Documents`, `Get Status` | the value, JSON, or the default |
| Events (triggers) | `Firebase: Connected`, `Connection Failed`, `Disconnected`, `Mirror Reconciled`, `Collection Defined`, `Collection Undefined`, `Document Created`, `Document Updated`, `Document Replaced`, `Document Deleted`, `Write Rejected` | pull data per the envelope in the domain model |

`Connect` and `Disconnect` exist as commands as well as tab buttons so a user who prefers a "connection deck" can run `Firebase: Connect` from a SAMMI Startup button. The deck command carries no password: it resumes from the session record the tab stored, so a deck file never holds a secret (SF-ADR-003 §5). The tab remains the default because it keeps the password out of deck files.

## One connection, inherited everywhere

The connection is configured once, in the extension, and is global to the Bridge. A deck never configures anything: its buttons use the commands and queries directly. The only per-deck declaration is optional, `Firebase: Define Collection` in the deck's startup button, which is the deck's schema. This is the "set up once in one place, reuse in every scene" requirement from the first conversation, with the extension tab playing the part of the session scene.

## The three paths

**Read.** No command. The extension keeps `fb_<collection>` current with `SAMMI.setVariable` on connect and on every local or remote change; a button uses the variable like any other. The product ships no dedicated read or write buttons; the streamer embeds writes in the buttons they already have (a cheer button carries `Firebase: Increment Field`).

**Query (`Get Document`, optional).** Button → SAMMI sends `ExecuteCommand` with `{collection, id, saveVar, prefix, FromButton, instanceId}` → `commands.js` reads the mirror map → `SAMMI.setVariable(saveVar, json, FromButton, instanceId)`, plus one `setVariable` per field when a prefix is given → button continues. No network. A few milliseconds (prototype 2, test 1).

**Command (`Update Document`).** Button → `ExecuteCommand` → invariants checked against the mirror → mirror updated in memory → `store.js` writes the ini (collection section, index, pending) → `fb_<collection>` variable rewritten → answer `ok` → `DocumentUpdated` with `source: local` fired → then, off the button's clock, the gateway sends a multi-location `update()` with `_t: serverTimestamp, _d: deviceId`. On acknowledgement the pending entry is removed. If Firebase is unreachable, the entry stays pending and is replayed on reconnect. The button never waits for the network.

**Remote change.** The gateway's listener receives a change (another device or the console, within about a second, F5/F7) → `sync.js` applies consistency rule 2 (document `_t`) and rule 3 (own echo) → if it is new, update mirror, ini and the `fb_<collection>` variable, then `SAMMI.triggerExt('Firebase: Document Updated', envelope)` with `source: remote`. Buttons with that trigger run; they are the policies.

**Start.** Bridge loads → extension loads `[connection]` from ini → `mirror.js` loads every collection, the index, the schema and the pending queue (queries already work) → `auth.resume()` → one read of `meta/schema` and `collections/` → reconcile (rules 2, 4, 6, 7) → subscribe → `Connected`, then `MirrorReconciled` fired → variable poller started for two-way collections. The tab reports the result. `Firebase: Reconcile` runs the same reconcile on demand and fires `MirrorReconciled` again (H2 ruling).

**Variable write.** Poller tick → `SAMMI.getVariable('fb_viewers')` → diff against the last-written snapshot → for each differing field, the same path as a command (`UpdateDocument` or `DeleteField`), which rewrites the snapshot and the variable → on rejection, variable restored from the mirror and `WriteRejected` fired.

## Bridge closed

Buttons that run a Cloud command get no answer: the button continues at once and the Save Variable is absent (S15). Two layers handle it:

1. **Documented deck pattern**, shown in the bundled example: after `Firebase: Get Document`, `If hueSettings does not exist` → `Trigger Button fbLocalNotice` (one popup per session, "using the local copy") → `INI: Load Text` file `firebase.ini`, section `collection:hue`, key `settings` → `Parse`. Reads keep working with zero dependency on the Bridge (D6, D10).
2. **Writes while closed** go to the same section and key with `INI: Save Text`, as JSON of the fields. On its next start the extension finds them by comparing each document's hash with `[index] hashes`, queues them as pending replaces stamped with the start time, pushes them, and alerts once with the count (D10, data model rule 7).
3. **Internet lost while the Bridge is open** is the other case and needs nothing from the deck: the extension is running, commands go to the mirror and `[pending]`, and reconnect replays them (rules 4 and 6).

## What runs where, and what persists where

| Thing | Lives in | Survives |
| --- | --- | --- |
| Values (truth for durability) | user's Firebase project | everything on the PC |
| Mirror, schema, pending queue, connection config, session record | `firebase.ini` in the SAMMI folder, via Bridge helpers | OBS reinstall, dock removal, Bridge update |
| In-memory map | the Bridge page | until the Bridge reloads |
| Firebase SDK session (localStorage) | OBS's Chromium profile | OBS updates (O3), not a profile reset; backed up to the ini (see [05-auth-flow.md](05-auth-flow.md)) |

## Size limits

`SAMMI.setVariable` and the ini helpers go over SAMMI's websocket, which drops messages that are too large (S12). The MVP caps a single value at 8 KB and answers `error: too large` above it. Chunked transfer, if ever needed, is the documented `chunkSender` pattern from SAMMI's docs.
