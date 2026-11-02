# Troubleshooting

Start with the status line at the top of the Bridge's **SAMMI Firebase** tab. If there's no tab, the extension isn't installed or the Bridge isn't open.

## What the status line means

| Status line | Meaning | What to do |
| --- | --- | --- |
| `Connected as ... · N documents · M pending` | Everything is working | Nothing |
| `OFFLINE, no internet: signed in as ...` | The internet is down. Reads work, and writes wait | Nothing. Pending goes to 0 when the internet returns |
| `Connect needed — buttons read the copy on this PC` | Your sign-in was lost | Enter your password and click **Connect** |
| `Not connected — buttons read the copy on this PC` | You haven't connected, or you disconnected | Enter your email and password and click **Connect** |
| `... invalid JSON ignored in firebase.ini: <document>` | A document in the file isn't valid JSON | Fix what wrote it. Writing that document again replaces the bad copy, and the message clears the next time OBS starts |
| `... with a dash or space in the id: read with commands, not variables` | A large collection's variable leaves those documents out | Read them with commands. See [Large collections](using.md#large-collections) |

**Offline takes time to show.** The status line can say `Connected` for about 30 seconds after the internet drops. Read the whole line, because the pending count is at the end.

## Connecting

**`That does not look like the config block from step 5`**
Copy the whole block again from [step 5](setup.md#step-5-copy-your-config-block), including the braces.

**`error: config incomplete`**
The block is missing a field. If it's `databaseURL`, you created the app before the database. Copy the config again now that the database exists.

**`error: credentials invalid`**
Check the email and password. If they're right, check that the user is listed under **Authentication → Users** and isn't disabled.

**`error: provider disabled`**
Redo [step 2](setup.md#step-2-turn-on-email-sign-in).

**`error: api key invalid`**
Copy the config again from [step 5](setup.md#step-5-copy-your-config-block). It may be from another project.

**Nothing happens when I click Connect**
Check that you did [step 4](setup.md#step-4-set-the-database-rules), and that the rules were published. Blocked database access doesn't show a clear message yet. Then reload the Bridge dock and try again.

**The tab says `Starting…` and stays there**
The extension loads its Firebase library from the internet, so the Bridge needs a connection the first time it loads. Check your internet and reload the dock.

## Installing

**`Bridge must be connected`**
Open the Bridge dock in OBS, wait for it to connect to SAMMI, and install again.

**I have two SAMMI Firebase decks**
This happens when you install a new version over an old one. See [Update to a new version](setup.md#update-to-a-new-version).

**I installed it, but there's no tab**
Right-click inside the Bridge dock and choose **Reload**.

## Buttons

**A variable shows `undefined`, or the text after it looks wrong**
Check the spelling, and that the path includes `global.`:

- White box: `/$global.fb_viewers.alice.points$/`
- Yellow box: `global.fb_viewers.alice.points`

If part of the path comes from another variable, it can't work. Use `Firebase: Get Field`.

**A button stops at a line reading a variable**
The document isn't in the variable. Use `Firebase: Get Field` with a default.

**Save Variable As is empty, and the button carried on**

- Is **Async** ticked on the command? Untick it.
- Is the Bridge open? With it closed, commands get no answer. SAMMI also shows a message saying the Bridge is disconnected.

**A trigger button's values are `undefined`**
You probably used **Run Button**, which sends no trigger data. Cause the real event instead, such as editing the document in the Firebase console. Check the pull value's spelling too, using the [reference](reference.md#triggers).

**SAMMI shows FATAL ERROR, mentioning `ds_map_set` and Set String Variable**
The button set a field on a document that doesn't exist in the variable. Create the document with a Firebase command first. See [Write by setting a variable](using.md#write-by-setting-a-variable).

**A trigger button ran many times in a row**
Changes made while you were offline arrive together. Make the button safe to repeat, or check `source` and `collection` before acting.

## Data

**My edit in the Firebase console disappeared**
Offline writes on a PC usually win over a console edit, because a console edit doesn't change the document's `_t` stamp. To make your edit win, also change `_t` to a larger number.

**Another PC's newer change lost**
The most recent write wins, using each PC's clock. Check that both PCs set their clocks automatically.

**I can't find my data in the Firebase console**
Open **Realtime Database → Data**, then `users` → your user ID → `collections`. Your user ID is listed under **Authentication → Users**.

## Still stuck

[Open an issue](https://github.com/listenrightmeow/sammi-firebase/issues) with the status line, the error text and your SAMMI version. Don't include your config block, your password or `firebase.ini`. To report a security problem, follow [SECURITY.md](../../SECURITY.md).
