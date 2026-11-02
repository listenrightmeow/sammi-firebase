# Contributing

SAMMI Firebase is built spec-first. Behavior is defined in `specs/` as Feature specs (`.feat`), and the test suites are compiled from them on every CI run. Code that is not traced to a spec does not merge.

## Before you start

- Read `docs/12-design-brief.md` for the why and `docs/adr/README.md` for the decisions.
- Toolchain: Node 24 and pnpm 11 (`.tool-versions`). Run `pnpm install`.
- Run the whole pipeline locally with `pnpm ci:local`. It runs the same commands CI runs (SF-ADR-012).

## Changing behavior

1. **Change the spec first.** Edit the `.feat` file and its `.contract.json`, then run `pnpm exec feat lint && pnpm exec feat audit`. A behavior change with no spec change will fail CI by design.
2. Implement inside the spec's `touches` globs. Handlers in `src/features/<feature>/handler.ts` are pure: every side effect goes through the gateway interface (SF-ADR-011).
3. Run `pnpm ci:local`. Every generated scenario must be green with zero unpredicted and zero missing effects, and coverage must hold at the floor in `contracts/quality-gates.json`.
4. Never edit a prediction to make a test pass. If you believe a spec is wrong, open an issue that quotes the scenario.

## Rules CI enforces

- Generated files are never committed: `specs/**/*.test.ts`, `.feature/` and `dist/` are gitignored and built by CI.
- Thresholds live in `contracts/quality-gates.json`. Changing one is an ADR amendment with a rejected alternative, not a pull request tweak.
- No secrets, Firebase configs or personal data in the repository. gitleaks runs on every push.

## Testing on a real PC

Specs and unit tests run anywhere, with fakes for SAMMI and Firebase. What only the real host can show runs on a Windows PC with SAMMI, OBS and a throwaway Firebase project: `docs/09-test-plan.md`, Layer 3.

1. Run `pnpm build:pc`. Both files get the same build stamp.
2. Install them as described in `tools/test-deck/README.md`.
3. Check the stamp in the **SAMMI Firebase** tab before you trust a result.

You don't need a PC to contribute. Say in your pull request if you couldn't run these, and a maintainer will.

## Changing documentation

- `docs/guide/` is for users, and describes what the code does today. Change it in the same pull request as the behavior.
- `docs/01-decision-record.md` is a history. Add a new decision rather than rewriting an old one.
- Never put real configs, credentials, user IDs or screenshots of them in the repository.

## Pull requests

Conventional commit messages. One spec per pull request where possible. Describe the spec change, not the code change; reviewers read `pnpm exec feat diff` first.
