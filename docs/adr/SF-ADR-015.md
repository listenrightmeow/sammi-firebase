# SF-ADR-015: Environments and evidence

| Field | Value |
| --- | --- |
| Status | Accepted (maintainer, Oct 29, 2026: "all agreed on") |
| Date | October 29, 2026 |
| Applies to | feat.config.json, CI artifacts, `evidence/` |
| Decision in flmnt | workspace `firebase`, entry 54a0ecb8 (D13); platform ADR-0016 (environment resolution) |
| Contract output | the `environment` field of `feat.config.json`; the evidence lane map below |

## Context

Feature stamps the environment a run used into its evidence bundle; configs are per tier, never per environment; `.feature/` is the generated-artifact home. This product has no deployed environments.

## Decision

| Tier | What runs | Evidence |
| --- | --- | --- |
| `ci` | GitHub Actions: the Feature harness with fake gateways (SF-ADR-016), the full pipeline of SF-ADR-012 | `feat report --evidence` bundle at `.feature/evidence/ci/<sha>.json`, archived per run; a run that files nothing is red |
| `local` | A developer's machine: the same commands via `pnpm ci:local` | none recorded (Feature records no evidence for `local`); the developer reads the console |
| `pc` | The streaming PC: SAMMI 2025.2+, OBS with the Bridge, the built `.sef`, a sandbox Firebase project | The on-PC matrix in `docs/09-test-plan.md` recorded per release in `evidence/pc/<version>.md` with versions and dates, and the gateway-probe fixture in `evidence/pc/gateway-probe.json`; tracked and published; no screenshots, no config, no secrets |

1. `feat.config.json` names `"environment": "ci"`; `pnpm ci:local` overrides it to `local` with `FEAT_ENVIRONMENT=local`; there is no `pc` config because the `pc` tier runs no generated tests.
2. Secrets: none in CI. The sandbox Firebase project's config lives only on the streaming PC and in the maintainer's console.
3. Absence versus satisfaction: a scenario that predicts nothing happened asserts `has []` on every service; a missing lane in the evidence is a failure, never a pass.

## Rationale

Three tiers are exactly what exist: what CI records, what a developer runs, and what only the host can show.

## Rejected alternatives

- **A `staging` tier with a nightly sandbox run.** Rejected for now: secrets in a public repository's CI for little signal beyond the local tier; revisit if the pc matrix becomes a bottleneck.

## Consequences

`evidence/` is the published evidence home. `discovery/results/` is discovery intelligence, local and gitignored, and bears on no release; the README's release checklist points at `evidence/pc/` and the CI bundle.

## Compliance impact

None.

## Open questions

None.
