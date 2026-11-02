# SAMMI Firebase

A [SAMMI](https://sammi.solutions) Bridge extension that keeps a streamer's records in their own Firebase project: collections of documents with fields, read locally in milliseconds, written through to the cloud, and announced as SAMMI triggers when they change anywhere. Settings and state survive reinstalls, drive failures and new machines, and one stream's data can be shared by several rigs, though that hasn't been tested with a second real PC yet.

**Status: no release yet.** All 23 specs pass, 204 of 204 scenarios, and the on-PC tests pass on one streaming PC (`evidence/pc/0.1.0.md`). See the [roadmap](ROADMAP.md) for what's left.

## Why

SAMMI keeps everything in local files. Variables do not survive a restart, and the usual workaround is ini files next to the executable, which do not survive a dead drive, a new machine or a second machine. SAMMI Firebase moves that state into a Firebase project the streamer owns, while every read still comes from a local mirror so buttons never wait on the network.

For IRL streamers this is the first piece of infrastructure that lets a stream's logic live in more than one place: the home rig and the on-location rig share points, tracking and alert state through the same database, built for connections that drop. The full argument is in `docs/12-design-brief.md`.

## What it does

- **Reads are variables.** Every collection appears as a global SAMMI object variable, so any button reads `/$global.fb_example.settings.ip$/` with no command.
- **Writes are one command in a button you already have.** `Firebase: Increment Field` in a cheer button adds points for the viewer's provider user id and answers with the new total: the write is the read.
- **Changes arrive as triggers.** `Firebase: Document Updated` fires when a record changes on another PC or in the Firebase console.
- **Local first.** With the internet down, reads come from the copy on your PC and writes wait to upload. With the Bridge closed, a button can still read and write `firebase.ini` directly. [Using SAMMI Firebase](docs/guide/using.md#when-things-go-offline) explains what wins when the connection returns.
- **Your data, your project.** You create a free Firebase project and an Email/Password user. There is no server of ours, and the extension never stores a password.

The command surface follows a DDD/CQRS grammar: commands write, queries read a local projection, events are past tense. Release 1 scope is in `docs/00-prd.md`.

## Requirements

- Windows, with SAMMI Core 2025.2.0 or newer.
- OBS 30 or newer, with the SAMMI Bridge open as a dock.
- A free Firebase project with Email/Password sign-in and a Realtime Database. The [setup guide](docs/guide/setup.md) walks you through it.
- Internet when the Bridge loads, to fetch the Firebase library. If OBS starts with no internet, it recovers once the internet is back.

## Installing

Not yet available; see the [roadmap](ROADMAP.md). To try it now, [build it from source](#development). When release 1 ships, the `.sef` will be attached to a GitHub Release, built by CI and signed with a GitHub artifact attestation. You will be able to verify the file you downloaded came from this repository's CI:

```
gh attestation verify sammi-firebase.sef --repo listenrightmeow/sammi-firebase
```

## Documentation

| Guide | What it covers |
| --- | --- |
| [Setup guide](docs/guide/setup.md) | Create your Firebase project, install and connect in about 15 minutes. Also a second PC, updating and uninstalling |
| [Using SAMMI Firebase](docs/guide/using.md) | Reading, writing, triggers, working offline and large collections |
| [Reference](docs/guide/reference.md) | Every command, trigger, answer and limit |
| [Troubleshooting](docs/guide/troubleshooting.md) | What the status line means, and how to fix common problems |

## How it is built

Spec first. Every fact the design relies on was verified on a streaming PC or in SAMMI's source before any product code (`docs/02-verification-list.md`). The design was modelled in Moment, decided in seventeen ADRs with JSON Schema contracts, and specified in 23 Feature specs whose 204 scenarios compile into the test suite on every CI run. Generated tests are never committed.

| Tool | Used for |
| --- | --- |
| [Moment](https://moment.mmmnt.ai/) | Domain modelling and validation (`model/`) |
| [Feature](https://feature.mmmnt.ai/) | Executable specs, drift detection and test generation (`specs/`) |
| [flmnt](https://flmnt.ai/) | Agent memory and decision causality |

## The design board

The design is laid out on a public Miro board: [SAMMI Firebase — NDD](https://miro.com/app/board/uXjVEUQjpYg=/). NDD stands for narrative-driven development, a way of modelling a product as the stories its users live through, moment by moment, before any code exists.

The board has two halves:

- **The architecture palette.** A context map of the extension, Firebase, SAMMI Core and the OBS dock, then one frame per aggregate (Connection, Collection, Document) with its commands, events and invariants, the local mirror and its queries, the policies streamers wire up, and a table of which component enforces each rule.
- **Eight narrative threads, T1 to T8.** One per outcome in the PRD, from "your SAMMI talks to your Firebase" to "a viewer counter". Each thread reads left to right as a film strip of moments, with lanes for what the streamer does, what the extension decides, what the systems do, and the branches where something is refused.

Sticky colours follow a legend on the board. Green notes mark what was discovered or challenged during review, so the board also records how the design changed. The board is the narrative; the Feature specs in `specs/` are the source of truth wherever the two differ. The board has not been updated since decision D24, so it still shows a few things that have changed, such as a Local Notice button.

## Development

Node 24 and pnpm 11 (`.tool-versions`). You don't need a Firebase project or Windows to run the tests.

```
pnpm install
pnpm ci:local         # the same checks CI runs (SF-ADR-012)
pnpm build:pc         # dist/sammi-firebase.sef and the on-PC test deck
```

To install your build, follow the [setup guide](docs/guide/setup.md) from step 6, then see `tools/test-deck/README.md` for the on-PC tests.

Read `CONTRIBUTING.md` before changing behavior: the spec changes first, and thresholds live in `contracts/quality-gates.json`. Report security issues privately as described in `SECURITY.md`.

## Repository map

| Path | What it is |
| --- | --- |
| `docs/guide/` | For users: setup, usage, reference and troubleshooting. |
| `docs/12-design-brief.md` | Start here for the design: the project, the user, why it matters, the IRL path. |
| `docs/00-prd.md` | Requirements: the eight outcomes, release-1 scope, backlog, success criteria. |
| `docs/01-decision-record.md` | Every decision in order, with reasons and consequences. |
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
| `model/` | The Moment model: one context, eight flows. Validated with the Moment build that adds ADR-037 (grammar completeness) and ADR-038 (palette conformance, project mode) (`moment parse model/`). `tools/export_facet.py` exports it for Facet. |
| `specs/` | 23 Feature specs with their contract registries; coverage matrix in `specs/README.md`. `feat.config.json` is the harness. |
| `tools/test-deck/` | The on-PC test deck, one button per case a button can drive; not shipped. |
| `tools/feat-adapters/` | The harness's `ini`, `firebase` and `sammi` service adapters (milestone 1). |
| `ROADMAP.md` | What is left before the first release, and what comes after. |
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
