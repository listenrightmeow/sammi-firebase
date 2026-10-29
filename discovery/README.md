# Discovery: OBS dock probe

`obs-dock-probe.html` (currently v3; the version is printed under the title) is a single self-contained page. Loaded the same way SAMMI Bridge is loaded, as an OBS Custom Browser Dock, it reports what that environment can and cannot do. It answers the **Assumed** rows in `docs/02-verification-list.md` (S14, O5, O6, O7, F2, F7).

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
| IndexedDB open | YES (observed Oct 28, 2026; the research said NO) | Either answer is fine; the design does not use IndexedDB. |
| window.open | YES (observed Oct 28, 2026; the research said NO) | NO would rule out Google popup sign-in. |
| CORS fetch to Firebase Auth REST | YES with an HTTP 400 and an API key error | NO means the dock cannot reach Google at all. Check the PC's internet, then report. |
| CDN reachable | YES | NO means the Bridge itself would fail to load here too. |
| Firebase JS SDK loads | YES | NO blocks the whole approach. Report the error text. |
| Auth initializes with localStorage persistence | YES | Report the error text. |
| Email/password sign-in call reaches the server | YES with `auth/api-key-not-valid` | `auth/operation-not-supported-in-this-environment` would be bad news. Report it. |
| Google popup sign-in | "popup window opened" with `auth/api-key-not-valid` (observed Oct 28, 2026). It means the SDK does not refuse popups here. Whether a real sign-in completes is Part 3, step "Google". | NO with `auth/operation-not-supported-in-this-environment` would rule Google sign-in out. `auth/argument-error` means you are running probe v1; use the current file. |

## Part 3. Real Firebase round trip (15 minutes, optional but valuable)

This proves sign-in, a write, a read and a live listener from inside the dock, which is the whole architecture. It uses a throwaway Firebase project. Delete it afterwards if you like.

### Create the throwaway project

1. Go to https://console.firebase.google.com and sign in with any Google account.
2. **Create a project**. Name it `sammi-probe`. Turn **off** Google Analytics when asked. Create, then Continue.
3. Left menu: **Build** → **Authentication** → **Get started**. On the **Sign-in method** tab choose **Email/Password**, switch **Enable** on, **Save**.
4. Still in Authentication, open the **Users** tab → **Add user**. Enter a throwaway email such as `probe@example.com` and a password you will type into the probe. **Add user**.
5. Left menu: **Build** → **Realtime Database** → **Create Database**. Pick the location nearest you, choose **Start in test mode**, **Enable**. Test mode allows reads and writes for 30 days, which is fine for a probe.
6. Copy the database URL shown above the empty data tree. It looks like `https://sammi-probe-default-rtdb.firebaseio.com` or `https://sammi-probe-default-rtdb.europe-west1.firebasedatabase.app`.
7. Optional, for the Google sign-in test: back in **Authentication** → **Sign-in method** → **Add new provider** → **Google** → switch **Enable** on, pick a support email when asked, **Save**.
8. Click the gear next to **Project Overview** → **Project settings**. Scroll to **Your apps** → click the **</>** (Web) icon. Nickname `probe`, do not tick Firebase Hosting, **Register app**. Copy the whole `const firebaseConfig = { ... };` block that appears. **Continue to console**.

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
7. **Google.** Click **Try Google sign-in with this project**. A popup opens to Google's sign-in page. Sign in with any Google account; the probe signs out again right away and stores nothing. Expected good result: `G2. signed in with Google as uid ...` then `GOOGLE SIGN-IN WORKS FROM THIS DOCK.` Expected bad result: `GOOGLE FAILED: auth/unauthorized-domain`, which means Firebase rejects the dock's file origin and Email/Password stays the sign-in method. Screenshot either way.

If a step fails, the log says `FAILED:` with Firebase's error code. The most likely ones: `auth/invalid-credential` means a typo in the email or password; `PERMISSION_DENIED` means the database is not in test mode; a hang at step 4 means the database URL is wrong or websockets are blocked.

## Part 4. Record the results

Create `discovery/results/` and save:

- The screenshots from Parts 1, 2 and 3.
- A short `notes.md` with the OBS version, the Chromium version from Raw environment, the date, and anything unexpected.

Then send the screenshots. The architecture document waits on these results.

Results: `results/2026-10-28-notes.md`. All parts have been run; the probe is kept for re-testing on other OBS or SAMMI versions.

## Cleanup

Remove the Probe dock in OBS via **Docks** → **Custom Browser Docks…** → the **X** on the Probe row → Apply. Delete the Firebase project if you do not want to keep it: Project settings → General → scroll to the bottom → **Delete project**.

---

# Discovery: Cloud Probe extension (prototype 2)

`cloud-probe-echo.sef` is a throwaway SAMMI Bridge extension with one command, **Cloud Probe: Echo**. It is generated by `build_echo_sef.py`; edit the script, not the `.sef`. It answers the two SAMMI-side rows of `docs/02-verification-list.md`:

