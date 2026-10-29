# Feat service adapters (SF-ADR-016)

Three local service adapters give the Feature harness its observable surfaces. Each is a `createAdapter(config)` module conformant to `@mmmnt/feat-adapter-kit`, built in the first milestone with the kit's conformance suite beside it. Until then these directories hold only this note; `feat generate` does not load adapters, `feat run` does.

| Service | Captures | Seeds | Reads |
| --- | --- | --- | --- |
| `ini` | `IniWrite { section, key, value, json }`, `IniDelete { section, key }` | `IniWrite` records | the ini as records |
| `firebase` | `set { path, value }`, `update { path, fields }`, `remove { path }`, `increment { path, field, by }` | `node { path, value }`, `user { email, password, uid }` | the tree as `node` records |
| `sammi` | `SetVariable { name, value }`, `Trigger { name, pullData }` | none | none |

`json` on an `IniWrite` is the parsed value when the value is JSON text, so specs assert documents structurally.
