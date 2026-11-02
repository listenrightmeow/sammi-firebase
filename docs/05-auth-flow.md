# Authentication flow

Email/Password through the Firebase Auth SDK, running inside the Bridge. Why nothing else works is in D4 and rows F1, F2, O2, O5 of the verification list: the SDK opens popups from the dock, but Firebase's authorized-domain check rejects any `file://` page (`auth/unauthorized-domain`, observed Oct 29, 2026), so Google and every other popup or redirect provider are out.

## States the tab shows

| State | Line in the tab | SAMMI alert | Commands |
| --- | --- | --- | --- |
| No config | "Paste your Firebase config to begin" | none | Queries answer from the mirror; commands answer `error: not connected` |
| Config, disconnected | "Connect needed" with email and password | one alert on Bridge start | same as above |
| Connecting | "Connecting…" | none | Queries from mirror; commands queue |
| Connected | "Connected as a@b.c · 42 documents · 0 pending" | none | all |
| Offline | "Connected · offline · 3 pending" | none | Queries from mirror; commands queue |
| Session lost | "Connect needed (session expired)" | one alert | as disconnected |

These are the states of the Connection aggregate in [10-domain-model.md](10-domain-model.md); `Connected`, `ConnectionFailed` and `Disconnected` are its events.

## Connect

From the tab, or from the `Firebase: Connect` command. The extension calls `signInWithEmailAndPassword` (F2, verified from the dock). There is no sign-up, no password reset and no account management in the first release (D9): the user creates the account in the Firebase console at setup step 2b, and resets a password there too.

Errors are translated before they reach the user:

| SDK code | Tab text |
| --- | --- |
| `auth/invalid-credential`, `auth/wrong-password`, `auth/user-not-found` | "Email or password is wrong. The user must exist under Authentication → Users in your project." |
| `auth/api-key-not-valid`, `auth/invalid-api-key` | "The config block is not from a Firebase web app. Redo setup step 5." |
| `auth/operation-not-allowed` | "Email/Password sign-in is not enabled in your project. Redo setup step 2." |
| `auth/network-request-failed` | "No internet. Will retry." |
| `auth/too-many-requests` | "Too many attempts. Wait a few minutes." |

## Staying signed in across restarts

The SDK is initialized with `browserLocalPersistence` (F3) and `browserPopupRedirectResolver` omitted. localStorage works in the dock and survives OBS updates (O3). The SDK stores its user record, including the refresh token, under a key of the form `firebase:authUser:<apiKey>:<appName>` and resumes silently on the next load; ID tokens last an hour and the SDK refreshes them itself (F4).

Two risks and their handling:

1. **The OBS profile is cleared** (reinstall, "clear browser data", new PC). The record is gone and the user must type the password once. Acceptable, but we can do better: on every auth state change the extension copies that localStorage record into the ini (`[connection] session=`, see the data model) through `SAMMI.saveIni`, and on start, if localStorage has no record but the ini does, it writes the record back into localStorage *before* initializing Auth. The SDK then resumes as if nothing happened. The record is treated as an opaque string; we never parse it. Test plan item T-A3 verifies the key name and the restore on the SDK version we pin.
2. **The refresh token is revoked** (password changed, user deleted in the console). The SDK raises `auth/user-token-expired` or similar on its next refresh; the extension moves to "Session lost" (`Disconnected` with reason `session`), clears the ini record, keeps the mirror, and shows one alert.

Why not keep a raw refresh token in the ini and skip the SDK record: the SDK cannot be seeded with a refresh token, and the REST token endpoint only yields an ID token usable with the database's REST API, not the SDK's realtime listener. Mirroring the SDK's own record keeps one code path.

## What is on disk

- In the OBS profile: the SDK's user record (refresh token inside). Same exposure as any signed-in web app in the Bridge, including SAMMI's own Twitch and YouTube tokens.
- In `firebase.ini`: a copy of that record, the config block (API key is public by design in Firebase web apps), the email. **No password, ever.** The deck command `Firebase: Connect` has no password box; it resumes from the stored session record, so a deck file cannot hold a secret (SF-ADR-003 §5).

## Security rules

Pasted once at setup step 4. They never need editing:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read":  "auth != null && auth.uid == $uid",
        ".write": "auth != null && auth.uid == $uid"
      }
    }
  }
}
```

Anything outside `users/{own uid}` is unreadable and unwritable, including by other users of the same project. A single project could therefore serve a streamer's whole household or team, each with their own account, with no extra setup.

## Disconnect

`Firebase: Disconnect`, also a button in the tab. Signs out of the SDK, deletes the ini session record, keeps the mirror and config so connecting again is one step. Clearing a project from the tab is not in the first release (D34).
