# Verification list

Every fact the design leans on, where it came from, and whether it has been confirmed on real hardware. Status values:

- **Verified (source)**: read in official documentation or source code. Citation given.
- **Verified (hardware)**: observed on a Windows machine running SAMMI and OBS.
- **Assumed**: consistent with the sources but not yet observed. Has a verification step.
- **Open**: not yet researched.

Last updated: Oct 28, 2026.

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
| S14 | Extension JavaScript in `[insert_script]` can use dynamic `import()` to load ES modules such as the Firebase SDK from gstatic. | Assumed | Probe page uses dynamic import; confirm it runs inside the OBS dock (probe row "Firebase JS SDK loads") |
| S15 | Whether SAMMI Core keeps running extension commands queued while the Bridge is disconnected, or fails them immediately, and what the button sees. | Open | Test with the Bridge closed: a button with a type 37 command, observe timeout behavior and any error |

## OBS browser environment

| # | Fact | Status | Source or verification step |
| --- | --- | --- | --- |
| O1 | OBS browser docks are Chromium Embedded Framework. | Verified (source) | obs-browser README |
| O2 | Chromium disables IndexedDB for pages loaded from file URLs. | Verified (source) | Chromium code review 11052023; community reports |
| O3 | localStorage works in OBS docks and survives OBS updates. | Verified (source) | OBS forum threads 159835, 131768 |
| O4 | All file-URL docks on one machine share a single localStorage namespace, so keys collide across docks. | Verified (source) | OBS forum thread 131768 |
| O5 | `window.open` is unavailable or blocked in the dock. | Assumed | Probe row "window.open" |
| O6 | Cross-origin `fetch` from the dock to Google endpoints works. | Assumed | Probe row "CORS fetch to Firebase Auth REST" |
| O7 | Websocket connections from the dock to `*.firebaseio.com` work. | Assumed | Probe round trip, step 3 to 5 |

## Firebase

| # | Fact | Status | Source or verification step |
| --- | --- | --- | --- |
| F1 | Popup and redirect sign-in require an http, https or chrome-extension origin and web storage; otherwise `auth/operation-not-supported-in-this-environment`. | Verified (source) | Firebase Auth error reference; firebase-js-sdk issue 558 |
| F2 | Email/Password sign-in has no origin restriction and works from a file URL. | Assumed | Probe rows "Email/password sign-in call reaches the server" and round trip step 2 |
| F3 | The Auth SDK can be initialized with localStorage or in-memory persistence instead of IndexedDB. | Verified (source) | Firebase JS SDK reference, `initializeAuth`, `browserLocalPersistence`, `inMemoryPersistence` |
| F4 | ID tokens last one hour; the refresh token lasts until revoked and is exchanged at `securetoken.googleapis.com/v1/token`. | Verified (source) | Firebase Auth REST reference |
| F5 | Realtime Database realtime listeners (`onValue`) deliver changes made from any client, including the console, within about a second. | Verified (source) | Firebase Realtime Database documentation |
| F6 | Realtime Database free tier: 1 GB stored, 10 GB per month downloaded, 100 simultaneous connections per project. | Verified (source) | Firebase pricing page |
| F7 | Realtime Database works from inside the OBS dock, including the live listener. | Assumed | Probe round trip; edit the value in the console and watch the listener line repeat |
| F8 | The Realtime Database web SDK has no disk persistence; its offline queue is in memory. | Verified (source) | Firebase documentation (web SDK offline capabilities) |
| F9 | Security rules can restrict each signed-in user to `users/{uid}` with a four-line rule set that never needs editing. | Verified (source) | Firebase Realtime Database rules documentation |

## Prototype plan

Two small prototypes close every **Assumed** row above. Neither is product code.

1. **OBS dock probe** (`discovery/obs-dock-probe.html`). Load as an OBS Custom Browser Dock on the Windows machine. Covers S14, O5, O6, O7, F2, F7. Record the result table and the round-trip log in `discovery/results/` with the OBS version and the Chromium version the probe reports.
2. **One-command extension.** A `.sef` with a single command that has a text box and a type 37 Save Variable box, whose script echoes the text back. Covers S6 and S15. Also records what the button sees when the Bridge is closed.

Both must pass before the architecture document is written, because S6 and F7 decide the shape of Cloud: Load and of the live update path.
