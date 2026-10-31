// The bundled deck (SF-ADR-005). Release 1 ships eight buttons; this milestone ships the ones built
// only from SAMMI command types verified on hardware: 0 extension command, 142 alert, 6 comment,
// 78 delete variable, 20 set string (discovery/build_echo_sef.py). Every extension command carries
// "async": 0.0, without which SAMMI does not wait for the Save Variable box (S6).

export const SAMMI_MIN = "2025.2.0";

type Cmd = Record<string, unknown>;

const cmd = (type: number, fields: Record<string, unknown>): Cmd => ({
  cmd: type,
  b0: "",
  b1: "",
  b2: "",
  b3: "",
  b4: "",
  b5: "",
  b6: "",
  b7: "",
  b8: "",
  b9: "",
  b10: "",
  b11: "",
  b12: "",
  b13: "",
  b14: "",
  b15: "",
  b16: "",
  b17: "",
  b18: "",
  b19: "",
  b20: "",
  ms: 0,
  sel: 1,
  dis: false,
  xpan: 0,
  ...fields,
});

// Comment is command 6; v0 is its color index (discovery/build_echo_sef.py, and the Hue Scenes deck on hardware).
export const comment = (text: string): Cmd => cmd(6, { b0: text, v0: 1 });
export const alert = (text: string): Cmd => cmd(142, { b0: text });
export const deleteVariable = (name: string): Cmd => cmd(78, { b0: name });
export const setString = (name: string, text: string): Cmd => cmd(20, { b0: name, b1: text, v0: false });
export const extension = (name: string, boxes: Record<string, string>): Cmd =>
  cmd(0, { ext: "SAMMI Bridge", extcmd: name, ...boxes, async: 0.0 });

const bgr = (r: number, g: number, b: number): number => b * 65536 + g * 256 + r;

function button(id: string, text: string, x: number, color: number, commands: Cmd[]): Record<string, unknown> {
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
    triggers: [],
    group_id: "",
    overlappable: 0.0,
    init_variable: "",
    deck: 0.0,
    width: 0.2,
    button_id: id,
    button_duration: 0.0,
    y: 0.0,
    switch_deck: "",
    height: 0.125,
    release_list: [],
    functions: 65.0,
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
      button("fbStatus", "Firebase\nStatus", 0.0, bgr(45, 127, 249), [
        comment("Shows the connection status. The Save Variable box makes SAMMI wait for the answer."),
        deleteVariable("fbStatus"),
        extension("Firebase: Get Status", { result: "fbStatus" }),
        alert("SAMMI Firebase: /$fbStatus$/"),
      ]),
      button("fbLocalNotice", "Firebase\nLocal Notice", 0.2, bgr(200, 120, 40), [
        comment("Helper (D10, H4): call it when a Firebase command answered nothing. Tells you once per session."),
        setString("fbLocalNoticeShown", "yes"),
        alert("SAMMI Firebase: the Bridge is not connected, so this deck is using the copy saved on this PC."),
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
