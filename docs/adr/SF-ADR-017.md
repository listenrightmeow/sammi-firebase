# SF-ADR-017: Quality gates and enforcement (threshold constants and definitions of done)

| Field | Value |
| --- | --- |
| Status | Accepted (Oct 29, 2026) |
| Date | October 29, 2026 |
| Applies to | every pull request, milestone and release; the CI workflow reads this ADR's contract |
| Decision in flmnt | workspace `firebase`; platform corpus METHODOLOGY §5g (fe04d939), §5e (e69a7df4), SPEC&TESTING §8 (3624953b), §12 (cb3f90ee), SYSARCH §17 (f5c4a80c) |
| Contract output | `contracts/quality-gates.json` |

## Context

The platform requires two procedural ADRs before execution can produce buildable specs: CI & Testing Strategy (the gate configuration, SF-ADR-012) and Quality Gates & Enforcement (the threshold constants). The maintainer asked, before development starts, for a statement of what success looks like. The platform defines it at three grains: the spec (lifecycle `draft → agreed → built → verified`, flipped by tooling), the milestone (machine-verifiable gates), and the release (evidence filed). This ADR fixes the numbers and the definitions for this project; SF-ADR-012 fixes the pipeline that enforces them.

## Decision

### 1. Threshold constants

The constants live in `contracts/quality-gates.json` and are read by the CI workflow and by `pnpm ci:local`, so the number in the ADR, the contract and the pipeline is one number.

| Constant | Value | Enforcer |
| --- | --- | --- |
| `specs.lintErrors` | 0 | `feat lint` |
| `specs.auditErrors` | 0 | `feat audit` |
| `specs.generatedSuiteCount` | equals the number of `.feat` files (23 today) | CI count check after `feat generate` |
| `run.scenarioPassRate` | 100% | `feat run` |
| `run.unpredictedEffects` / `run.missingEffects` | 0 / 0 | `feat run` |
| `run.executedTestCount` | equals the scenario count reported by `feat lint` (190 today) | CI count check; refuse on zero |
| `coverage.lines` / `coverage.branches` | 95 / 95 | vitest coverage, all-files instrumentation |
| `coverage.scope` | `src/features/**`, `tools/feat-adapters/**`, `tools/build/**` | coverage config |
| `coverage.excluded` | `src/ext/**` (host wiring: real gateways, tab DOM, poller and listener loops), justified by the PC tier | coverage config; any addition is an ADR amendment |
| `unit.adapterConformance` | 3 of 3 adapters pass the kit suite | vitest |
| `security.secrets` | 0 | gitleaks |
| `security.dependencies` | no HIGH or CRITICAL | `pnpm audit` |
| `security.sast` | no CRITICAL | semgrep |
| `build.sefMaxBytes` | 204800 | `pnpm build:sef --check` |
| `build.asyncFlag` | every deck command `"async": 0.0` | `pnpm build:sef --check` |
| `build.httpUrls` | 0 | `pnpm build:sef --check` |
| `model.parseDiagnostics` | 0 | `moment parse` |
| `evidence.bundlePerRun` | 1 at `.feature/evidence/ci/<sha>.json` | `feat report --evidence`; missing bundle is red |

### 2. Definition of done, per spec (the agent contract)

A spec is **agreed** when the maintainer has ratified its predictions (all 23 are). It is **built** when its generated suite is green in CI with zero unpredicted and zero missing effects and the handler lives inside its `touches`; tooling flips the status, never a hand. It is **verified** when, in addition, the coverage floor holds for its handler module and the evidence bundle of that run is archived. Every shipped feature's spec ends at `verified`. The agent builds only `agreed` specs and may propose `draft → agreed`; the maintainer may revert.

### 3. Definition of done, per milestone

| Gate | Machine check |
| --- | --- |
| Spec Audit | all specs `agreed`; `feat lint` and `feat audit` zero ERROR; predictions reviewed by the maintainer (done Oct 29, 2026) |
| Delivery | `feat run` green; coverage at the floor; lifecycle rows flipped by tooling |
| Integration | zero unpredicted and zero missing effects across all specs at PR stage |
| Evidence | every CI run filed a bundle; a lane that ran and filed nothing is red |
| Deployment | not applicable (SF-ADR-009); replaced by the Release gate below |

**Milestone 1 (foundation) is done when:** CI executes the full eleven-stage pipeline with a non-zero expected count of generated tests; the three adapters pass the kit's conformance suite and the fake-fidelity suite; the Connect spec (SPEC-CON-001) is `verified`; `pnpm build:sef --check` passes on the bundled skeleton; the evidence bundle for the run is archived. Nothing domain-specific beyond Connect is required of milestone 1.

### 4. Definition of done, per release

All CI gates green on the tag; every spec `verified`; the on-PC matrix in `docs/09-test-plan.md` passed recorded in `evidence/pc/<version>.md`; T-I1 passed by someone who did not write the setup guide; the gateway-probe fixture matches the fakes (T-D2); the `.sef` attached to the Release is the one CI built and carries its artifact attestation; the registry entry validates against `contracts/registry-entry.json`.

### 5. Enforcement rules (from the delivery doctrine, kept verbatim in intent)

1. A gate that can pass with zero work executed is broken: gates own file selection, refuse zero inputs, and the pipeline asserts counts.
2. No pipe eats a gate's exit code.
3. Reproduce the literal CI command locally before pushing.
4. Raise the tests to the bar, never the bar to the tests: a coverage failure is fixed with tests, not thresholds or excludes; any change to a constant in this ADR is an amendment with a rejected alternative.
5. A red check is a blocker. "Flaky, safe to push" is not a call the agent makes.
6. After adding a CI step, watch its next run to conclusion.
7. When the compiler refuses a prediction, fix the code, never the prediction.

## Rationale

The maintainer asked what success looks like before development; the platform already defines it at the three grains that matter, and only the deployment gate has no meaning here. Writing the numbers as a contract makes them enforceable rather than advisory (SYSARCH §17), which is the difference a scrutinising reader will look for.

## Rejected alternatives

- **Thresholds in the workflow file only.** Rejected: the ADR and the pipeline would drift; the contract is the single source.
- **A lower floor for an "atypical" project.** Rejected: the atypical parts (host wiring) are excluded by name and covered by a real lane; the typical parts are TypeScript under vitest and get the platform floor.
- **Treating the PC matrix as optional.** Rejected: it is the only lane that exercises the Bridge, SAMMI and the SDK; a release without it would ship the one layer nothing else tests.

## Consequences

`contracts/quality-gates.json` is written with this ADR. Milestone 1's first task is the workflow that reads it. `pnpm ci:local` mirrors it.

## Compliance impact

None.

## Open questions

None.
