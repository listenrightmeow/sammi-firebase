// The gateway probe's steps (T-D2, docs/09 Layer 3). Each step calls the real SAMMI Bridge helper
// the gateways in src/ext/gateways.ts rely on and records the raw reply, so the fake world
// (tools/feat-adapters/world.ts) can be checked against what SAMMI actually does. The steps take
// the Bridge as a parameter: the probe tab passes the global SAMMI, the tests pass a fake.

export interface Bridge {
  saveIni(file: string, section: string, key: string, value: string, type?: string): Promise<unknown>;
  loadIni(file: string, section: string, key: string, type?: string): Promise<unknown>;
  setVariable(name: string, value: unknown, buttonId?: string): Promise<unknown>;
  getVariable(name: string, buttonId?: string): Promise<unknown>;
  triggerExt(trigger: string, data: Record<string, unknown>): Promise<unknown>;
}

export interface StepResult {
  id: string;
  question: string;
  /** The raw replies, in call order, as SAMMI returned them. */
  replies: unknown[];
  /** The value the gateways would see (replyValue of the last read). */
  observed: unknown;
  expected: unknown;
  pass: boolean;
  error?: string;
}

export interface ProbeReport {
  probe: "gateway-probe";
  version: string;
  ranAt: string;
  userAgent: string;
  /** Function names on the Bridge's SAMMI object, to settle whether an ini delete helper exists. */
  bridgeHelpers: string[];
  steps: StepResult[];
}

export const PROBE_FILE = "firebase-probe.ini";
export const TRIGGER = "Gateway Probe: Ping";

/** Mirrors replyValue in src/ext/gateways.ts; the probe checks that this reading is right. */
export const replyValue = (reply: unknown): unknown =>
  reply && typeof reply === "object"
    ? ((reply as Record<string, unknown>).Value ?? (reply as Record<string, unknown>).value)
    : reply;

const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

type Body = (b: Bridge, replies: unknown[]) => Promise<unknown>;

interface Step {
  id: string;
  question: string;
  expected: unknown;
  body: Body;
}

const call = async (replies: unknown[], p: Promise<unknown>): Promise<unknown> => {
  const reply = await p;
  replies.push(reply ?? null);
  return reply;
};

const roundTrip =
  (section: string, key: string, value: string): Body =>
  async (b, r) => {
    await call(r, b.saveIni(PROBE_FILE, section, key, value, "text"));
    return replyValue(await call(r, b.loadIni(PROBE_FILE, section, key, "text")));
  };

// Values the mirror writes: document JSON is one line, may hold ini metacharacters and any text.
const JSON_DOC = JSON.stringify({ name: "a=b; c # d [e]", n: 3, ok: true, note: 'say "hi" \\ é 🎉' });

export const STEPS: Step[] = [
  {
    id: "ini-read-shape",
    question: "Does loadIni reply with the saved text under .Value (the gateways' replyValue)?",
    expected: "hello",
    body: roundTrip("probe", "plain", "hello"),
  },
  {
    id: "ini-number-text",
    question: 'Is a numeric-looking value saved as text read back as the string "42", not a number?',
    expected: "42",
    body: roundTrip("probe", "number", "42"),
  },
  {
    id: "ini-json-value",
    question: "Does a one-line JSON document with = ; # [ ] quotes, backslash and non-ASCII survive the round trip?",
    expected: JSON_DOC,
    body: roundTrip("probe", "json", JSON_DOC),
  },
  {
    id: "ini-colon-section",
    question: "T-D1: does a section named collection:test round-trip (SF-ADR-004)?",
    expected: JSON_DOC,
    body: roundTrip("collection:test", "a", JSON_DOC),
  },
  {
    id: "ini-slash-key",
    question: "Does a [pending] key containing / (viewers/alice) round-trip (docs/06 T-D1)?",
    expected: "1",
    body: roundTrip("pending", "viewers/alice", "1"),
  },
  {
    id: "ini-absent-key",
    question: "What does loadIni return for a key that was never written? The gateway treats it as absent.",
    expected: "absent",
    body: async (b, r) => {
      const v = replyValue(await call(r, b.loadIni(PROBE_FILE, "probe", "never-written", "text")));
      return v === undefined || v === null || v === "" ? "absent" : v;
    },
  },
  {
    id: "ini-delete-fallback",
    question: 'T-D2: after saving "" over a key, does it read as absent (the gateway\'s delete fallback)?',
    expected: "absent",
    body: async (b, r) => {
      await call(r, b.saveIni(PROBE_FILE, "collection:test", "gone", "doomed", "text"));
      await call(r, b.saveIni(PROBE_FILE, "collection:test", "gone", "", "text"));
      const v = replyValue(await call(r, b.loadIni(PROBE_FILE, "collection:test", "gone", "text")));
      return v === undefined || v === null || v === "" ? "absent" : v;
    },
  },
  {
    id: "variable-object",
    question: "S16: does setVariable with an object come back from getVariable as the same object?",
    expected: { d: { n: 1, s: "x" }, list: [1, 2] },
    body: async (b, r) => {
      await call(r, b.setVariable("fb_probe", { d: { n: 1, s: "x" }, list: [1, 2] }, "global"));
      return replyValue(await call(r, b.getVariable("fb_probe", "global")));
    },
  },
  {
    id: "variable-absent",
    question: "What does getVariable return for a global that does not exist?",
    expected: "absent",
    body: async (b, r) => {
      const v = replyValue(await call(r, b.getVariable("fb_probe_never_set", "global")));
      return v === undefined || v === null || v === "" ? "absent" : v;
    },
  },
  {
    id: "trigger",
    question: `S11: does triggerExt resolve? (Confirm in SAMMI that "${TRIGGER}" fired with pull data n = 7.)`,
    expected: "resolved",
    body: async (b, r) => {
      await call(r, b.triggerExt(TRIGGER, { n: 7, s: "probe" }));
      return "resolved";
    },
  },
];

export const helperNames = (bridge: object): string[] =>
  Object.keys(bridge)
    .filter((k) => typeof (bridge as Record<string, unknown>)[k] === "function")
    .sort();

export async function runProbe(
  bridge: Bridge,
  meta: { version: string; userAgent: string; now: () => Date },
): Promise<ProbeReport> {
  const steps: StepResult[] = [];
  for (const s of STEPS) {
    const replies: unknown[] = [];
    try {
      const observed = await s.body(bridge, replies);
      steps.push({
        id: s.id,
        question: s.question,
        replies,
        observed,
        expected: s.expected,
        pass: equal(observed, s.expected),
      });
    } catch (e) {
      steps.push({
        id: s.id,
        question: s.question,
        replies,
        observed: null,
        expected: s.expected,
        pass: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return {
    probe: "gateway-probe",
    version: meta.version,
    ranAt: meta.now().toISOString(),
    userAgent: meta.userAgent,
    bridgeHelpers: helperNames(bridge),
    steps,
  };
}
