import { realtimeClient } from "./realtimeClient.js";

function ignoreError() {
  return undefined;
}

function createRealtimeStore() {
  let lastEvent = null;
  let status = realtimeClient.getStatus();
  const snapshotListeners = new Set();
  let wired = false;

  function notify() {
    for (const listener of snapshotListeners) {
      try {
        listener();
      } catch {
        ignoreError();
      }
    }
  }

  function ensureWired() {
    if (wired) return;
    wired = true;

    realtimeClient.subscribe((event) => {
      lastEvent = event || null;
      notify();
    });

    realtimeClient.subscribeStatus((nextStatus) => {
      status = nextStatus || { state: "idle" };
      notify();
    });
  }

  return {
    subscribe(listener) {
      ensureWired();
      if (typeof listener !== "function") return () => {};
      snapshotListeners.add(listener);
      return () => {
        snapshotListeners.delete(listener);
      };
    },
    subscribeEvents(listener) {
      return realtimeClient.subscribe(listener);
    },
    subscribeStatus(listener) {
      return realtimeClient.subscribeStatus(listener);
    },
    getSnapshot() {
      return {
        lastEvent,
        status,
      };
    },
    getStatus() {
      return status;
    },
    canUseWs() {
      return realtimeClient.canUseWs();
    },
    send(message) {
      return realtimeClient.send(message);
    },
  };
}

export const realtimeStore = createRealtimeStore();