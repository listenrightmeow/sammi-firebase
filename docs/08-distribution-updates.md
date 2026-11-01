# Distribution, build and updates

## Repository layout (ratified, SF-ADR-010, SF-ADR-011, SF-ADR-016)

```
src/
  ext/
    main.ts             entry bundled into [insert_script]; wires the real gateways to the Bridge helpers and the Firebase SDK
    tab.html            the SAMMI Firebase tab ([insert_external])
    commands.ts         extCommand registrations ([insert_command]), generated from contracts/command-boxes.json
    gateways/           ini, firebase, sammi, clock: the real implementations behind the gateway interface
    poller.ts  listener.ts
  features/<feature>/handler.ts   one pure handler per spec, export handle(input) → { status, body }
specs/                  Feature specs (.feat + .contract.json), one per command and query; coverage in specs/README.md
contracts/              JSON Schema contract outputs of the ADRs
model/                  the Moment model (ADR-037 grammar, ADR-038 palette conformance)
tools/
  build/
    sef.ts              esbuild bundle + .sef assembly + version stamp → dist/sammi-firebase.sef (`pnpm build:sef`)
    deck.ts             generates the bundled deck JSON (every command with "async": 0.0)
  feat-adapters/        the harness: world.ts and the ini, firebase, sammi adapters with their conformance suites
  export_facet.py       Facet export of the model
dist/sammi-firebase.sef built by CI and attached to the GitHub Release; dist/ is gitignored
registry/sammi-firebase.json   the file we submit to SAMMI's registry (see Updates)
docs/  discovery/  README.md  LICENSE
```

The `.sef` is text with fixed section headers (S1). `tools/build/sef.ts` runs esbuild on `src/ext/main.ts` into one classic-script IIFE, writes the sections in order, inserts the version into `[extension_version]`, and puts the generated deck plus `"sammi_version": "2025.2.0"` and `"bridge": true` into `[insert_over]` (S13). The Firebase SDK is loaded at run time by dynamic `import()` from gstatic (S14), the same way the Bridge itself loads its libraries from CDNs (S8), so the `.sef` stays small and the SDK version is a single pinned string. Handlers are pure with respect to the host: every side effect goes through the gateway interface, which is what lets the Feature harness run the same modules with fakes (SF-ADR-011, SF-ADR-016). Source is erasable TypeScript (type-only imports, no enums, no parameter properties) so Node runs the handlers in the harness without a build step.

## Versioning

- Semantic versions in `[extension_version]` and in the tab heading.
- `meta/version` in the cloud tree, the ini layout and the event envelope `version` are versioned separately and additively; every release reads every earlier version (D8, SF-ADR-010). The `[collection:<name>]` ini sections and the `fb_<collection>` variable shape are frozen because decks read them directly.
- A release is a git tag `vX.Y.Z` cut only on a green pipeline and a GitHub Release with the CI-built `sammi-firebase.sef` attached, signed with a GitHub artifact attestation that users can verify with `gh attestation verify`; nothing generated is committed (SF-ADR-012 §4). A data-format change ships with a migration test (T-U1).

## How users get updates

The Bridge fetches SAMMI's registry on load, compares each installed extension's `[extension_version]` with the registry's `latest_version`, and shows an **Update** button that opens `download_link` (S9). Nothing installs itself. The user downloads the `.sef` and installs it through SAMMI Core → Bridge → Install an Extension, which replaces the previous version. The mirror, config and auth record live in the ini, so an update changes nothing the user has set up (architecture, "what persists where").

To be listed: one pull request adding `registry/sammi-firebase.json` to the `extensions/` folder of the SAMMI-Bridge repository, following `extensions/sample.json`. Submitted once the first release is stable (D8). Until then, users install from our GitHub release and receive no update prompt.

## Minimum versions

| Component | Minimum | Enforced by |
| --- | --- | --- |
| SAMMI Core | 2025.2.0 | `sammi_version` in `[insert_over]` (S5, S13) |
| SAMMI Bridge | the version shipped with SAMMI 2025.2.0 (type 37 in its box table) | documented; older Bridges forward the box type anyway, SAMMI Core does the waiting |
| OBS browser plugin | any CEF with ES modules and dynamic import; verified on CEF 127 (Oct 28, 2026) and on Chrome 150 in OBS 33.0.1 (Nov 1, 2026) | documented |
| Firebase JS SDK | pinned, 10.12.0 at planning time | the import URL |

## Testing in a real Bridge without hand-editing bridge.html

SAMMI's docs suggest editing bridge.html for development; the prototype showed the install flow is fast enough to avoid that. The loop is: edit `src/`, run `pnpm build:sef`, uninstall and reinstall in SAMMI Core, reload the Bridge dock. Under a minute. Everything that does not need SAMMI runs in the Feature harness on any machine (`feat run`, test plan Layer 1); the PC is for what only the host can show (Layer 3).

## Licensing and attribution

MIT, same as Hue Scenes. The `.sef` carries the license line in `[extension_info]`. The Firebase SDK is Apache 2.0 and is loaded, not redistributed.
