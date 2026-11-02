# Roadmap

What comes after the first release. Decisions behind these items are in [docs/01-decision-record.md](docs/01-decision-record.md).

## Next

### Setup guide test

T-I1: someone new follows the setup guide in under 15 minutes (D35).

### Second PC

Run T-S1, T-L3 and T-L4 with a second real PC (D35). Sharing data between PCs is designed and covered by the specs, but hasn't been tested on two real machines.

### Clearer errors

Several failures don't yet tell the user what to do. These outcomes come from reading the code, and haven't been run on a PC.

| Situation | What happens today | Planned |
| --- | --- | --- |
| Database rules missing or wrong | **Connect** shows nothing, and the tab can stay at `Starting…` when the Bridge loads. A retry may answer `error: already connected` until the Bridge dock is reloaded | A message naming setup step 4, and a clean retry |
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
