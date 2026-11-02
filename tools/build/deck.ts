// The bundled deck (SF-ADR-005): the seven buttons of the PRD. Command ids and box layouts follow SAMMI's
// docs; 0 extension command, 6 comment, 20 set string, 78 delete variable and 142 alert were confirmed
// by discovery/build_echo_sef.py, and 7 If, 83 String Get Length, 127 INI Load, 141 Popup, 190 Wait and
// the SAMMI Startup trigger by the Hue Scenes deck on the same SAMMI. 66 Trigger Pull Data was
// confirmed by the deck check (D23). Every extension command
// carries "async": 0.0, without which SAMMI does not wait for the Save Variable box (S6).

export const SAMMI_MIN = "2025.2.0";

type Cmd = Record<string, unknown>;

// The base every command carries in the deck verified on hardware (discovery/build_echo_sef.py).
export const COMMAND_BASE = { obsid: "Main", vis: 1, ms: 0, sel: false, dis: 0, xpan: 0 };

const cmd = (type: number, fields: Record<string, unknown>): Cmd => ({ ...COMMAND_BASE, cmd: type, ...fields });

// Comment is command 6; v0 is its color index (discovery/build_echo_sef.py, and the Hue Scenes deck on hardware).
export const comment = (text: string): Cmd => cmd(6, { b0: text, v0: 1 });
export const alert = (text: string): Cmd => cmd(142, { b0: text });
export const deleteVariable = (name: string): Cmd => cmd(78, { b0: name });
export const setString = (name: string, text: string): Cmd => cmd(20, { b0: name, b1: text, v0: false });
export const extension = (name: string, boxes: Record<string, string>): Cmd =>
  cmd(0, { ext: "SAMMI Bridge", extcmd: name, ...boxes, async: 0.0 });
export const popup = (text: string): Cmd => cmd(141, { b0: text, v0: 0 });
export const waitMs = (ms: number): Cmd => cmd(190, { b0: String(ms) });
export const strLen = (save: string, text: string): Cmd => cmd(83, { b0: save, b1: text });
export const iniSave = (file: string, section: string, key: string, text: string): Cmd =>
  cmd(126, { b0: file, b1: section, b2: key, b3: text });
export const iniLoad = (file: string, section: string, key: string, save: string): Cmd =>
  cmd(127, { b0: file, b1: section, b2: key, b3: save });
export const triggerButton = (id: string): Cmd => cmd(132, { b0: id, b1: "0", v0: false });
export const triggerPull = (save: string, key: string): Cmd => cmd(66, { b0: save, b1: key });

/** If (7): SAMMI stores 20 condition slots; v0 is the then-block size, v1 the else-block size. */
export function ifThen(left: string, op: string, right: string, then: Cmd[], otherwise: Cmd[] = []): Cmd[] {
  const head = cmd(7, {});
  for (let k = 0; k < 60; k++) head[`b${k}`] = k % 3 === 1 ? "==" : "";
  for (let k = 3; k < 23; k++) head[`v${k}`] = 0;
  Object.assign(head, { b0: left, b1: op, b2: right, v0: then.length, v1: otherwise.length, v2: 1 });
  return [head, ...then, ...otherwise];
}

export const STARTUP_TRIGGER = { trg: 10.0, type: "SAMMI Startup", group_id: "" };

export const bgr = (r: number, g: number, b: number): number => b * 65536 + g * 256 + r;

export function button(
  id: string,
  text: string,
  x: number,
  y: number,
  color: number,
  commands: Cmd[],
  triggers: Record<string, unknown>[] = [],
): Record<string, unknown> {
  return {
    color,
    persistent: 1.0,
    text,
    release_duration: 0.0,
    queueable: 0.0,
    command_list: commands.map((c, i) => ({ ...c, pos: i })),
    press_type: 0.0,
    x,
    border: 2.0,
    image: "",
    triggers: triggers.map((t) => ({ ...t, button_id: id })),
    group_id: "",
    overlappable: 0.0,
    init_variable: "",
    deck: 0.0,
    width: 0.2,
    button_id: id,
    button_duration: 0.0,
    y,
    switch_deck: "",
    height: 0.125,
    release_list: [],
    functions: 65.0 + (triggers.length ? 16 : 0),
    stretch: 0.0,
    is_transparent: 0.0,
  };
}

