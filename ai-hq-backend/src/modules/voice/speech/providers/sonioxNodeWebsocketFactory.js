import WebSocket from "ws";

export const SONIOX_NODE_WEBSOCKET_FACTORY_VERSION =
  "soniox_node_websocket_factory.v1";

function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeSendJson(socket, payload) {
  if (!payload || typeof payload !== "object") return;
  socket.send(JSON.stringify(payload));
}

function closeQuietly(socket) {
  try {
    socket?.close?.();
  } catch {
    // ignore close failures
  }
}

export function createSonioxNodeWebsocketFactory({
  WebSocketImpl = WebSocket,
  connectTimeoutMs = 10_000,
  autoSendInitialConfig = true,
} = {}) {
  return function sonioxNodeWebsocketFactory(request = {}) {
    const url = s(request.url);
    const stage = s(request.stage);
    const initialConfig = obj(request.initialConfig || request.config);

    if (!url) {
      throw new Error("soniox_websocket_url_missing");
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      let socket = null;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        closeQuietly(socket);
        reject(new Error("soniox_websocket_connect_timeout"));
      }, connectTimeoutMs);

      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        fn(value);
      };

      try {
        socket = new WebSocketImpl(url);

        socket.once("open", () => {
          try {
            if (autoSendInitialConfig) {
              safeSendJson(socket, initialConfig);
            }

            finish(resolve, {
              socket,
              provider: "soniox",
              stage,
              url,
              networkIo: true,
              initialConfigSent:
                autoSendInitialConfig && Object.keys(initialConfig).length > 0,
            });
          } catch (err) {
            closeQuietly(socket);
            finish(reject, err);
          }
        });

        socket.once("error", (err) => {
          closeQuietly(socket);
          finish(reject, err || new Error("soniox_websocket_error"));
        });
      } catch (err) {
        closeQuietly(socket);
        finish(reject, err);
      }
    });
  };
}
