import { runProbe, TRIGGER, type Bridge } from "./steps.ts";

// The probe tab's wiring: Run calls the steps against the Bridge's SAMMI object and shows the report
// as JSON to copy into evidence/pc/gateway-probe.json (T-D2). Host wiring, run on the streaming PC.

declare const SAMMI: Bridge;
declare const PROBE_VERSION: string;

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

export function main(): void {
  el("gpTrigger").textContent = TRIGGER;
  el<HTMLButtonElement>("gpRun").onclick = async () => {
    el("gpStatus").textContent = "Running…";
    const report = await runProbe(SAMMI, {
      version: PROBE_VERSION,
      userAgent: navigator.userAgent,
      now: () => new Date(),
    });
    const seen = el<HTMLInputElement>("gpSeen");
    const render = (): void => {
      const out = { ...report, triggerSeenInSammi: seen.checked };
      el<HTMLTextAreaElement>("gpOut").value = JSON.stringify(out, null, 2);
    };
    seen.onchange = render;
    render();
    const failed = report.steps.filter((s) => !s.pass).map((s) => s.id);
    el("gpStatus").textContent = failed.length
      ? `Done. Differs from the fakes: ${failed.join(", ")}.`
      : "Done. Every step matches the fakes.";
  };
  el<HTMLButtonElement>("gpCopy").onclick = async () => {
    await navigator.clipboard.writeText(el<HTMLTextAreaElement>("gpOut").value);
    el("gpStatus").textContent = "Copied.";
  };
}