export function deck(uniqueId: string): Record<string, unknown> {
  return {
    background_color: 4210752.0,
    on: true,
    grid_y: 8.0,
    snap_grid: true,
    lb_version: SAMMI_MIN,
    background_image: "",
    sammi_version: SAMMI_MIN,
    encrypted: false,
    adaptive_resizing: true,
    unique_id: uniqueId,
    deck_name: "SAMMI Firebase",
    grid_x: 5.0,
    stretch: false,
    button_list: [
      button("fbHelp", "Firebase\nHelp", 0.0, 0.0, bgr(110, 110, 110), [
        popup(
          "SAMMI Firebase\n\n" +
            "Connect once in the Bridge's SAMMI Firebase tab (config, email, password). After that:\n" +
            "- Read any document as a variable: in a yellow box, type global.fb_example.settings.ip\n" +
            "- Write with one Firebase command inside your own buttons (Set Field, Increment Field, Replace Document...).\n" +
            "- Leave the Async box on Firebase commands unticked.\n" +
            "- Firebase: Startup declares this deck's collections; the Example buttons show a write, a read with the " +
            "Bridge-closed fallback, and two policies (attach their Firebase trigger with Edit Triggers).",
        ),
      ]),
      button("fbStatus", "Firebase\nStatus", 0.2, 0.0, bgr(45, 127, 249), [
        comment("Shows the connection status. The Save Variable box makes SAMMI wait for the answer."),
        deleteVariable("fbStatus"),
        extension("Firebase: Get Status", { result: "fbStatus" }),
        alert("SAMMI Firebase: /$fbStatus$/"),
      ]),
      button(
        "fbStartup",
        "Firebase\nStartup",
        0.4,
        0.0,
        bgr(45, 160, 90),
        [
          comment(
            "Runs when SAMMI starts. Declares this deck's collections (docs/06): the extension enforces them on this " +
              "PC and writes them to the cloud so a second PC inherits them. Waits 20 s for OBS and the Bridge.",
          ),
          waitMs(20000),
          deleteVariable("fbDefineExample"),
          extension("Firebase: Define Collection", {
            name: "example",
            fields: "ip, scene_1, scene_1_name",
            strict: "true",
            twoWay: "true",
            result: "fbDefineExample",
          }),
          deleteVariable("fbDefineViewers"),
          extension("Firebase: Define Collection", {
            name: "viewers",
            fields: "points, tier",
            strict: "false",
            twoWay: "true",
            result: "fbDefineViewers",
          }),
        ],
        [STARTUP_TRIGGER],
      ),
      button("fbExampleReplace", "Example:\nReplace Document", 0.0, 0.125, bgr(45, 127, 249), [
        comment(
          "A settings button (T2): writes one whole document. Read it anywhere as /$global.fb_example.settings.ip$/.",
        ),
        deleteVariable("fbReplaceResult"),
        extension("Firebase: Replace Document", {
          collection: "example",
          id: "settings",
          fields: '{"ip":"192.168.1.20","scene_1":"relax","scene_1_name":"Relax"}',
          result: "fbReplaceResult",
        }),
        alert("SAMMI Firebase: /$fbReplaceResult$/"),
      ]),
      button("fbExampleGet", "Example:\nGet with fallback", 0.2, 0.125, bgr(45, 127, 249), [
        comment(
          "Reads example/settings. With the Bridge closed the command answers nothing and SAMMI says the Bridge is " +
            "disconnected, so the button reads the copy in firebase.ini instead (D10, D24).",
        ),
        setString("exampleSettings", ""),
        extension("Firebase: Get Document", {
          collection: "example",
          id: "settings",
          unpack: "",
          result: "exampleSettings",
        }),
        strLen("exampleSettingsLen", "/$exampleSettings$/"),
        ...ifThen("exampleSettingsLen", "==", "0", [
          iniLoad("firebase.ini", "collection:example", "settings", "exampleSettings"),
        ]),
        alert("SAMMI Firebase: example/settings = /$exampleSettings$/"),
      ]),
      button("fbOnDocumentUpdated", "Policy:\nchanged elsewhere", 0.4, 0.125, bgr(150, 90, 200), [
        comment(
          "POLICY. Attach the trigger yourself: right-click > Edit Triggers > Add > Extension Trigger, name " +
            "'Firebase: Document Updated'. Tells you when a document changed on another PC or in the console.",
        ),
        triggerPull("fbSource", "source"),
        triggerPull("fbCollection", "collection"),
        triggerPull("fbId", "id"),
        ...ifThen("fbSource", "==", '"remote"', [
          alert("SAMMI Firebase: /$fbId$/ in /$fbCollection$/ changed elsewhere"),
        ]),
      ]),
      button("fbOnConnected", "Policy:\nrefresh on connect", 0.6, 0.125, bgr(150, 90, 200), [
        comment(
          "POLICY. Attach the trigger yourself: right-click > Edit Triggers > Add > Extension Trigger, name " +
            "'Firebase: Connected'. Copies example/settings into local variables example_ip, example_scene_1, ...",
        ),
        deleteVariable("fbRefresh"),
        extension("Firebase: Get Document", {
          collection: "example",
          id: "settings",
          unpack: "example",
          result: "fbRefresh",
        }),
      ]),
    ],
  };
}

/** Every extension command in a deck, with its async flag, for the build check. */
export function extensionCommands(deckData: Record<string, unknown>): { name: string; async: unknown }[] {
  const out: { name: string; async: unknown }[] = [];
  for (const b of (deckData.button_list as Record<string, unknown>[]) ?? [])
    for (const c of [...((b.command_list as Cmd[]) ?? []), ...((b.release_list as Cmd[]) ?? [])])
      if (c.cmd === 0) out.push({ name: String(c.extcmd), async: c.async });
  return out;
}
