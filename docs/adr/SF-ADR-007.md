# SF-ADR-007: The variable surface: fb_<collection> for reads, two-way binding by polling for writes

| Field | Value |
| --- | --- |
| Status | Accepted (maintainer rulings of Oct 28–29, 2026; corpus ratified Oct 29, 2026) |
| Date | October 29, 2026 |
| Applies to | Mirror projection, VariableSurface and PollBoundVariables gateways |
| Decision in flmnt | workspace `firebase`, entry fcc5c5fe, 90f9fa63, b0a0a7a5, 605960f9 (H5) |
| Contract output | `contracts/collection-variable.json` |

## Context

Maintainer ruling, Oct 29, 2026: the schema SAMMI reads and writes must be accessible as variables to any button; streamers will not build buttons just to read or write; the operations are embedded in the buttons they already have. SAMMI documents object variables with JavaScript-style dot notation and ships Set and Get Object Variable commands; the Spotify extension already sends whole objects through `SAMMI.setVariable` (S16 verified from source). The Bridge has no subscription to variable changes.

## Decision

1. The extension keeps one global object variable per collection, `fb_<collection>`, keyed by document id, each document an object of its fields without `_t` and `_d`, rewritten with `SAMMI.setVariable` on connect and on every local or remote change. A static document is read as `/$global.fb_example.settings.ip$/`.
2. Dynamic paths: for a person keyed by the provider's user id, the recipe is the write command's own answer first, then `Firebase: Get Field` with the id in its Id box. SAMMI does not resolve a variable nested inside a path (S17, contradicted on hardware, D27). Figured out once, shown once in the bundled deck, copied by the streamer per provider.
3. Writes by variable (H5): a collection declared `two-way` (default on) binds its variable. The extension polls each bound variable through `SAMMI.getVariable` at `poll_ms` (default 500, a tab setting), diffs against the snapshot it last wrote, and issues `ApplyVariableChange` per differing field through the Document aggregate's invariants. A rejected change is reverted in the variable and announced by `WriteRejected`. The costs are stated: one poll interval of latency, websocket traffic proportional to bound collections, and no result answer for a variable write.
4. If a collection grows past SAMMI's message limit (S12), the fallback is one variable per document, decided by measurement (T-V3).

## Rationale

The maintainer's requirement, verbatim: "what we build and expose is going to surface these variables for r/w operations embedded within other buttons that the streamer decides to integrate firebase storage with." Polling is the only mechanism available for the write direction, adopted with its costs visible.

## Rejected alternatives

- **Reads only through a Get command.** The first draft; rejected by the ruling.
- **Keying people by display name.** Rejected: names change and are not predictable paths; provider user ids are stable and arrive in the trigger.
- **Writes only through commands.** Rejected by ruling H5; commands remain the precise path and the one that returns a result.

## Consequences

Own rewrites never loop because the snapshot is updated before the variable. A remote change applied between two polls updates snapshot and variable together. Tests T-V1 to T-V7. S18 measures poll cost at build.

## Compliance impact

None.

## Open questions

None. (How Facet renders a query step is Facet's concern and is recorded in its own workspace.)
