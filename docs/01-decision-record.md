# Decision record

Name: **SAMMI Firebase** (decided Oct 29, 2026; earlier working title SAMMI Cloud Vars). A SAMMI Bridge extension that gives SAMMI buttons durable, off-machine storage, so a streamer's settings and state survive a reinstall, a dead drive or a move to a new PC, and can be edited from anywhere.

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

**Consequences.** Commands must behave sensibly when the Bridge is closed (see D5). Every extension command in a shipped deck must carry `"async": 0.0` (SAMMI 2025.2.0's Async checkbox, unticked), otherwise SAMMI does not wait for the Save Variable box; found by prototype 2 on Oct 29, 2026. The extension is JavaScript, so the project needs a build step that assembles a `.sef` from source files, plus a way to test in a real OBS dock.

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

**Hardware note, Oct 28 and 29, 2026.** The probe showed that `window.open` and IndexedDB both work inside the OBS dock, and that the Firebase SDK (10.12.0) opens its sign-in popup from `file://` without the documented "operation not supported" error. But with a real project and Google enabled, sign-in fails with `auth/unauthorized-domain`: the SDK's authorized-domain check requires an http or https page before it matches the hostname, so a `file://` page can never pass and no console setting changes that. Google and every other popup or redirect provider are therefore ruled out for the Bridge. **Review closed; Email/Password confirmed.** A future alternative, if the account-creation step proves to be a real obstacle for users, is a small hosted sign-in page (static, on GitHub Pages) that performs Google sign-in in the user's normal browser and shows a one-time code to paste into the extension. That is a separate decision with its own hosting responsibility and is not part of the MVP.

**Decision.**

- Sign in with email and password through a form in the extension's tab in the Bridge.
- Configure the Firebase Auth SDK for localStorage persistence (verified working in the dock, O3), so the SDK resumes the session itself on every Bridge start.
- Back up the SDK's own persisted session record, as an opaque string, into a SAMMI ini file through `SAMMI.saveIni`, and restore it into localStorage before Auth initializes if the OBS profile has lost it. (Revised Oct 29, 2026 from "store the refresh token in the ini": the SDK cannot be seeded with a bare refresh token, and the REST token endpoint only serves the database's REST API, not the realtime listener. Details in [05-auth-flow.md](05-auth-flow.md).)
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

## D7. Naming and surface: the DDD Palette, under the name SAMMI Firebase

**Decided:** Oct 28, 2026. **Revised:** Oct 29, 2026.

**Decision.**

- The extension is called **SAMMI Firebase**. Commands are prefixed `Firebase: `. The provider is still a pluggable module (D2), but the user-facing name says what it is.
- The command surface follows the DDD Palette (Layer 0 notation): commands are imperative and target one aggregate (`Firebase: Create Document`), queries read a projection (`Firebase: Get Document`), domain events are past tense and appear as SAMMI triggers (`Firebase: Document Updated`), and a user's button with such a trigger is a policy. The full model is [10-domain-model.md](10-domain-model.md).
- The data unit is a **document** in a **collection**, with **fields**. Firebase stays schema-less; the user declares a deck's collections locally with `Firebase: Define Collection`, which the extension enforces on that machine.
- Values are strings or numbers. A document is passed to and from SAMMI as JSON text; `Set Field` and `Get Field` cover the one-field case without JSON.

**Why.** Non-technical users think in records (a viewer, a counter, a settings page), not in paths. The palette gives the surface a grammar that stays consistent as commands are added, and it is the house notation. Naming the provider removes a layer of abstraction that was costing clarity without buying anything yet.

**Consequences.** The first version of this record (Oct 28) proposed path keys such as `hue/ip` and provider-neutral names `Cloud: Save` and `Cloud: Load`; both are withdrawn. **Amended Oct 29, 2026 (board review, maintainer ruling):** the read side is not a command. The mirror is projected into SAMMI global variables, `fb_<collection>`, that any button reads directly; the product ships no dedicated read or write buttons; the streamer embeds the write commands in the buttons they already have. Queries remain for filtering, counting and unpacking. **Amended again the same day (maintainer challenge):** people are keyed by the provider's user id, never a name; every write command answers with the resulting document or value so the button that wrote it needs no read; dynamic paths use nested variable resolution (S17) or that answer. The JSON-detection sentence that was dropped and then questioned is moot: JSON is now the explicit document format, never guessed.

