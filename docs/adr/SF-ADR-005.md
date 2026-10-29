# SF-ADR-005: The command surface follows the DDD Palette; documents in collections; commands answer with their result

| Field | Value |
| --- | --- |
| Status | Accepted (maintainer rulings of Oct 28–29, 2026; corpus ratified Oct 29, 2026) |
| Date | October 29, 2026 |
| Applies to | every command and query; the bundled deck |
| Decision in flmnt | workspace `firebase`, entry fcc5c5fe (D7), 605960f9 (D12) |
| Contract output | `contracts/command-boxes.json`, `contracts/command-answer.json` |

## Context

The maintainer's palette (Layer 0 of the methodology) is the house grammar: commands imperative on one aggregate, events past tense, policies as "when one event then one command", projections on the read side. Streamers think in records, not paths. Prototype 2 established the payload a Bridge extension receives and how it answers (S6).

## Decision

1. Commands are `Firebase: <Verb> <Noun>` in SAMMI's list and target one aggregate: Connection (`Connect`, `Disconnect`, `Reconcile`), Collection (`Define Collection`, `Undefine Collection`), Document (`Create Document`, `Replace Document`, `Update Document`, `Set Field`, `Increment Field`, `Delete Field`, `Delete Document`). Queries are `Get Document`, `Get Field`, `Document Exists`, `List Documents`, `Query Documents`, `Count Documents`, `Get Status`. The box payloads are `contracts/command-boxes.json`.
2. The data unit is a document in a collection with fields that are strings or numbers. A document is passed to and from SAMMI as JSON text; `Set Field` and `Get Field` cover the one-field case without JSON. People are keyed by the streaming provider's user id from the trigger; the display name is a field.
3. Every command answers through its Save Variable box with its result: the resulting document as JSON for the document commands, the new value for `Increment Field`, `ok` for deletes and connection commands, or `error: <reason>` (`contracts/command-answer.json`). The write is the read: a cheer button that increments points holds the new total.
4. A rejected command emits no event and writes nothing; the button receives the error answer. The extension always answers within the box timeout.
5. Firebase stays schema-less; `Define Collection` declares a deck's shape locally and in `meta/schema`, enforced by the extension (SF-ADR-008).

## Rationale

The palette gives the surface a grammar that stays consistent as commands are added, and it is the notation every other artifact in the platform speaks. Returning the result removes a read from every write-then-read flow and gives dynamic-id flows a guaranteed value.

## Rejected alternatives

- **Flat path keys (`hue/ip`) with Save and Load.** The first draft; rejected: users think in records, and dynamic ids have no home in a path.
- **Provider-neutral names (`Cloud: Save`).** Rejected: an abstraction that cost clarity without buying anything yet; the provider stays pluggable underneath.
- **Guessing JSON in values.** Rejected: JSON is the explicit document format, never inferred.
- **Answering only `ok`.** Rejected: it forces a read after every write and leaves person-keyed flows without a value.

## Consequences

Box payloads and answers are contracts the specs assert. Reason codes form a closed list in `command-answer.json`. The bundled deck's examples are examples only; the product ships no dedicated read or write buttons.

## Compliance impact

None.

## Open questions

None.
