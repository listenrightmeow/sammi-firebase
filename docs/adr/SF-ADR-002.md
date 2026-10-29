# SF-ADR-002: Users bring their own Firebase project; Realtime Database is the store

| Field | Value |
| --- | --- |
| Status | Accepted (maintainer rulings of Oct 28–29, 2026; corpus ratified Oct 29, 2026) |
| Date | October 29, 2026 |
| Applies to | Connection aggregate, the setup guide, the provider gateway |
| Decision in flmnt | workspace `firebase`, entry 1a431d94 (D2, D3) |
| Contract output | `contracts/firebase-config.json`, `contracts/cloud-tree.json`, `contracts/database.rules.json` |

## Context

Resilient data off the host machine means an account somewhere. The free Realtime Database tier allows 100 simultaneous connections per project, a hard ceiling for any shared instance (F6). Firebase offers two databases: Firestore, a document store with typed field envelopes, and Realtime Database, one JSON tree addressed by path with native realtime listeners and a plain REST API. The probe verified sign-in, write, read and the live listener from inside the OBS dock against a real project (F2, F7, Oct 29, 2026).

## Decision

1. The MVP uses the user's own Firebase project. The user creates it, enables Email/Password, creates their user, creates a Realtime Database and pastes our four-line security rules; the extension validates the pasted web-app config and names the console step to redo on any error.
2. The store is Realtime Database. Data lives under `users/{uid}`; the tree shape is `contracts/cloud-tree.json`; the rules file is `contracts/database.rules.json` and grants each uid its own subtree only.
3. The provider is a pluggable module behind a small gateway interface, so a hosted preset (a project we operate) can be offered later without changing decks or commands.

## Rationale

MVP mindset: users control their data, and we carry no cost, quota, abuse or support burden. Realtime Database fits SAMMI's data (records of strings and numbers), its listener is exactly the "cloud edit notifies the Bridge" behavior, and its free tier covers a streamer's settings many times over.

## Rejected alternatives

- **A shared project we operate.** Rejected for the MVP: the 100-connection ceiling, cost, abuse and support; kept as a later preset.
- **Google Drive or another store the user already has.** Rejected: needs an OAuth client we register and get verified, which makes us a service operator again, and OAuth popups do not complete from the dock (SF-ADR-003).
- **Firestore.** Rejected: typed field envelopes add ceremony with no benefit; no realtime listener semantics simpler than RTDB's; the provider abstraction keeps it possible later.

## Consequences

The console walkthrough is the floor of setup complexity and is documented with one screenshot per step. Security rules ship with the product and never need editing. The config is validated against `firebase-config.json` before the SDK is touched.

## Compliance impact

The API key in a Firebase web-app config is public by design; the rules file is the security boundary. No personal data beyond the user's email is stored by the extension.

## Open questions

None.