---

## D9. First release is the connection only

**Decided:** Oct 29, 2026.

**Decision.** The first release ships: the Bridge tab with config paste, email, password, Connect and Disconnect, and the status line; the Connection, Collection and Document commands, queries and events of [10-domain-model.md](10-domain-model.md); the mirror and its ini fallback; the bundled example deck. It does **not** ship account creation, password reset, or any account management. Creating the Firebase project, enabling Email/Password, creating the user and pasting the security rules are the user's setup, documented with screenshots.

**Why.** MVP. The Bridge is required anyway (D1, S15), so the connection lives there, configured once, and every deck inherits it.

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

## D10. Bridge closed: tell the user, and catch the cloud up afterwards

**Decided:** Oct 29, 2026.

**Context.** Two distinct situations look the same from a button. (a) The Bridge is open but the internet is down: the extension is running. (b) The Bridge is closed (OBS closed, dock removed): the extension is not running at all, verified S15. Only (b) needs anything from the deck.

**Decision.**

1. **Notify.** Whenever a deck falls back to the local copy, the user is told once per session that they are working locally. The bundled deck ships a helper button, `Firebase: Local Notice`, that shows one SAMMI popup ("SAMMI Firebase: Bridge not connected, using the local copy on this PC") and sets a global flag so it does not repeat. The documented fallback is three commands: `If <result> does not exist` → `Trigger Button fbLocalNotice` → `INI: Load Text` → `Parse`. On reconnect the extension shows one alert with what it did ("Back online: 2 local changes pushed, 1 remote change applied").
2. **Catch-up, case (a), internet lost while the Bridge runs.** Already in the design: commands write the mirror and `[pending]`, the extension replays `[pending]` on reconnect under the consistency rules. Nothing for the deck to do.
3. **Catch-up, case (b), Bridge closed.** A deck may write a document locally with `INI: Save Text` to the same section and key it reads from (`collection:<name>`, `<id>`), as valid JSON of the fields. The extension keeps a hash of every document it last wrote in `[index] hashes`. On start, before connecting, it hashes every document in the ini; any document whose hash differs was edited while the extension was away and becomes a pending `replace` stamped with the start time. It is then pushed under the normal rules, and because its timestamp is "now" it wins over remote changes made meanwhile. Invalid JSON is left alone and reported in the tab. Deleting a document while closed is not supported; the README says so.

**Why.** (a) is the common case and costs nothing new. (b) is rare but the question "how does the cloud catch up" must have one answer, and hashing on start gives it without asking the deck to keep timestamps or indexes. Local-while-closed wins because the user was acting on the only copy they could see.

**Consequences.** `[index] hashes` added to the ini layout; consistency rule 7 added to the data model; the bundled deck gains the notice button; test cases T-B3 and T-B4. Writes while closed move from "unsupported" to "supported for update and replace, not delete" in the first release.

---

## D11. Method: the platform methodology, with Sift bypassed

**Decided:** Oct 29, 2026 (maintainer, verbatim: "we have to follow the platform methodology even if we're using tools like OBS + SAMMI … follow the platform (flmnt) workflows. everything is defined there. the only thing we're going to bypass on this project is Sift").

**Decision.** From here the project follows the platform workflows as recorded in the flmnt `platform` workspace: the design is projected onto an NDD board in the platform grammar for the maintainer's review (board: `SAMMI Firebase — NDD`, https://miro.com/app/board/uXjVEUQjpYg=/), then SiDD passes to convergence, then `.moment` files with a 1:1 alignment check against the board, then Feature specs, then build. The Sift reading is skipped. Documents 01–10 are the PRD-equivalent and the extracted DDD inventory; the board is derived from them, and anything added on the board is discovered provenance that flows back into these documents.

