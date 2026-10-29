# Security policy

## Reporting a vulnerability

Report privately through GitHub: **Security → Report a vulnerability** on this repository. Do not open a public issue. Expect an acknowledgement within a week.

## Scope

In scope: the extension (`.sef`), its handling of the Firebase session record and config in `firebase.ini`, the security rules it ships (`contracts/database.rules.json`), and the release pipeline, including the artifact attestation.

Out of scope: Firebase itself, SAMMI, OBS, and the security of a user's own Firebase project beyond the rules this project ships.

## What the extension stores

The Firebase web-app config (public by design), the account email, and the SDK's session record, all in `firebase.ini` in the SAMMI folder. It never stores a password, and the deck command `Firebase: Connect` has no password box (SF-ADR-003). Users can verify a release with `gh attestation verify` as described in the README.
