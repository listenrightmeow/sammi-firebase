# Contributing

SAMMI Firebase is built spec-first. Behavior is defined in `specs/` as Feature specs (`.feat`), and the test suites are compiled from them on every CI run. Code that is not traced to a spec does not merge.

## Before you start

- Read `docs/12-design-brief.md` for the why and `docs/adr/README.md` for the decisions.
- Toolchain: Node 24 and pnpm 11 (`.tool-versions`). Run `pnpm install`.
- Run the whole pipeline locally with `pnpm ci:local`. It runs the same commands CI runs (SF-ADR-012).

## Changing behavior

1. **Change the spec first.** Edit the `.feat` file and its `.contract.json`, then run `feat lint && feat audit`. A behavior change with no spec change will fail CI by design.
2. Implement inside the spec's `touches` globs. Handlers in `src/features/<feature>/handler.ts` are pure: every side effect goes through the gateway interface (SF-ADR-011).
3. Run `pnpm ci:local`. Every generated scenario must be green with zero unpredicted and zero missing effects, and coverage must hold at the floor in `contracts/quality-gates.json`.
4. Never edit a prediction to make a test pass. If you believe a spec is wrong, open an issue that quotes the scenario.

## Rules CI enforces

- Generated files are never committed: `specs/**/*.test.ts`, `.feature/` and `dist/` are gitignored and built by CI.
- Thresholds live in `contracts/quality-gates.json`. Changing one is an ADR amendment with a rejected alternative, not a pull request tweak.
- No secrets, Firebase configs or personal data in the repository. gitleaks runs on every push.

## Pull requests

Conventional commit messages. One spec per pull request where possible. Describe the spec change, not the code change; reviewers read `feat diff` first.