**Consequences.** Five hotspots are on the board (the fifth raised by the first ruling: writes by setting a variable, not adopted because the Bridge cannot observe variable changes without polling). Four from conversion await rulings: per-machine versus cloud-stored schema; whether reconcile-on-connect is its own command; local-wins on reopen; and whether the local notice is a deck helper or an extension command. Rulings land here and in the data model in the same pass.

---

## D12. Rulings from the first board review

**Decided:** Oct 29, 2026 (maintainer, on the five hotspots: "1. yes, write to cloud 2. yes, support both paths and give streamers the decision to either reconcile based on triggers or reactive actions within a button 3. agreed 4. not sure how to answer this 5. yes").

1. **Schema in the cloud.** `DefineCollection` writes `users/{uid}/meta/schema/<collection>` as well as the ini; connect merges cloud into local by timestamp, so a second machine inherits the declaration.
2. **Reconcile, both paths.** Connect reconciles and then fires `MirrorReconciled`; a new command `Firebase: Reconcile` does the same on demand, so a streamer can wire it to any trigger as a policy or call it inside a button.
3. **Local wins on reopen.** Confirmed (D10).
4. **Local Notice stays a deck-side helper.** Agent decision, offered for ratification: the notice is needed exactly when the extension is not running, so nothing else can show it; the reconnect alert is the after-the-fact half.
5. **Writes by variable.** Adopted. `fb_<collection>` is two-way for collections declared `two-way` (default on). The extension polls bound variables through the Bridge (default 500 ms, a tab setting), diffs against its last-written snapshot, and issues the corresponding document commands through the normal path; a rejected change reverts and fires `WriteRejected`. Costs: one poll interval of latency, websocket traffic proportional to bound collections (S12, S18), and no result answer for a variable write. Commands remain the precise path and the one that returns the result.

**Consequences.** New commands `Reconcile`; new events `MirrorReconciled`, `WriteRejected`; `DefineCollection` gains `two-way`; cloud schema node; verification S18; tests T-V5 to T-V7, T-R1, T-S1. Prototype 3 covers S16, S17 and S18 before the `.moment` step.

---

## D13. The Moment model, the grammar it uses, and no prototype 3

**Decided:** Oct 29, 2026 (maintainer: "we only need a prototype 3 if there are items left that you feel we need evidence on through discovery before we ratify the plans. otherwise let's move forward with the moment files").

