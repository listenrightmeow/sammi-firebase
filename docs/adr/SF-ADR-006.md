# SF-ADR-006: Domain events are SAMMI triggers carrying a reduced PADR-004 envelope

| Field | Value |
| --- | --- |
| Status | Accepted (maintainer rulings of Oct 28–29, 2026; corpus ratified Oct 29, 2026) |
| Date | October 29, 2026 |
| Applies to | every event; the FireTrigger gateway |
| Decision in flmnt | workspace `firebase`, entry fcc5c5fe (D7) |
| Contract output | `contracts/event-envelope.json` |

## Context

The platform's Event Payload Contract (PADR-004) defines the envelope every product's events carry: eventId, eventType, productSource, sessionId, causationEventIds, correlationId, timestamp, version, payload. SAMMI extension triggers carry flat pull data (S11).

## Decision

1. Every domain event becomes an extension trigger `Firebase: <Noun> <Past participle>`: Connected, Connection Failed, Disconnected, Mirror Reconciled, Collection Defined, Collection Undefined, Document Created, Document Replaced, Document Updated, Document Deleted, Write Rejected.
2. Pull data is the envelope reduced to what a trigger can carry flat: `eventId`, `eventType`, `timestamp`, `version`, `source` (`local` or `remote`), `deviceId`, `causationId` (the SAMMI button instance that issued the command when local), plus the event's own fields; JSON-valued fields are JSON text (`contracts/event-envelope.json`).
3. `source` exists so a policy button can skip its own echoes with one If box.
4. ConnectionFailed and WriteRejected are refusals surfaced as triggers: the refused act happened out of band (a credential, a variable write), so the fact "it was refused" is recorded as an event by an explicit command. This bends the palette's "a rejection emits nothing" and is stated as such.

## Rationale

Users wire policies as buttons with these triggers; the envelope gives them identity, time, cause and origin without a custom schema per event, and keeps the product's events recognizably in the platform's shape.

## Rejected alternatives

- **The full PADR-004 envelope.** Rejected: `productSource`, `sessionId`, `causationEventIds` and `correlationId` have no meaning inside one Bridge; the reduced set keeps the useful fields.
- **One generic `Firebase: Changed` trigger.** Rejected: SAMMI's trigger list is how streamers discover events, and a policy is one event, one command.

## Consequences

Every event is a schema the specs assert on the `sammi` surface. Event versioning is additive (SF-ADR-010).

## Compliance impact

None.

## Open questions

None. A `Firebase: Any Event` trigger for logging decks is on the backlog (PRD §5), not in release 1.
