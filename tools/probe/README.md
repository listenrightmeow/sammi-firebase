# Gateway probe (T-D2)

A throwaway SAMMI extension that checks the Bridge helpers the real gateways rely on (`src/ext/gateways.ts`) and records what they return. The fake world's fidelity suite (`tools/feat-adapters/world.test.ts`) asserts against the recording, so the fakes cannot quietly drift from SAMMI.

It writes only to `firebase-probe.ini` and the global variable `fb_probe`. It does not touch `firebase.ini`, Firebase or the network.

## Run it on the streaming PC (5 minutes)

1. Build it: `pnpm build:probe` writes `dist/gateway-probe.sef`.
2. In SAMMI, use **Bridge** → **Install an Extension** and pick `dist/gateway-probe.sef` (the Bridge must be open in OBS). Open the Bridge and its **Gateway Probe** tab.
3. Press **Run**. The status line names any step that differs from the fakes.
4. In SAMMI, check that the extension trigger **Gateway Probe: Ping** fired with pull data `n` = 7 (for example in SAMMI's log), then tick the box in the tab.
5. Press **Copy result** and save the clipboard as `evidence/pc/gateway-probe.json`.
6. Run `pnpm test:unit`. The `gateway probe fixture (T-D2)` cases now run against your recording.
7. **Bridge** → **Uninstall an Extension** → Gateway Probe, delete its empty deck, and delete `firebase-probe.ini` from SAMMI's folder if you like.

## What each step settles

| Step | Settles |
| --- | --- |
| `ini-read-shape` | `loadIni` replies with the value under `.Value`, as `replyValue` assumes |
| `ini-number-text` | text that looks like a number reads back as text |
| `ini-json-value` | a one-line JSON document with `= ; # [ ]`, quotes, backslash and non-ASCII survives |
| `ini-colon-section` | T-D1: `:` in a section name works (else sections become `collection_<name>`, SF-ADR-004) |
| `ini-slash-key` | `/` in a `[pending]` key works (docs/06) |
| `ini-absent-key` | a never-written key reads as absent |
| `ini-delete-fallback` | saving `""` over a key makes it read as absent, the gateway's delete (the Bridge has no delete helper; `bridgeHelpers` in the report lists what it does have) |
| `variable-object` | S16: an object set with `setVariable` comes back from `getVariable` intact |
| `variable-absent` | an unknown global reads as absent |
| `trigger` | S11: `triggerExt` resolves; the tick box records that SAMMI showed it |

A failed step is a finding, not a broken probe: amend the gateway and the fake together (the step's `replies` show what SAMMI actually returned), then re-run.
