# SF-ADR-004: Local-first mirror in firebase.ini; consistency rules; Bridge-closed behavior

| Field | Value |
| --- | --- |
| Status | Accepted (maintainer rulings of Oct 28–29, 2026; corpus ratified Oct 29, 2026) |
| Date | October 29, 2026 |
| Applies to | Mirror projection, Reconcile, every Document command |
| Decision in flmnt | workspace `firebase`, entry 1a431d94 (D5, D6), 605960f9 (D10, D12) |
| Contract output | `contracts/ini-firebase.json` |

## Context

Buttons run during a live stream. They cannot wait on the network and must keep working with the Bridge closed or the internet down. The Bridge exposes `SAMMI.saveIni` and `SAMMI.loadIni`, which make SAMMI Core write and read ini files that SAMMI's own INI commands can also read (S10). The Realtime Database web SDK's offline queue is memory only (F8). A hidden OBS dock keeps running; only closing OBS takes the Bridge away (O8, S15).

## Decision

1. Every document has a local mirror in memory and in `firebase.ini`: one section per collection, one key per document holding the document JSON (`contracts/ini-firebase.json`). The `[collection:<name>]` sections are frozen from release 1 because decks read them directly.
2. Order of a local command: validate against the mirror → apply → write the ini (collection, index, pending) → rewrite the collection variable → answer the button → send to Firebase → drop from pending on acknowledgement.
3. Remote changes: document-level last write wins by server `_t`; own echoes (`_d` equal to this device with equal `_t`) are ignored and emit nothing.
4. `[pending]` is the durable write queue, replayed on reconnect: update, set-field, delete-field and increment merge on the server in any order; a create or replace older than the remote is dropped and announced as `DocumentUpdated` with source `remote`.
5. Reconcile on connect: one read of `meta/schema` and `collections/`, rule 3 per document, rule 4 per pending entry, then subscribe. Connect reconciles automatically; `Firebase: Reconcile` does it on demand (H2).
6. Bridge closed: a deck reads with `INI: Load Text` from the frozen section, and SAMMI's own "Bridge disconnected" message tells the user (D24). A deck may write a document with `INI: Save Text`; on the next start the extension hashes every ini document against `[index] hashes`, queues the changed ones as pending replaces stamped now, and pushes them; local wins over remote changes made meanwhile (H3). Deletes while closed are unsupported.

## Rationale

The mirror is the source of truth for buttons; the cloud is the source of truth for durability. A setting read a thousand times and written once must never cost a network round trip on read. Local-wins on reopen because the user was acting on the only copy they could see, and silently discarding what they did during the stream is the failure this project exists to prevent.

## Rejected alternatives

- **Browser storage as the mirror.** Rejected: shared across every file-URL dock (O4), invisible to SAMMI's own commands, lost with the OBS profile.
- **Remote wins on reopen with an alert.** Rejected by maintainer ruling H3.
- **Relying on the SDK's offline queue.** Rejected: memory only (F8).
- **Field-level timestamps for merges.** Rejected: field-level merges already happen on the server through `update()`; document-level `_t` decides only which snapshot the mirror keeps.

## Consequences

`loadIni` reads one key at a time, so `[index]` carries the collection and id lists and the hashes. Nine mirror rules are stated in the domain model and the specs assert them. Tests T-B1 to T-B5, T-O1 to T-O3, T-D1.

## Compliance impact

None.

## Open questions

None. Whether GameMaker's ini functions accept `:` in section names is a milestone-1 check (T-D1), not a decision: if they do not, the section name becomes `collection_<name>` and `contracts/ini-firebase.json` is amended in the same change.
