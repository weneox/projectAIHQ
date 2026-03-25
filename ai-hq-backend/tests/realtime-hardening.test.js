import test from "node:test";
import assert from "node:assert/strict";
import http from "http";
import { once } from "node:events";
import WebSocket from "ws";

import { cfg } from "../src/config.js";
import { issueRealtimeTicket } from "../src/realtime/auth.js";
import { createWsHub } from "../src/wsHub.js";

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return `ws://127.0.0.1:${address.port}/ws`;
}

async function openSocket(url) {
  const ws = new WebSocket(url);
  const messages = [];
  ws.on("message", (buf) => {
    try {
      messages.push(JSON.parse(String(buf)));
    } catch {}
  });
  await once(ws, "open");
  return { ws, messages };
}

function waitForClose(ws) {
  return new Promise((resolve) => {
    ws.on("close", (code, reason) => {
      resolve({ code, reason: String(reason || "") });
    });
  });
}

function waitForMessageCount(messages, count, timeoutMs = 800) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (messages.length >= count) {
        clearInterval(timer);
        resolve(messages);
        return;
      }

      if (Date.now() - started >= timeoutMs) {
        clearInterval(timer);
        reject(new Error(`timed out waiting for ${count} messages; got ${messages.length}`));
      }
    }, 20);
  });
}

function waitQuietly(ms = 200) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("websocket rejects missing realtime ticket", async () => {
  const previousSecret = cfg.auth.userSessionSecret;
  cfg.auth.userSessionSecret = "test-realtime-secret";

  const server = http.createServer();
  const hub = createWsHub({ server });
  const baseUrl = await listen(server);

  try {
    const ws = new WebSocket(baseUrl);
    const closed = await waitForClose(ws);
    assert.equal(closed.code, 1008);
  } finally {
    hub.close();
    await new Promise((resolve) => server.close(resolve));
    cfg.auth.userSessionSecret = previousSecret;
  }
});

test("websocket broadcasts stay tenant-scoped", async () => {
  const previousSecret = cfg.auth.userSessionSecret;
  cfg.auth.userSessionSecret = "test-realtime-secret";

  const server = http.createServer();
  const hub = createWsHub({ server });
  const baseUrl = await listen(server);

  try {
    const acmeTicket = issueRealtimeTicket({
      userId: "user-acme",
      tenantId: "tenant-acme",
      tenantKey: "acme",
      role: "operator",
    });
    const betaTicket = issueRealtimeTicket({
      userId: "user-beta",
      tenantId: "tenant-beta",
      tenantKey: "beta",
      role: "operator",
    });

    const acme = await openSocket(`${baseUrl}?ticket=${encodeURIComponent(acmeTicket)}`);
    const beta = await openSocket(`${baseUrl}?ticket=${encodeURIComponent(betaTicket)}`);
    await waitForMessageCount(acme.messages, 1);
    await waitForMessageCount(beta.messages, 1);

    hub.broadcast("inbox.thread.updated", {
      thread: {
        id: "thread-1",
        tenant_key: "acme",
      },
    });

    await waitForMessageCount(acme.messages, 2);
    await waitQuietly();

    assert.equal(acme.messages[1]?.type, "inbox.thread.updated");
    assert.equal(beta.messages.length, 1);

    acme.ws.close();
    beta.ws.close();
  } finally {
    hub.close();
    await new Promise((resolve) => server.close(resolve));
    cfg.auth.userSessionSecret = previousSecret;
  }
});

test("operator-only realtime events do not reach tenant members", async () => {
  const previousSecret = cfg.auth.userSessionSecret;
  cfg.auth.userSessionSecret = "test-realtime-secret";

  const server = http.createServer();
  const hub = createWsHub({ server });
  const baseUrl = await listen(server);

  try {
    const operatorTicket = issueRealtimeTicket({
      userId: "user-operator",
      tenantId: "tenant-acme",
      tenantKey: "acme",
      role: "operator",
    });
    const memberTicket = issueRealtimeTicket({
      userId: "user-member",
      tenantId: "tenant-acme",
      tenantKey: "acme",
      role: "member",
    });

    const operator = await openSocket(`${baseUrl}?ticket=${encodeURIComponent(operatorTicket)}`);
    const member = await openSocket(`${baseUrl}?ticket=${encodeURIComponent(memberTicket)}`);
    await waitForMessageCount(operator.messages, 1);
    await waitForMessageCount(member.messages, 1);

    hub.broadcast({
      type: "voice.call.updated",
      audience: "operator",
      call: {
        id: "call-1",
        tenant_key: "acme",
      },
    });

    await waitForMessageCount(operator.messages, 2);
    await waitQuietly();

    assert.equal(operator.messages[1]?.type, "voice.call.updated");
    assert.equal(member.messages.length, 1);

    operator.ws.close();
    member.ws.close();
  } finally {
    hub.close();
    await new Promise((resolve) => server.close(resolve));
    cfg.auth.userSessionSecret = previousSecret;
  }
});
