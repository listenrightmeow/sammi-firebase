# SF-ADR-012: CI and testing strategy

| Field | Value |
| --- | --- |
| Status | Accepted (Oct 29, 2026); revised the same day against the platform corpus and ratified with attestations added |
| Date | October 29, 2026 |
| Applies to | the repository's CI, every pull request, every release |
| Decision in flmnt | workspace `firebase`, entries 54a0ecb8 (D13), c0140331 (D16); platform corpus SYSARCH §14 (78f61a63), SPEC&TESTING §6/§7/§10/§12 (a73f2697, 0fe50c31, 2ae65c3e, cb3f90ee), METHODOLOGY §5e/§5g (e69a7df4, fe04d939), maintainer ruling a7846ba6 |
| Contract output | the pipeline below; CI workflow `.github/workflows/ci.yml` (milestone 1 deliverable); thresholds are constants in `contracts/quality-gates.json` (SF-ADR-017) |

## Context

The platform's CI & Testing Strategy is written for products we operate: a pipeline of lint, typecheck, the feat chain, unit tests, coverage, CDK assertion tests, security scans, schema composition, build, then canary deploy and an evidence bundle per environment. Its doctrine was paid for in production and is technology-independent where it concerns the spec pipeline: generated tests are never committed and CI compiles them every run (a7846ba6); a gate that can pass with zero work executed is broken by construction, so gates own file selection, refuse zero inputs and report counts (§5e, §7); never let a pipe eat a gate's exit code; reproduce the literal CI command locally; watch a new CI step's next run to conclusion; raise the tests to the bar, never the bar to the tests; a red check is a blocker.

SAMMI Firebase is a client-side extension (SF-ADR-009): one language, no deployment, no infrastructure. The overlap with the platform is exactly the spec pipeline (Feature toolchain, vitest, TypeScript) and the repository hygiene of a public codebase. This ADR takes the platform's strategy where the technology overlaps and names what is replaced or not applicable, so a reader can see nothing was dropped silently.

## Decision

### 1. The pipeline

Every push and pull request runs these stages in order on GitHub Actions (`ubuntu-latest`, Node 22, pnpm). Each stage runs its command directly, reads its own exit code (`set -o pipefail`, no `| tail`), and fails the run on non-zero. Each gate's threshold is a constant read from `contracts/quality-gates.json` so the workflow and the ADR cannot drift.

| # | Stage | Command | Passes when | Platform mapping |
| --- | --- | --- | --- | --- |
| 1 | Lint and format | `eslint .` · `prettier --check .` | zero findings | kept |
| 2 | Types | `tsc --noEmit` (the strict tsconfig the build uses) | zero errors | kept |
| 3 | Model | `moment parse model/` (`pnpm model`) with `@mmmnt/cli` 0.6.0, the first release carrying ADR-037 and ADR-038, pinned exactly in `package.json` | zero diagnostics | ours: the model is a gate input here |
| 4 | Spec lint and audit | `feat lint` · `feat audit` | zero ERROR; B1 handler present, B2 rejects ↔ rejection, B3 touches present | kept |
| 5 | Generate | `feat generate` | succeeds; output gitignored; **generated-suite count equals spec count** (23) | kept; count check per §5e(1) |
| 6 | Run | `feat run --coverage` | 100% scenarios green, zero unpredicted and zero missing effects on every service; **executed test count equals scenario count** (190, read from `feat lint` output, never hard-coded) | kept; the runner refuses to spawn on zero files |
| 7 | Unit | `vitest run` on `tools/feat-adapters/**` and `src/**` non-generated suites | green; the `@mmmnt/feat-adapter-kit` conformance suite runs for each of the three adapters and the fake-fidelity suite runs against the recorded fixture | kept ("Unit" tier) |
| 8 | Coverage | `tools/build/coverage-gate.ts` merges the stage 6 and 7 reports and scopes them by `contracts/quality-gates.json` | ≥ 95% lines and branches on `src/features/**` and `tools/feat-adapters/**`; a built module with no coverage artifact is a violation; the only exclusion is `src/ext/**` (host wiring exercised on the PC tier), listed by name in the contract | kept at the platform floor; exclusion justified below |
| 9 | Security | `gitleaks detect` · Dependabot alerts via `pnpm audit --audit-level=high` · `semgrep --config auto --severity ERROR` | zero secrets; no HIGH/CRITICAL dependency; no CRITICAL SAST finding | kept; CDK Nag not applicable |
| 10 | Build | `pnpm build:sef --check` (`tools/build/sef.ts`) | `.sef` assembles; bundle passes `node --check`; deck JSON parses; every deck command carries `"async": 0.0`; no `http://`; SDK import URL appears exactly once; `.sef` ≤ 200 KB | ours; replaces CDK/Serverless/Cosmo build |
| 11 | Evidence | `feat report --junit` · `feat report --evidence` | bundle written at `.feature/evidence/ci/<sha>.json` and archived as a CI artifact; a lane that ran and filed nothing is a red gate | kept; environment `ci` so the bundle is recorded (`local` records none) |

