# Test plan

Three layers. Layers 1 and 2 run on this Mac; layer 3 needs the Windows streaming PC with SAMMI, OBS and a throwaway Firebase project, like the discovery probes did. Every layer 3 case states what to screenshot.

## Layer 1. The Feature harness, Node, no SAMMI (SF-ADR-012, SF-ADR-016)

Every behavior in `specs/` is an executable assertion. `feat lint && feat audit && feat generate && feat run` compiles the 23 specs into suites on every CI run and drives the handler modules in `src/features/` through three local service adapters in `tools/feat-adapters/` (`ini`, `firebase`, `sammi`), all views over one in-process fake world with a frozen clock. Generated suites are never committed.

| Id | Suite | What it proves |
| --- | --- | --- |
| H1 | Adapter conformance: `@mmmnt/feat-adapter-kit` `serviceAdapterContract` for each of the three adapters | capture-window discipline, record shape, reset and seed semantics the runtime relies on |
| H2 | Fake fidelity: unit tests on the fake world, one per documented behavior of the real surface, each citing its verified fact (S10 ini strings one key at a time; RTDB `update` with null removes, `increment` from a missing field starts at 0, `_t` comes from the frozen clock; S16 `setVariable` with an object) and asserting the fixture recorded by T-D2 | the fakes behave like the Bridge and the SDK |
| H3 | The generated suites: 204 scenarios across 23 specs | every command, query, precondition, event and mirror rule |
| H4 | Coverage: vitest with all-files instrumentation on `src/features/**`, `tools/feat-adapters/**`, `tools/build/**`; `src/ext/**` excluded by name (host wiring, Layer 3) | at least 95% lines and branches (SF-ADR-017) |

## Layer 2. Build and static checks, any machine (SF-ADR-011, SF-ADR-012)

| Id | Check |
| --- | --- |
| B1 | `tools/build/sef.ts` bundles `src/ext/main.ts` with esbuild and assembles `dist/sammi-firebase.sef`; the JavaScript passes `node --check`, the deck parses |
| B2 | Every command in the bundled deck has `"async": 0.0` and a Save Variable box named consistently with the command registrations |
| B3 | `.sef` under 200 KB; no `http://` URLs; SDK version string appears exactly once |
| B4 | Every command, query and trigger name in the deck matches `contracts/command-boxes.json` and `contracts/event-envelope.json` exactly (D7) |
| B5 | `moment parse model/` clean; `feat lint` and `feat audit` at zero errors; `tsc --noEmit`, eslint and prettier clean |

## Layer 3. On the streaming PC

Setup: SAMMI 2025.2.0+, OBS with the Bridge dock, a throwaway Firebase project configured per the setup guide (this doubles as the test of the guide itself). Record OBS, SAMMI and Bridge versions.

### Install and setup

| Id | Steps | Pass when | Covers |
| --- | --- | --- | --- |
| T-I1 | Follow the README setup guide literally, timing each step | Under 15 minutes, no step needs outside help | journey 1 |
| T-I2 | Install with the Bridge closed | SAMMI refuses with a clear message | S13 |
| T-I3 | Paste a config missing `databaseURL` | Tab names the missing field | failure 6 |
| T-I4 | Connect from the tab with the user created in the console | Tab shows connected; `Firebase: Connected` trigger fires | journey 1 step 8 |
| T-K1 | Run each bundled-deck button with Run Button; restart SAMMI; attach the two policy triggers and fire them (edit `example/settings` in the console; reconnect) | Help shows its popup; Startup runs on start and defines `example` and `viewers`; Replace and Get answer; with the Bridge closed Get shows the ini copy; the policies alert and unpack `example_*` | bundled deck (D21, D24): If, Popup, INI Load, Trigger Pull Data |

### Commands

| Id | Steps | Pass when | Covers |
| --- | --- | --- | --- |
| T-C1 | `Replace Document` `test`/`a` fields `{"n":1}`, then `Get Document` → alert | Alert shows the JSON; console shows `users/{uid}/collections/test/a` with `n`, `_t`, `_d` | Update, Get, tree shape |
| T-C2 | `Get Field` of an absent document with default `none` | Alert shows `none` | query default |
| T-C3 | `Get Document` 50 times in a Repeat | Completes in under one second total | local-first |
| T-C4 | `Replace Document` with a 9 KB field | Answer `error: too large` | failure 9 |
| T-C5 | `Set Field` on collection `Bad.Name` | Answer `error: bad collection name` | failure 10 |
| T-C6 | `Delete Document`, then `Document Exists` | `false`; node absent in console; a second `Delete Document` answers `error: missing` | Delete, DOC-05 |
| T-C7 | `Get Status` | One line with state, email, project, document count, pending count | Status |
| T-C8 | `Increment Field` twice from two buttons at once | Console shows +2 | atomic increment |
| T-C9 | `Create Document` with blank id, then `List Documents` | New push id listed last | generated ids |
| T-C10 | `Define Collection` strict, then `Set Field` with an unknown field | `error: unknown field` | schema |
| T-C11 | `Query Documents` `points > 50` order by `points` limit 2 | Two documents, sorted | query |
| T-C12 | `Get Document` with Unpack prefix `v` | `v_points` and `v_tier` exist as local variables | unpack |

### Variables

