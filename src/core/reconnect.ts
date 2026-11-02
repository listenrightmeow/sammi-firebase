import { settleInFlight } from "./document.ts";

/**
 * Rules 4 and 6 when the connection returns. The SDK's get() answers from its cache while a listener
 * is active, which at this moment still holds the tree from before the drop, so the listener goes
 * first: the reconcile reads the server, decides each pending entry, and only then subscribes again.
 */
export async function reconcileAfterReconnect(steps: {
  stopListening: () => void;
  reconcile: () => Promise<unknown>;
  startListening: () => Promise<void>;
}): Promise<void> {
  steps.stopListening();
  try {
    await settleInFlight();
    await steps.reconcile();
  } finally {
    await steps.startListening();
  }
}
