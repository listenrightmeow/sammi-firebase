# Failure modes

What goes wrong, what the user sees, what the extension does, and what the deck author can do. "Verified" points at the verification list or the prototype results.

| # | Situation | User sees | Extension does | Deck author | Verified |
| --- | --- | --- | --- | --- | --- |
| 1 | Bridge not open when a button runs a Firebase command or query | SAMMI output: "Bridge disconnected"; the Save Variable is absent; the button continues at once | nothing, it is not running | `If var is empty` → `INI: Load Text` from `firebase.ini`, section `collection:<name>`, key `<id>` → `Parse`; to write, `INI: Save Text` the JSON to the same key | S15, test 6b; D10; D24 |
| 1b | Bridge reopened after local edits | One alert: "Back online: N local changes pushed, M remote changes applied"; `Document Updated` events with `source: local` for the pushed ones | hash every ini document against `[index] hashes`, queue the changed ones as pending replaces stamped now, push, then reconcile | nothing | D10; data model rule 7 |
| 2 | Extension answers too slowly (box timeout) | Save Variable absent after the timeout; button continues | always answers within the timeout; a late answer still lands (harmless) | same as 1 | S15, test 4 |
| 3 | No internet | Tab: `OFFLINE, no internet: signed in as ...` with a pending count, about 30 seconds after the drop; buttons unaffected | queries from the mirror; commands to the mirror and `[pending]`; reconcile on reconnect | nothing | D5; F8 (own queue); T-O1 to T-O3 |
| 4 | Internet returns after offline edits on both machines | Document events arrive in a burst, `source: remote` | document-level last write wins by `_t` (D30); field merges happen on the server; losing `create`/`replace` replays dropped and announced | expect bursts; check `source` before reacting | D5; data model rules 2 and 4 |
| 5 | Session lost (profile cleared, password changed, user deleted) | Tab: "Connect needed"; one SAMMI alert; `Disconnected` event with reason `session` | restore the session record from the ini first; if that fails, wait for Connect; mirror keeps serving | a policy on `Firebase: Disconnected` can alert | 05-auth-flow |
| 6 | Wrong config pasted | Tab: `error: config incomplete <field>`, `error: invalid config`, or a message that it is not the config block | validates `apiKey`, `authDomain`, `projectId`, `appId`, `databaseURL` before touching the SDK | nothing | probe round trip (config parsing) |
| 7 | Security rules not pasted, or database left in test mode past 30 days | From reading the code: **Connect** shows nothing, and a retry may answer `error: already connected` until the dock is reloaded. A clearer message is on the roadmap (D34) | the error is not caught | nothing | not run on a PC |
| 8 | Email/Password provider not enabled, or user not created | Tab: `error: provider disabled` or `error: credentials invalid`. `Connection Failed` fires | `ConnectionFailed` event | | 05-auth-flow |
| 9 | Document over 8 KB after merge, or a field over 4 KB | command answers `error: too large` | refuses, nothing written | split into more documents | S12 |
| 10 | Bad collection, id or field name; unknown field in a strict collection; `Create` on an existing id; `Increment` on a non-number | command answers `error: <reason>` | refuses, emits no event | fix the deck | domain model invariants |
| 11 | Two Bridges open ("Second Bridge tried to connect") | SAMMI's own error | the second instance never connects, so it never runs | close the extra Bridge | SAMMI docs |
| 12 | SAMMI older than 2025.2.0 | Install refused with SAMMI's version message | `sammi_version` in `[insert_over]` | update SAMMI | S5, S13 |
| 13 | Bridge not connected at install | Install refused | `"bridge": true` in `[insert_over]` | open the Bridge first | S13 |
| 14 | User ticks Async on a Firebase command | Save Variable absent, button continues at once | nothing it can do | untick Async; README rule 1 | prototype 2 runs 1 and 2 |
| 15 | Firebase SDK fails to load (gstatic blocked, no internet at Bridge start) | Tab: `error: no internet` on Connect, or `Not connected` at start, with no sign-in popup. The mirror serves reads | reports `no internet`, keeps the session | reload the dock when the internet is back | D35; T-O4 |
| 16 | Free-tier quota exceeded (100 simultaneous connections, 10 GB/month) | Firebase refuses the connection | treat as offline | practically unreachable for one streamer's settings | F6 |
| 17 | OBS dock hidden | nothing, it keeps working | nothing | nothing | O8 |
| 18 | Extension update installed | Bridge reloads; mirror and auth resume from ini | reads every earlier schema | nothing | D8 |
| 20 | A bound-variable write violates an invariant (unknown field in a strict collection, too large, bad value) | the variable snaps back to the mirror's value within one poll; `Firebase: Write Rejected` fires with the reason | reverts the variable, emits the event, writes nothing | a policy on Write Rejected can alert | H5 ruling; data model rule 8 |
| 21 | Two-way collection grows past one message (16,000 bytes) | Chains replace the whole-variable message; a variable write takes up to about 25 seconds at 500 documents; ids with a dash or space are left out of the variable and the tab says so | chained publish and paged poll (D32) | read those ids with commands; turn off two-way or use commands for big collections | S12, S18, D32 |
| 19 | Project deleted in the console | From reading the code: the same as row 7. A message naming setup step 1 is on the roadmap (D34). The mirror keeps serving | mirror keeps serving; nothing is lost locally | the ini is a readable backup | not run on a PC |

## Principles behind the table

- **The mirror always serves queries.** Every row above leaves the queries working, Bridge permitting. Loss of the cloud is never loss of a stream.
- **The extension always answers.** A command that cannot do its job answers `error: …` within the timeout rather than letting the box time out, so a deck can tell "failed" from "Bridge closed".
- **The setup guide numbers its steps** so errors can name the step to redo. They do not do that yet (roadmap, D34). `docs/guide/reference.md` maps each error to its step.
- **A deck that sets a field on a document missing from the variable crashes SAMMI** ("FATAL ERROR ... ds_map_set", found by T-V3). SAMMI's own Set String does this before the extension is involved. Write new documents with a Firebase command, not a variable.
- **No silent data loss.** A dropped replay (rule 4) is announced through `Document Updated` with `source: remote`, so a policy can at least alert.

## Not handled in the MVP, by decision

- New documents written with `INI: Save Text` while the Bridge is closed. The Bridge helper reads one key at a time (S10), so the extension can only find ids already in `[index]`.
- Deletes while the Bridge is closed. Updates and replaces through `INI: Save Text` are caught up on start (D10); a document removed from the ini by hand is not.
- Merge of concurrent `Replace`/`Create` of the same document beyond last write wins. Field-level updates and increments merge on the server already.
- Encryption of values at rest beyond what Firebase provides. Secrets such as API keys for other services should not be stored as values; the usage guide says so.
