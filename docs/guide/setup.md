# Setup guide

This connects SAMMI to a Firebase project you own. It takes about 15 minutes and costs nothing, because Firebase's free plan covers it. You do steps 1 to 5 once per project. The SAMMI Firebase tab refers to these step numbers.

## Before you start

You need:

- SAMMI Core 2025.2.0 or newer, running on Windows
- OBS, with the SAMMI Bridge open as a dock
- `sammi-firebase.sef`. There's no release yet, so [build it from source](../../README.md#development) for now. After the first release, it'll be on the [Releases page](https://github.com/listenrightmeow/sammi-firebase/releases)
- A Google account for Firebase

### Open the Bridge in OBS

Skip this if the Bridge already shows in OBS.

1. In OBS, go to **Docks → Custom Browser Docks**.
2. Under **Dock Name**, enter `SAMMI Bridge`.
3. Under **URL**, enter the path to `bridge.html` in your SAMMI folder, with forward slashes. For example: `file:///C:/SAMMI/bridge/bridge.html`.
4. Click **Apply**, then **Close**. If the dock doesn't appear, tick it under **Docks → SAMMI Bridge**.

## Part 1: Set up Firebase

Firebase sometimes moves or renames its menu items. If you can't find one, use the console's search.

### Step 1: Create a project

Go to the [Firebase console](https://console.firebase.google.com) and create a project. Any name works, and Analytics can be off.

<!-- screenshot: images/step-1-create-project.png -->

### Step 2: Turn on email sign-in

Go to **Authentication → Get started → Email/Password**, enable it and click **Save**.

<!-- screenshot: images/step-2-email-password.png -->

### Step 2b: Create your user

Go to **Authentication → Users → Add user** and enter an email and a password. You'll sign in with these in step 8.

Use a password you don't use anywhere else.

<!-- screenshot: images/step-2b-add-user.png -->

### Step 3: Create the database

Go to **Realtime Database → Create Database**, choose the location nearest you and start in **locked mode**.

Do this before step 5, so that your config includes `databaseURL`.

<!-- screenshot: images/step-3-create-database.png -->

### Step 4: Set the database rules

Open the database's **Rules** tab, replace everything with the rules below and click **Publish**. Each user can then read and write only their own data.

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid == $uid",
        ".write": "auth != null && auth.uid == $uid"
      }
    }
  }
}
```

<!-- screenshot: images/step-4-rules.png -->

### Step 5: Copy your config block

1. Go to **Project settings → Your apps** and click the web icon `</>`.
2. Enter any nickname and click **Register app**.
3. Copy the whole `firebaseConfig` block, and save it somewhere private. A second PC will need it.

To find it later, select the app under **Your apps** and choose **Config**.

<!-- screenshot: images/step-5-config.png -->

## Part 2: Install and connect

### Step 6: Install the extension

With OBS and the Bridge dock open, go to **Bridge → Install an Extension** in SAMMI and pick `sammi-firebase.sef`.

A **SAMMI Firebase** tab appears in the Bridge, and a **SAMMI Firebase** deck appears in SAMMI. If SAMMI says the Bridge must be connected, open the Bridge in OBS and try again.

### Step 7: Paste the config

In the Bridge, open the **SAMMI Firebase** tab and expand **Connection**. Paste the config block into the large box.

### Step 8: Connect

Enter the email and password from step 2b and click **Connect**.

The status line changes to `Connected as <your email> · 0 documents · 0 pending`. If it doesn't, see [Troubleshooting](troubleshooting.md).

The extension doesn't store your password. It stays signed in the next time you open OBS.

## Check that it works

1. Open the **SAMMI Firebase** deck in SAMMI.
2. Double-click **Example: Replace Document** and press **Run Button**. An alert shows the document.
3. In the Firebase console, open **Realtime Database → Data**, then `users` → your user ID → `collections` → `example` → `settings`. The same values are there.

You're set up. Next, read [Using SAMMI Firebase](using.md).

## Set up a second PC

Use the same Firebase project and user. You don't repeat steps 1 to 5. Tests with a second real PC are [still to come](../../ROADMAP.md), so treat this as untested for now.

1. Install the extension (step 6).
2. Paste the same config block (step 7).
3. Enter the same email and password, then click **Connect** (step 8).

Your documents download to that PC, and the status line shows how many.

## Update to a new version

Keep OBS and the Bridge dock open, and install the new `.sef` the same way. When SAMMI asks **Extension SAMMI Firebase is already installed. Reinstall it?**, choose **Yes**. Then right-click inside the Bridge dock and choose **Reload**.

Your documents, collections, config and sign-in are all kept.

**You'll end up with a second SAMMI Firebase deck.** Both decks work, but both Startup buttons run when SAMMI starts. Delete the one you don't use, and keep the one with your triggers attached.

## Uninstall

In SAMMI, uninstall **SAMMI Firebase** and delete its deck. Your data stays in Firebase. If you reinstall and connect again, it all comes back.

To remove your data as well, delete the Firebase project in the console, and delete `firebase.ini` from your SAMMI folder.
