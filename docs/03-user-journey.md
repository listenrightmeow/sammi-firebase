# User journey

Who the user is, what they do, and how many steps each thing takes. Every step a user must perform is counted and must earn its place. Command names follow [10-domain-model.md](10-domain-model.md).

The user is a streamer who installs things by clicking. They may never have opened a developer console. They already run SAMMI with the Bridge as an OBS dock, because that is step 5 of SAMMI's own getting-started guide.

## Journey 1. First-time setup, one machine

Target: under fifteen minutes, with screenshots for every console step. Steps 1 to 6 happen once per user, ever.

| # | Where | What the user does | Why it exists |
| --- | --- | --- | --- |
| 1 | Firebase console | Create a project (name it anything, Analytics off). | Users own their data (D2). |
| 2 | Firebase console | Authentication → Get started → Email/Password → Enable → Save. | The only sign-in that works from the Bridge (D4, verified F1). |
| 2b | Firebase console | Authentication → Users → Add user: an email and a password. | No account management in the extension (D9); the user is created here. |
| 3 | Firebase console | Realtime Database → Create → nearest location → start in **locked** mode. | The store (D3). Locked mode because step 4 replaces the rules. |
| 4 | Firebase console | Rules tab → select all → paste the rule set from our README → Publish. | Each user may only read and write their own subtree (F9). |
| 5 | Firebase console | Project settings → Your apps → Web → Register → copy the config block. | The extension needs the API key, auth domain, project id, app id and database URL. |
| 6 | SAMMI Core | Bridge → Install an Extension → pick the `.sef`. | Standard SAMMI install (S2). The SAMMI Firebase tab appears in the Bridge and a small deck is added. |
| 7 | Bridge, SAMMI Firebase tab | Paste the config block into the one big box. The tab says what is missing if anything is. | Validation is the extension's job, not the user's. |
| 8 | Bridge, SAMMI Firebase tab | Type the email and password from step 2b, click **Connect**. The tab shows "Connected as …". | `Connect` command; stored session resumes on later starts. |

Done. The status line in the tab is green. Steps 1 to 5 are the floor set by D2 and D9 and must be documented with one screenshot each.

## Journey 2. Using it inside the buttons the streamer already has

There are no Firebase buttons to build. A deck declares its shape once, in its startup button; after that the data is variables, and writes are single commands dropped into existing buttons.

```
Startup button (once per deck):
  Firebase: Define Collection   name: example   fields: ip, scene_1   strict: yes

The streamer's existing cheer button, one line added:
  Firebase: Increment Field     collection: viewers   id: /$user$/   field: points   by: /$bits$/

Any button, reading a static document, no command at all:
  /$fb_example.settings.ip$/

The same cheer button, reading the viewer it just updated:
  the Increment Field command answered with the new total (Save Variable As: points)
  or, elsewhere: /$fb_viewers./$userId$/.points$/
```

Reading is a variable. `fb_<collection>` is a global object variable the extension keeps current; a document is `fb_example.settings`, a field is `fb_example.settings.ip`. People are keyed by the provider's user id, which arrives in the trigger, so their paths are dynamic: nested resolution `/$fb_viewers./$userId$/.points$/`, or simply the value the write command answered with. Writing is one of the commands embedded where the data changes: `Set Field`, `Increment Field`, `Update Document`, `Create Document`, `Delete Document`. `Query Documents`, `Count Documents` and `Get Document` with unpacking exist for lists, leaderboards and anyone who prefers local variables.

| Step | What happens | Verified by |
| --- | --- | --- |
| Button reads `/$fb_example.settings.ip$/` | A plain variable read; the extension rewrote it on the last change. | S16 (to verify: object variables via setVariable) |
| Button runs a query | Button pauses, extension answers from the local mirror in a few milliseconds, button continues. | S6, prototype 2 tests 1 to 3 |
| Button runs a command | Button pauses, extension validates, writes the mirror and the ini, acknowledges, fires the event, then sends to Firebase in the background. | S6; D5 |
| Someone edits the document in the Firebase console or on another PC | Extension updates the mirror and fires `Firebase: Document Updated` with `source: remote`. A button with that trigger is the policy. | F7; S11 |
| Bridge is closed | `fb_<collection>` variables keep their last values for the SAMMI session (they are SAMMI's own globals); after a SAMMI restart they are absent until the Bridge returns. A query command continues at once with the Save Variable absent. The bundled example shows the fallback: If `exampleSettings` does not exist → Trigger Button `fbLocalNotice` (one popup: "using the local copy") → `INI: Load Text` from `firebase.ini`, section `collection:example`, key `settings` → Parse. A deck may also write the document back with `INI: Save Text`; the extension pushes it when the Bridge returns. | S15 test 6b; D6; D10 |

Rules the user must know, stated in the README in this order:

1. Leave the **Async** box on Firebase commands unticked. The bundled deck has it unticked; a command added by hand defaults to unticked too (SAMMI 2025.2.0 setting "Async is sync", default on).
2. Collections and fields are lower-case names: `viewers`, `points`. Document ids may also have capitals and dashes.
3. Fields are text or numbers. A whole document goes in and out as JSON text; `Parse` and SAMMI's string commands handle it.

## Journey 3. Second machine, or a fresh install after a disaster

The reason the project exists.

| # | Where | What the user does |
| --- | --- | --- |
| 1 | SAMMI Core | Install the `.sef`. |
| 2 | Bridge, SAMMI Firebase tab | Paste the same config block (the README tells them to keep a copy; the tab also offers **Copy config** on the first machine). |
| 3 | Bridge, SAMMI Firebase tab | Email and password, **Connect**. |
| 4 | | The extension pulls every collection, writes the mirror, and the status line says how many documents it restored. Decks that use the queries work immediately. |

Four steps, about two minutes, no console visit.

## Journey 4. Day to day

- OBS starts, the Bridge dock loads, the extension signs in silently from its stored session (D4), reconciles with the cloud, and shows green. Nothing to click.
- If the session is gone (OBS profile reset, password changed), the tab shows a red line "Connect needed" and SAMMI shows one alert. Queries keep working from the mirror in the meantime.
- If OBS was closed during a session and a deck wrote documents locally, the next Bridge start shows one alert with how many were pushed. Nothing to do.
- Updates: the Bridge's Extensions tab shows an Update button when we publish a new version (S9). The user downloads the `.sef` and installs it again. Data is untouched.

## What the user never does

- Open a browser developer console.
- Edit a JSON file.
- Create a Google Cloud service account, OAuth client, or billing account. The Firebase free tier covers this use (F6).
- Configure anything per deck except, optionally, the deck's own collections.
