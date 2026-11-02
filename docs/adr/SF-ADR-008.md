# SF-ADR-008: Collections are declared locally and mirrored to the cloud; strictness and binding are per collection

| Field | Value |
| --- | --- |
| Status | Accepted (maintainer rulings of Oct 28–29, 2026; corpus ratified Oct 29, 2026) |
| Date | October 29, 2026 |
| Applies to | Collection aggregate |
| Decision in flmnt | workspace `firebase`, entry 605960f9 (H1), fcc5c5fe |
| Contract output | `contracts/cloud-tree.json` (`meta/schema`), `contracts/ini-firebase.json` (`[schema]`) |

## Context

Firebase is schema-less. Users define the data they store; the extension needs enough shape to enforce strictness, bind variables, and unpack documents in a known order. A second machine should inherit a deck's declaration without re-running its startup button (maintainer ruling H1).

## Decision

1. `Firebase: Define Collection` (name, fields, strict, two-way) writes the declaration to `firebase.ini [schema]` and to `users/{uid}/meta/schema/<name>` with a timestamp from the writing PC's clock (D30). `Undefine Collection` removes both and never deletes documents.
2. On connect the cloud schema is merged into the local one, newest wins, before any deck runs (`ApplyRemoteSchema`).
3. An undeclared collection is open: any field names are accepted. `strict` rejects unknown fields. `two-way` (default on) binds the collection's variable for writes (SF-ADR-007).
4. Names: collections and fields `[a-z][a-z0-9_]{0,31}`, `_` prefix reserved; ids `[A-Za-z0-9_-]{1,64}`; blank id on create means a generated push id.

## Rationale

A deck is self-describing through its startup button, and a new machine already has the shape after its first connect. The name rules are stricter than Firebase's so that a name is valid everywhere, including as an ini key and a SAMMI variable path, without escaping.

## Rejected alternatives

- **Per-machine schema only.** The first draft; rejected by ruling H1.
- **Enforcing schemas in Firebase security rules.** Rejected: rules would need editing per deck, and the user must never edit them.
- **No schema at all.** Rejected: strict collections, variable binding and unpack order need one.

## Consequences

`CollectionDefined` carries `source` like document events. Test T-S1.

## Compliance impact

None.

## Open questions

None.
