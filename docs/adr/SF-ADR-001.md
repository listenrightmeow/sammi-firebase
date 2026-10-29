# SF-ADR-001: Ship as a SAMMI Bridge extension; the Bridge is required

| Field | Value |
| --- | --- |
| Status | Accepted (maintainer rulings of Oct 28–29, 2026; corpus ratified Oct 29, 2026) |
| Date | October 29, 2026 |
| Applies to | the whole product |
| Decision in flmnt | workspace `firebase`, entry 1a431d94 (D1), 605960f9 (D12) |
| Contract output | none (advisory); the surface it enables is shaped by SF-ADR-005 |

## Context

Two ways exist to add cloud storage to SAMMI without changing SAMMI itself: a deck of helper buttons that other buttons call through Trigger Button and Wait Until Variable Exists, using SAMMI's own HTTP Request command; or a Bridge extension, a `.sef` file whose JavaScript runs inside SAMMI Bridge and registers commands that appear in SAMMI's command list. The Bridge is the local page `SAMMI/bridge/bridge.html` loaded as an OBS browser dock, connected to SAMMI Core over a websocket on port 9425 (verified S7).

Prototype 2 (Cloud Probe, Oct 29, 2026) settled how a Bridge extension answers a button: with the command's Async box unticked, SAMMI pauses the button until the extension sends `SetVariable` for the Save Variable box, for persistent and non-persistent buttons alike; on timeout the button continues with the variable absent; with the Bridge closed the button continues at once and SAMMI prints "Bridge disconnected" (S6, S15).

## Decision

1. SAMMI Firebase is a SAMMI Bridge extension, distributed as one `.sef` file, installed through SAMMI Core → Bridge → Install an Extension.
2. The Bridge must be open for commands and queries to answer. The product does not attempt to work without it; it fails fast and visibly (SF-ADR-004 covers what a deck does meanwhile).
3. Every command in a shipped deck carries `"async": 0.0`; the documentation tells anyone adding a command by hand to leave the Async box unticked.

## Rationale

The target user is non-technical. A command with a labeled box needs no explanation; a calling convention between buttons does. Live updates from the cloud, the feature that makes the cloud worth having, are only possible from a page that keeps a connection open. The Bridge is step 5 of SAMMI's own getting-started guide, so every user with alerts already runs it.

## Rejected alternatives

- **A button library.** Rejected: a three-command calling convention per read, no live updates without polling from SAMMI, and auth and token refresh rebuilt from SAMMI boxes, visible to the user.
- **A standalone local server the Bridge talks to.** Rejected: a second process to install and keep running, for no capability the Bridge page lacks.
- **Working without the Bridge through SAMMI's HTTP Request command as a fallback write path.** Rejected for release 1: it would duplicate the write path and its invariants in SAMMI boxes.

## Consequences

The extension is JavaScript (TypeScript source, SF-ADR-011) running in OBS's Chromium from a `file://` origin, which rules out popup sign-in (SF-ADR-003) and shapes the test harness (SF-ADR-016). The minimum SAMMI version is 2025.2.0, enforced by `sammi_version` in the `.sef`, and `"bridge": true` makes SAMMI refuse to install without the Bridge connected (S13).

## Compliance impact

None. No data leaves the user's machine except to the Firebase project they own.

## Open questions

None.
