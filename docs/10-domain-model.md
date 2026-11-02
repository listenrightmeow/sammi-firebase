# Domain model

Written in the DDD Palette notation (Layer 0 of the methodology stack: commands imperative, events past tense, one command targets one aggregate, policies are "when one event, then one command", projections serve queries). SAMMI's command list is the user-facing projection of this model: every palette command appears as `Firebase: <Verb> <Noun>` and every domain event as a trigger `Firebase: <Noun> <Past participle>`.

Firebase is schema-less. The schema lives on the SAMMI side, declared by the user per deck, and the extension enforces only the invariants below. That is the "users define the data they want to store" requirement.

## Bounded context: SAMMI Firebase

One context, one ubiquitous language:

| Term | Meaning |
| --- | --- |
| Connection | The one link between this Bridge and one Firebase project, as one signed-in user. |
| Collection | A named set of documents, for example `viewers`, `example`, `counters`. Declared locally, optional. |
| Document | The unit of storage and the aggregate root for all data commands. Lives in exactly one collection, has an id and fields. |
| Field | A named value inside a document. A string or a number. |
| Mirror | The local projection of every document the connection has seen: in memory, in the ini, and as SAMMI global variables. Buttons read the variables; queries exist for filtering and counting. |
| Variable surface | The Interface of the projection: one SAMMI object variable per collection, working name `fb_<collection>`, keyed by document id, each document an object of fields. A static document is read as `/$global.fb_example.settings.ip$/`; a document keyed by a provider user id is read with `Firebase: Get Field` (D27) or taken from the write command's answer. |
| Person document | A document whose id is the streaming provider's user id as delivered in the trigger's pull data. Display name is a field, never the id (maintainer challenge, Oct 29, 2026). |
| Device | This machine's identity on the connection, so it can tell its own writes from others'. |

External system: **Firebase** (Authentication, Realtime Database). It is reached through a gateway and it generates domain events (changes made by another device or by hand in the console).

## Aggregates

### Connection

State: `Disconnected` (initial) → `Connecting` on `Connect` → `Connected` on success; `Connected` → `Disconnected` on `Disconnect`; `Connected` → `Offline` on network loss and back on recovery (internal).

| Commands | Events | Invariants |
| --- | --- | --- |
| `Connect` (config, email, password) | `Connected`, then `MirrorReconciled` | Config has `apiKey`, `authDomain`, `projectId`, `appId`, `databaseURL`. At most one connection per Bridge. |
| `Disconnect` | `Disconnected` | |
| `Reconcile` | `MirrorReconciled` (pushed, applied, dropped) | Connection is Connected. Runs the same reconcile Connect runs; a streamer calls it from a policy (on any trigger) or reactively inside a button (H2 ruling). |

### Collection

A locally declared shape. Firebase never sees it; the mirror and the invariants do.

| Commands | Events | Invariants |
| --- | --- | --- |
| `DefineCollection` (name, fields, strict, two-way) | `CollectionDefined` (source local or remote) | Name is `[a-z][a-z0-9_]{0,31}`. Field names likewise. Written to `firebase.ini [schema]` **and** to `users/{uid}/meta/schema/<name>` so another machine inherits it on connect (H1 ruling). |
| `UndefineCollection` (name) | `CollectionUndefined` | Does not delete documents. Removes the cloud schema entry too. |

A collection that was never defined is open: any field names are accepted. A defined collection with `strict` on rejects unknown fields; off, it only documents them (and lets `GetDocument` unpack to variables in a known order). `two-way` (default on) binds the collection's variable for writes, see the projection section; off makes the variable read-only.

### Document

The aggregate root for data. Identity: (collection, id).

