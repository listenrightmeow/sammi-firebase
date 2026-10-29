# Verification list

Every fact the design leans on, where it came from, and whether it has been confirmed on real hardware. Status values:

- **Verified (source)**: read in official documentation or source code. Citation given.
- **Verified (hardware)**: observed on a Windows machine running SAMMI and OBS.
- **Assumed**: consistent with the sources but not yet observed. Has a verification step.
- **Open**: not yet researched.

Last updated: Oct 29, 2026. Hardware results from probe v1 are in `discovery/results/2026-10-28-notes.md`.

## SAMMI and SAMMI Bridge

| # | Fact | Status | Source or verification step |
| --- | --- | --- | --- |
| S1 | An extension is a single `.sef` text file with sections `[extension_name]`, `[extension_info]`, `[extension_version]`, `[insert_external]`, `[insert_command]`, `[insert_hook]`, `[insert_script]`, `[insert_over]`. | Verified (source) | SAMMI docs, "Build Extension"; `bridge/template.sef` in the SAMMI release |
| S2 | Install is SAMMI Core > Bridge > Install an Extension; the Bridge refreshes and gains a tab; the bundled deck is added to SAMMI Core. | Verified (source) | SAMMI docs, "Install Extension" |
| S3 | Extension commands are registered with `SAMMI.extCommand(name, color, height, boxes, triggerButton, hidden, rowUnits, rowHeights)` and listened to with `sammiclient.on(name, payload => ...)`; payload carries `FromButton` and `instanceId`. | Verified (source) | SAMMI-Bridge README, "Extension Command", "Listening to Extension Data" |
| S4 | Box type 37, `box_save_variable`: SAMMI waits for the extension to return a value before continuing; default timeout 30000 ms, configurable with `timeoutAfter`. | Verified (source) | SAMMI-Bridge README, box type table and "Basic Math" example |
| S5 | Synchronous extension commands were added in SAMMI 2025.2.0 (July 2025), along with "async is sync" for all purple commands. Minimum SAMMI version for this project is therefore 2025.2.0. | Verified (source) | SAMMI patch notes, 2025.2.0 |
| S6 | How the extension delivers the value for a type 37 box. Presumed: `SAMMI.setVariable(saveVariableName, value, FromButton, instanceId)`. | Assumed | Not spelled out in the README. Verify with a one-command prototype extension in a real SAMMI. First prototype task. |
| S7 | The Bridge is the local file `SAMMI/bridge/bridge.html`, opened as an OBS Custom Browser Dock or in any browser; it connects to SAMMI Core on `127.0.0.1:9425` over a websocket, optionally with a password. | Verified (source) | SAMMI getting-started guide, steps 5 and 6 |
| S8 | The Bridge loads its libraries from public CDNs (jsdelivr, cdnjs) when it opens, so it needs internet access to start. | Verified (source) | `release/bridge.html` script tags |
| S9 | Extension updates: the Bridge fetches `https://sammi.solutions/SAMMI-Bridge/extensions/extensions.json`, compares `latest_version` with the installed `[extension_version]`, and shows an Update button linking to `download_link`. No automatic install. Listing requires a pull request adding a JSON file under `extensions/` in the SAMMI-Bridge repository. | Verified (source) | `release/bridge.html` update code; `extensions/sample.json`; SAMMI docs "Submitting Extensions" |
| S10 | Bridge helpers `SAMMI.saveIni(file, section, key, value, type)` and `SAMMI.loadIni(file, section, key, type)` make SAMMI Core write and read ini files. The Spotify extension uses them for its client id and refresh token. | Verified (source) | SAMMI-Bridge README; `spotify.sef` |
| S11 | `SAMMI.triggerExt(name, pullData)` fires an extension trigger in SAMMI with arbitrary pull data. | Verified (source) | SAMMI-Bridge README, "Trigger Extension" |
| S12 | `SAMMI.setVariable` messages have a size limit; large payloads must be chunked. | Verified (source) | SAMMI docs, "Build Extension", data size limitation |
| S13 | The `.sef` deck section accepts `"sammi_version"` and `"bridge": true` keys that make SAMMI refuse to install on an old SAMMI or without the Bridge connected. | Verified (source) | SAMMI docs, "Build Extension", `[insert_over]` |
| S14 | A page loaded as an OBS dock can use dynamic `import()` to load ES modules such as the Firebase SDK from gstatic. | Verified (hardware) | Probe v1 in OBS dock, Oct 28, 2026: SDK 10.12.0 loaded. Still to confirm: the same from inside a `.sef` `[insert_script]`, which the Bridge injects as a classic script (prototype 2) |
| S15 | Whether SAMMI Core keeps running extension commands queued while the Bridge is disconnected, or fails them immediately, and what the button sees. | Open | Test with the Bridge closed: a button with a type 37 command, observe timeout behavior and any error |

## OBS browser environment

