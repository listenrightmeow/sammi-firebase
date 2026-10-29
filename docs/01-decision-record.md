# Decision record

Working title: **SAMMI Cloud Vars** (name not final). A SAMMI Bridge extension that gives SAMMI buttons durable, off-machine storage, so a streamer's settings and state survive a reinstall, a dead drive or a move to a new PC, and can be edited from anywhere.

Status: planning. Nothing is built. Each decision below records the options considered, what was chosen, why, and what it costs. Decisions marked **open** still need an answer before design is final.

Dates are when the decision was made. Facts cited here are tracked, with sources and verification status, in [02-verification-list.md](02-verification-list.md).

---

## D1. Ship as a SAMMI Bridge extension, not a library of buttons

**Decided:** Oct 28, 2026.

**Context.** Two ways exist to add cloud storage to SAMMI without changing SAMMI itself. A deck of "library" buttons that other buttons call through Trigger Button and Wait Until Variable Exists, using SAMMI's own HTTP Request command. Or a Bridge extension: a `.sef` file whose JavaScript runs inside SAMMI Bridge and registers new commands that appear in SAMMI's command list.

**Options.**

| | Button library | Bridge extension |
| --- | --- | --- |
| What the user sees | A deck of helper buttons to copy into every project; a three-command calling convention | New commands with labeled boxes, like any built-in command |
| Returning a value | Caller waits on a variable | Save Variable box (type 37); SAMMI pauses the button until the value arrives |
| Live updates from the cloud | Impossible without polling | Realtime listener fires a SAMMI trigger |
| Auth and token refresh | Rebuilt from SAMMI boxes, visible to the user | Handled in JavaScript, hidden |
| Runtime dependency | SAMMI Core only | SAMMI Bridge must be open (OBS dock or browser tab) |
| Install | Paste Deck | Bridge > Install an Extension, SAMMI's standard flow |
| Updates | Re-paste a deck | Bridge shows an Update button from SAMMI's extension registry |

**Decision.** Bridge extension.

**Why.** The target user is non-technical. A command with a box labeled "Key" and a box labeled "Save Variable As" needs no explanation. A calling convention does. Live updates are the feature that makes the cloud worth having, and only the extension can deliver them. The Bridge dependency is acceptable because the Bridge is step 5 of SAMMI's own getting-started guide and every user with alerts already runs it.

**Consequences.** Commands must behave sensibly when the Bridge is closed (see D5). The extension is JavaScript, so the project needs a build step that assembles a `.sef` from source files, plus a way to test in a real OBS dock.

---

## D2. Users own their data: bring-your-own Firebase project

**Decided:** Oct 28, 2026.

**Context.** Resilient data off the host machine means an account somewhere. The question is whose.

**Options.**

1. **A shared project we operate.** Zero setup for the user. We carry cost, abuse, quota (the free plan allows 100 simultaneous Realtime Database connections per project, which is a hard ceiling for a shared instance), and a support burden.
2. **The user's own Firebase project.** The user creates a project in the Firebase console, enables Email/Password sign-in, creates a Realtime Database, pastes our security rules, and pastes the project's config into the extension. One-time, roughly five minutes with screenshots. Data lives in the user's own Google account.
3. **A store the user already has**, such as Google Drive through their Google account. Needs an OAuth client we register and get verified, which makes us a service operator again.

**Decision.** Option 2 for the MVP. The provider configuration must be a pluggable setting from day one, so option 1 can be offered later as a preset without changing decks or commands.

**Why.** MVP mindset. Users control their own data, and we take on no operational responsibility. If storage is ever commercialized, that is a new preset, not a rewrite.

**Consequences.** The Firebase console walkthrough is the floor of setup complexity and must be documented step by step with screenshots. The extension must validate a pasted config and tell the user exactly which console step they missed. Security rules are part of what we ship and the user pastes them, so they must be short and never need editing.

---

## D3. Backend: Firebase Realtime Database, not Firestore

**Decided:** Oct 28, 2026.

**Context.** Firebase offers two databases. Firestore is a document store: collections of documents with typed fields. Realtime Database is one JSON tree addressed by path.

**Decision.** Realtime Database.

**Why.**

- SAMMI data is strings in boxes under names. A JSON tree keyed by path, such as `users/{uid}/hue/ip`, is a direct fit. Firestore's typed field envelopes add ceremony with no benefit here.
- Realtime listeners are the database's native feature and are exactly the "cloud edit notifies the Bridge" behavior wanted.
- The REST API is a plain GET and PUT of JSON, which keeps a non-Bridge fallback possible later.
- Free tier is ample for this use: 1 GB stored, 10 GB per month downloaded.

**Consequences.** No queries beyond path reads. A deck owns a prefix and that is its "schema" (see D7). Firestore remains an option if a future feature needs queries; the provider abstraction in D2 keeps that door open.

---

## D4. Authentication: Email/Password, with the refresh token kept by SAMMI

**Decided:** Oct 28, 2026.

**Context.** SAMMI Bridge runs from a file URL inside OBS's embedded Chromium. Firebase's documentation says popup and redirect sign-in flows (Google and other identity providers) require an http, https or chrome-extension origin and fail with "operation not supported in this environment" otherwise. SAMMI cannot sign RSA JWTs, so service accounts are out.

**Hardware note, Oct 28, 2026.** The probe showed that `window.open` and IndexedDB both work inside the OBS dock, contrary to the research. Probe v2 then showed the Firebase SDK (10.12.0) opens its sign-in popup from the `file://` dock without the documented "operation not supported" refusal. What remains untested is whether a real project completes the sign-in, since Firebase also checks the page's origin against the project's authorized domains and a `file://` page has no hostname. **This decision is under review** until probe v3's Google sign-in button answers it: if Google sign-in completes from the dock, it should become the primary sign-in because it removes the "create an email/password account" step for the user, with Email/Password kept as the fallback.