| Commands | Events | Invariants |
| --- | --- | --- |
| `CreateDocument` (collection, id or blank for generated, fields JSON) | `DocumentCreated` | Id must not exist. Id is `[A-Za-z0-9_-]{1,64}`. Fields valid for the collection. Document under 8 KB. |
| `ReplaceDocument` (collection, id, fields JSON) | `DocumentReplaced`, or `DocumentCreated` when the document was absent | Upsert: creates the document when absent so a settings button needs no Exists check. Fields valid. Under 8 KB. |
| `UpdateDocument` (collection, id, fields JSON) | `DocumentUpdated` | Merges fields into an existing document (`error: missing` otherwise; a merge into nothing is a Create). Fields valid. Under 8 KB after merge. |
| `SetField` (collection, id, field, value) | `DocumentUpdated`, or `DocumentCreated` when absent | One field without JSON; numeric text is stored as a number, a `str:` prefix forces a string; creates the document when absent so a counter deck needs no startup button. |
| `IncrementField` (collection, id, field, by) | `DocumentUpdated`, or `DocumentCreated` when absent | Field is a number or absent (starts from 0); `by` defaults to 1 and may be negative; atomic on the server (Firebase `increment`); answers the new total. |
| `DeleteField` (collection, id, field) | `DocumentUpdated` | Document exists. |
| `DeleteDocument` (collection, id) | `DocumentDeleted` | Document exists; deleting an absent document answers `error: missing` and emits nothing. Deleting the last document leaves an empty `fb_<collection>` variable. |

Every command is validated against the mirror (invariants), applied to the mirror, acknowledged to the button, then sent to Firebase. **The acknowledgement carries the result**: Create, Replace, Update, SetField and DeleteField answer with the resulting document as JSON; IncrementField answers with the new field value; DeleteDocument answers `ok`. A cheer button that increments a viewer's points therefore holds the new total with no further read: the write is the read. Rejections go back as `error: <reason>` and emit no event (palette: rejection → no event).

## Domain events

Past tense, immutable, one per state change. They are SAMMI extension triggers, so a SAMMI button with that trigger is the policy.

| Event | Emitted by | Payload (trigger pull data) |
| --- | --- | --- |
| `Connected` | Connection | `email`, `projectId`, `documents` (count restored) |
| `ConnectionFailed` | Connection | `reason` |
| `Disconnected` | Connection | `reason` (`user`, `network`, `session`) |
| `CollectionDefined` / `CollectionUndefined` | Collection | `collection` |
| `DocumentCreated` | Document, or Firebase (seen on the listener) | `collection`, `id`, `fields` (JSON) |
| `DocumentUpdated` | Document, or Firebase | `collection`, `id`, `fields` (JSON, whole document after), `previous` (JSON), `changed` (JSON array of field names) |
| `DocumentReplaced` | Document, or Firebase | as Updated |
| `DocumentDeleted` | Document, or Firebase | `collection`, `id`, `previous` (JSON) |
| `MirrorReconciled` | Connection | `pushed`, `applied`, `dropped` (counts), `cause` (`connect` or `command`) |
| `WriteRejected` | Document (via a bound variable) | `collection`, `id`, `field`, `reason` |

Every event carries the envelope fields of the platform's Event Payload Contract (PADR-004), reduced to what a SAMMI trigger can carry flat:

