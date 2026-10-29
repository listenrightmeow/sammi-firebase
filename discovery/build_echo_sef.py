#!/usr/bin/env python3
"""Builds discovery/cloud-probe-echo.sef, prototype 2 of the verification list.

A throwaway SAMMI Bridge extension with one command, "Cloud Probe: Echo", whose only job is to
answer two questions on real hardware:

  S6   How does an extension hand a value back to a button that is paused on a Save Variable box
       (box type 37)?  Hypothesis: SAMMI.setVariable(saveVariableName, value, FromButton, instanceId).
  S15  What does a button see when the Bridge is closed, or when the extension answers too late?

Nothing here is product code. Run:  python3 discovery/build_echo_sef.py
"""
import json
import time
from pathlib import Path

OUT = Path(__file__).resolve().parent / "cloud-probe-echo.sef"
SAMMI_MIN = "2025.2.0"          # Save Variable boxes (type 37) arrived in 2025.2.0
EXT_NAME = "Cloud Probe"
CMD_NAME = "Cloud Probe: Echo"
TIMEOUT_MS = 10000              # timeoutAfter on the Save Variable box

# ---------------------------------------------------------------- deck JSON helpers
BASE = dict(obsid="Main", vis=1.0, ms=0.0, sel=False, dis=0.0, xpan=0.0)

def cmd(cid, **kw):
    d = dict(BASE); d["cmd"] = float(cid); d.update(kw); return d

def comment(text):              return cmd(6, b0=text, v0=1.0)
def alert(msg):                 return cmd(142, b0=msg)
def delete_var(name):           return cmd(78, b0=name)
def set_string(name, text):     return cmd(20, b0=name, b1=text, v0=False)

def echo(text, delay_ms, save_as):
    """The extension command. Box values travel under the box keys defined in [insert_command]."""
    return cmd(0, ext="SAMMI Bridge", extcmd=CMD_NAME, text=text, delayMs=str(delay_ms), result=save_as)

def number(cmds):
    for i, c in enumerate(cmds): c["pos"] = float(i)
    return cmds

def bgr(r, g, b): return float(b * 65536 + g * 256 + r)

def button(bid, text, x, y, color, commands, persistent):
    cmds = number(commands)
    functions = 1 + (64 if persistent else 0)
    return {
        "color": color, "persistent": 1.0 if persistent else 0.0, "text": text,
        "release_duration": 0.0, "queueable": 0.0, "command_list": cmds, "press_type": 0.0,
        "x": x, "border": 2.0, "image": "", "triggers": [], "group_id": "", "overlappable": 0.0,
        "init_variable": "", "deck": 0.0, "width": 0.2, "button_id": bid, "button_duration": 0.0,
        "y": y, "switch_deck": "", "height": 0.125, "release_list": [], "functions": float(functions),
        "stretch": 0.0, "is_transparent": 0.0,
    }

def echo_button(bid, text, x, y, color, *, persistent, delay_ms, note, delete_first=True):
    # v0.1.0 preset the variable to a placeholder before the command, and SAMMI continued at once: the
    # Save Variable box is a "wait until this variable exists" and a preset value satisfies it immediately.
    # So: delete first, never preset. If the wait times out, the alert shows an unresolved /$echoResult$/.
    cmds = [comment(f"Cloud Probe. {note}")]
    if delete_first: cmds.append(delete_var("echoResult"))
    cmds += [echo("hello from " + bid, delay_ms, "echoResult"),
             alert("Cloud Probe " + bid + ": /$echoResult$/")]
    return button(bid, text, x, y, color, cmds, persistent)

BUTTONS = [
    echo_button("cpEchoP", "Echo\n(persistent)", 0.0, 0.0, bgr(60, 160, 60), persistent=True, delay_ms=0,
                note="Persistent button, no delay. Expected: the alert shows 'echo: hello from cpEchoP @ <time>' right away."),
    echo_button("cpEchoN", "Echo\n(non-persistent)", 0.2, 0.0, bgr(60, 120, 200), persistent=False, delay_ms=0,
                note="Non-persistent button. Tests that instanceId is enough for the value to land in the right button instance."),
    echo_button("cpEchoSlow", "Echo\n(3 s delay)", 0.4, 0.0, bgr(200, 160, 40), persistent=True, delay_ms=3000,
                note="The extension waits 3 s before answering. Expected: the button pauses 3 s, then the alert shows the echo."),
    echo_button("cpEchoLate", "Echo\n(15 s delay, 10 s timeout)", 0.6, 0.0, bgr(200, 60, 60), persistent=True, delay_ms=15000,
                note=f"The extension answers after 15 s but the box times out at {TIMEOUT_MS} ms. Shows what the button sees on timeout."),
    echo_button("cpEchoStale", "Echo\n(no delete, press twice)", 0.8, 0.0, bgr(150, 90, 200), persistent=True, delay_ms=1000,
                delete_first=False,
                note="Does NOT delete echoResult first. Press twice. If the second alert shows the FIRST press's time at once, SAMMI accepts a stale value and product code must delete the variable before every command."),
]