**Decision.**

- Sign in with email and password through a form in the extension's tab in the Bridge.
- Configure the Firebase Auth SDK for localStorage persistence or in-memory persistence, so the extension does not depend on IndexedDB behavior that varies across Chromium builds.
- Store the refresh token, and nothing else secret, in a SAMMI ini file through the Bridge's `SAMMI.saveIni` helper, the same way the Spotify extension stores its refresh token. On Bridge start, exchange it for a fresh ID token.
- Security rules grant each uid access to its own subtree only.

**Why.** It is the flow the documentation guarantees to work in the environment, and it needs no browser storage to survive restarts. One secret remains on the machine, the refresh token, which is unavoidable and is the same exposure every other SAMMI integration has.

**Consequences.** Users create an email and password account for this purpose. Password reset goes through Firebase's email flow, which the console enables by default. The extension must show sign-in state clearly and recover from a revoked token by asking for the password again.

---

## D5. Local-first with write-through; cloud changes update the local copy

**Decided:** Oct 28, 2026.

**Context.** Buttons run during a live stream. They cannot wait on the network, and they must keep working when the Bridge is closed or the internet is down.

**Decision.**

- Every value has a local mirror. Reads come from the mirror. Writes go to the mirror first, then to the cloud.
- The extension keeps a realtime listener on the user's subtree. When a value changes in the cloud, the extension updates the mirror and fires a SAMMI trigger so buttons can react.
- On Bridge start, the extension reconciles: cloud wins for values that changed remotely, pending local writes are pushed.
- Conflict rule for the MVP: last write wins, by server timestamp. Values are small settings, not counters, so this is acceptable and must be stated.

**Why.** Matches the way the data is used. A light setting read a thousand times and written once should never cost a network round trip on read.

**Consequences.** The mirror is the source of truth for buttons; the cloud is the source of truth for durability. The design must make "mirror is stale" visible in the extension's tab, and the test plan must cover offline writes that sync later.

---

## D6. The local mirror is a SAMMI ini file, not browser storage

**Decided:** Oct 28, 2026.

**Context.** The Bridge has `SAMMI.saveIni` and `SAMMI.loadIni` helpers that make SAMMI Core write and read ini files in the SAMMI folder. Existing extensions use them for their settings. Browser storage inside OBS docks works (localStorage and, per the Oct 28, 2026 probe, IndexedDB too) but is shared across every dock on the machine because of the file URL, lives inside OBS's profile rather than SAMMI's folder, and is invisible to SAMMI's own commands.

**Decision.** The mirror and the extension's own settings live in SAMMI ini files written through the Bridge helpers. Browser storage is not used for anything that must survive.

**Why.** It is the ecosystem-native store, it survives OBS reinstalls and dock changes, it is visible and backupable as a plain file, and SAMMI's built-in INI commands can read it, which gives decks a zero-dependency fallback when the Bridge is closed.

**Consequences.** Ini is flat: section, key, value. Nested cloud paths flatten to a section per prefix and a key per leaf. Values are strings; the extension stores JSON for anything structured.

---

## D7. Provider-neutral commands, namespaces instead of schemas

**Decided:** Oct 28, 2026.

**Decision.**

- Command names never mention Firebase. Working names: **Cloud: Save**, **Cloud: Load**, **Cloud: Delete**, **Cloud: List**, and a trigger **Cloud: Value Changed**.
- A key is a path with slashes, for example `hue/ip`. A deck owns a prefix. The documentation for a deck lists its keys; that is its schema. The extension does not enforce schemas.
- Values are strings on the SAMMI side. The extension stores JSON when a value parses as JSON, so objects round-trip.

**Why.** Users think in folders, not schemas. Provider-neutral names keep D2's pluggability real. Decks written against these commands never change when the backend does.

**Consequences.** Final command names are **open** until the user journey document is written, because the names appear in SAMMI's command search and should sort together.

---

## D8. Versioning and updates

**Decided:** Oct 28, 2026.

**Context.** SAMMI Bridge checks an extension registry hosted by SAMMI, compares versions, and shows an Update button that opens a download link. Nothing installs automatically; the user installs the new `.sef` the same way as the first time. Getting listed is a pull request adding a JSON file to the SAMMI-Bridge repository.

**Decision.**

- Semantic versions in `[extension_version]`.
- Every release must read data written by every earlier release. Data format changes are additive.
- The bundled deck stays minimal, because installs re-add it.
- We register in SAMMI's extension registry once the first release is stable.

---

## Open decisions

- **Sign-in method** (D4). Email/Password stands unless probe v3 shows Google sign-in completes from the dock with a real project.
- **Final name and command names** (D7). Needed before the user journey document.
- **Scope of the first release.** Proposal: Save, Load, Delete, Value Changed trigger, sign-in panel, status display. List, export and import in a later release.
- **Ini layout** for the mirror: one file per deck prefix, or one file for everything. Decide in the data model document.
- **What the deck bundled in the `.sef` contains.** Proposal: a single help button and a "Cloud: Status" button, nothing more.
- **Bridge closed behavior.** Proposal: commands return the mirror value through SAMMI's own INI: Load Text as a documented fallback, and the extension warns in its tab when it reconnects. Needs the data model to settle the ini layout first.
- **Build and test tooling.** How a `.sef` is assembled from source, and how it is tested in a real OBS dock without hand-editing bridge.html. Decide in the distribution document.
