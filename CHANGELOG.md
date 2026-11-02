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

- **Connect** can show nothing if the database rules are wrong or the Firebase library can't load.
- Installing a new version over an old one leaves a second deck.
- Create Document with a blank id doesn't return the new id.
- See the [roadmap](ROADMAP.md) for the full list.
