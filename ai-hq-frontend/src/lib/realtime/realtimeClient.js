import { createWsClient } from "../ws.js";

function createRealtimeClient() {
  const eventListeners = new Set();
  const statusListeners = new Set();
  let client = null;
  let refCount = 0;
  let lastStatus = { state: "idle" };

  function emitEvent(event) {
    for (const listener of eventListeners) {
      try {
        listener(event);
      } catch {}
    }
  }

  function emitStatus(status) {
    lastStatus = status || { state: "idle" };
    for (const listener of statusListeners) {
      try {
        listener(lastStatus);
      } catch {}
    }
  }

  function ensureClient() {
    if (client) return client;
    client = createWsClient({
      onEvent: emitEvent,
      onStatus: emitStatus,
    });
    return client;
  }

  function start() {
    const next = ensureClient();
    next.start();
  }

  function stop() {
    if (!client) return;
    try {
      client.stop();
    } catch {}
  }

  function retain() {
    refCount += 1;
    if (refCount === 1) {
      start();
    }
  }

  function release() {
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0) {
      stop();
    }
  }

  function subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    eventListeners.add(listener);
    retain();

    return () => {
      eventListeners.delete(listener);
      release();
    };
  }

  function subscribeStatus(listener) {
    if (typeof listener !== "function") return () => {};
    statusListeners.add(listener);
    try {
      listener(lastStatus);
    } catch {}
    retain();

    return () => {
      statusListeners.delete(listener);
      release();
    };
  }

  return {
    subscribe,
    subscribeStatus,
    getStatus() {
      return lastStatus;
    },
    canUseWs() {
      return ensureClient().canUseWs();
    },
    send(message) {
      return ensureClient().send(message);
    },
  };
}

export const realtimeClient = createRealtimeClient();
