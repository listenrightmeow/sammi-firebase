# Moment alignment — board ↔ model

The methodology's gate before the spec layer: every event, command, aggregate and flow on the NDD board appears in the Moment-derived model, in the same context, and vice versa; the diff must be empty. Checked on Oct 29, 2026 against the board `SAMMI Firebase — NDD` (https://miro.com/app/board/uXjVEUQjpYg=/) after rulings H1–H5.

## The model

`model/` is a Moment project in the ADR-037 grammar, held to the palette by ADR-038 (`@mmmnt/cli` 0.6.2, pinned exactly as a dev dependency; run it as `pnpm exec moment`). Moment releases before 0.6.0 have no `external`, `projection`, `query`, `rule`, `state` or `gateway` and will not parse these files.

| File | Holds |
| --- | --- |
| `model/contexts/sammi-firebase.moment` | externals (FirebaseAuth, FirebaseDatabase, SammiCore, ObsBridge, Streamer), the context `SammiFirebase`: 3 aggregates, 18 commands, 11 events, 12 invariants, 2 projections, 7 queries, 9 rules, 1 policy, 3 relationships, 6 glossary terms |
| `model/flows/t1…t8-*.moment` | the eight NDD threads, one file each |

Validation, Oct 29, 2026:

```
moment parse model/        Parsed project successfully: 9 file(s), 1 context(s), 8 flow(s)   (0 errors, 0 warnings)
moment test  <each flow>   63 structural tests, 63 passed (T1 10 · T2 11 · T3 7 · T4 10 · T5 7 · T6 5 · T7 7 · T8 6)
moment derive <each flow>  63 cases
moment simulate --all      scenarios generated per flow (happy path + one per branch)
```

## Testing the flows in Facet

Two manifests exist and both are in place:

- `model/.manifest.yaml`: the project index (name, the context file, the eight flow files, generator output dirs, watch paths). `moment status model/` and `moment watch` read it.
- `model/facet/manifest.json`: Facet's index, generated, never committed. Regenerate with:

```
python3 tools/export_facet.py                                                   # simulate --all, then Facet's event-type check
pnpm exec moment serve model/facet --all                                       # WebSocket for Facet on port 4321
```

