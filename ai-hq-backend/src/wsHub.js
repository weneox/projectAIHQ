import { WebSocketServer } from "ws";
import { isOperatorRealtimeRole, verifyRealtimeTicket } from "./realtime/auth.js";
import { buildRealtimeEnvelope, inferRealtimeAudience } from "@aihq/shared-contracts/realtime";
import { recordRealtimeAuthFailure } from "./observability/runtimeSignals.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isOperatorAudience(audience = "") {
  return lower(audience) === "operator";
}

function scanScope(value, depth = 0) {
  if (!value || depth > 4) {
    return {
      tenantKey: "",
      tenantId: "",
    };
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = scanScope(item, depth + 1);
      if (found.tenantKey || found.tenantId) return found;
    }

    return {
      tenantKey: "",
      tenantId: "",
    };
  }

  if (!isObj(value)) {
    return {
      tenantKey: "",
      tenantId: "",
    };
  }

  const tenantKey = lower(
    value.tenantKey ||
      value.tenant_key ||
      value.scope?.tenantKey ||
      value.scope?.tenant_key
  );
  const tenantId = s(
    value.tenantId ||
      value.tenant_id ||
      value.scope?.tenantId ||
      value.scope?.tenant_id
  );

  if (tenantKey || tenantId) {
    return { tenantKey, tenantId };
  }

  for (const child of Object.values(value)) {
    const found = scanScope(child, depth + 1);
    if (found.tenantKey || found.tenantId) return found;
  }

  return {
    tenantKey: "",
    tenantId: "",
  };
}

function normalizeBroadcastMessage(input, payload) {
  const msg = (() => {
    if (typeof input === "string") {
      if (isObj(payload)) return { ...payload, type: input };
      return { type: input, payload };
    }

    if (isObj(input)) {
      return { ...input };
    }

    return null;
  })();

  if (!isObj(msg)) return null;

  const type = s(msg.type || msg.event);
  if (!type) return null;

  const inferredScope = scanScope(msg);
  const tenantKey = lower(msg.tenantKey || inferredScope.tenantKey);
  const tenantId = s(msg.tenantId || inferredScope.tenantId);

  if (!tenantKey && !tenantId) {
    return null;
  }

  const checked = buildRealtimeEnvelope({
    ...msg,
    type,
    tenantKey,
    tenantId,
    audience: lower(msg.audience || inferRealtimeAudience(type)),
  });

  return checked.ok ? checked.value : null;
}

function canReceive(scope = {}, message = {}) {
  const scopeTenantKey = lower(scope.tenantKey);
  const scopeTenantId = s(scope.tenantId);
  const messageTenantKey = lower(message.tenantKey);
  const messageTenantId = s(message.tenantId);

  const tenantMatch =
    (scopeTenantKey && messageTenantKey && scopeTenantKey === messageTenantKey) ||
    (scopeTenantId && messageTenantId && scopeTenantId === messageTenantId);

  if (!tenantMatch) return false;

  if (!isOperatorAudience(message.audience)) {
    return true;
  }

  return isOperatorRealtimeRole(scope.role);
}

export function createWsHub({ server, logger = null }) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const clients = new Set();

  function send(ws, obj) {
    try {
      ws.send(JSON.stringify(obj));
    } catch {}
  }

  function broadcast(input, payload) {
    const message = normalizeBroadcastMessage(input, payload);
    if (!message) return false;

    const encoded = JSON.stringify(message);

    for (const ws of clients) {
      try {
        if (!canReceive(ws.scope, message)) continue;
        ws.send(encoded);
      } catch {}
    }

    return true;
  }

  const interval = setInterval(() => {
    for (const ws of clients) {
      if (ws.isAlive === false) {
        try {
          ws.terminate();
        } catch {}
        clients.delete(ws);
        continue;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {}
    }
  }, 30_000);

  wss.on("close", () => clearInterval(interval));

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, "http://localhost");
    const ticket = s(url.searchParams.get("ticket"));
    const verified = verifyRealtimeTicket(ticket);

    if (!verified.ok) {
      recordRealtimeAuthFailure({
        reason: verified.error,
      });
      logger?.warn?.("realtime.connect.denied", {
        reason: verified.error,
        remoteAddress: s(req.socket?.remoteAddress),
      });
      ws.close(1008, "unauthorized");
      return;
    }

    ws.scope = verified.scope;
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    clients.add(ws);
    logger?.info?.("realtime.connect.accepted", {
      tenantKey: ws.scope.tenantKey,
      tenantId: ws.scope.tenantId,
      userId: ws.scope.userId,
      role: ws.scope.role,
    });
    send(ws, {
      type: "hello",
      tenantKey: ws.scope.tenantKey,
      tenantId: ws.scope.tenantId,
      audience: ws.scope.audience,
      role: ws.scope.role,
      ts: Date.now(),
    });

    ws.on("close", () => {
      clients.delete(ws);
      logger?.info?.("realtime.connect.closed", {
        tenantKey: ws.scope?.tenantKey,
        tenantId: ws.scope?.tenantId,
        userId: ws.scope?.userId,
      });
    });
  });

  function close() {
    clearInterval(interval);
    try {
      wss.close();
    } catch {}
  }

  return { broadcast, send, close };
}
