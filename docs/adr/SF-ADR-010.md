# SF-ADR-010: Versioning, distribution and updates

| Field | Value |
| --- | --- |
| Status | Accepted (maintainer, Oct 29, 2026: "all agreed on") |
| Date | October 29, 2026 |
| Applies to | the `.sef`, releases, the SAMMI registry entry |
| Decision in flmnt | workspace `firebase`, entry 1a431d94 (D8) |
| Contract output | `contracts/registry-entry.json` |

## Context

SAMMI Bridge fetches `https://sammi.solutions/SAMMI-Bridge/extensions/extensions.json` on load, compares each installed extension's `[extension_version]` with the registry's `latest_version`, and shows an Update button opening `download_link`. Nothing installs itself; the user installs the new `.sef` as the first time. Listing is a pull request adding a JSON file under `extensions/` in SAMMISolutions/SAMMI-Bridge (S9).

## Decision

1. Semantic versions in `[extension_version]` and in the tab heading. A release is a git tag `vX.Y.Z` cut only on a green pipeline, and a GitHub Release with the `sammi-firebase.sef` **that CI built** attached. `dist/` is never committed (generated files are built by CI, platform ruling a7846ba6; revised Oct 29, 2026 by SF-ADR-012 §4).
2. Data formats are versioned separately and additively: `meta/version` in the cloud tree, the ini layout, the event envelope `version`. Every release reads every earlier version. The `[collection:<name>]` ini sections and the `fb_<collection>` variable shape are frozen because decks read them.
3. We submit `registry/sammi-firebase.json` (shape: `contracts/registry-entry.json`) to SAMMI's registry after the first stable release; until then users install from GitHub Releases and receive no update prompt.
4. Minimum versions: SAMMI Core 2025.2.0 (enforced in the `.sef`); the Bridge shipped with it; the Firebase JS SDK pinned by the import URL.

## Rationale

The update path is SAMMI's own; the only thing we control is never breaking data a user already has.

## Rejected alternatives

- **Self-updating from inside the extension.** Rejected: not how SAMMI extensions work, and a code-download path in a dock is a trust problem for an open-source project.
- **Bundling the Firebase SDK into the `.sef`.** Rejected: the Bridge already loads its own libraries from CDNs at start (S8); a dynamic import keeps the `.sef` small and the SDK a single pinned string.

## Consequences

`tools/build/sef.ts` stamps the version; the release workflow attaches its output; a release checklist in the README. A data-format change is a minor version at most and must ship with a migration test (T-U1).

## Compliance impact

None.

## Open questions

None. Releases carry a GitHub artifact attestation; ratified Oct 29, 2026, specified in SF-ADR-012 §4.
