import {
  alert,
  bgr,
  button,
  comment,
  deleteVariable,
  extension,
  ifThen,
  iniLoad,
  iniSave,
  setString,
  triggerButton,
  triggerPull,
  waitMs,
} from "../build/deck.ts";

// The on-PC test deck: one button per docs/09 Layer 3 case that a button can drive. Installed as its
// own extension so reinstalling SAMMI Firebase leaves it in place. It is never shipped in a release.

type Cmd = Record<string, unknown>;
const GREEN = bgr(45, 160, 90);
const BLUE = bgr(45, 127, 249);
const ORANGE = bgr(200, 120, 40);
const GREY = bgr(110, 110, 110);
const PURPLE = bgr(150, 90, 200);
const RED = bgr(190, 60, 60);

/** One Firebase command that waits for its answer in a fresh variable. */
const run = (name: string, boxes: Record<string, string>, save: string): Cmd[] => [
  deleteVariable(save),
  extension(`Firebase: ${name}`, { ...boxes, result: save }),
];
const doc = (collection: string, id: string) => ({ collection, id });
const replace = (collection: string, id: string, fields: string, save = "tSeed"): Cmd[] =>
  run("Replace Document", { ...doc(collection, id), fields }, save);

const POLL_MS = 3000;
/** 56 KB in all: over the message cap (D32), and over the 41 KB where the first T-V3 run stopped. */
const LARGE = Array.from({ length: 8 }, (_, i) => `d${i}`);
const LARGE_FIELDS = JSON.stringify({ n: "start", x: "x".repeat(3500), y: "y".repeat(3500) });

