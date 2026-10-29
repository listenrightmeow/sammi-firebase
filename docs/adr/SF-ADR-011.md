# SF-ADR-011: Language and build: TypeScript source, esbuild into the `.sef`, modules the harness can call directly

| Field | Value |
| --- | --- |
| Status | Accepted (maintainer, Oct 29, 2026: "all agreed on") |
| Date | October 29, 2026 |
| Applies to | the extension's code and build |
| Decision in flmnt | workspace `firebase`, entry 54a0ecb8 (D13), this corpus |
| Contract output | none (advisory); the build output is checked by B1–B3 in SF-ADR-012 |

## Context

A `.sef` is a text file with fixed sections; `[insert_script]` is plain JavaScript the Bridge injects (S1). Prototype 2 assembled one from Python. The Feature toolchain's handler adapter invokes an exported function in a module path with a payload and expects `{ status, body }`.

## Decision

1. Source is TypeScript under `src/`. One module per feature folder exports the handler the specs name (`src/features/<feature>/handler.ts`), taking the box payload and a context of gateways (ini, firebase, sammi, clock) and returning `{ status: "OK" | "ERR", body }`. Handlers are pure with respect to the host: every side effect goes through the gateway context.
2. `tools/build/sef.ts` (run with `pnpm build:sef`) uses esbuild's API to bundle `src/ext/main.ts` (which wires the gateways to the real Bridge helpers and the Firebase SDK) into a single IIFE, then assembles the `.sef` sections around it with the version and the bundled deck.
3. The same handler modules run in the Feature harness with fake gateways (SF-ADR-016). No code path is special-cased for tests.
4. Node 22 or newer for tooling; the extension itself targets the Chromium in OBS 30+ (CEF 127 verified).

## Rationale

The harness has to call the same code the Bridge runs, or the specs prove nothing. Separating handler from host wiring is what makes that true, and esbuild gives one deterministic artifact without a bundler configuration to maintain.

## Rejected alternatives

- **Plain JavaScript, no build.** Rejected: no types for the contracts, and the harness would still need a way to inject gateways.
- **Shipping ES modules in the `.sef`.** Rejected: `[insert_script]` is injected as a classic script.
- **A framework for the tab UI.** Rejected: the tab is a form, a status line and a log; plain DOM.

## Consequences

Tooling pins (Oct 29, 2026): TypeScript 6.0 for type-checking and linting, because typescript-eslint does not support TypeScript 7 yet; the Firebase SDK's types are declared in `src/ext/firebase-sdk.ts` rather than taken from the `firebase` npm package, whose Node-side dependencies the extension never runs.


Generated tests import the handler modules through the adapter's `{ module, export }` routing. The `.sef` is reproducible from source; `dist/` is committed per release only.

## Compliance impact

None.

## Open questions

None.
