# Reference

Every command has a **Save Variable As** box, and the answers below arrive there. Leave **Async** unticked. Any command can answer with an [error](#errors) instead.

## Names and limits

| Item | Rule |
| --- | --- |
| Collection and field names | Lower-case letters, digits and underscores. Starts with a letter, up to 32 characters |
| Document ids | Letters, digits, underscores and dashes, up to 64 characters |
| Field values | Text or numbers |
| One field | Up to 4 KB |
| One document | Up to 8 KB |
| One answer | Up to 16,000 bytes |

## Commands that write

These need you to be signed in. Otherwise they answer `error: not connected`.

| Command | Boxes | What it does | Answer |
| --- | --- | --- | --- |
| `Firebase: Create Document` | Collection, Id, Fields (JSON) | Creates a document, and refuses if the id exists. A blank id generates one | The fields as JSON |
| `Firebase: Replace Document` | Collection, Id, Fields (JSON) | Writes the whole document, creating it if needed | The fields as JSON |
| `Firebase: Update Document` | Collection, Id, Fields (JSON) | Changes only the fields you list | The whole document as JSON |
| `Firebase: Set Field` | Collection, Id, Field, Value | Sets one field | The value |
| `Firebase: Increment Field` | Collection, Id, Field, By | Adds to a number, and starts from 0 if the field is missing | The new total |
| `Firebase: Delete Field` | Collection, Id, Field | Removes one field | `ok` |
| `Firebase: Delete Document` | Collection, Id | Removes a document | `ok` |

## Queries

These answer from the copy on your PC, whether or not you're connected.

| Command | Boxes | Answer |
| --- | --- | --- |
| `Firebase: Get Document` | Collection, Id, Unpack prefix (optional) | The fields as JSON |
| `Firebase: Get Field` | Collection, Id, Field, Default (optional) | The value, or the default if it's missing |
| `Firebase: Document Exists` | Collection, Id | `true` or `false` |
| `Firebase: List Documents` | Collection | The ids as a JSON array |
| `Firebase: Query Documents` | Collection, Field, Operator, Value, Order by, Descending, Limit | The matching documents as a JSON array |
| `Firebase: Count Documents` | Collection, Field, Operator, Value | The number of matching documents |
| `Firebase: Get Status` | None | The status as JSON: `state`, `email`, `projectId`, `documents`, `pending`, `lastSync`, `deviceId` and any `invalidIni` |

**Filtering:** the operators are `==`, `!=`, `>`, `>=`, `<`, `<=`, `contains` and `exists`. Numbers compare as numbers, even when one is stored as text. `contains` ignores upper and lower case. Leave Field and Operator blank to match everything.

**Sorting:** **Order by** is a field name, or `id`, which is the default.

## Commands for the connection and collections

| Command | Boxes | What it does | Answer |
| --- | --- | --- | --- |
| `Firebase: Connect` | None | Resumes the stored sign-in. A new sign-in needs the password in the tab | `ok` |
| `Firebase: Disconnect` | None | Signs out, and keeps the config, collections and local copy | `ok` |
| `Firebase: Reconcile` | None | Compares this PC with Firebase now. This also happens by itself on every connect and reconnect | `ok` |
| `Firebase: Define Collection` | Collection, Fields, Strict, Two-way | [Declares a collection](using.md#declare-your-collections-optional) | `ok` |
| `Firebase: Undefine Collection` | Collection | Removes the declaration, and keeps the documents | `ok` |

## Triggers

Attach these with **Edit Triggers → Add → Extension Trigger**, and read their values with **Trigger Pull Data**.

| Trigger | Pull values |
| --- | --- |
| `Firebase: Connected` | `email`, `projectId`, `documents` |
| `Firebase: Connection Failed` | `reason` |
| `Firebase: Disconnected` | `reason`: `user`, `network` or `session` |
| `Firebase: Mirror Reconciled` | `pushed`, `applied`, `dropped`, `cause`: `connect` or `command` |
| `Firebase: Collection Defined` | `collection`, `fields`, `strict`, `twoWay` |
| `Firebase: Collection Undefined` | `collection` |
| `Firebase: Document Created` | `collection`, `id`, `fields` |
| `Firebase: Document Replaced` | `collection`, `id`, `fields`, `previous` |
| `Firebase: Document Updated` | `collection`, `id`, `fields`, `previous`, `changed` |
| `Firebase: Document Deleted` | `collection`, `id`, `previous` |
| `Firebase: Write Rejected` | `collection`, `id`, `field`, `reason` |

Every trigger also carries:

| Pull value | Meaning |
| --- | --- |
| `source` | `local` for this PC, or `remote` for another PC or the Firebase console |
| `deviceId` | The device that made the change. An edit in the Firebase console can show `unknown` or the last device's id |
| `eventType`, `eventId`, `timestamp`, `version` | Details of the event |
| `causationId` | The button instance that caused a local change |

`fields`, `previous` and `changed` are JSON text.

In `Firebase: Mirror Reconciled`, `pushed` counts this PC's changes uploaded, `applied` counts changes downloaded, and `dropped` counts offline writes that lost to a newer change. Zeros are normal: `applied` is 0 when the live connection already delivered the change.

## Errors

| Answer starts with | Meaning | What to do |
| --- | --- | --- |
| `error: not connected` | A write was tried while signed out | Connect in the tab |
| `error: already connected` | Connect ran while connected | Nothing, or Disconnect first |
| `error: config incomplete` | The config is missing the named field | Paste the whole block from [step 5](setup.md#step-5-copy-your-config-block) |
| `error: invalid config` | The config isn't a Firebase web-app config | The same |
| `error: credentials invalid` | Wrong email or password, or the session has expired | Enter them again. Check the user exists under [step 2b](setup.md#step-2b-create-your-user) |
| `error: provider disabled` | Email sign-in is off | Redo [step 2](setup.md#step-2-turn-on-email-sign-in) |
| `error: api key invalid` | The project doesn't recognise the key | Copy the config again from [step 5](setup.md#step-5-copy-your-config-block) |
| `error: bad collection name` | The name breaks the [rules](#names-and-limits) | Fix the name |
| `error: bad id` | The id breaks the rules | Fix the id |
| `error: bad field` | The field name breaks the rules | Fix the name |
| `error: unknown field` | The collection is strict, and doesn't list this field | Add it to Define Collection, or fix the name |
| `error: exists` | Create Document used an id already in use | Use Replace Document, or a new id |
| `error: missing` | The document or field isn't there | Check the name, or give Get Field a default |
| `error: not defined` | Undefine Collection named a collection that isn't declared | Check the name |
| `error: too large` | Over a [limit](#names-and-limits) | Split the data, or use a query with a Limit |
| `error: not a number` | Increment Field hit a field that isn't a number | Fix the field or use Set Field |
| `error: bad operator` | Query or Count used an unknown operator | Use one [listed above](#queries) |

## Variables

`fb_<collection>` is a global object: document ids, then fields. It leaves out the `_t` and `_d` stamps. See [Using](using.md#read-with-variables) for how to type it.

## Where the data lives

| Place | Holds |
| --- | --- |
| Firebase | `users/<uid>/collections/<collection>/<id>`, plus `_t` (the writing PC's clock) and `_d` (its device id) on each document |
| `firebase.ini`, in the SAMMI folder | Your config, session, a copy of every document, and writes waiting to upload |

Sections in `firebase.ini` you can read with **INI: Load Text**: `collection:<collection>`, with the document id as the key. Don't edit the other sections.
