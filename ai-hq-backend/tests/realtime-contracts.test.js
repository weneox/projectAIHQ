import test from "node:test";
import assert from "node:assert/strict";

import { emitRealtimeEvent } from "../src/realtime/events.js";
import { broadcastLead } from "../src/routes/api/leads/events.js";

test("emitRealtimeEvent rejects invalid event shape", () => {
  const sent = [];
  const ok = emitRealtimeEvent(
    {
      broadcast(payload) {
        sent.push(payload);
        return true;
      },
    },
    {
      type: "inbox.thread.updated",
      thread: { id: "thread-1" },
    }
  );

  assert.equal(ok, false);
  assert.equal(sent.length, 0);
});

test("emitRealtimeEvent broadcasts validated scoped payloads", () => {
  const sent = [];
  const ok = emitRealtimeEvent(
    {
      broadcast(payload) {
        sent.push(payload);
        return true;
      },
    },
    {
      type: "inbox.thread.updated",
      audience: "operator",
      tenantKey: "acme",
      thread: { id: "thread-1", tenant_key: "acme" },
    }
  );

  assert.equal(ok, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].tenantKey, "acme");
  assert.equal(sent[0].audience, "operator");
});

test("broadcastLead still delivers through explicit realtime helper", async () => {
  const sent = [];
  await broadcastLead(
    {
      broadcast(payload) {
        sent.push(payload);
        return true;
      },
    },
    "lead.updated",
    {
      id: "lead-1",
      tenant_key: "acme",
    }
  );

  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, "lead.updated");
  assert.equal(sent[0].tenantKey, "acme");
  assert.equal(sent[0].audience, "operator");
});