- **S6**: how an extension hands a value back to a button paused on a Save Variable box (type 37). The extension calls `SAMMI.setVariable(saveVariableName, value, FromButton, instanceId)` and logs SAMMI's reply.
- **S15**: what a button sees when the extension answers late, and when the Bridge is closed.

It needs SAMMI 2025.2.0 or newer, with the Bridge open and connected. Nothing leaves the machine.

## Part 5. Install (2 minutes, plus 3 if the Bridge is not set up yet)

If the Bridge is not already running as an OBS dock:

1. In SAMMI Core click **Bridge** → **Copy Full Path**. That copies the path of `bridge.html` inside the `SAMMI/bridge` folder.
2. In OBS: **Docks** → **Custom Browser Docks…**, Dock Name `Bridge`, paste the path into the URL column, **Apply**, **Close**. If the dock does not appear, **Docks** → **Bridge**.
3. In the dock's **Settings** tab, under Bridge Connection: IP `127.0.0.1`, port `9425`, password only if one is set in SAMMI Core → **Settings**. Click **Connect**. A green "Connected" (or green dot) means it worked, and the dock remembers this.
4. Only one Bridge may be open. If it says "Second Bridge tried to connect", close the other one (a browser tab or a second dock).

Then:

1. Copy `cloud-probe-echo.sef` to the Windows PC.
2. Make sure the Bridge dock is open in OBS and shows as connected to SAMMI.
3. In SAMMI Core: **Bridge** → **Install an Extension** → pick the `.sef` file. SAMMI refuses with a message if the Bridge is not connected or SAMMI is older than 2025.2.0. Report any refusal text.
4. Two things appear: a **Cloud Probe** tab in the Bridge dock, with a log that already shows one line listing the Bridge's helper functions, and a **Cloud Probe** deck in SAMMI with four buttons.

## Part 6. Run the six tests (6 minutes)

Keep the Bridge dock visible while pressing buttons, so the log and the SAMMI alert can be seen together. Every button deletes `echoResult`, runs the extension command, then shows an alert with whatever `echoResult` holds. If the Save Variable wait timed out, the alert shows the unresolved text `/$echoResult$/` (or `0`).

**Reinstalling after a change** (the extension name stays the same): SAMMI Core → **Bridge** → **Uninstall an Extension** → Cloud Probe, delete the old Cloud Probe deck, then install the new `.sef`. Check the Cloud Probe tab's heading shows the expected version.

**Quick check without reinstalling:** open any Cloud Probe button in SAMMI's editor and look at the Cloud Probe: Echo command. If it is purple with an **Async** box ticked, the deck predates v0.3.0; untick Async, save, and the command turns gray and waits. v0.3.0 ships it unticked.

| # | Press | Expected if the hypothesis holds | Record |
| --- | --- | --- | --- |
| 1 | **Echo (persistent)** | Alert appears at once reading `echo: hello from cpEchoP @ hh:mm:ss`. The log shows `received: {...}` and `sent setVariable(...) -> SAMMI replied: {...}`. | Screenshot of the alert and of the log. The `received` line is the most valuable thing in this whole test: it shows exactly what SAMMI sends for a type 37 box. |
| 2 | **Echo (non-persistent)** | Same as test 1. | Alert text. If it shows the unresolved placeholder, instanceId handling differs for non-persistent buttons. |
| 3 | **Echo (3 s delay)** | The button visibly pauses about three seconds, then the alert shows the echo. | Roughly how long the pause was. |
| 4 | **Echo (15 s delay, 10 s timeout)** | After about ten seconds the alert appears. What it says is the answer: the unresolved placeholder, empty, or something else. Five seconds later the log shows the late `setVariable` and SAMMI's reply to it. | Alert text, the delay before it, and SAMMI's reply to the late write. Also check SAMMI's own log window for an error line. |
| 5 | **Echo (no delete, press twice)** | First press: alert after one second with the time. Second press: if the alert comes at once showing the *first* press's time, SAMMI accepts a stale value and product code must delete the variable before every command. If it waits one second and shows a new time, SAMMI clears it itself. | Both alert texts and whether the second press waited. |
| 6 | **Bridge closed** | Close the Bridge dock (Docks menu, untick it), wait a few seconds, press **Echo (persistent)**. Either the alert appears at once, or after about ten seconds, or the button hangs. | Which of the three happened, the alert text, and any error in SAMMI's log. Reopen the Bridge dock afterwards and confirm the Cloud Probe tab comes back. |

## Part 7. Record and clean up

Add the screenshots and a few lines per test to `discovery/results/`. Then remove the prototype: in SAMMI Core's Bridge section remove the Cloud Probe extension, delete the Cloud Probe deck, and reload the Bridge dock. Nothing else was written.
