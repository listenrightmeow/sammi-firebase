# Using SAMMI Firebase

Your data is organised as **collections** of **documents**, and each document has **fields**. For example, the `viewers` collection could have a document `alice` with the fields `points` and `tier`.

You'll do four things with it:

| To | Use |
| --- | --- |
| Read a value | A variable, such as `/$global.fb_viewers.alice.points$/` |
| Read a value chosen at run time | `Firebase: Get Field` |
| Write a value | A Firebase command in your button |
| React to a change | An extension trigger on your button |

## Declare your collections (optional)

You can write to a collection without declaring it. Declare one when you want to limit its fields or turn off writing through variables.

Add `Firebase: Define Collection` to a button that runs at startup. The deck's **Firebase Startup** button shows how, and waits 20 seconds so OBS and the Bridge are ready first. Change its two examples to your own collections.

| Box | What it does |
| --- | --- |
| **Collection** | The collection's name |
| **Fields** | Its field names, separated by commas |
| **Strict** | `true` refuses any field not listed. `false` allows any field |
| **Two-way** | `true` lets a button write by setting the variable. `false` means those writes aren't saved: the value sits in the variable, with no error, until the extension next rewrites it |

Declarations are saved to Firebase, so another PC picks them up when it connects.

## Read with variables

Every collection appears as a global variable named `fb_<collection>`, with no command needed. How you type it depends on the box:

| Box in SAMMI | Type |
| --- | --- |
| White box (text, such as an alert message) | `/$global.fb_viewers.alice.points$/` |
| Yellow box (such as an If condition) | `global.fb_viewers.alice.points` |

Both need the `global.` part.

- **A variable inside a path doesn't work.** SAMMI won't resolve `/$global.fb_viewers./$userId$/.points$/`. Use `Firebase: Get Field` when the document or field is chosen at run time.
- **A missing path stops the button.** If the document might not exist, use `Firebase: Get Field` with a default.
- **Variables reset when SAMMI restarts.** The extension writes them again when it connects. If you restart SAMMI while OBS stays open and a variable is missing, reload the Bridge dock.

## Read with commands

Use these when you need a default, a search or a count. They read the copy on your PC, so they answer straight away, even when you're offline or signed out. See the [reference](reference.md#queries) for all of them.

Put a variable name in **Save Variable As**, and read the answer from it on the next line:

1. `Firebase: Get Field`: Collection `viewers`, Id `/$userId$/`, Field `points`, Default `0`, Save Variable As `points`
2. Alert: `You have /$points$/ points`

To get a whole document as separate variables, fill in **Unpack prefix** on `Firebase: Get Document`. With the prefix `v`, the fields arrive as `v_points` and `v_tier`, with one underscore between the prefix and the field name.

## Write with commands

Add a Firebase command to any button. Boxes accept variables, so one button can serve every viewer:

1. `Firebase: Increment Field`: Collection `viewers`, Id `/$userId$/`, Field `points`, By `10`, Save Variable As `points`
2. Alert: `You now have /$points$/ points`

The answer is the new value, so you don't need to read it again.

**Two rules for every Firebase command:**

- **Leave Async unticked.** Otherwise the button carries on before the answer arrives.
- **Fill in Save Variable As.** That's what makes the button wait for the answer. Errors arrive here too, as text starting with `error:`.

An answer means the write is saved on this PC. It reaches Firebase moments later, or when you're next online.

## Write by setting a variable

In a collection with two-way on, setting a field in the variable writes it to Firebase. Use **Set String Variable** with the name `global.fb_viewers.alice.tier`.

- **Only set fields on documents that already exist.** Setting a field on a missing document can crash SAMMI with a FATAL ERROR. Create documents with a Firebase command.
- **The value is written as text.** To keep a number as a number, use a Firebase command.
- **A refused write snaps back.** In a strict collection, an unknown field disappears from the variable and `Firebase: Write Rejected` fires. In a collection over 16,000 bytes, the variable currently stays wrong and the trigger can repeat ([roadmap](../../ROADMAP.md)).
- **You have to be connected.** Variable writes made while signed out or with the Bridge closed aren't picked up, and the next connect overwrites them.
- **Removing a field from the variable deletes it** from the document.
- **The write isn't instant.** It's picked up within about a second. In a collection over 16,000 bytes, it can take longer: about 25 seconds at 500 documents.