const CASES: { id: string; label: string; color: number; commands: Cmd[] }[] = [
  {
    id: "tC1",
    label: "T-C1\nReplace + Get",
    color: GREEN,
    commands: [
      ...replace("test", "a", '{"n":1}', "tReplace"),
      ...run("Get Document", { ...doc("test", "a"), unpack: "" }, "tGet"),
      alert('T-C1 expect {"n":1} twice. replace=/$tReplace$/ get=/$tGet$/'),
    ],
  },
  {
    id: "tC2",
    label: "T-C2\nField default",
    color: GREEN,
    commands: [
      ...run("Get Field", { ...doc("test", "absent"), field: "n", default: "none" }, "tField"),
      alert("T-C2 expect none. got /$tField$/"),
    ],
  },
  {
    id: "tC3",
    label: "T-C3\n50 reads",
    color: GREEN,
    commands: [
      ...Array.from({ length: 50 }, () =>
        extension("Firebase: Get Document", { ...doc("test", "a"), unpack: "", result: "tRead" }),
      ),
      alert("T-C3 expect this under one second after pressing Run Button"),
    ],
  },
  {
    id: "tC4",
    label: "T-C4\nToo large",
    color: GREEN,
    commands: [
      ...replace("test", "big", JSON.stringify({ x: "x".repeat(9000) }), "tBig"),
      alert("T-C4 expect error: too large. got /$tBig$/"),
    ],
  },
  {
    id: "tC5",
    label: "T-C5\nBad name",
    color: GREEN,
    commands: [
      ...run("Set Field", { ...doc("Bad.Name", "a"), field: "n", value: "1" }, "tBad"),
      alert("T-C5 expect error: bad collection name. got /$tBad$/"),
    ],
  },
  {
    id: "tC6",
    label: "T-C6\nDelete",
    color: GREEN,
    commands: [
      ...replace("test", "del", '{"n":1}'),
      ...run("Delete Document", doc("test", "del"), "tDel1"),
      ...run("Document Exists", doc("test", "del"), "tExists"),
      ...run("Delete Document", doc("test", "del"), "tDel2"),
      alert(
        "T-C6 expect first ok, exists false, second error: missing. first=/$tDel1$/ exists=/$tExists$/ second=/$tDel2$/",
      ),
    ],
  },
  {
    id: "tC7",
    label: "T-C7\nStatus",
    color: GREEN,
    commands: [
      ...run("Get Status", {}, "tStatus"),
      alert("T-C7 expect state, email, project, documents, pending. got /$tStatus$/"),
    ],
  },
  {
    id: "tC8",
    label: "T-C8\nTwo increments",
    color: GREEN,
    commands: [
      ...replace("test", "count", '{"n":0}'),
      triggerButton("tC8a"),
      triggerButton("tC8b"),
      waitMs(2000),
      ...run("Get Field", { ...doc("test", "count"), field: "n", default: "" }, "tCount"),
      alert("T-C8 expect 2. got /$tCount$/"),
    ],
  },
  {
    id: "tC9",
    label: "T-C9\nGenerated id",
    color: GREEN,
    commands: [
      ...run("Create Document", { ...doc("generated", ""), fields: '{"n":1}' }, "tCreate"),
      ...run("List Documents", { collection: "generated" }, "tList"),
      alert("T-C9 expect the created id last in the list. created=/$tCreate$/ list=/$tList$/"),
    ],
  },
  {
    id: "tC10",
    label: "T-C10\nStrict",
    color: GREEN,
    commands: [
      ...run("Define Collection", { name: "strictdemo", fields: "a", strict: "true", twoWay: "true" }, "tDefine"),
      ...run("Set Field", { ...doc("strictdemo", "one"), field: "b", value: "1" }, "tStrict"),
      alert("T-C10 expect define ok, set error: unknown field b. define=/$tDefine$/ set=/$tStrict$/"),
    ],
  },
  {
    id: "tC11",
    label: "T-C11\nQuery",
    color: GREEN,
    commands: [
      ...replace("scores", "p1", '{"points":40}'),
      ...replace("scores", "p2", '{"points":60}'),
      ...replace("scores", "p3", '{"points":80}'),
      ...replace("scores", "p4", '{"points":55}'),
      ...run(
        "Query Documents",
        {
          collection: "scores",
          field: "points",
          operator: ">",
          value: "50",
          orderBy: "points",
          descending: "false",
          limit: "2",
        },
        "tQuery",
      ),
      alert("T-C11 expect p4 (55), then p2 (60), and nothing else. got /$tQuery$/"),
    ],
  },
  {
    id: "tC12",
    label: "T-C12\nUnpack",
    color: GREEN,
    commands: [
      ...replace("scores", "v", '{"points":7,"tier":"gold"}'),
      ...run("Get Document", { ...doc("scores", "v"), unpack: "v" }, "tUnpack"),
      alert("T-C12 expect points=7 tier=gold. points=/$v_points$/ tier=/$v_tier$/"),
    ],
  },
  {
    id: "tV1",
    label: "T-V1 T-V2\nRead variable",
    color: BLUE,
    commands: [
      comment("No Firebase command here. Run T-C1 first: a missing path stops the button."),
      alert("T-V1 expect 1, or your console edit. got /$global.fb_test.a.n$/"),
    ],
  },
  {
    id: "tV4",
    label: "T-V4\nWrite is read",
    color: BLUE,
    commands: [
      setString("userId", "alice"),
      ...run("Increment Field", { ...doc("viewers", "/$userId$/"), field: "points", by: "10" }, "points"),
      alert("T-V4 expect 10 higher each run. answer=/$points$/"),
      ...run("Get Field", { ...doc("viewers", "/$userId$/"), field: "points", default: "" }, "tRead"),
      alert("T-V4 expect the same total. read=/$tRead$/"),
    ],
  },
  {
    id: "tD1",
    label: "T-D1\nINI read",
    color: BLUE,
    commands: [
      comment("Run T-C1 first."),
      iniLoad("firebase.ini", "collection:test", "a", "tIni"),
      alert("T-D1 expect the document as JSON with _t and _d. got /$tIni$/"),
    ],
  },
  {
    id: "tR1",
    label: "T-R1\nReconcile",
    color: BLUE,
    commands: [...run("Reconcile", {}, "tReconcile"), alert("T-R1 expect ok. got /$tReconcile$/")],
  },
  {
    id: "tR1c",
    label: "T-R1\nCounts (trigger)",
    color: BLUE,
    commands: [
      comment("Attach the Extension Trigger 'Firebase: Mirror Reconciled' yourself. It also fires on every connect."),
      triggerPull("tPushed", "pushed"),
      triggerPull("tApplied", "applied"),
      triggerPull("tDropped", "dropped"),
      triggerPull("tCause", "cause"),
      alert(
        "T-R1 expect a cause and three numbers. cause=/$tCause$/ pushed=/$tPushed$/ applied=/$tApplied$/ dropped=/$tDropped$/",
      ),
    ],
  },
  {
    id: "tO1",
    label: "T-O1\nSet + Get",
    color: ORANGE,
    commands: [
      ...run("Set Field", { ...doc("test", "b"), field: "n", value: "2" }, "tSet"),
      ...run("Get Field", { ...doc("test", "b"), field: "n", default: "" }, "tGetB"),
      alert("T-O1 expect set 2, get 2, straight away. set=/$tSet$/ get=/$tGetB$/"),
    ],
  },
  {
    id: "tO3",
    label: "T-O3\nReplace b",
    color: ORANGE,
    commands: [
      ...replace("test", "b", '{"n":3}', "tReplaceB"),
      alert('T-O3 expect {"n":3} straight away. got /$tReplaceB$/'),
    ],
  },
  {
    id: "tB5",
    label: "T-B5\nUpdate a",
    color: ORANGE,
    commands: [
      ...run("Update Document", { ...doc("test", "a"), fields: '{"m":1}' }, "tUpdate"),
      alert("T-B5 expect the document with m=1, straight away. got /$tUpdate$/"),
    ],
  },
  {
    id: "tL2",
    label: "T-L2\nOwn write",
    color: PURPLE,
    commands: [
      comment("Attach 'Firebase: Document Updated' to Watch: Updated first."),
      ...run("Update Document", { ...doc("test", "a"), fields: '{"own":"write"}' }, "tOwn"),
      waitMs(POLL_MS),
      alert("T-L2 expect exactly one Watch: Updated alert before this, with source=local. answer=/$tOwn$/"),
    ],
  },
  {
    id: "tV5",
    label: "T-V5\nSet variable",
    color: PURPLE,
    commands: [
      ...replace("test", "two", '{"n":1,"note":"start"}'),
      waitMs(POLL_MS),
      setString("global.fb_test.two.note", "fromvariable"),
      waitMs(POLL_MS),
      ...run("Get Field", { ...doc("test", "two"), field: "note", default: "" }, "tTwo"),
      alert(
        "T-V5 expect fromvariable, in the console too, after one Watch: Updated alert with source=local. got /$tTwo$/",
      ),
    ],
  },
  {
    id: "tV6",
    label: "T-V6\nStrict variable",
    color: PURPLE,
    commands: [
      comment("Attach 'Firebase: Write Rejected' to Watch: Rejected first."),
      ...run("Define Collection", { name: "strictdemo", fields: "a", strict: "true", twoWay: "true" }, "tDefine"),
      ...replace("strictdemo", "one", '{"a":"keep"}'),
      waitMs(POLL_MS),
      setString("global.fb_strictdemo.one.b", "refused"),
      waitMs(POLL_MS),
      ...run("Get Document", { ...doc("strictdemo", "one"), unpack: "" }, "tStrictDoc"),
      alert(
        'T-V6 expect {"a":"keep"} with no b, after one Watch: Rejected alert naming unknown field. got /$tStrictDoc$/',
      ),
    ],
  },
  {
    id: "tV7",
    label: "T-V7\nTwo-way off",
    color: PURPLE,
    commands: [
      ...run("Define Collection", { name: "oneway", fields: "n, m", strict: "false", twoWay: "false" }, "tDefine"),
      ...replace("oneway", "a", '{"n":"start","m":"one"}'),
      waitMs(POLL_MS),
      setString("global.fb_oneway.a.n", "ignored"),
      waitMs(POLL_MS),
      ...run("Get Field", { ...doc("oneway", "a"), field: "n", default: "" }, "tOneway"),
      ...run("Update Document", { ...doc("oneway", "a"), fields: '{"m":"two"}' }, "tOneway2"),
      alert("T-V7 expect stored=start and variable=start. stored=/$tOneway$/ variable=/$global.fb_oneway.a.n$/"),
    ],
  },
  {
    id: "tV3x",
    label: "T-V3\nClear",
    color: PURPLE,
    commands: [
      comment("Removes the large collection through the extension."),
      ...LARGE.flatMap((id) => run("Delete Document", doc("large", id), "tLarge")),
      ...run("Count Documents", { collection: "large" }, "tLargeCount"),
      alert("T-V3 clear expect 0. got /$tLargeCount$/"),
    ],
  },
  {
    id: "tV3",
    label: "T-V3\nOver the cap",
    color: PURPLE,
    commands: [
      comment("Crosses the 16,000 byte message cap with a few large documents (D32). Run T-V3 Clear first."),
      ...LARGE.flatMap((id) => replace("large", id, LARGE_FIELDS, "tLarge")),
      ...run("Count Documents", { collection: "large" }, "tLargeCount"),
      ...ifThen(
        "tLargeCount",
        "==",
        `"${LARGE.length}"`,
        [
          alert(`T-V3 expect ${LARGE.length} and start. count=/$tLargeCount$/ variable=/$global.fb_large.d7.n$/`),
          setString("global.fb_large.d7.n", "fromvariable"),
          waitMs(POLL_MS),
          ...run("Get Field", { ...doc("large", "d7"), field: "n", default: "" }, "tLargeRead"),
          alert("T-V3 expect fromvariable. got /$tLargeRead$/"),
        ],
        [alert(`T-V3 expect ${LARGE.length}, this run lost writes. count=/$tLargeCount$/`)],
      ),
    ],
  },
  {
    id: "tB3",
    label: "T-B3\nINI edit",
    color: RED,
    commands: [
      comment("Run with OBS closed."),
      iniSave("firebase.ini", "collection:test", "a", '{"n":33}'),
      alert("T-B3 expect this with OBS closed. Now edit test/a in the console, then open OBS."),
    ],
  },
  {
    id: "tB4",
    label: "T-B4\nBad INI",
    color: RED,
    commands: [
      comment("Run with OBS closed."),
      iniSave("firebase.ini", "collection:test", "a", "{not json"),
      alert("T-B4 expect this with OBS closed. Now open OBS."),
    ],
  },
  {
    id: "tWatchU",
    label: "Watch\nUpdated",
    color: GREY,
    commands: [
      comment("Attach the Extension Trigger 'Firebase: Document Updated' yourself. Never run it directly."),
      triggerPull("tWSource", "source"),
      triggerPull("tWCollection", "collection"),
      triggerPull("tWId", "id"),
      alert(
        "Watch: Updated expect the source each case names. source=/$tWSource$/ collection=/$tWCollection$/ id=/$tWId$/",
      ),
    ],
  },
  {
    id: "tWatchR",
    label: "Watch\nRejected",
    color: GREY,
    commands: [
      comment("Attach the Extension Trigger 'Firebase: Write Rejected' yourself. Never run it directly."),
      triggerPull("tWField", "field"),
      triggerPull("tWReason", "reason"),
      alert("Watch: Rejected expect unknown field. field=/$tWField$/ reason=/$tWReason$/"),
    ],
  },
  {
    id: "tC8a",
    label: "T-C8 helper\nincrement A",
    color: GREY,
    commands: [
      ...run("Increment Field", { ...doc("test", "count"), field: "n", by: "1" }, "tIncA"),
      alert("T-C8 helper A expect 1 or 2. got /$tIncA$/"),
    ],
  },
  {
    id: "tC8b",
    label: "T-C8 helper\nincrement B",
    color: GREY,
    commands: [
      ...run("Increment Field", { ...doc("test", "count"), field: "n", by: "1" }, "tIncB"),
      alert("T-C8 helper B expect 1 or 2. got /$tIncB$/"),
    ],
  },
];

const COLUMNS = 5;

export function testDeck(uniqueId: string, stamp = "dev"): Record<string, unknown> {
  return {
    background_color: 4210752.0,
    on: true,
    grid_y: 8.0,
    snap_grid: true,
    lb_version: "2025.2.0",
    background_image: "",
    sammi_version: "2025.2.0",
    encrypted: false,
    adaptive_resizing: true,
    unique_id: uniqueId,
    deck_name: `SAMMI Firebase Tests ${stamp}`,
    grid_x: 5.0,
    stretch: false,
    button_list: CASES.map((c, i) =>
      button(c.id, c.label, (i % COLUMNS) * 0.2, Math.floor(i / COLUMNS) * 0.125, c.color, c.commands),
    ),
  };
}
