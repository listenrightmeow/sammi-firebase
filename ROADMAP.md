# Roadmap

What is left before the first release, and what comes after it. Decisions behind these items are in [docs/01-decision-record.md](docs/01-decision-record.md).

## Before the first release

| Item | Status |
| --- | --- |
| On-PC tests that need a second PC: T-S1, T-L3, T-L4 | Waiting for a second PC. Results so far are in [evidence/pc/0.1.0.md](evidence/pc/0.1.0.md) |
| T-I1: someone new follows the setup guide in under 15 minutes | Not started |
| Run CI on GitHub for the first time, and fix what it finds | Not started |
| Tag the release, which builds and signs the `.sef` | Comes last |

## Known bugs

Found by reading the code while auditing the guides. None has been run on a PC. The guides warn about each one.

| Bug | Effect |
| --- | --- |
| Create Document with a blank id doesn't return the id | A button can't get the new id, though the spec says the answer carries it. Find it with List Documents |
| A refused variable write in a collection over 16,000 bytes doesn't snap back (D32) | The variable stays wrong, and Write Rejected can repeat on each pass of the poller |
| Any sign-in failure reports as `credentials invalid` | Starting OBS with no internet may show a false "sign-in needed" popup. This case needs testing on a PC |
| Writes made with **INI: Save Text** to a new document are ignored | Only documents already in the index are caught up |

## After the first release

### Clearer errors

Several failures don't yet tell the user what to do. Reading the code suggests these outcomes; they haven't been run on a PC.

| Situation | What happens today | Planned |
| --- | --- | --- |
| Database rules missing or wrong | **Connect** shows nothing, and the tab can stay at `Starting…` when the Bridge loads. A retry may answer `error: already connected` until the Bridge dock is reloaded | A message naming setup step 4, and a clean retry |
| The Firebase library can't load | Reports `error: credentials invalid`, or a false "sign-in needed" popup at start | A message, and a retry |
| The Firebase project was deleted | Not handled separately | A message naming setup step 1 |
| Connect errors | The tab shows the error, such as `error: provider disabled`, with no setup step | Each error names the step to redo |

### Updates

- **One deck after an update.** Installing a new version over an old one leaves a second deck (D33). The deck's id includes the version, and a stable id may fix this, but that hasn't been tested.

### Documentation

- **A launch site, with a screenshot for each Firebase console step.** The shot list is in [docs/guide/images/README.md](docs/guide/images/README.md).
- **Bring the [design board](https://miro.com/app/board/uXjVEUQjpYg=/) up to date** with the decisions since D24.

### Ideas

Recorded so they aren't argued again. None is committed.

- A hosted Firebase preset, so a streamer needs no project of their own (SF-ADR-002)
- A `Firebase: Any Event` trigger for logging decks (SF-ADR-006)
- Import and export as orchestrations (`docs/10-domain-model.md`)
- A nightly run against a sandbox project, if the on-PC tests become a bottleneck (SF-ADR-015)
- A phone-sized page or moderator panel on the same data (`docs/12-design-brief.md`)
- Tab controls for the poll interval, forgetting a project and copying the config, all dropped from the first release (D34)
