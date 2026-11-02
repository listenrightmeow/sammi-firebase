import { host } from "./host.ts";

const changes = (n: number, kind: string, verb: string): string =>
  `${n} ${kind} ${n === 1 ? "change" : "changes"} ${verb}`;

/** Failure 1b: the one alert after edits made while the Bridge was closed. Reports once. */
export function takeCatchUpNotice(): string | undefined {
  const { state } = host();
  const done = state.iniCatchUp;
  state.iniCatchUp = undefined;
  if (!done) return undefined;
  return `SAMMI Firebase: Back online: ${changes(done.pushed, "local", "pushed")}, ${changes(done.applied, "remote", "applied")}`;
}

/** Rule 7: names the documents the ini held as invalid JSON at start, for the tab. */
export function invalidIniNotice(): string {
  const { invalidIni } = host().state;
  return invalidIni.length ? ` · invalid JSON ignored in firebase.ini: ${invalidIni.join(", ")}` : "";
}

/** D32: documents a large collection's variable leaves out, for the tab. */
export function unreachableNotice(): string {
  const count = [...host().state.unreachable.values()].reduce((sum, ids) => sum + ids.length, 0);
  return count ? ` · ${count} with a dash or space in the id: read with commands, not variables` : "";
}