**Decision.** No prototype 3: S16 is verified from SAMMI's own docs and the Spotify extension's use of `setVariable` with objects; S17 is not load-bearing because `Get Object Variable` with a variable key is a documented SAMMI command; S18 is a build-time measurement. The model is written as a Moment project under `model/` in the ADR-038 grammar (the maintainer's ratified palette conformance), validated with the feature-branch CLI: project parse clean, 63 structural tests passing, derive and simulate running. The board ↔ model diff is empty after six grammar-forced commands were added to the board as discovered provenance ([11-moment-alignment.md](11-moment-alignment.md)).

**Consequences.** The next artifact is the Feature specs. Four Moment tooling findings are recorded in the Moment workspace. The SiDD passes the methodology places between board and model were not run as separate documents; the model's validation and the alignment check stand in for pass 1, and no formal pass was called; the ratification of the ADRs and specs on Oct 29, 2026 stands in for it, and the one modelling choice it would have reviewed (refusals surfaced as events) is accepted in SF-ADR-006 §4.

---

## D14. The ADR corpus, and where the System Architecture Reference does not apply

**Decided:** Oct 29, 2026 (maintainer: "don't force what the platform workflow includes if it doesn't fit in this project … follow the procedure where it fits. after the conclusion of the ADRs, let's write a simple PRD").

**Decision.** Sixteen ADRs in `docs/adr/` in the platform's house form (context, decision, rationale, rejected alternatives, consequences, compliance impact, open questions, contract output). SF-ADR-001 to 008 render the rulings D1–D12 and are marked accepted; SF-ADR-009 to 016 are procedural and proposed for ratification. SF-ADR-009 is the deviation record: this product operates no infrastructure, so the reference's cloud, federation, event store, managed auth, environments and canary defaults do not apply, while its ADR standards, contract outputs, generated-tests-never-committed rule and boundary-enforcement locality are kept. The enforceable decisions export JSON Schema in `contracts/` (`firebase-config`, `ini-firebase`, `cloud-tree`, `database.rules`, `command-answer`, `event-envelope`, `collection-variable`, `command-boxes`, `registry-entry`).

**Consequences.** The error reason registry (`command-answer.json`) grew from 13 to 23 codes while the specs were written; it is closed and a contract change from here. The PRD is `docs/00-prd.md`.

---

## D15. Feature toolchain adoption and the shape of the specs

**Decided:** Oct 29, 2026 (maintainer: "make sure the feature files are comprehensive and assertions are thoroughly covered. eventually this repository is going to be open-sourced and it will be heavily scrutinized").

**Decision.** Twenty-three `.feat` specs under `specs/` (connection 4, collection 3, document 9, query 7), 189 scenarios, one per command and query of the Moment model, validated with `feat lint` and `feat audit` at zero errors and compiled by `feat generate` into 23 suites that are gitignored. Harness per SF-ADR-016: the handler response adapter routes every command to `src/features/<feature>/handler.ts`; three local service adapters (`ini`, `firebase`, `sammi`) are the observable surfaces, each scenario predicting all three. Every precondition is a `rejects` line with a `predict rejection` scenario asserting zero effects; the two refusals that have effects (ConnectionFailed, WriteRejected) are `predict error` with their compensating records; the three grammar-forced recording commands are covered as the error branches of the commands that issue them (`RecordConnectionFailure` in Connect, `RecordWriteRejection` in Apply Variable Change) or as their own spec (`RecordSessionLoss`). The coverage matrix is `specs/README.md`.

**Agent decisions inside the specs, for amendment.** (a) `Replace Document`, `Set Field` and `Increment Field` upsert so counters and settings need no startup button; `Update Document` and `Delete Field` require the document. (b) `Set Field` types numeric text as a number with a `str:` escape. (c) `Query Documents` operators `== != > >= < <= contains exists`, numeric when both sides are numbers, missing fields never match, missing order fields sort last. (d) `Get Field` takes a `default`; `Document Exists` and the list/count queries answer false/empty/0 for unknown collections. (e) `Delete Document` of the last document leaves an empty collection variable rather than removing it. (f) Timestamp ties on a remote change keep the local document.

**Consequences.** The build (SF-ADR-014) can start: milestone 1 is the three adapters with their kit conformance suites and the first handler green. `feat run` currently stops at adapter load, the expected state of a spec-complete, code-empty repository.

---

## D16. Pre-build audit: the approved specs are the truth, and the model, docs and board were brought to them

**Decided:** Oct 29, 2026 (maintainer: "run a quick audit and make sure all ADRs + PRD and moment files + feature files are all in sync. update states on all docs as approved where applicable... audit the NDD and verify it's in sync as well").

**Findings and changes.** The approved specs disagreed with the model and docs on four points, all consequences of the six ratified decisions under D15: `Replace Document` upserts (model and docs/10 said it required the document); `Update Document` requires the document (model, docs/10 and the board said upsert); deleting an absent document is refused with `missing` (model DOC-05, docs/10 and the board said no-op); `Document Exists` answers `true`/`false` and `Get Status` answers JSON (docs/10 said `1`/`0` and one line). The model, docs/10, the board's Document frame and invariant list were changed to the specs; the model still parses with 63/63 flow tests. Because `Update Document` no longer creates, the settings example in journey T2, the bundled deck's example button, the test plan and the board's T2 thread now use `Replace Document`, which is the whole-record write a settings button means. The `MirrorReconciled` field is `cause` everywhere (docs/10 still said `trigger`). docs/08 was rewritten to the ratified build (TypeScript, esbuild, `dist/sammi-firebase.sef`, SF-ADR-010/011) and docs/09 Layers 1 and 2 to the ratified harness (SF-ADR-012/016). The error registry lost `session lost` and `write rejected` (event reasons, not box answers) and gained a Connect scenario for `api key invalid`. SF-ADR-016 §4 was corrected: the harness passes no clock; the frozen clock is a service option in `feat.config.json`. The Connect spec's provider-disabled scenario now seeds a declared `AuthProvider` record instead of a magic path.

**Consequences.** Everything carries status approved or accepted; the specs are `agreed`, which is Feature's ratified state before `built`. Build milestone 1 may start.

---

## D17. CI, testing and quality gates taken from the platform corpus, with the non-applicable parts named

**Decided:** Oct 29, 2026 (maintainer: "looking to establish requirements on what success looks like before development starts... apply only what is relevant to this project").

**Decision.** SF-ADR-012 was rewritten against the platform's current rulings (SYSARCH §14, SPEC&TESTING §6/§7/§10/§12, METHODOLOGY §5e/§5g, the generated-files ruling) as an eleven-stage pipeline with every platform stage mapped as kept, replaced or not applicable. SF-ADR-017 (new) holds the threshold constants as a contract (`contracts/quality-gates.json`) and the definitions of done per spec, per milestone and per release. Changes of substance: the coverage floor is the platform's 95%, not 90%, with `src/ext/**` the one named exclusion (host wiring, covered by the PC tier); counts are asserted (generated suites = specs, executed tests = scenarios) so a gate cannot pass on zero work; gitleaks, dependency and SAST scans are merge blockers; `dist/` is no longer committed, the Release carries the CI-built `.sef` (SF-ADR-010 revised); the CI evidence tier is named `ci` because Feature records no bundle for `local` (SF-ADR-015 revised). Not applicable, stated: CDK, Serverless, federation, canaries, Playwright, the eventual tier, `feat verify`.

**Consequences.** Milestone 1 is defined: the workflow with all stages active, three conformant adapters, Connect `verified`, the build check green, a bundle archived. Ratified Oct 29, 2026 with one addition: the Release `.sef` carries a GitHub artifact attestation (SF-ADR-012 §4). The same day every document dropped author attribution and personal names; the project owner is referred to as the maintainer, inferable from the repository's handle and history.

---

## D18. Pre-build sweep of open questions

**Decided:** Oct 29, 2026 ("sweep all documentation for open questions before we start building").

**Findings.** Every ADR's open-questions section, the PRD, the decision record, the verification list, the test plan and the alignment note were read. Six items were checks or backlog, not decisions, and were closed in place: the `:` in ini section names is a milestone-1 check with its fallback named (SF-ADR-004, T-D1); the ini delete helper is a milestone-1 check with its fallback named (T-D2); `feat-adapter-fs` is rejected for the `ini` service because it captures paths only (SF-ADR-016); the `Any Event` trigger, the hosted preset, import and export, a nightly sandbox run and a companion page are recorded as backlog in the PRD; S18 is relabelled deferred-to-build so the verification list's own summary line is true; no separate SiDD pass is called, the ratification stands in for it (D13, docs/11). One item was a decision and was ruled: **`Firebase: Connect` as a deck command is resume-only, with no password box**; the password is typed only in the tab, so no deck file can hold a secret (SF-ADR-003 §5, docs/04, docs/05, `contracts/command-boxes.json`). The Connect handler is unchanged: the tab passes config, email and password to it; the deck command passes nothing and resumes.

**Consequences.** No open question remains in any document. Development starts at milestone 1 (SF-ADR-017 §3).

---

## D19. Repository baseline before the build

**Decided:** Oct 29, 2026 (maintainer agreed to four pre-build fixes; on evidence: "any evidence we ship should be in a different directory that is not ignored").

**Decision.** (1) The planning layer is committed as one baseline so the spec layer has a reference for `feat diff`. (2) The `.sef` assembler is TypeScript (`tools/build/sef.ts`, `pnpm build:sef`), not Python, so the repository has one toolchain and the build tool sits inside the coverage scope; SF-ADR-010, 011, 012, 017, docs/08 and docs/09 updated. (3) `package.json` is ESM (`"type": "module"`, required for natively imported TypeScript handlers), private, version 0.1.0, pnpm-managed (`pnpm-lock.yaml`; the npm lockfile removed; esbuild's install script approved explicitly in `pnpm-workspace.yaml`). (4) `LICENSE` (MIT, copyright the SAMMI Firebase contributors), `CONTRIBUTING.md` (spec-first workflow) and `SECURITY.md` (private reporting) added. (5) Shipped evidence lives in `evidence/`, tracked: `evidence/pc/<version>.md` per release and `evidence/pc/gateway-probe.json`; `discovery/results/` stays local discovery intelligence with no bearing on a release (SF-ADR-012, 015, 017, docs/09, README, `contracts/quality-gates.json`). The spec fixtures' Firebase app id was replaced with an obviously fake one.

---

## D20. Milestone 1 built: all specs green, and what building them found

**Decided:** Oct 29, 2026 ("we're ready to start building out the specs").

**Result.** The 23 handlers, the domain core, the fake world with its three adapters, the Bridge entry point and gateways, the `.sef` build, and the CI and release workflows. Every local gate passes: lint and format, types, the model, `feat lint` and `feat audit`, 200 of 200 generated scenarios with the counts asserted, 83 unit tests, merged coverage of 98.8% of lines and 95.5% of branches, the build check, no high-severity advisory, no secret. The `.sef` assembles at 61 KB.

**Spec amendments, ratified Oct 29, 2026** (listed in `specs/README.md`): document order in Connect follows the database's key order; 65 JSON-text predictions compacted; the four Reconcile givens rebuilt with `later` and `outage` seeds because seeds run before executes; the replayed increment predicts its stamp; ten scenarios added for rules the code needed and no spec stated. None changes a ratified behavior.

**Decisions made while building.** TypeScript 6.0 is pinned because typescript-eslint does not support 7. The Firebase SDK's types are declared locally instead of installing the `firebase` package. That package was a types-only dependency whose Node-side code carried eight high-severity advisories. `@mmmnt/cli` 0.5.0 is removed: it cannot parse the ADR-037 grammar the model uses and carried a vulnerable `lodash-es`. The real ini gateway writes an empty value for a removed key and reads empty as absent, the fallback named for T-D2. The bundled deck ships only buttons built from command types verified on hardware; the full eight-button deck waits for the PC tier to confirm the other command ids. Coverage is measured by merging the spec run and the unit run, with the Feature runtime inlined under Vite so natively imported TypeScript maps to the right lines.

**Moment, resolved the same day.** CI's model stage builds Moment from commit `bebd994` of `mmmnt/mmmnt`, on branch `feat/adr-037-grammar-completeness` (ADR-037 grammar, ADR-038 palette conformance and project mode, ADR-039 sync). The branch had never been pushed; it was pushed on Oct 29, 2026. The `lodash-es` advisory was traced to Moment's pin of `langium` 4.2.1, which pins chevrotain ~11.1.1 and through it `lodash-es` exactly 4.17.23, so no consumer of `@mmmnt/cli` could override it. The fix is mmmnt/mmmnt pull request #180: `langium` 4.4.0 and Node 22, because every Langium release without the pin depends on chevrotain 12 or 13, which require Node 22 (Node 20 has been end-of-life since April 30, 2026). All its checks pass; it awaits review and a branch-protection update from `build (20)` to `build (24)`.

**Next.** Milestone 2 is the PC tier: the gateway probe (T-D2), the on-PC matrix, and the full bundled deck.

---

## Open decisions

None. The spec amendments listed in D20 were ratified on Oct 29, 2026 ("all ratified"). On Oct 29, 2026 the maintainer ratified D17 (SF-ADR-017, the revision of SF-ADR-012, attestations) and earlier in one word ("all agreed on") D12 item 4, SF-ADR-009 to 016, and the six agent decisions under D15; see D16 for what the pre-build audit changed as a result. The items below were closed on Oct 29, 2026:

- Final name and command names: D7.
- Scope of the first release: D9. `Query Documents` and `Increment Field` ship in 1.0.
- Ini layout: as [06-data-model.md](06-data-model.md), one file `firebase.ini`; collection sections frozen.
- Bundled deck: Help, Status, startup button with two `Define Collection` examples, Example: Replace Document, Example: Get Document with fallback, the two example policies, and `Firebase: Local Notice` (D10). Eight buttons.
- Bridge closed behavior: D10.
- Build and test tooling: as [08-distribution-updates.md](08-distribution-updates.md) and [09-test-plan.md](09-test-plan.md), good for now.