### Edits in the Firebase console

Field values must be text or numbers. If a console edit adds a true/false value or a nested object, the extension silently ignores the whole document.

## React to changes

1. Right-click your button and choose **Edit Triggers**.
2. Choose **Add**, then **Extension Trigger**.
3. Enter the trigger's name, such as `Firebase: Document Updated`, and save.
4. In the button, use **Trigger Pull Data** to read what happened. For example, Pull Value `source`, saved as `fbSource`.

The deck's two **Policy** buttons are examples, with their triggers left for you to attach.

**Good to know:**

- **Run Button doesn't send trigger data.** Run directly, a trigger button's pulled values come back `undefined`. Test it by causing the real event.
- **`source` tells you where a change came from.** `local` means this PC, and `remote` means another PC or the Firebase console.
- **Changes can arrive in a burst.** After an automatic reconnect, a trigger button can run several times in a row.
- **Signing in doesn't replay changes.** Changes downloaded when you sign in or start the Bridge fire only `Firebase: Mirror Reconciled`.

See the [reference](reference.md#triggers) for every trigger and what it carries.

## When things go offline

| What happened | Reads | Writes |
| --- | --- | --- |
| **Internet down** | Keep working | Answer straight away, and upload when the internet returns. The tab shows `OFFLINE` and a pending count, usually about 30 seconds after the drop |
| **Signed out** | Commands keep working. Variables keep their values, but aren't rewritten if SAMMI restarts | Answer `error: not connected` |
| **OBS or the Bridge closed** | Firebase commands get no answer, but variables keep their values until SAMMI restarts | Firebase commands do nothing |

**Starting OBS with no internet hasn't been tested yet.** The Bridge fetches the Firebase library as it loads, so it may show a false "sign-in needed" message. If it does, reload the dock when the internet is back.

### If two places changed the same document

What happens depends on the command you ran while offline:

| Offline command | When the internet returns |
| --- | --- |
| Create Document, Replace Document | The newer write wins, using each PC's clock. Keep your PCs' clocks set automatically |
| Update Document, Set Field, Increment Field, Delete Field, Delete Document | Your change is always applied, on top of whatever Firebase now holds |

Changes to different fields of a document, made while both PCs are online, are both kept. Tests with a second real PC are [still to come](../../ROADMAP.md).

### Keep a button working with the Bridge closed

With the Bridge closed, a Firebase command answers nothing and the button carries on. To read the local copy instead, follow the deck's **Example: Get with fallback** button:

1. Before the command, set the variable you'll name in **Save Variable As** to empty.
2. Run `Firebase: Get Document`.
3. If that variable is still empty, use **INI: Load Text** with file `firebase.ini`, section `collection:<collection>` and key `<id>`.

The text you get is the document as JSON, including its `_t` and `_d` stamps.

### Write with the Bridge closed

Use **INI: Save Text** with the same file, section and key, and valid JSON of the document's fields. This works only for documents that already exist; a new one is ignored. When OBS next opens, the extension uploads the change, and this PC's version wins. A popup says how many changes it pushed. Deleting a document this way isn't supported.

If the JSON isn't valid, the extension ignores it and the tab names the document.

## Large collections

No single message to SAMMI goes over 16,000 bytes. A larger collection still works, with these differences:

- **Variable writes are slower** to arrive, as described above.
- **Ids with a dash are left out of the variable,** and the tab tells you how many there are. Variables can't reach these ids in a smaller collection either, so read them with commands. Ids from `Firebase: Create Document` can contain dashes, so choose your own ids for documents you'll read as variables.
- **An answer over the limit is `error: too large`.** Use `Firebase: Query Documents` with a **Limit**.

## Keep your data safe

- **`firebase.ini`** in your SAMMI folder holds your config, your sign-in session and a copy of your documents. Don't share it or show it on stream.
- **Your config block** identifies your project. Your database rules are what protect the data, so make sure you did [step 4](setup.md#step-4-set-the-database-rules). Keep it private anyway.
- **Don't store secrets as values,** such as API keys for other services. Values aren't encrypted beyond what Firebase provides.