uid = time.strftime("%Y%m%d%H%M%S") + "000000000"
deck_data = {
    "background_color": 4210752.0, "on": True, "grid_y": 8.0, "snap_grid": True,
    "lb_version": SAMMI_MIN, "background_image": "", "sammi_version": SAMMI_MIN,
    "encrypted": False, "adaptive_resizing": True, "unique_id": uid,
    "button_list": BUTTONS, "deck_name": "Cloud Probe", "grid_x": 5.0, "stretch": False,
}
insert_over = {"deck_data": json.dumps(deck_data), "unique_id": uid, "include_image": {},
               "sammi_version": SAMMI_MIN, "bridge": True}

# ---------------------------------------------------------------- the extension itself
INSERT_EXTERNAL = """<div style="font-family:system-ui,sans-serif">
  <h4>Cloud Probe (prototype 2, v0.2.0)</h4>
  <p>Press the buttons on the <b>Cloud Probe</b> deck in SAMMI. Every command the extension receives is logged
     below, newest first, together with what the extension sent back and how SAMMI replied.
     Nothing leaves this machine.</p>
  <button id="cpClear" type="button">Clear log</button>
  <pre id="cpLog" style="white-space:pre-wrap;word-break:break-all;background:#111;color:#ddd;padding:8px;min-height:120px;font-size:12px"></pre>
</div>"""

INSERT_COMMAND = f"""SAMMI.extCommand('{CMD_NAME}', 3355443, 52, {{
  text:    ['Text', 14, 'hello', 1],
  delayMs: ['Answer after (ms)', 14, '0', 0.7],
  result:  ['Save Variable As', 37, 'echoResult', 1.3, {{ timeoutAfter: {TIMEOUT_MS} }}]
}}, false, false);
cloudProbeMain();"""

INSERT_SCRIPT = """// Cloud Probe: one command that echoes its text box back into a Save Variable box.
function cloudProbeLog(msg) {
  const el = document.getElementById('cpLog');
  const line = new Date().toISOString().slice(11, 23) + '  ' + msg;
  if (el) el.textContent = line + '\\n' + el.textContent;
  console.log('[Cloud Probe] ' + msg);
}

function cloudProbeMain() {
  const clear = document.getElementById('cpClear');
  if (clear) clear.onclick = () => { document.getElementById('cpLog').textContent = ''; };

  // What helpers does this Bridge expose? Anything that looks like a dedicated "return a value" API?
  const helpers = Object.keys(SAMMI || {});
  cloudProbeLog('Bridge helpers (' + helpers.length + '): ' + helpers.join(', '));
  cloudProbeLog('helpers mentioning return/result/respond/save: ' +
    (helpers.filter(k => /return|result|respond|save/i.test(k)).join(', ') || 'none'));

  sammiclient.on('""" + CMD_NAME + """', async (payload) => {
    cloudProbeLog('received: ' + JSON.stringify(payload));
    const d = payload.Data || {};
    const delay = parseInt(d.delayMs, 10) || 0;
    if (delay) { cloudProbeLog('waiting ' + delay + ' ms before answering'); await new Promise(r => setTimeout(r, delay)); }
    const value = 'echo: ' + d.text + ' @ ' + new Date().toISOString().slice(11, 19);
    try {
      const reply = await SAMMI.setVariable(d.result, value, d.FromButton, d.instanceId);
      cloudProbeLog('sent setVariable(' + JSON.stringify(d.result) + ', ' + JSON.stringify(value) + ', ' +
        JSON.stringify(d.FromButton) + ', ' + JSON.stringify(d.instanceId) + ') -> SAMMI replied: ' + JSON.stringify(reply));
    } catch (e) {
      cloudProbeLog('setVariable FAILED: ' + (e && e.message ? e.message : JSON.stringify(e)));
    }
  });
  cloudProbeLog('listening for "' + '""" + CMD_NAME + """' + '"');
}"""

sef = f"""[extension_name]
{EXT_NAME}
[extension_info]
Throwaway prototype for the SAMMI Cloud Vars project. One command, "{CMD_NAME}", that echoes a text box back into a Save Variable box. Safe to uninstall.
[extension_version]
0.2.0
[insert_external]
{INSERT_EXTERNAL}

[insert_command]
{INSERT_COMMAND}

[insert_hook]
// none

[insert_script]
{INSERT_SCRIPT}

[insert_over]
{json.dumps(insert_over)}
"""
OUT.write_text(sef, encoding="utf-8")
print(f"wrote {OUT} ({len(BUTTONS)} buttons, {sum(len(b['command_list']) for b in BUTTONS)} commands, {OUT.stat().st_size} bytes)")
