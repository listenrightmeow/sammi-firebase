# SF-ADR-016: Feature toolchain adoption: the harness, the services, and how specs map to the model

| Field | Value |
| --- | --- |
| Status | Accepted (maintainer, Oct 29, 2026: "all agreed on") |
| Date | October 29, 2026 |
| Applies to | feat.config.json, specs/, tools/feat-adapters/, src/features/ |
| Decision in flmnt | workspace `firebase`, entry 54a0ecb8 (D13), this corpus |
| Contract output | `feat.config.json` itself (schema-validated by the toolchain); the three adapter record vocabularies below |

## Context

A `.feat` spec instructs an agent, predicts every observable effect, and compiles to a test suite. Predictions target configured services through adapters that capture effects during a window; the response adapter invokes the command. Nothing observes a SAMMI Bridge extension natively, so the observable surfaces must be built. The earned-adapter doctrine: adapters are earned by need, starting at the handler level.

## Decision

1. **Response adapter:** `@mmmnt/feat-adapter-handler`. Every command and query routes to `src/features/<feature>/handler.ts` export `handle`. The handler receives the box payload (as `ExecuteCommand` delivers it, without `FromButton`/`instanceId`) and returns `{ status: "OK" | "ERR", body }`; the body is the answer (SF-ADR-013) plus, for `Get Document`, the unpacked variables, so queries stay pure.
2. **Three service adapters, ours, in `tools/feat-adapters/`**, each a `createAdapter(config)` module conformant to `@mmmnt/feat-adapter-kit`, all views over one in-process fake world (`tools/feat-adapters/world.ts`) that also installs the fake gateways the handlers use, registered on `globalThis` under a symbol because the handler adapter imports handlers natively and module identity is not guaranteed:

| Service | Consistency | Captures (record types) | Seeds | Reads |
| --- | --- | --- | --- | --- |
| `ini` | acid | `IniWrite { section, key, value }`, `IniDelete { section, key }` | `IniWrite` records, so a scenario starts from a known `firebase.ini` | the ini as records |
| `firebase` | strong | `set { path, value }`, `update { path, fields }`, `remove { path }`, `increment { path, field, by }` | `node { path, value }` records | the tree as `node` records |
| `sammi` | acid | `SetVariable { name, value }` (the `fb_<collection>` publications), `Trigger { name, pullData }` (the events) | none | none |

3. **Spec types map to the model:** aggregate commands → `type command`; queries → `type query`; the reconcile policy is exercised as an effect of `Connect` rather than a separate policy spec, because the delivered-event stimulus has no service of its own here; the Mirror projection is asserted through the `ini` and `sammi` effects of every command.
4. **Scenario clock:** the harness uses `clock at` only to resolve `variables:`; it passes no clock to adapters or handlers (verified in `@mmmnt/feat-runtime` 0.1.19). Every scenario therefore shares one frozen clock, `2026-10-29T12:00:00Z`, declared as `options.clock` on each service in `feat.config.json`; the fake world reads it, and `_t` written by this device is that instant. A scenario needing a different clock is a config change, flagged at review.
5. **Layout:** `specs/<area>/<feature>/<feature>.feat` with its `.contract.json` beside it; shared shapes `$ref` `contracts/`. Generated `*.test.ts` land beside the spec and are gitignored.
6. **Pinned toolchain:** `@mmmnt/feature` 0.3.x, `feat 1.0` pragma; adapters `@mmmnt/feat-adapter-handler` 0.1.x, `@mmmnt/feat-schema-json` 0.2.x, `@mmmnt/feat-runtime` 0.1.x.

## Rationale

Three surfaces are exactly what the extension touches on the host: SAMMI's ini, the Firebase tree, and SAMMI's variables and triggers. Capturing them makes every rule in the data model assertable, and the fakes are small because the gateway interface is small.

## Rejected alternatives

- **An adapter driving a real SAMMI and OBS.** Rejected for the local tier: no CI can run them; the pc tier covers it by hand (SF-ADR-015).
- **A single `host` service.** Rejected: predictions lose precision ("the ini was not written but the trigger fired" is a real case).
- **Mocking the Firebase SDK itself.** Rejected: the gateway interface is the seam; the SDK sits behind it and is exercised on the pc tier.

## Consequences

The first milestone builds the three adapters and their conformance suites before any feature. The specs in `specs/` are the units of work of the build.

## Compliance impact

None.

## Open questions

None. `feat-adapter-fs` was considered for the `ini` service and rejected on Oct 29, 2026: it captures only file paths (`FILE_WRITTEN`, `FILE_DELETED`), cannot seed, and carries no values, so the specs' `IniWrite { section, key, json }` records could not be asserted. The `ini` adapter is ours, a view over the fake world.
