# Architecture decision records

SAMMI Firebase's decisions in the platform's ADR form: context, decision, rationale, rejected alternatives, consequences, compliance impact, open questions, and a contract output where the decision is enforceable. The human-readable chronology is `docs/01-decision-record.md`; the causality is in the `firebase` flmnt workspace. The System Architecture Reference's defaults were applied where they fit and deviated from by SF-ADR-009.

| ADR | Title | Contract output |
| --- | --- | --- |
| [SF-ADR-001](SF-ADR-001.md) | Ship as a SAMMI Bridge extension; the Bridge is required | advisory |
| [SF-ADR-002](SF-ADR-002.md) | Users bring their own Firebase project; Realtime Database | `firebase-config.json`, `cloud-tree.json`, `database.rules.json` |
| [SF-ADR-003](SF-ADR-003.md) | Email/Password sign-in; session in localStorage, backed up to the ini | `ini-firebase.json` (`connection`) |
| [SF-ADR-004](SF-ADR-004.md) | Local-first mirror; consistency rules; Bridge-closed behavior | `ini-firebase.json` |
| [SF-ADR-005](SF-ADR-005.md) | Command surface in the DDD Palette; documents; answers | `command-boxes.json`, `command-answer.json` |
| [SF-ADR-006](SF-ADR-006.md) | Domain events as SAMMI triggers with a reduced envelope | `event-envelope.json` |
| [SF-ADR-007](SF-ADR-007.md) | The variable surface and two-way binding | `collection-variable.json` |
| [SF-ADR-008](SF-ADR-008.md) | Collections declared locally and mirrored to the cloud | `cloud-tree.json`, `ini-firebase.json` (`schema`) |
| [SF-ADR-009](SF-ADR-009.md) | Deviation: no operated infrastructure | advisory |
| [SF-ADR-010](SF-ADR-010.md) | Versioning, distribution and updates | `registry-entry.json` |
| [SF-ADR-011](SF-ADR-011.md) | TypeScript source, esbuild into the `.sef`, harness-callable modules | advisory |
| [SF-ADR-012](SF-ADR-012.md) | CI and testing strategy (platform SYSARCH §14 applied where the technology overlaps; replaced and not-applicable stages named) | the pipeline; `.github/workflows/ci.yml` |
| [SF-ADR-013](SF-ADR-013.md) | Error response format and the reason registry | `command-answer.json` |
| [SF-ADR-014](SF-ADR-014.md) | Execution rules (delegate of PADR-013) | procedural |
| [SF-ADR-015](SF-ADR-015.md) | Environments and evidence | `feat.config.json` environment |
| [SF-ADR-016](SF-ADR-016.md) | Feature toolchain adoption: harness, services, spec mapping | `feat.config.json`, adapter vocabularies |
| [SF-ADR-017](SF-ADR-017.md) | Quality gates and enforcement: threshold constants, definitions of done per spec, milestone and release | `quality-gates.json` |

Status: all seventeen accepted (Oct 29, 2026). 001–008 render maintainer rulings of Oct 28–29, 2026; 009–016 were ratified by the maintainer on Oct 29, 2026 ("all agreed on"). Contracts live in `contracts/`. Required procedural ADRs per the platform (SYSARCH §17): CI & Testing Strategy = 012, Quality Gates & Enforcement = 017, Error Response Format = 013, Event Conventions = 006, Execution Rules = 014, Feat Toolchain Adoption = 016, Environment & Evidence Strategy = 015. Corrections applied at the pre-build audit of Oct 29, 2026: SF-ADR-016 §4 (the harness passes no clock; the frozen clock is a service option), SF-ADR-013 (registry trimmed to the 21 reasons a box can answer), SF-ADR-005 (document commands spelled out).