| Id | Steps | Pass when | Covers |
| --- | --- | --- | --- |
| T-V1 | `Replace Document` `test`/`a` `{"n":1}`; a plain button alerts `/$global.fb_test.a.n$/` | Alert shows `1` with no Firebase command in that button | S16, the read side |
| T-V2 | Edit `test/a` in the console | Within 2 s the same button shows the new value | variable kept current on remote change |
| T-V4 | `Increment Field` `viewers`/`/$userId$/` `points` by 10 with Save Variable As `points`; alert `/$points$/`; `Get Field` `viewers`/`/$userId$/` `points` and alert the answer | Both show the new total | the write is the read; D27 |
| T-V5 | Plain button: `Set Variable global.fb_test.a.n = 2` (two-way on) | Within one poll the console shows `n: 2`; `Document Updated` source local fires | H5, rule 8 |
| T-V6 | Plain button sets an unknown field on a strict two-way collection | Variable reverts within one poll; `Write Rejected` fires with `unknown field` | failure 20 |
| T-V7 | Two-way off for `test`; set the variable | Nothing written; variable overwritten by the next rewrite | binding flag |
| T-R1 | Button runs `Firebase: Reconcile` after an offline edit elsewhere | The answer is `ok`; `Mirror Reconciled` fires with the counts in its pull data (`applied` is 1 only if the live listener has not already applied the edit); variable updated | H2 |
| T-S1 | Define Collection on PC A; connect on PC B without running the startup button | PC B's `[schema]` holds the collection with the same `strict` and `two_way` | H1 |
| T-V3 | 500 documents of 100 bytes in one collection | `fb_test` still round-trips; else per-document fallback engaged and documented | S12 |

### Live changes

| Id | Steps | Pass when | Covers |
| --- | --- | --- | --- |
| T-L1 | Button with trigger `Firebase: Document Updated` that alerts id and fields; edit `test/a` in the console | Alert within 2 s with the new fields and `source: remote` | F7, trigger |
| T-L2 | `Update Document` from this PC | One `Document Updated` with `source: local`, none with `source: remote` | own-echo rule |
| T-L3 | Second PC (or a second OBS profile) connected as the same user; update there | Trigger fires here with `source: remote` | journey 3 |
| T-L4 | Two PCs update different fields of one document while both online | Both fields present on both PCs | server-side field merge |

### Persistence and recovery

| Id | Steps | Pass when | Covers |
| --- | --- | --- | --- |
| T-P1 | Close OBS, open it | Tab green without typing anything; document count unchanged; `Firebase: Connected` fires | session resume |
| T-P2 | Close OBS, delete OBS's browser profile data (plugin cache folder), open it | Tab green without typing (restored from ini record) | 05-auth-flow risk 1, T-A3 |
| T-A3 | Inspect localStorage key name on the pinned SDK version | Matches the pattern the restore code expects | 05-auth-flow |
| T-P3 | Change the password in the console; restart OBS | Tab: "Connect needed"; one alert; `Disconnected` reason `session`; queries still answer | failure 5 |
| T-P4 | Uninstall extension, delete deck, reinstall, connect | All documents back; count matches | journey 3 |
| T-D2 | Gateway probe `.sef` (`pnpm build:probe`; steps and run guide in `tools/probe/README.md`): ini write, load and **delete** of a key in section `collection:test`; `setVariable` with an object then `getVariable`; `triggerExt` | Every step prints pass; the delete leaves no key (or the fallback the probe reports is adopted by the `ini` gateway); output saved as the fidelity fixture `evidence/pc/gateway-probe.json` | the fakes' assumptions |
| T-D1 | `INI: Load Text` file `firebase.ini`, section `collection:test`, key `a` from a plain button | Returns the document JSON (confirms `:` in section names; otherwise the section becomes `collection_<name>`, SF-ADR-004) | SF-ADR-004 |

### Offline and Bridge-closed

| Id | Steps | Pass when | Covers |
| --- | --- | --- | --- |
| T-O1 | Disable the PC's network; `Set Field` `test`/`b` `n`=`2`; `Get Field` | command answers `2` at once; query answers `2`; tab shows 1 pending | failure 3 |
| T-O2 | Re-enable network | Pending goes to 0; console shows `test/b` | replay |
| T-O3 | Offline here, `Replace Document` `test/b`; meanwhile edit `test/b` in the console (newer); reconnect | Local takes the console's version; `Document Updated` fires with `source: remote` | rule 4 |
| T-B1 | Close OBS; run the bundled fallback example button twice | Both runs: the alert with the mirror document via INI: Load Text, and SAMMI's "Bridge disconnected" message | S15, failure 1, D10, D24 |
| T-B2 | Reopen OBS | Tab green; no duplicate triggers | reconnect |
| T-B3 | Close OBS; `INI: Save Text` a changed document to `collection:test`, key `a`; meanwhile edit the same document in the console; reopen OBS | Alert "1 local change pushed"; console shows the local version; `Document Updated` with `source: local` | D10, rule 7 |
| T-B4 | Close OBS; write invalid JSON to a document key; reopen OBS | Tab reports the key; cloud untouched; the document keeps its last good value in memory | rule 7 |
| T-B5 | Bridge open, pull the network cable, `Update Document` on `test/a`, plug it back | Pending 1 then 0; console shows the update; no disconnect message (the Bridge was never closed) | case (a) of D10 |

### Update

| Id | Steps | Pass when | Covers |
| --- | --- | --- | --- |
| T-U1 | Install version N, write documents, install version N+1 over it | Documents, schema, config and session intact; tab shows N+1 | D8 |

## Exit criteria for the first release

All layer 1 and 2 checks pass on every commit. Every layer 3 case passed once on the streaming PC recorded in `evidence/pc/<version>.md`. T-I1 passed by someone who did not write the guide.
