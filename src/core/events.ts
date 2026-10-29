import { host } from "./host.ts";

// Domain events become SAMMI extension triggers carrying the reduced PADR-004 envelope
// (SF-ADR-006, contracts/event-envelope.json).

export type EventType =
  | "Connected"
  | "ConnectionFailed"
  | "Disconnected"
  | "MirrorReconciled"
  | "CollectionDefined"
  | "CollectionUndefined"
  | "DocumentCreated"
  | "DocumentReplaced"
  | "DocumentUpdated"
  | "DocumentDeleted"
  | "WriteRejected";

export interface EventOptions {
  source?: "local" | "remote";
  deviceId?: string;
}

export const triggerName = (type: EventType): string => `Firebase: ${type.replace(/(?<!^)([A-Z])/g, " $1")}`;

export async function emit(type: EventType, fields: Record<string, unknown>, opts: EventOptions = {}): Promise<void> {
  const { ports, state, cause } = host();
  const source = opts.source ?? "local";
  const pullData: Record<string, unknown> = {
    eventId: ports.uuid(),
    eventType: type,
    timestamp: new Date(ports.now()).toISOString(),
    version: 1,
    source,
    deviceId: opts.deviceId ?? state.deviceId,
  };
  if (source === "local") pullData.causationId = cause;
  await ports.sammi.trigger(triggerName(type), { ...pullData, ...fields });
}
