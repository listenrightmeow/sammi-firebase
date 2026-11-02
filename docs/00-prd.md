# SAMMI Firebase — product requirements

| Field | Value |
| --- | --- |
| Status | Approved by the owner, Oct 29, 2026 (draft 1 written after discovery the same day) |
| Scope | Release 1 |
| Companion documents | decisions `docs/01`, verification `docs/02`, journeys `docs/03`, architecture `docs/04`, data model `docs/06`, domain model `docs/10`, ADRs `docs/adr/`, model `model/`, specs `specs/` |

This project started from curiosity: can a SAMMI user's data live somewhere safer than files next to an executable? Discovery answered yes on real hardware, and the design that followed is settled in the decision record and ADRs. This PRD is the short statement of what is being built and why, for anyone meeting the project cold.

## 1. Problem

SAMMI keeps everything in local files. Variables do not survive a restart, and the usual workaround is ini files next to the executable. Lose the machine, lose the setup. Nothing a streamer configures can be edited from anywhere else, and nothing reacts when it changes.

## 2. Who it is for

A streamer who runs SAMMI with the Bridge as an OBS dock, installs things by clicking, and may never have opened a developer console. They have buttons already: cheers, alerts, counters, scene changes. They will not build buttons to manage data; they will add one line to the buttons they have.

## 3. What it is

A SAMMI Bridge extension, one `.sef` file, that keeps a streamer's records in their own Firebase project. Records are documents in collections with fields. Every button reads them as ordinary SAMMI variables. Writes are single commands embedded in existing buttons, or, for bound collections, plain variable sets. Changes made anywhere, another PC or the Firebase console, arrive within a second as SAMMI triggers.

## 4. Outcomes (the eight journeys)

| Outcome | A streamer can say |
| --- | --- |
| O1 | "My SAMMI talks to my Firebase." Setup once: a Firebase project, the extension installed, config pasted, Connect, status green. Under fifteen minutes with screenshots. |
| O2 | "My deck keeps its records." A startup button declares a collection; a settings button writes one document; any button reads `/$global.fb_example.settings.ip$/`. |
| O3 | "A change made elsewhere reaches my stream." Edit a record in the console; the mirror and the variable update; a policy button fires. |
| O4 | "The Bridge is closed and the show goes on." Reads fall back to the ini; the deck tells me once; what I changed meanwhile is pushed when the Bridge returns and wins. |
| O5 | "The internet drops mid-stream." Writes queue, reads keep working, the queue replays. |
| O6 | "New machine, same data." Install, paste the saved config, connect; schema and documents come home before any deck runs. |
| O7 | "The session is lost." The stored session restores itself; at worst I type the password once; buttons never stop. |
| O8 | "A viewer counter." A cheer button increments points by the provider's user id and holds the new total; a leaderboard is a query. |

## 5. Release 1 scope

In:

- The Bridge tab: config paste with validation, email and password, Connect, Disconnect, status line, poll interval, Forget this project.
- Commands: Connect, Disconnect, Reconcile, Define Collection, Undefine Collection, Create Document, Replace Document, Update Document, Set Field, Increment Field, Delete Field, Delete Document.
- Queries: Get Document (with unpack), Get Field, Document Exists, List Documents, Query Documents, Count Documents, Get Status.
- Triggers: Connected, Connection Failed, Disconnected, Mirror Reconciled, Collection Defined, Collection Undefined, Document Created, Document Replaced, Document Updated, Document Deleted, Write Rejected.
- The variable surface `fb_<collection>`, two-way for bound collections.
- The local mirror in `firebase.ini`, the pending queue, reconcile on connect and on demand, Bridge-closed fallback and catch-up on reopen.
- A bundled deck of seven buttons: help, status, a startup button with two Define Collection examples, example replace, example get with the fallback, two example policies.
- A setup guide with one screenshot per console step.

Out, by decision:

- Account creation, password reset or any account management in the extension.
- A hosted Firebase project or any service we operate.
- Deleting documents while the Bridge is closed.
- Nested objects as field values (store JSON text in a string field).
- Import and export, and any orchestration.

Backlog, recorded so they are not re-argued: a hosted Firebase preset so a streamer needs no project of their own (SF-ADR-002); a `Firebase: Any Event` trigger for logging decks (SF-ADR-006); import and export as orchestrations (`docs/10` §policies); a nightly run against a sandbox project if the PC matrix becomes a bottleneck (SF-ADR-015); a phone-sized web page or moderator panel on the same tree (`docs/12`).

## 6. Requirements that discovery fixed

| Requirement | Source |
| --- | --- |
| Email/Password is the only sign-in; Google and other popup providers cannot complete from the Bridge's `file://` origin. | F1 verified, Oct 29, 2026 |
| Every shipped command carries the Async flag off; otherwise SAMMI does not wait for the answer. | S6, prototype 2 |
| The extension always answers within the box timeout; an absent answer means the Bridge was not running. | S15 |
| A hidden OBS dock keeps running; only closing OBS takes the Bridge away. | O8 |
| Documents are at most 8 KB and fields 4 KB, because SAMMI's websocket drops larger messages. | S12 |
| People are keyed by the streaming provider's user id, never a display name. | maintainer, Oct 29, 2026 |
| Reads are variables; the product ships no dedicated read or write buttons. | maintainer, Oct 29, 2026 |

## 7. Success criteria for release 1

- A streamer who did not write the setup guide completes O1 in under fifteen minutes (T-I1).
- Every scenario in the on-PC matrix passes on the streaming PC (`docs/09-test-plan.md`).
- Every `.feat` spec is `verified`: the generated suite green in CI with zero unpredicted effects.
- The board, the Moment model and the specs agree: every command, event and aggregate appears in all three.
- The repository is public under MIT with the setup guide, the ADRs and the evidence of the hardware probes.

## 8. Constraints

- Minimum SAMMI Core 2025.2.0; the Bridge shipped with it; OBS 30 or newer.
- No infrastructure is operated (SF-ADR-009). The user's Firebase free tier covers the use.
- The extension never stores a password. It stores the SDK's session record, the config and the email in the SAMMI folder.

## 9. Open questions

- None. The pre-build sweep of Oct 29, 2026 closed the last one: the deck command `Firebase: Connect` is resume-only, with no password box (SF-ADR-003 §5).
