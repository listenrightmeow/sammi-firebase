# Changelog

This project follows [Semantic Versioning](https://semver.org/). Dates are added when a version is released.

## Unreleased

First release, in preparation. See the [roadmap](ROADMAP.md) for what's left.

### Added

- 19 Firebase commands and queries, and 11 triggers.
- Collections as global SAMMI variables, with writes through the variable for two-way collections.
- A local copy in `firebase.ini`, so reads work offline, signed out, and with the Bridge closed.
- A bundled deck with seven example buttons.
- A setup guide, usage guide, reference and troubleshooting guide.

### Known issues

- **Connect** can show nothing if the database rules are wrong.
- Installing a new version over an old one leaves a second deck.
- Sharing data between PCs hasn't been tested on two real machines.
- See the [roadmap](ROADMAP.md) for the full list.
