# SAMMI Firebase

A [SAMMI](https://sammi.solutions) Bridge extension that keeps a streamer's records in their own Firebase project: collections of documents with fields, read locally in milliseconds, written through to the cloud, and announced as SAMMI triggers when they change anywhere. Settings and state survive reinstalls, drive failures and new machines, and one stream's data can be shared by several rigs.

**Status: specification complete; build starting (milestone 1).** There is no release and no product code yet. The design, decisions and executable specs are complete, ratified and audited against each other (decisions D16 to D19 in `docs/01-decision-record.md`).

## Why

SAMMI keeps everything in local files. Variables do not survive a restart, and the usual workaround is ini files next to the executable, which do not survive a dead drive, a new machine or a second machine. SAMMI Firebase moves that state into a Firebase project the streamer owns, while every read still comes from a local mirror so buttons never wait on the network.

For IRL streamers this is the first piece of infrastructure that lets a stream's logic live in more than one place: the home rig and the on-location rig share points, tracking and alert state through the same database, built for connections that drop. The full argument is in `docs/12-design-brief.md`.

## What it will do

- **Reads are variables.** Every collection appears as a global SAMMI object variable, so any button reads `/$fb_hue.settings.ip$/` with no command.
- **Writes are one command in a button you already have.** `Firebase: Increment Field` in a cheer button adds points for the viewer's provider user id and answers with the new total: the write is the read.
- **Changes arrive as triggers.** `Firebase: Document Updated` fires within about a second when a record changes on another PC or in the Firebase console.
- **Local first.** With the Bridge closed or the internet down, reads come from `firebase.ini`, writes queue, and what you did meanwhile wins when the connection returns.
- **Your data, your project.** You create a free Firebase project and an Email/Password user. There is no server of ours, and the extension never stores a password.

The command surface follows a DDD/CQRS grammar: commands write, queries read a local projection, events are past tense. Release 1 scope is in `docs/00-prd.md`.

## Requirements

- SAMMI Core 2025.2.0 or newer, with the SAMMI Bridge open as an OBS browser dock.
- A Firebase project with Email/Password sign-in and a Realtime Database.

## Installing

Not yet available. When release 1 ships, the `.sef` will be attached to a GitHub Release, built by CI and signed with a GitHub artifact attestation. You will be able to verify the file you downloaded came from this repository's CI:

```
gh attestation verify sammi-firebase.sef --repo listenrightmeow/sammi-firebase
```

## How it is built

Spec first. Every fact the design relies on was verified on a streaming PC or in SAMMI's source before any product code (`docs/02-verification-list.md`). The design was modelled in Moment, decided in seventeen ADRs with JSON Schema contracts, and specified in 23 Feature specs whose 190 scenarios compile into the test suite on every CI run. Generated tests are never committed.

| Tool | Used for |
| --- | --- |
| [Moment](https://moment.mmmnt.ai/) | Domain modelling and validation (`model/`) |
| [Feature](https://feature.mmmnt.ai/) | Executable specs, drift detection and test generation (`specs/`) |
| [flmnt](https://flmnt.ai/) | Agent memory and decision causality |

## Development

Node 24 and pnpm 11 (`.tool-versions`).

```
pnpm install
pnpm ci:local      # the same pipeline CI runs (SF-ADR-012)
feat lint && feat audit && feat generate    # check and compile the specs
```

Read `CONTRIBUTING.md` before changing behavior: the spec changes first, and thresholds live in `contracts/quality-gates.json`. Report security issues privately as described in `SECURITY.md`.

## Repository map

| Path | What it is |
| --- | --- |
| `docs/12-design-brief.md` | Start here: the project, the user, why it matters, the IRL path. |
| `docs/00-prd.md` | Requirements: the eight outcomes, release-1 scope, backlog, success criteria. |
| `docs/01-decision-record.md` | Every decision in order, D1 to D19, with reasons and consequences. |
| `docs/adr/` | Seventeen architecture decision records with contract outputs; index in `docs/adr/README.md`. |
| `docs/02-verification-list.md` | Every fact the design relies on, its source, and how it was verified. |
| `docs/03-user-journey.md` | What a streamer does, step by step, counted. |
| `docs/04-architecture.md` | Pieces, modules, and the path of a read, a write and a cloud change. |
| `docs/05-auth-flow.md` | Email/Password sign-in, staying signed in, security rules. |
| `docs/06-data-model.md` | The cloud tree, the ini mirror, and the consistency rules. |
| `docs/07-failure-modes.md` | What goes wrong, what the user sees, what the extension does. |
| `docs/08-distribution-updates.md` | Repository layout, build, versioning, SAMMI's update registry. |
| `docs/09-test-plan.md` | The Feature harness, build checks, and the on-PC test matrix. |
| `docs/10-domain-model.md` | The domain model: aggregates, commands, events, queries, invariants. |
| `docs/11-moment-alignment.md` | How the model, the design board and the specs were kept in agreement. |
| `contracts/` | JSON Schema contracts: config, ini layout, cloud tree, security rules, answers, events, variables, command boxes, registry entry, quality gates. |
| `model/` | The Moment model: one context, eight flows. Validated with the Moment CLI build that implements ADR-038 (`moment parse model/`). `tools/export_facet.py` exports it for Facet. |
| `specs/` | 23 Feature specs with their contract registries; coverage matrix in `specs/README.md`. `feat.config.json` is the harness. |
| `tools/feat-adapters/` | The harness's `ini`, `firebase` and `sammi` service adapters (milestone 1). |
| `evidence/` | Shipped release evidence: the on-PC matrix per release and the gateway-probe fixture. |
| `discovery/` | The hardware probes used during discovery: an OBS dock probe page and the Cloud Probe extension. |

## Principles

- The target user installs things by clicking. Every step they must perform is counted and justified.
- Users own their data and their schema. A deck declares its own collections; Firebase stays schema-less.
- Local first. Queries read a local projection and never wait on the network; commands write through.
- One connection, configured once in the Bridge, inherited by every deck.
- Specs before code.

## License

MIT. See `LICENSE`.