| # | Fact | Status | Source or verification step |
| --- | --- | --- | --- |
| O1 | OBS browser docks are Chromium Embedded Framework. | Verified (source) | obs-browser README |
| O2 | Chromium disables IndexedDB for pages loaded from file URLs. | **Contradicted (hardware)** | Probe v1, Oct 28, 2026: `indexedDB.open` succeeds on `file://` in Chromium 156 and in the OBS dock (CEF 127). The 2012 Chromium change is no longer in effect. Design does not rely on IndexedDB either way |
| O3 | localStorage works in OBS docks and survives OBS updates. | Verified (hardware, partial) | Read/write confirmed by probe v1 in the OBS dock, Oct 28, 2026. Survival across OBS updates still rests on forum threads 159835, 131768 |
| O4 | All file-URL docks on one machine share a single localStorage namespace, so keys collide across docks. | Verified (source) | OBS forum thread 131768 |
| O5 | `window.open` is unavailable or blocked in the dock. | **Contradicted (hardware)** | Probe v1, Oct 28, 2026: `window.open` returns a window in the OBS dock (obs-browser 2.26.9). Whether Firebase's popup sign-in accepts the `file://` origin is a separate question, F1 |
| O6 | Cross-origin `fetch` from the dock to Google endpoints works. | Verified (hardware) | Probe v1 in OBS dock, Oct 28, 2026: HTTP 400 with a JSON error body from identitytoolkit.googleapis.com |
| O7 | Websocket connections from the dock to `*.firebaseio.com` work. | Verified (hardware) | Probe round trip in the OBS dock, Oct 29, 2026: write acknowledged, read back, listener delivered a console edit |

## Firebase

| # | Fact | Status | Source or verification step |
| --- | --- | --- | --- |
| F1 | Popup and redirect sign-in cannot complete from a `file://` page. | Verified (hardware) | Probe v3 in the OBS dock, Oct 29, 2026, real project with Google enabled: `auth/unauthorized-domain`. The SDK (10.12.0) no longer refuses with `operation-not-supported` as the docs say; instead its authorized-domain check (`_validateOrigin`) requires an http or https protocol before matching the hostname, so a `file://` origin never matches and no console setting can admit it. Same outcome, different error |
| F2 | Email/Password sign-in has no origin restriction and works from a file URL. | Verified (hardware) | Probe round trip in the OBS dock, Oct 29, 2026: signed in against a real project and received a uid |
| F3 | The Auth SDK can be initialized with localStorage or in-memory persistence instead of IndexedDB. | Verified (source) | Firebase JS SDK reference, `initializeAuth`, `browserLocalPersistence`, `inMemoryPersistence` |
| F4 | ID tokens last one hour; the refresh token lasts until revoked and is exchanged at `securetoken.googleapis.com/v1/token`. | Verified (source) | Firebase Auth REST reference |
| F5 | Realtime Database realtime listeners (`onValue`) deliver changes made from any client, including the console, within about a second. | Verified (source) | Firebase Realtime Database documentation |
| F6 | Realtime Database free tier: 1 GB stored, 10 GB per month downloaded, 100 simultaneous connections per project. | Verified (source) | Firebase pricing page |
| F7 | Realtime Database works from inside the OBS dock, including the live listener. | Verified (hardware) | Probe round trip in the OBS dock, Oct 29, 2026: a value edited in the Firebase console arrived through `onValue` in the dock |
| F8 | The Realtime Database web SDK has no disk persistence; its offline queue is in memory. | Verified (source) | Firebase documentation (web SDK offline capabilities) |
| F9 | Security rules can restrict each signed-in user to `users/{uid}` with a four-line rule set that never needs editing. | Verified (source) | Firebase Realtime Database rules documentation |

## Prototype plan

Two small prototypes close every **Assumed** row above. Neither is product code.

1. **OBS dock probe** (`discovery/obs-dock-probe.html`). Load as an OBS Custom Browser Dock on the Windows machine. Covers S14, O5, O6, O7, F1, F2, F7. Record the result table and the round-trip log in `discovery/results/` with the OBS version and the Chromium version the probe reports. **Status:** v1 table run Oct 28, 2026, see results. v2 popup row run Oct 28, 2026; round trip run Oct 29, 2026 and passed (O7, F2, F7 verified); v3 Google sign-in run Oct 29, 2026, `auth/unauthorized-domain` (F1 verified). **Complete.**
2. **One-command extension** (`discovery/cloud-probe-echo.sef`, built by `discovery/build_echo_sef.py`). A `.sef` with a single command that has a text box, a delay box and a type 37 Save Variable box, whose script echoes the text back with `SAMMI.setVariable(saveVar, value, FromButton, instanceId)` and logs the raw payload and SAMMI's reply. Covers S6 and S15, including the timeout case and the Bridge-closed case. **Status:** written Oct 29, 2026, not yet run. Instructions: `discovery/README.md`, Parts 5 to 7.

Both must pass before the architecture document is written, because S6 and F7 decide the shape of Cloud: Load and of the live update path. F7 passed Oct 29, 2026; the live update path is confirmed. S6 (prototype 2) is still open.