Stages 1 to 4 and 10 run in parallel after install; 5 to 8 and 11 run in sequence. The whole chain must pass before merge; there is no manual override.

### 2. The testing pyramid, mapped

| Platform tier | Here | Status |
| --- | --- | --- |
| Generated-behavioral (response status, body, matchers) | the 200 scenarios | kept |
| Generated-structural (per-service record diff: cardinality, ordering, absences) | `ini`, `firebase`, `sammi` predictions in every scenario | kept |
| Generated-eventual (`contains`, convergence-polled) | none: all three services are `acid` or `strong`; no eventual lane | not applicable, stated |
| Integrity (`feat verify`) | removed platform-wide (a73f2697); CI generates every run | not applicable |
| Buildability (`feat audit`) | stage 4 | kept |
| Unit (hand-written vitest on non-generated code) | adapters (conformance + fidelity), build tool, host wiring that is pure (deck generator, `.sef` assembler) | kept |
| Infrastructure (CDK assertion tests) | none | not applicable |
| E2E (Playwright, pre-deploy staging) | replaced by the PC tier: the on-PC matrix and the gateway probe (`docs/09-test-plan.md` Layer 3), recorded in `evidence/pc/<version>.md` | replaced; manual, release-gating |

Test names describe behavior, never method names. A red generated test is a spec violation: fix the code, or halt and revise the spec (SF-ADR-014); never edit a prediction to make a run pass.

### 3. Local reproduction

`pnpm ci:local` runs the literal stage commands with the same flags and toolchain versions CI uses. Before any push: the whole feat plane, not the touched spec; after a `feat.config.json` edit, regenerate and run everything (the inputs-hash of every suite changes). A CI-only coverage failure with a clean local run gets exactly one rerun: a stable named uncovered line is real.

### 4. Release engineering

- Tag only on green: the release workflow runs the full pipeline on the tag and attaches the `.sef` **built by CI** to the GitHub Release. Nothing generated is committed; `dist/` is gitignored (this revises SF-ADR-010 §1, which said `dist/` is committed per release).
- The release workflow signs the `.sef` with a GitHub artifact attestation (`actions/attest-build-provenance`, SLSA build provenance bound to the tag's commit and the workflow). The attestation is published with the Release; anyone can verify the file they downloaded came from this repository's CI with `gh attestation verify sammi-firebase.sef --repo <owner>/sammi-firebase`. The README's install section carries that one line.
- The registry entry's `download_link` points at the Release asset.
- Release gate, manual and recorded: the on-PC matrix passed on the streaming PC recorded in `evidence/pc/<version>.md`; T-I1 passed by someone who did not write the setup guide; the gateway probe fixture (T-D2) matches the fakes.

### 5. Watching new steps

After any change to the workflow, the next run is watched to conclusion before another push stacks on it. Binaries resolve through the dependency graph (`pnpm exec`), never assumed paths.

## Rationale

The platform's spec-pipeline doctrine applies unchanged because the technology is the same: Feature, vitest, TypeScript, GitHub Actions. The 95% floor is the platform's, not the earlier 90%, because lowering a floor for convenience is the thing §5e(4) forbids; the one exclusion is justified by a real alternative lane that exists and gates release. The infrastructure, deployment and federation stages are not applicable because there is nothing to deploy, and saying so in a table is cheaper than letting a reader wonder.

## Rejected alternatives

- **Keeping the 90% floor with an unlisted exclusion.** Rejected: §5e(4), and a public repository will read the exclusion list.
- **Committing `dist/` per release for one-click download.** Rejected: a7846ba6, generated files are never committed; the Release asset gives the same one click.
- **A nightly run against a real sandbox Firebase project.** Rejected for now: secrets in a public repository's CI for little signal beyond the fakes checked against the recorded fixture; the PC tier covers the SDK.
- **E2E in the browser (Playwright against bridge.html).** Rejected: the Bridge needs SAMMI Core on the websocket; no CI runner has it.

## Consequences

Milestone 1 (SF-ADR-009) delivers `.github/workflows/ci.yml` with all eleven stages active and the first spec `verified`. SF-ADR-010 and `docs/08` are revised for the uncommitted `dist/`. SF-ADR-015 gains the `ci` tier. SF-ADR-017 holds the threshold constants as a contract.

## Compliance impact

None beyond repository hygiene; gitleaks protects the Firebase config and the sandbox credentials from ever landing in history.

## Open questions

None. Attestations were ratified on Oct 29, 2026 and are part of §4.
