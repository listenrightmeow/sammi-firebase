# SAMMI Firebase

A [SAMMI](https://sammi.solutions) Bridge extension that gives SAMMI buttons documents in the user's own Firebase project: collections of records with fields, read locally in milliseconds, written through to the cloud, and announced as triggers when they change anywhere. Settings and state survive reinstalls, drive failures and new machines.

**Status: specification complete and ratified (Oct 29, 2026); build not started.** NDD board, Moment model, 16 ADRs with contract schemas, PRD and 23 Feature specs (190 scenarios) are approved and audited against each other (decision D16). Next: milestone 1 of the build (harness adapters, first handler green), per SF-ADR-014. No product code yet. Every fact the design relies on has been verified on hardware (`docs/02-verification-list.md`); the planning set is in `docs/`; the design journey is on the NDD board (Miro, [`SAMMI Firebase — NDD`](https://miro.com/app/board/uXjVEUQjpYg=/)). Sequence followed: board review → `.moment` files → ADRs and PRD → Feature specs → build (next). Sift is bypassed on this project. Causality is recorded in the flmnt workspace `firebase`.

## Why

SAMMI keeps everything in local files. Lose the machine, lose the setup. Variables do not survive a restart, and the usual workaround is ini files that live next to the executable. This project adds commands such as `Firebase: Update Document` and `Firebase: Get Document` that behave like SAMMI's INI commands but persist off the machine, plus triggers such as `Firebase: Document Updated` when a record changes elsewhere. The command surface follows a DDD/CQRS grammar: commands write, queries read a local projection, events are past tense.

## Tools

- [Moment](https://moment.mmmnt.ai/) for modeling and validation.
- [Feature](https://feature.mmmnt.ai/) for feature specs, drift detection, and test generation.
- [flmnt](https://flmnt.ai/) for agent memory management and causality tracking.

## Documents

| File | What it is |
| --- | --- |
| `docs/12-design-brief.md` | The design brief: the project, the target user, why it is valuable, and the path it opens for IRL streamers running one stream ecosystem across several rigs. Start here. |
| `docs/00-prd.md` | The product requirements: problem, user, the eight outcomes, release-1 scope, what discovery fixed, success criteria. |
| `docs/01-decision-record.md` | Each architectural decision: options, choice, reasons, consequences. Open decisions at the end. |
| `docs/02-verification-list.md` | Every fact the design relies on, its source, and whether it has been confirmed on hardware. Includes the prototype plan. |
| `discovery/obs-dock-probe.html` | A self-contained page to load as an OBS browser dock. Reports what the Bridge's environment can and cannot do. |
| `docs/03-user-journey.md` | Who the user is and every step they take, counted. |
| `docs/04-architecture.md` | Pieces, modules, commands, and the exact path of a read, a write and a cloud change. |
| `docs/05-auth-flow.md` | Email/Password sign-in, staying signed in across restarts, security rules. |
| `docs/06-data-model.md` | Keys, values, the cloud tree, the ini mirror, consistency rules. |
| `docs/07-failure-modes.md` | What goes wrong, what the user sees, what the extension does. |
| `docs/08-distribution-updates.md` | Repository layout, build, versioning, SAMMI's update registry. |
| `docs/09-test-plan.md` | Logic tests, build checks, and the on-PC test matrix with exit criteria. |
| `docs/10-domain-model.md` | The DDD Palette model: bounded context, aggregates, commands, events, queries, policies, invariants. The source of every command name. |
| `docs/11-moment-alignment.md` | The board ↔ model 1:1 check, what the grammar cannot carry, tooling findings, validation results. |
| `docs/adr/` | Sixteen architecture decision records in the platform's form; index in `docs/adr/README.md`. |
| `contracts/` | JSON Schema contract outputs of the enforceable ADRs: config, ini layout, cloud tree, security rules, answers and reason codes, event envelope, collection variable, command boxes, registry entry. |
| `specs/` | Feature specs (`.feat` + `.contract.json`), one per command and query; coverage matrix in `specs/README.md`. `feat lint && feat audit && feat generate`; generated suites are not committed. `feat.config.json` is the harness (SF-ADR-016). |
| `model/` | The Moment project (ADR-038 grammar): `.manifest.yaml`, `contexts/sammi-firebase.moment`, `flows/t1…t8`. Parse with the ADR-038 CLI: `node <moment-adr037>/packages/cli/dist/moment.mjs parse model/`. For Facet: `python3 tools/export_facet.py`, then `serve model/facet --all` (output is generated, not committed; the script also replicates Facet's event-type check). |
| `discovery/cloud-probe-echo.sef` | Prototype 2: proved how a Save Variable box gets its value back. |
| `evidence/` | Published release evidence: the CI bundle is archived per run; `evidence/pc/` holds the on-PC matrix per release and the gateway-probe fixture. Discovery-phase probe results stay local and are summarised in `docs/02-verification-list.md`. |

Next: build milestone 1 (SF-ADR-009, SF-ADR-016): the three harness adapters in `tools/feat-adapters/`, the first handler, `feat run` green in CI.

## Principles

- The target user installs things by clicking. Every step they must perform is counted and justified.
- Users own their data and their schema. The MVP uses the user's own Firebase project; a deck declares its own collections; Firebase stays schema-less.
- Local first. Queries read a local projection and never wait on the network; commands write through.
- One connection, configured once in the Bridge, inherited by every deck.
- Planning before code.

## License

To be chosen before the first release. MIT is the intended license.
