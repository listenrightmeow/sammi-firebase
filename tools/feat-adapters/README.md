# Feat service adapters (SF-ADR-016)

The harness's three observable surfaces, all views over one in-process fake world (`world.ts`) with a frozen clock. The world also installs the host the handlers use, under `Symbol.for("sammi-firebase.host")` on `globalThis`, so the handler adapter's native imports and these adapters share one state.

| Service | Captures | Seeds | Reads |
| --- | --- | --- | --- |
| `ini` | `IniWrite { section, key, value, json? }`, `IniDelete { section, key }` | `IniWrite` (value, or json written as JSON text) | the ini as `IniWrite` records |
| `firebase` | `set { path, value }`, `update { path, fields }`, `remove { path }`, `increment { path, field, by }` | `node { path, value }`, `user { email, password, uid }`, `provider { name, enabled }`, `project { apiKey, projectId }`, `later { path, value }`, `outage { writes }` | the tree as one `node` record |
| `sammi` | `SetVariable { name, value }`, `Trigger { name, pullData }` | none (seed rejects with a configuration error) | none |

`json` on an `IniWrite` is the parsed value when the value is JSON text, so specs assert documents structurally.

Tests: `adapters.test.ts` runs the `@mmmnt/feat-adapter-kit` conformance suite for each adapter (H1); `world.test.ts` asserts each fake behavior against the fact it mirrors (H2). Run them with `pnpm test:unit`.
