# SF-ADR-003: Email/Password sign-in; the SDK session persisted in localStorage and backed up to the ini

| Field | Value |
| --- | --- |
| Status | Accepted (maintainer rulings of Oct 28–29, 2026; corpus ratified Oct 29, 2026) |
| Date | October 29, 2026 |
| Applies to | Connection aggregate, FirebaseAuth gateway |
| Decision in flmnt | workspace `firebase`, entry 1a431d94 (D4) |
| Contract output | `contracts/ini-firebase.json` (section `connection`) |

## Context

The Bridge runs from a `file://` origin inside OBS's Chromium. Firebase's documentation says popup and redirect sign-in need an http, https or chrome-extension origin. The probe refined this: SDK 10.12 opens the popup from the dock, but a real project refuses the sign-in with `auth/unauthorized-domain`, because the authorized-domain check requires an http or https page before it matches the hostname, and no console setting admits `file://` (F1, Oct 29, 2026). Email/Password sign-in completes from the dock (F2). localStorage works in the dock and survives OBS updates (O3); IndexedDB also works, contrary to older research (O2), but the OBS profile can still be cleared.

## Decision

1. Email/Password is the only sign-in. The user creates the account in the Firebase console (setup step 2b); release 1 ships no sign-up, password reset or account management (D9).
2. The SDK is initialized with `browserLocalPersistence` and no popup resolver, so it resumes the session itself on every Bridge start.
3. On every auth state change the extension copies the SDK's persisted session record, as an opaque string, into `firebase.ini` `[connection] session`. On start, if localStorage has no record but the ini does, the record is written back before Auth initializes.
4. A revoked session (password changed, user deleted) moves the connection to Disconnected with reason `session`, clears the ini record, keeps the mirror, and shows one alert.
5. The password is typed only in the tab. `Firebase: Connect` as a deck command has no boxes beyond Save Variable: it resumes from the stored session record (`Connect { }` in the spec), so a connection deck works after the first tab sign-in and no deck file ever holds a secret. A cold machine signs in once through the tab (ruled Oct 29, 2026).

## Rationale

It is the only flow that completes in the environment. Backing up the SDK's own record keeps one code path: the SDK cannot be seeded with a bare refresh token, and the REST token endpoint only serves the database's REST API, not the realtime listener.

## Rejected alternatives

- **Google sign-in through a popup.** Rejected by hardware evidence: `auth/unauthorized-domain` from `file://`.
- **A hosted sign-in page that shows a one-time code to paste.** Rejected for the MVP: it makes us a service operator and adds a step; recorded as the alternative if account creation proves a real obstacle.
- **Storing the refresh token in the ini and exchanging it over REST.** Rejected: the SDK cannot adopt it, so the realtime listener would need a second, REST-only client.

## Consequences

One secret is on the machine, the SDK session record, the same exposure every other Bridge integration has. The ini never holds a password. Test T-A3 verifies the localStorage key name on the pinned SDK version; T-P2 verifies the restore.

## Compliance impact

The session record and the email are stored locally in the SAMMI folder; they are the user's own credentials to their own project.

## Open questions

None. The deck command is resume-only (decision 5); the password box exists only in the tab.
