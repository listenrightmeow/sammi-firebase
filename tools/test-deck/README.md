# On-PC test deck

A separate deck for the Layer 3 cases in `docs/09-test-plan.md`. Reinstalling SAMMI Firebase leaves it in place. It is never shipped in a release.

## Install

1. Run `pnpm build:pc`, which gives both files the same build stamp.
2. Install `dist/sammi-firebase.sef`, then connect in the **SAMMI Firebase** tab.
3. Install `dist/sammi-firebase-tests.sef`. A **SAMMI Firebase Tests** deck appears.

**Before testing, check the stamp.** The **SAMMI Firebase** tab heading and the test deck's name must both show the stamp `pnpm build:pc` printed. Anything else means an older file is installed.

To run a button, double-click it and press **Run Button**. Each one finishes with an alert that starts with its case id and says what to expect. T-C8 also shows one alert from each helper.

## Commands (green)

| Button | Pass when the alert shows | Also check |
| --- | --- | --- |
| T-C1 | `replace={"n":1}` and `get={"n":1}` | Console: `collections/test/a` has `n`, `_t`, `_d` |
| T-C2 | `none` | |
| T-C3 | `finished 50 reads`, under a second after pressing | Run T-C1 first |
| T-C4 | `error: too large` | |
| T-C5 | `error: bad collection name` | |
| T-C6 | `first=` succeeded, `exists=false`, `second=error: missing` | Console: `test/del` is absent |
| T-C7 | State, email, project, document count, pending count | |
| T-C8 | `2` | Console: `test/count/n` is `2` |
| T-C9 | The new id in `created=`, and last in `list=` | |
| T-C10 | `set=error: unknown field` | |
| T-C11 | `p4` (55), then `p2` (60), and nothing else | |
| T-C12 | `points=7 tier=gold` | |

## Variables and INI (blue)

Run T-C1 first. These read `test/a`, and a missing path stops the button.

| Button | Pass when the alert shows | Notes |
| --- | --- | --- |
| T-V1 T-V2 | `1` | Then edit `n` under `test/a` in the console and run it again: the new value within 2 seconds |
| T-V4 | Two alerts with the same total, 10 higher each run | The second reads through `Firebase: Get Field`, because SAMMI does not resolve a variable nested in a path |
| T-D1 | The document as JSON, including `_t` and `_d` | Run with OBS closed too |
| T-R1 | `ok` | Change `test/a` in the console while disconnected and reconnect. Then run **T-V1 T-V2**: it shows your edit |
| T-R1 Counts (trigger) | `cause=` and three numbers | Attach the Extension Trigger `Firebase: Mirror Reconciled` to this button first, then never run it directly: a direct run has no trigger data, so everything is `undefined`. Run **T-R1** for `cause=command` with zeros, or edit `test/a` while disconnected and reconnect for `cause=connect` with `applied=1` |

## Offline (orange)

| Button | Steps | Pass when |
| --- | --- | --- |
| T-O1 | Disable the PC's network, run the button, re-enable | The alert appears straight away with `set=2 get=2`, and the tab shows 1 pending. After re-enabling, pending goes to 0 and the console shows `test/b` |
| T-O3 | Disable the network, run the button, wait for `OFFLINE` first, on another device change `n` under `test/b` to `99` and add 3600000 to `_t` (one hour, so it is newer than this write), re-enable | The alert appears straight away with `{"n":3}`. After re-enabling, `test/b` stays `99` in the console, and the tab's pending goes to 0. **T-V1**-style reads of it show `99` |
| T-B5 | Disable the network, run the button, re-enable | The alert appears straight away with `m` in it. Pending goes 1 then 0, and the console shows `m`. No disconnect message appears |

The two grey helper buttons are run by T-C8. Don't run them directly.

## Variables, own writes and scale (purple)

Attach the triggers once, in SAMMI: right-click **Watch Updated** > **Edit Triggers** > **Add** > **Extension Trigger**, and type `Firebase: Document Updated`. Do the same on **Watch Rejected** with `Firebase: Write Rejected`. Never run the two Watch buttons directly.

| Button | Pass when |
| --- | --- |
| T-L2 | One **Watch: Updated** alert with `source=local`, then the T-L2 alert |
| T-V5 | One **Watch: Updated** alert with `source=local`, then `fromvariable`. Console: `test/two/note` is `fromvariable` |
| T-V6 | One **Watch: Rejected** alert naming `unknown field`, then the document with no `b` |
| T-V7 | `stored=start variable=start`. Console: `oneway/a/n` is `start` |
| T-V3 Clear | `0`. Run it before T-V3 |
| T-V3 | `8` and `start`, then one **Watch: Updated** alert, then `fromvariable`. Console: `collections/large` has 8 documents |

These set text, because Set String is the variable command this deck has confirmed on hardware. T-V5 and T-V7 use their own documents so the other cases keep `test/a`.

## Bridge closed (red)

Close OBS first, and leave SAMMI open.

| Button | Then | Pass when |
| --- | --- | --- |
| T-B3 | Edit `test/a` in the console, then open OBS | One popup: `Back online: 1 local change pushed, ...`. Console: `test/a` has `n` = `33`. One **Watch: Updated** alert with `source=local` |
| T-B4 | Open OBS | The tab's status line ends `invalid JSON ignored in firebase.ini: test/a`. Console: `test/a` is unchanged |

After T-B4, run **T-C1** to overwrite `test/a`, then close and reopen OBS. The status line clears.

## Not on this deck

These have no button, because they are about installing, the tab or a second PC: T-I1, T-I2, T-I4, T-K1, T-P1 to T-P4, T-A3, T-L1, T-L3, T-L4, T-S1, T-B1, T-B2 and T-U1.
