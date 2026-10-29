# Evidence

What this repository ships as proof that a release does what the specs say. Discovery-phase probe results are not here; they are summarised, with their sources, in `docs/02-verification-list.md`.

| Lane | Where | Written by |
| --- | --- | --- |
| `ci` | the Feature evidence bundle `.feature/evidence/ci/<sha>.json`, archived as an artifact of every CI run (SF-ADR-012 stage 11) | `feat report --evidence` |
| `pc` | `pc/<version>.md`: the on-PC matrix of `docs/09-test-plan.md` Layer 3, one file per release, with SAMMI, Bridge, OBS, CEF and Firebase SDK versions and the date | the maintainer, on the streaming PC |
| `pc` | `pc/gateway-probe.json`: the gateway probe's output (T-D2); the fake-world fidelity suite asserts against it | the gateway probe `.sef` |

Rules: no screenshots, no Firebase config, no credentials, no personal data. A release without its `pc/<version>.md` does not ship (SF-ADR-017 §4).