Facet accepts `SimQuery.*` since mmmnt/facet 27b1a40 (Oct 29, 2026, shipped to https://facet.mmmnt.dev), so the output loads unmodified. The export script replicates Facet's event-type check after generating; a command or query placed on a branch lane has no lane context, is emitted as a bare name, and would be rejected, so such nodes sit on the context lane inside their `when` block (T1 `RecordConnectionFailure`, T7 `RecordSessionLoss`, fixed Oct 29, 2026).

The Oct 29, 2026 run wrote 8 topologies, 57 scenarios (happy paths plus one negative per precondition), 5 artifacts (event catalog, impact analysis, saga state machines, policy definitions, AsyncAPI) and `manifest.json`, 546 events in all. Facet can also load the folder through its upload drawer.

## Aggregates

Board: Connection, Collection, Document. Model: Connection, Collection, Document. **Diff: none.**

## Commands

On the board and in the model (12): Connect, CreateDocument, DefineCollection, DeleteDocument, DeleteField, Disconnect, IncrementField, Reconcile, ReplaceDocument, SetField, UndefineCollection, UpdateDocument.

In the model only (6), each a construct the grammar needs in order to say what the board says in prose: ApplyRemoteChange, ApplyRemoteSchema, ApplyVariableChange, RecordConnectionFailure, RecordSessionLoss, RecordWriteRejection.

| Model-only command | Why it exists | On the board now as |
| --- | --- | --- |
| `ApplyRemoteChange` | The listener's delivery must be a command on the Document aggregate so rules 2 and 3 are its preconditions and a refused change emits nothing | discovered sticky, Document frame |
| `ApplyVariableChange` | The poller's diff (H5) must go through the Document aggregate's invariants | discovered sticky, Document frame |
| `ApplyRemoteSchema` | The cloud schema merge (H1) is a state change of Collection with its own precondition | discovered sticky, Collection frame |
| `RecordConnectionFailure` | ConnectionFailed is a refusal SAMMI must surface as a trigger; a command must emit it | discovered sticky, Connection frame |
| `RecordSessionLoss` | Disconnected with reason session, observed by the resume gateway | discovered sticky, Connection frame |
| `RecordWriteRejection` | WriteRejected, same reasoning as ConnectionFailure | discovered sticky, Document frame |

On the board only: none. **Diff after the board additions: none.**

## Events

On the board and in the model (11): CollectionDefined, CollectionUndefined, Connected, ConnectionFailed, Disconnected, DocumentCreated, DocumentDeleted, DocumentReplaced, DocumentUpdated, MirrorReconciled, WriteRejected. Model only: none. Board only: none. **Diff: none.**

## Flows and moments

| Flow | Moments in model | Columns on board | Model-only moments | Board-only |
| --- | --- | --- | --- | --- |
| T1 — Your SAMMI talks to your Firebase (O1) | 6 | 6 | none | none |
| T2 — A deck keeps its records (O2) | 7 | 7 | none | none |
| T3 — A change made elsewhere reaches the stream (O3) | 5 | 5 | none | none |
| T4 — The Bridge is closed and the show goes on (O4) | 8 | 7 | M5b · The local change is pushed | none |
| T5 — The internet drops mid-stream (O5) | 6 | 6 | none | none |
| T6 — New machine, same data (O6) | 5 | 4 | M3b · The mirror is rebuilt | none |
| T7 — The session is lost (O7) | 5 | 5 | none | none |
| T8 — A viewer counter (O8) | 5 | 5 | none | none |

The two model-only moments split a board column because the grammar's V5 requires `triggered-by` to name a node from an earlier moment: Connect and the reconcile it triggers cannot share a column. Both are added to the board as a note on the column they split. **Diff after that note: none.**

## What the model carries that the board does not draw

Projections (Mirror, ConnectionStatus) with their gateways, the seven queries, the nine mirror rules, the Streamer external with its two gateways, the value objects that name what crosses each gateway, and the glossary. All derived from docs 04, 06 and 10.

## What the grammar cannot carry (listed, not drawn)

- Connection's Offline sub-state: no command of its own; T5 shows it narratively.
- ConnectionFailed and WriteRejected as events of refusals: the palette says a rejection emits no event; here the refused act happened out of band, so the fact "it was refused" is recorded by an explicit command. A modelling choice accepted in SF-ADR-006 §4 on Oct 29, 2026; no separate SiDD pass was called.
- Actor and external-system steps inside the flows: project mode cannot resolve a node on an `[External]` lane (see tooling findings), so the streamer's acts and Firebase's and SAMMI's steps are comments beside the moments, lane declared, no nodes. The board keeps them as stickies; the 1:1 check does not cover them.
- The streamer-side policies (OnDocumentUpdatedAlert, OnConnectedRefresh) chain to SAMMI commands outside the context, which `chains-to` cannot name; they are patterns in a comment, and on the board.

## Tooling findings for the Moment workspace

1. In project mode a node on an `[External]` lane can never resolve: lanes get `ctx-<label>` ids and externals get `ext-<name>` ids, so PM-05 fails for every such node. Single-file mode fails the same nodes under V1. The corpus avoids the case by leaving external lanes empty. Either externals should be addressable by lane, or the palette's "External System generates Domain Events" needs a construct.
2. `trigger` is a keyword and cannot name an event field (the policy keyword); the error surfaces as "Expecting EOF" at the field, which hides the cause.
3. `chains-to` must name a command of an aggregate or orchestration in the model, so a policy whose Then is a host-side command (a SAMMI popup) cannot be declared even when the host is an external with gateways.
4. V5 forbids `triggered-by` within the same moment, which forces a board column to split when a command and the command it triggers happen in one beat.

## Verification rows closed by sources, no prototype 3

- S16: SAMMI documents object variables with JavaScript-style dot notation (Set Local Variable docs) and ships Set/Get Object Variable; the Spotify extension already sends whole objects through `SAMMI.setVariable`. Verified (source).
- S17: nested resolution `/$fb_viewers./$userId$/.points$/` is not documented. It is not load-bearing: `Get Object Variable` with Object `fb_viewers` and Key `/$userId$/` is a documented SAMMI command, so the dynamic recipe has a guaranteed form. Reclassified: nice-to-have, measured during build (T-V4).
- S18: polling cost is a measurement, not a design gate; measured during build (T-V3).

## Pre-build audit, Oct 29, 2026 (decision D16)

After the maintainer ratified the ADRs, the PRD and the specs, every layer was checked against every other by script (command, query, event and reason names; statuses) and by reading. The specs are the truth where they differed:

| Where | Before | After (from the approved specs) |
| --- | --- | --- |
| model `ReplaceDocument`, docs/10, board Document frame | document must exist | upsert; `DocumentCreated` when absent |
| model `UpdateDocument`, docs/10, board Document frame and T2 | upsert | requires the document (`missing` otherwise); T2's settings button and the bundled example use `Replace Document` |
| model `SetField`, `IncrementField`, docs/10 | silent on creation | upsert; numeric text typed, `str:` escape; `by` defaults to 1 |
| model DOC-05, docs/10, board invariant list | delete of absent is a no-op | refused with `missing`, no event; last delete leaves an empty variable |
| docs/10 `DocumentExists`, `GetStatus`, `QueryDocuments`, `MirrorReconciled` | `1`/`0`; one line; seven operators; field `trigger` | `true`/`false`; JSON; eight operators incl. `exists`; field `cause` |
| contracts `command-boxes.json` | seven operators, Count without filter | eight operators, `descending`, Count takes the filter |
| contracts `command-answer.json`, SF-ADR-013 | 23 reasons incl. `session lost`, `write rejected` | 21 reasons a box can answer; `api key invalid` now has a Connect scenario |
| SF-ADR-016 §4 | harness honors `clock at` | it does not; frozen clock is `options.clock` on each service |
| Connect spec | magic seed path `__auth/providers/password` | declared `AuthProvider` and `AuthProject` seed records |
| docs/08, docs/09 Layers 1–2 | concatenated JavaScript, `cloud-vars.sef`, Node scripts | esbuild bundle, `sammi-firebase.sef`, the Feature harness |

Model after the changes: `parse model/` clean, 63/63 flow tests. Board: Document frame, invariant list, Policies (H4 ruled green), T2 thread and a ratification note in the Context Map updated; the board remains the narrative, the `.feat` files the truth.
