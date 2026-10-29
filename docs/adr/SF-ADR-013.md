# SF-ADR-013: Error response format: the answer shape and the reason registry

| Field | Value |
| --- | --- |
| Status | Accepted (maintainer, Oct 29, 2026: "all agreed on") |
| Date | October 29, 2026 |
| Applies to | every command and query; the tab's messages |
| Decision in flmnt | workspace `firebase`, entry fcc5c5fe (D7), 605960f9 |
| Contract output | `contracts/command-answer.json` |

## Context

The platform's required Error Response Format ADR assumes HTTP and RFC 7807. Here the error surface is a string in a SAMMI Save Variable box and a line in the Bridge tab.

## Decision

1. A command or query answers one of: the resulting document as JSON text, a scalar as text, `ok`, or `error: <reason>` where `<reason>` is one of a closed list kept as the `ErrorReason` enum in `contracts/command-answer.json` (connection: `not connected`, `already connected`, `config incomplete`, `invalid config`, `credentials invalid`, `provider disabled`, `api key invalid`, `session lost`; collection: `bad collection name`, `not defined`; document: `bad id`, `exists`, `missing`, `bad field`, `unknown field`, `too large`, `not a number`, `not two-way`, `bad operator`; remote: `remote older`, `own echo`, `remote schema older`). `Disconnected` carries its own `reason` (`user`, `network`, `session`) and `WriteRejected` carries the underlying reason; neither is a box answer, so neither is in the registry. Adding a reason is a contract change.
2. In the handler contract, a rejection is `{ status: "ERR", body: { code, answer } }` where `code` is the reason in SCREAMING_SNAKE_CASE (`UNKNOWN_FIELD`) and `answer` is the exact string the box receives. Specs predict both.
3. A rejection emits no event and writes nothing. The two exceptions, ConnectionFailed and WriteRejected, are `predict error` in the specs: an error response with compensating effects (SF-ADR-006).
4. The tab translates SDK errors to one sentence naming the setup step to redo (`docs/05-auth-flow.md`).
5. An absent Save Variable is never produced by the extension; it means the Bridge was not running (SF-ADR-004).

## Rationale

A streamer reads the box; a spec asserts the code. Both must be stable, so both are in the contract.

## Rejected alternatives

- **RFC 7807 JSON in the box.** Rejected: unreadable in a SAMMI alert, and SAMMI's string commands would have to parse it.
- **Free-text reasons.** Rejected: a public project's decks would be written against them.

## Consequences

Every `rejects` line in a spec names a code from the registry; the two-way lint (B2) holds it to its scenarios.

## Compliance impact

None.

## Open questions

None.
