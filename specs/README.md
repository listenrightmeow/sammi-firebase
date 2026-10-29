# Feature specs

Layer 4 of the methodology: one `.feat` spec per command and query of the Moment model (`model/contexts/sammi-firebase.moment`), each with its `.contract.json` registry beside it. The specs are the units of work for the build (SF-ADR-014); the generated `*.test.ts` suites are never committed (SF-ADR-012). Harness: SF-ADR-016.

```
feat lint && feat audit && feat generate && feat run
```

All 23 specs are green against the handlers in `src/features/` and the fake world in `tools/feat-adapters/` (milestone 1, Oct 29, 2026): 200 scenarios, 200 passing.

## Vocabulary

- **Services:** `ini` (writes and deletes to `firebase.ini`), `firebase` (writes to the user's Realtime Database), `sammi` (variable publications and triggers). A scenario predicts every service; `has []` is an assertion that nothing happened there.
- **Seed vocabulary of the fake world:** `node` (database contents), `user`, `provider` (Email/Password switched off), `project` (the API key the project really has), `later` (a write by another device that lands after the Bridge's first full read, unseen by its listener), `outage { writes }` (the next N document writes fail, as when the network drops). Seeds always run before `execute` steps, so anything that must happen after Connect is a `later` write or comes from a command issued during an `outage`.
- **Clock:** every scenario runs at `2026-10-29T12:00:00Z`; `_t` written by this device is `1793275200000` and the fixtures seed older timestamps from `dev2`.
- **Fixtures:** user `uid-streamer` on project `sammi-probe`, device `dev1`; collections `hue` (strict, two-way), `viewers` (open, keyed by provider user id), `counters`, `notes`, `log`.
- **Answers:** `response OK CommandResponse { answer, document | value | ids | documents | count | status | variables }` or `response ERR CommandError { code, answer }`, per SF-ADR-013. Every `rejects` line names a code from `contracts/command-answer.json`; `feat lint` holds each to a `predict rejection` scenario.

## Coverage

| Spec | Model element | Scenarios | Rules asserted | Journeys | ADRs |
| --- | --- | --- | --- | --- | --- |
| SPEC-CON-001 Connect | `Connect` + policy `ReconcileOnConnected` + `RecordConnectionFailure` (the `predict error` branches) | 17 | MIR-02, 04, 06, 07; config validation; session resume | O1, O5, O6, O7 | 002, 003, 004, 006 |
| SPEC-CON-002 Disconnect | `Disconnect` | 2 | session record only | O1 | 003 |
| SPEC-CON-003 Reconcile | `Reconcile` (H2 on-demand path) | 5 | MIR-02, 04, 06 | O4, O5 | 004 |
| SPEC-CON-004 Record Session Loss | `RecordSessionLoss` | 3 | mirror kept | O7 | 003 |
| SPEC-COL-001 Define Collection | `DefineCollection` | 8 | names; H1 cloud schema | O2 | 008 |
| SPEC-COL-002 Undefine Collection | `UndefineCollection` | 3 | documents untouched | O2 | 008 |
| SPEC-COL-003 Apply Remote Schema | `ApplyRemoteSchema` | 3 | newest wins | O6 | 008 |
| SPEC-DOC-001 Create Document | `CreateDocument` | 17 | MIR-01, 08, 09; strict; sizes; push id | O2, O8 | 004, 005, 008 |
| SPEC-DOC-002 Replace Document | `ReplaceDocument` | 11 | MIR-01, 08; upsert | O2 | 004, 005 |
| SPEC-DOC-003 Update Document | `UpdateDocument` | 11 | MIR-01, 04 (field merge), 08 | O2 | 004, 005 |
| SPEC-DOC-004 Set Field | `SetField` | 12 | MIR-01, 08; typing of box text | O2 | 005 |
| SPEC-DOC-005 Increment Field | `IncrementField` | 14 | MIR-01, 04 (server increment), 08; answer is the new total | O8 | 005 |
| SPEC-DOC-006 Delete Field | `DeleteField` | 9 | MIR-01, 08 | O2 | 005 |
| SPEC-DOC-007 Delete Document | `DeleteDocument` | 8 | MIR-01, 05, 08 | O2 | 004 |
| SPEC-DOC-008 Apply Remote Change | `ApplyRemoteChange` | 13 | MIR-02, 03, 05, 08 | O3 | 004, 006 |
| SPEC-DOC-009 Apply Variable Change | `ApplyVariableChange` + `RecordWriteRejection` (the `predict error` branches) | 13 | MIR-01, 08, 09; H5 revert | O2, O8 | 007 |
| SPEC-QRY-001 Get Document | `GetDocument` | 7 | read model only; unpack | O2 | 005 |
| SPEC-QRY-002 Get Field | `GetField` | 9 | default | O2 | 005 |
| SPEC-QRY-003 Document Exists | `DocumentExists` | 6 | | O2 | 005 |
| SPEC-QRY-004 List Documents | `ListDocuments` | 4 | | O8 | 005 |
| SPEC-QRY-005 Query Documents | `QueryDocuments` | 15 | operators, ordering, typing | O8 | 005 |
| SPEC-QRY-006 Count Documents | `CountDocuments` | 7 | | O8 | 005 |
| SPEC-QRY-007 Get Status | `GetStatus` | 3 | works Disconnected | O1, O4 | 005 |

Every command and query of the model has a spec or is the refusal branch of the command that issues it; every event in the model is asserted as a `Trigger` record somewhere (checked by script, zero missing). The nine mirror rules: MIR-01 write order in every document command; MIR-02 and 03 in Apply Remote Change and Reconcile; MIR-04 in Connect, Reconcile, Update and Increment; MIR-05 in Delete Document and Apply Remote Change; MIR-06 in Connect and Reconcile; MIR-07 (ini edits while closed, local wins) in Connect; MIR-08 (variable rewrite) everywhere; MIR-09 (bound-variable writes) in Apply Variable Change.

## Amendments made at build (D20, for ratification)

- **Connect, scenario 1:** documents are applied in key order, as the Realtime Database returns them. The prediction listed them in the order the spec was written.
- **Eleven specs:** 65 JSON-text predictions were compacted (`{"a":1}`, not `{"a": 1}`). A SAMMI box receives compact JSON; the spacing came from the tool that drafted the specs.
- **Reconcile, four scenarios:** the givens seeded the "later" cloud change and pending entry after `execute Connect`, but the harness runs every seed first, so Connect consumed them. They now use `later` writes and an `outage`; the replayed increment also predicts its `_t`/`_d` stamp, as Increment Field and Connect's replay do.
- **Ten scenarios added**, each a rule the code needed and no spec stated: Connect on a machine that never connected writes a generated device id; no config at all names `apiKey`; a password with no email, a deck Connect with no stored session, and a stored session the SDK rejects are each refused as invalid credentials; Apply Remote Change ignores a removal of an unknown document and refuses a malformed snapshot; Apply Variable Change reverts a clear of a missing field; Define Collection accepts no fields; Increment Field reads `by` typed as text.

## Assumptions the PC tier must confirm

- The specs predict `IniDelete` records (Disconnect, Delete Document, pending acknowledgements). The Bridge's `saveIni`/`loadIni` helpers are verified (S10); a delete helper is not. The `ini` gateway keeps `deleteKey` in its interface and the gateway probe (test plan T-D2) decides the real implementation. If the Bridge cannot delete a key, the gateway writes an empty value and the index is authoritative; the specs' `IniDelete` record then maps to that write in the real adapter only, never in the fake.
- `provider with AuthProvider` and `project with AuthProject` seeds model what the Firebase console does (provider enabled, API key belongs to the project); they exist only in the fake world.

## What the specs do not cover

The on-PC matrix (`docs/09-test-plan.md`) covers what Node cannot observe: the Bridge's `async` wait, timeouts, the hidden dock, the real SDK's session persistence, SAMMI's message limit, and the setup guide. The poller's loop and the RTDB listener are host wiring (SF-ADR-011) and are exercised there; the commands they issue are specified here.
