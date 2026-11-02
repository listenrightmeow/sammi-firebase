# SAMMI Firebase — design brief

| Field | Value |
| --- | --- |
| Status | Approved companion to the PRD (`docs/00-prd.md`), Oct 29, 2026 |
| Audience | Anyone meeting the project cold: contributors, reviewers, streamers deciding whether to install it |
| Length | Ten minutes. The PRD has the scope; the ADRs have the decisions; this has the why. |

## The project in one paragraph

SAMMI Firebase is a SAMMI Bridge extension, one `.sef` file, that keeps a streamer's records in a Firebase project the streamer owns. Records are documents in collections with fields. Every SAMMI button reads them as ordinary variables, writes them with one command embedded in a button the streamer already has, or sets them as a variable and lets the extension write them through. A change made anywhere, another PC, the Firebase console, a second rig in another city, arrives as a SAMMI trigger within about a second. The streamer sets it up once; every deck inherits it.

## The problem

SAMMI is the automation layer under many streams: alerts, counters, scene changes, chat games, viewer points, hardware. Everything it knows lives in local files beside the executable. Variables do not survive a restart. The workaround everyone reaches for is ini files, which survive a restart but not a dead drive, a reinstall, a new machine or a second machine. Nothing a streamer configures can be edited from anywhere else, and nothing reacts when it changes.

That is a resilience problem for every streamer and a hard wall for one kind of streamer in particular, described below.

## Who it is for

A streamer who runs SAMMI with the Bridge as an OBS dock, installs things by clicking, and may never have opened a developer console. They already have buttons: a cheer handler, an alert, a death counter, a scene switch. They will not build buttons to manage data. They will add one line to buttons they have, read `/$global.fb_example.settings.ip$/` where they used to read a local variable, and expect the rest to be invisible.

They own their data. The MVP asks them to create a free Firebase project and an Email/Password user, following a step-by-step guide, and never asks them to trust us with a credential or a server. There is no server. The extension talks to their project from their machine.

## Why it is valuable

**Settings and state survive the machine.** Reinstall SAMMI, replace a drive, buy a new PC: install the extension, paste the saved config, connect, and the schema and every document are back before any deck runs. This alone pays for the setup.

**The write is the read.** A cheer button that increments a viewer's points holds the new total in the same button, keyed by the provider's user id. No second command, no race, no polling from SAMMI.

**Live from anywhere.** Edit a record in the Firebase console on a phone during a stream and the overlay updates. A moderator can be given a tiny web form later; the data path already exists.

**The show goes on without the cloud.** Reads never wait on the network. The Bridge closed, the internet down, the session revoked: buttons keep reading the local mirror, writes queue, and what the streamer did meanwhile wins when the connection returns. Nothing a streamer does during a stream is silently discarded.

**Nothing to operate, nothing to pay.** The free Realtime Database tier covers a streamer's settings many thousands of times over. We run no service, hold no data, and cannot leak what we do not have.

## The path this opens for IRL streamers

This is the part the earlier documents did not say out loud.

An IRL streamer's ecosystem is split across machines by necessity. The home PC runs SAMMI, OBS and the alert stack because that is where the GPU, the capture hardware and the stable connection are. The streamer is somewhere else, with a phone, a bonded modem and perhaps a laptop in a backpack. Today the points, the tracking state, the alert history and the scene logic live in files on the home PC, and the person on location cannot see them, change them or react to them. A second SAMMI on the laptop starts from nothing and knows nothing about the home rig.

A remote database changes the shape of that problem. The data is no longer on a machine; it is at `users/{uid}` in a project both machines can reach. Concretely:

- **One ecosystem, several rigs.** The home PC and the backpack laptop connect as the same user. Viewer points accrue wherever the chat is being handled; the leaderboard is the same query on both. A collection declared on one machine is inherited by the other on connect.
- **State follows the streamer.** Where they are, what segment of the day they are in, which alerts are armed, what the current challenge count is: documents the on-location rig writes and the home rig reacts to through triggers, and the reverse.
- **Built for a bad connection.** IRL connectivity drops. The local mirror answers every read, writes queue in the ini, replay happens on reconnect, and the merge rules (last write wins per document, field-level merges on the server, increments that count from both sides) were designed for two machines writing at once. The failure modes an IRL streamer meets daily are the ones the architecture was specified against.
- **Any client can join later.** Because the tree is plain JSON behind Firebase's own auth and rules, a phone-sized web page, a moderator panel or a companion app can read and write the same documents without a change to the extension. Release 1 ships none of these; it ships the store, the schema, the merge rules and the trigger path they would use.

The product therefore does two things at once: it gives every SAMMI user resilience they lack, and it gives IRL streamers the first piece of infrastructure that lets a stream's logic live in more than one place.

## What release 1 is and is not

Release 1 is the connection and the data model: the Bridge tab, twelve commands, seven queries, eleven triggers, the variable surface, the local mirror and its offline behaviour, a bundled deck of examples and a setup guide. It is not account management, a hosted project, a phone app or a moderator panel. Those are paths, and the point of this release is to make them short.

## How it was built

Planning first. Every fact the design relies on was verified on the streaming PC or in SAMMI's source before a line of product code (`docs/02-verification-list.md`). The design was argued on an NDD board, modelled in Moment, decided in sixteen ADRs with JSON Schema contracts, and specified in twenty-three Feature specs whose 200 scenarios compile into the test suite on every CI run. The repository is meant to be read as closely as it is run.

## Where to go next

| Want | Read |
| --- | --- |
| Scope, outcomes, success criteria | `docs/00-prd.md` |
| Why each decision | `docs/adr/README.md`, chronology in `docs/01-decision-record.md` |
| What a streamer does, step by step | `docs/03-user-journey.md` |
| The data and its rules | `docs/06-data-model.md`, `docs/10-domain-model.md` |
| What is asserted | `specs/README.md` |
