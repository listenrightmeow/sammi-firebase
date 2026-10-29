# Discovery: OBS dock probe

`obs-dock-probe.html` is a single self-contained page. Loaded the same way SAMMI Bridge is loaded, as an OBS Custom Browser Dock, it reports what that environment can and cannot do. It answers the **Assumed** rows in `docs/02-verification-list.md` (S14, O5, O6, O7, F2, F7).

It needs a Windows PC with OBS Studio. SAMMI does not need to be running. Nothing leaves the machine unless you fill in the optional Firebase section.

## Part 1. Baseline in a normal browser (2 minutes)

1. Copy `obs-dock-probe.html` to the Windows PC, for example to the Desktop.
2. Double-click it. It opens in your default browser from a `file:///` address, which is the same kind of address OBS will use.
3. Wait until the "Starting…" line disappears and the table fills in. Take a screenshot. This is the Chromium baseline to compare the OBS result against.

## Part 2. Inside an OBS dock (3 minutes)

1. Open OBS Studio. In the menu bar: **Docks** → **Custom Browser Docks…**
2. In the table that opens, type `Probe` in the Dock Name column and the file's full path in the URL column, for example `C:\Users\you\Desktop\obs-dock-probe.html`. Press **Apply**, then **Close**.
3. A dock named Probe appears. If it does not, use **Docks** → **Probe** to show it. Drag its edge to make it taller so the whole table is visible.
4. Wait for the table. If the yellow "Starting…" line stays for more than ten seconds, that is itself the result: the dock cannot run the page's script. Screenshot it.
5. Screenshot the table. Expand **Raw environment** at the bottom and screenshot that too; it contains the Chromium version OBS uses.
6. Note the OBS version: **Help** → **About**.

What the rows mean:

| Row | Expected | If it says NO |
| --- | --- | --- |
| Running inside OBS | YES | The file is open in a browser, not in OBS. Redo Part 2. |
| localStorage, sessionStorage | YES | Design still works; the mirror is a SAMMI ini file. Record it. |
| IndexedDB open | NO is expected | Confirms the design decision to avoid IndexedDB. |
| window.open | NO is expected | Confirms Google popup sign-in is impossible here. |
| CORS fetch to Firebase Auth REST | YES with an HTTP 400 and an API key error | NO means the dock cannot reach Google at all. Check the PC's internet, then report. |
| CDN reachable | YES | NO means the Bridge itself would fail to load here too. |
| Firebase JS SDK loads | YES | NO blocks the whole approach. Report the error text. |
| Auth initializes with localStorage persistence | YES | Report the error text. |
| Email/password sign-in call reaches the server | YES with `auth/api-key-not-valid` | `auth/operation-not-supported-in-this-environment` would be bad news. Report it. |
| Google popup sign-in | NO with `auth/operation-not-supported-in-this-environment` | Expected. |

## Part 3. Real Firebase round trip (15 minutes, optional but valuable)

This proves sign-in, a write, a read and a live listener from inside the dock, which is the whole architecture. It uses a throwaway Firebase project. Delete it afterwards if you like.

### Create the throwaway project

1. Go to https://console.firebase.google.com and sign in with any Google account.
2. **Create a project**. Name it `sammi-probe`. Turn **off** Google Analytics when asked. Create, then Continue.
3. Left menu: **Build** → **Authentication** → **Get started**. On the **Sign-in method** tab choose **Email/Password**, switch **Enable** on, **Save**.
4. Still in Authentication, open the **Users** tab → **Add user**. Enter a throwaway email such as `probe@example.com` and a password you will type into the probe. **Add user**.
5. Left menu: **Build** → **Realtime Database** → **Create Database**. Pick the location nearest you, choose **Start in test mode**, **Enable**. Test mode allows reads and writes for 30 days, which is fine for a probe.
6. Copy the database URL shown above the empty data tree. It looks like `https://sammi-probe-default-rtdb.firebaseio.com` or `https://sammi-probe-default-rtdb.europe-west1.firebasedatabase.app`.
7. Click the gear next to **Project Overview** → **Project settings**. Scroll to **Your apps** → click the **</>** (Web) icon. Nickname `probe`, do not tick Firebase Hosting, **Register app**. Copy the whole `const firebaseConfig = { ... };` block that appears. **Continue to console**.

### Run it

1. In the Probe dock (or the browser tab from Part 1, to compare), expand **Optional: real Firebase round trip**.
2. Paste the config block exactly as copied. If it does not contain a `databaseURL` line, add one using the URL from step 6, in the form `databaseURL: "https://...",`.
3. Enter the email and password from step 4. Click **Run Firebase round trip**.
4. Expected log:

   ```
   1. auth initialized (localStorage persistence)
   2. signed in as uid XXXXXXXX
   3. listener attached
      listener fired (#1): null
   4. write acknowledged by server
      listener fired (#2): {"wroteAt":"...","from":"obs-dock-probe"}
   5. read back: {...}
   DONE. Now edit probe/XXXXXXXX in the Firebase console; ...
   ```

5. Back in the Firebase console, **Realtime Database** → **Data**. Expand `probe` → the uid → click the `wroteAt` value, change it to anything, press Enter. Within a second or two a new `listener fired (#3)` line with your edit should appear in the dock. That line is the "cloud edit notifies the Bridge" behavior.
6. Screenshot the log.

If a step fails, the log says `FAILED:` with Firebase's error code. The most likely ones: `auth/invalid-credential` means a typo in the email or password; `PERMISSION_DENIED` means the database is not in test mode; a hang at step 4 means the database URL is wrong or websockets are blocked.

## Part 4. Record the results

Create `discovery/results/` and save:

- The screenshots from Parts 1, 2 and 3.
- A short `notes.md` with the OBS version, the Chromium version from Raw environment, the date, and anything unexpected.

Then send the screenshots. The architecture document waits on these results.

## Cleanup

Remove the Probe dock in OBS via **Docks** → **Custom Browser Docks…** → the **X** on the Probe row → Apply. Delete the Firebase project if you do not want to keep it: Project settings → General → scroll to the bottom → **Delete project**.
