import { host } from "./host.ts";
import { documentCount } from "./store.ts";

/** The ConnectionStatus projection (Get Status, and Connect's answer). */
export function status(): Record<string, unknown> {
  const { state } = host();
  return {
    state: state.connected ? "Connected" : "Disconnected",
    ...(state.email ? { email: state.email } : {}),
    ...(state.config ? { projectId: state.config.projectId } : {}),
    documents: documentCount(),
    pending: state.pending.size,
    ...(state.lastSync !== undefined ? { lastSync: state.lastSync } : {}),
    deviceId: state.deviceId,
    ...(state.invalidIni.length ? { invalidIni: [...state.invalidIni] } : {}),
  };
}