| Field | Value |
| --- | --- |
| `eventId` | UUID v4 |
| `eventType` | the event name above |
| `timestamp` | ISO 8601 UTC |
| `version` | 1 |
| `source` | `local` (this device's command) or `remote` (another device or the console) |
| `deviceId` | the originating device when known |
| `causationId` | the SAMMI button instance that issued the command, when `source` is `local`; blank for remote |

`source` exists so a policy can avoid reacting to its own writes (the palette's "own echo" concern becomes a one-box If in the button).

## The projection and its interface (CQRS read side)

The mirror is the projection. It subscribes to every document event, local or remote. It is eventually consistent with Firebase; the lag is the listener's, about a second (F5).

**Its interface is SAMMI's variable space** (maintainer ruling, Oct 29, 2026). On connect and on every change the extension writes one global object variable per collection, `fb_<collection>`, keyed by document id, each document an object of its fields. A streamer's existing button reads a static document directly, `/$global.fb_example.settings.ip$/`. For a document keyed by a provider user id the id is held in a variable, which a path cannot resolve (S17, D27): use `Firebase: Get Field`, or, simpler and always available, the value the write command just answered with. No read command is needed, and the product ships no dedicated read or write buttons; the streamer embeds the write commands below in the buttons they already have.

**The variables are two-way for bound collections** (H5 ruling, maintainer, Oct 29, 2026). A button may write by setting the variable, `Set Variable global.fb_viewers.alice.points = 130`, and the extension turns the change into a document command: it polls each bound collection's variable through the Bridge at a fixed interval (default 500 ms, a setting in the tab), diffs it against the snapshot it last wrote, and issues `UpdateDocument` or `DeleteField` per changed field through the normal command path, so invariants, the mirror, the ini, Firebase and `DocumentUpdated` all apply. A change the invariants reject is reverted in the variable and announced by `WriteRejected`. Binding is per collection (`two-way` on Define Collection, default on). The costs are stated, not hidden: one poll interval of latency, websocket traffic per tick proportional to the bound collections' size (S12), and the fact that a command still gives the button its result while a variable write does not.

Queries remain for what a variable cannot express, served from memory, never from the network:

| Query | Boxes | Returns (Save Variable box) |
| --- | --- | --- |
| `GetDocument` | collection, id, Save Variable As, Unpack prefix (optional) | The document as JSON; with a prefix, also one local variable per field, `prefix_field`. Optional: the same data is already in `fb_<collection>` |
| `GetField` | collection, id, field, default, Save Variable As | The field value, or the default when the document or field is missing (`error: missing` without a default) |
| `DocumentExists` | collection, id, Save Variable As | `true` or `false`; an unknown collection is `false` |
| `ListDocuments` | collection, Save Variable As | JSON array of ids, sorted; `[]` for an unknown collection |
| `QueryDocuments` | collection, field, operator (`==`, `!=`, `<`, `<=`, `>`, `>=`, `contains`, `exists`), value, order by, descending, limit, Save Variable As | JSON array of `{id, …fields}`, filtered and sorted in the mirror. Numeric comparison when both sides are numbers, string otherwise; `contains` is a case-insensitive substring test; documents lacking the filter field never match; missing order fields sort last; default order by id |
| `CountDocuments` | collection, optional filter as Query Documents, Save Variable As | number; `0` for an unknown collection |
| `GetStatus` | Save Variable As | JSON: `state`, `email`, `projectId`, `documents`, `pending`, `lastSync`, `deviceId`; works while Disconnected |

Queries never fail on invariants; an unknown collection or id returns the default or an empty result.

Polling is the only mechanism available because the Bridge has no variable-change subscription; it was adopted by maintainer ruling with the costs above (H5). Verification S18 measures it.

## Policies

A policy is a SAMMI button whose trigger is one of the events above and whose body issues one command. The extension ships none; the user writes them. The bundled deck shows two:

- `OnDocumentUpdatedAlert`: trigger `Firebase: Document Updated`, If `source == remote` → Popup "`{collection}/{id}` changed elsewhere".
- `OnConnectedRefresh`: trigger `Firebase: Connected` → `GetDocument` of the deck's settings document into local variables.
- `ReconcileOnMyTrigger` (pattern, not shipped): trigger of the streamer's choice → `Firebase: Reconcile`. The same command can be placed reactively inside any button instead (H2 ruling: both paths).

## Orchestrations

None in the first release. A future `Import` (restore from JSON) and `Export` would be orchestrations: a command invoked on them, steps relayed through events and policies, with compensation.

## Value objects

`CollectionName`, `DocumentId`, `FieldName`, `FieldValue` (string or number), `DeviceId`, `Timestamp` (server-assigned, milliseconds), `FirebaseConfig`.

## Gateways

- `FirebaseAuthGateway`: `Connect` → signed-in session; session resume on start.
- `FirebaseDatabaseGateway`: writes (`set`, `update`, `remove`, `increment`), the initial read, and the listener that turns remote changes into domain events.

Both are the only code that imports the Firebase SDK, so a second provider is two files (D2).

## How this maps onto SAMMI's surface

| Palette | In SAMMI |
| --- | --- |
| Command | Extension command `Firebase: Create Document` and so on, `"async": 0.0`, answered through a Save Variable box |
| Query | Extension command with a Save Variable box, answered from the mirror |
| Domain event | Extension trigger `Firebase: Document Updated` and so on, with the payload as pull data |
| Policy | A user's button with that trigger |
| Projection | The mirror: memory, `firebase.ini` (readable by SAMMI's own INI commands when the Bridge is closed), and the `fb_<collection>` global variables that every button reads |
| Aggregate state (Connection) | The status line in the Bridge tab and `GetStatus` |

Naming rules for the command list: prefix `Firebase: `, then the palette name split into words. Commands are verbs first (`Firebase: Update Document`), queries are `Get`, `List`, `Query`, `Count`, events are noun then past participle (`Firebase: Document Updated`). SAMMI sorts the list alphabetically, so everything groups under `Firebase:`.
