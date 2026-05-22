import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import express from "express";

import {
  apiRouter,
  __test__ as apiRouterTest,
} from "../src/routes/api/index.js";
import {
  operationRequestsRoutes,
} from "../src/routes/api/operationRequests/index.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT_ID = "99999999-9999-4999-8999-999999999999";
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";

function assertTenantPredicate(sql) {
  const text = String(sql).replace(/\s+/g, " ").toLowerCase();
  if (!text.includes("operation_requests")) return;
  if (!text.includes("select") && !text.includes("update operation_requests")) return;
  const whereClause = text.split(" where ")[1] || "";
  if (!whereClause.includes("tenant_id")) {
    const err = new Error("Tenant-scoped database query requires tenant predicate");
    err.code = "TENANT_PREDICATE_REQUIRED";
    throw err;
  }
}

function row(overrides = {}) {
  return {
    id: REQUEST_ID,
    tenant_id: TENANT_ID,
    tenant_key: "acme",
    source_channel: "voice",
    source_call_id: "33333333-3333-4333-8333-333333333333",
    source_event_id: null,
    source_tool_call_id: "tool-call-1",
    operation_type: "create_request",
    request_type: "repair_request",
    business_family: "repair_service",
    status: "new",
    priority: "normal",
    title: "repair_request - Washer repair",
    description: "Washer repair",
    customer_name: "Nigar",
    customer_phone: "+994501112233",
    customer_email: "",
    company_name: "",
    requested_date: "",
    requested_time: "",
    location: "",
    address: "",
    assigned_to: "",
    due_at: null,
    resolved_at: null,
    slots: { description: "Washer repair" },
    extraction: { voiceOutcome: { type: "business_request_created" } },
    meta: { source: "voice_action_runtime" },
    created_at: "2026-05-23T00:00:00.000Z",
    updated_at: "2026-05-23T00:00:00.000Z",
    ...overrides,
  };
}

function makeDb() {
  const rows = [
    row(),
    row({
      id: "44444444-4444-4444-8444-444444444444",
      tenant_id: OTHER_TENANT_ID,
      tenant_key: "other",
      request_type: "quote_request",
    }),
  ];
  const queries = [];

  return {
    rows,
    queries,
    db: {
      query: async (sql, params = []) => {
        const text = String(sql);
        const normalized = text.replace(/\s+/g, " ").toLowerCase();
        queries.push({ text: normalized, params });
        assertTenantPredicate(text);

        if (normalized.includes("from operation_requests")) {
          if (normalized.includes("where id = $1 and tenant_id = $2")) {
            return {
              rows: rows.filter((item) => item.id === params[0] && item.tenant_id === params[1]),
            };
          }

          let result = rows.filter((item) => item.tenant_id === params[0]);
          if (normalized.includes("status = $2")) {
            result = result.filter((item) => item.status === params[1]);
          }
          if (normalized.includes("request_type =")) {
            const requestTypeParam = params.find((item) => String(item).endsWith("_request"));
            if (requestTypeParam) {
              result = result.filter((item) => item.request_type === requestTypeParam);
            }
          }
          return { rows: result };
        }

        if (normalized.includes("update operation_requests")) {
          assert.match(normalized, /where id = \$1 and tenant_id = \$2/);
          const item = rows.find((candidate) => candidate.id === params[0] && candidate.tenant_id === params[1]);
          if (!item) return { rows: [] };

          item.tenant_key = params[2];
          item.source_channel = params[3];
          item.source_call_id = params[4];
          item.source_event_id = params[5];
          item.source_tool_call_id = params[6];
          item.operation_type = params[7];
          item.request_type = params[8];
          item.business_family = params[9];
          item.status = params[10];
          item.priority = params[11];
          item.title = params[12];
          item.description = params[13];
          item.customer_name = params[14];
          item.customer_phone = params[15];
          item.customer_email = params[16];
          item.company_name = params[17];
          item.requested_date = params[18];
          item.requested_time = params[19];
          item.location = params[20];
          item.address = params[21];
          item.assigned_to = params[22];
          item.due_at = params[23];
          item.resolved_at = params[24];
          item.slots = JSON.parse(params[25]);
          item.extraction = JSON.parse(params[26]);
          item.meta = JSON.parse(params[27]);
          return { rows: [item] };
        }

        throw new Error(`unexpected query: ${text}`);
      },
    },
  };
}

function requestJson(server, { method = "GET", path = "/", body, headers = {} } = {}) {
  const address = server.address();
  const payload = body === undefined ? "" : JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method,
        hostname: "127.0.0.1",
        port: address.port,
        path,
        headers: {
          ...(payload
            ? {
                "content-type": "application/json",
                "content-length": Buffer.byteLength(payload),
              }
            : {}),
          ...headers,
        },
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            body: raw ? JSON.parse(raw) : null,
          });
        });
      }
    );

    req.on("error", reject);
    req.end(payload);
  });
}

async function withOperationRequestApp({ dbFixture = makeDb(), auth = {} } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.auth = {
      userId: "user-1",
      tenantId: TENANT_ID,
      tenantKey: "acme",
      role: "operator",
      ...auth,
    };
    req.tenantId = req.auth.tenantId;
    req.tenantKey = req.auth.tenantKey;
    next();
  });
  const auditEntries = [];
  app.use(operationRequestsRoutes({
    db: dbFixture.db,
    audit: {
      log: async (entry) => {
        auditEntries.push(entry);
      },
    },
  }));

  const server = await new Promise((resolve) => {
    const nextServer = app.listen(0, () => resolve(nextServer));
  });

  return {
    ...dbFixture,
    auditEntries,
    server,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

test("list returns only tenant-scoped helper data and ignores client tenant input", async () => {
  const fixture = await withOperationRequestApp();
  try {
    const response = await requestJson(fixture.server, {
      path: `/operation-requests?tenantId=${OTHER_TENANT_ID}&requestType=repair_request`,
      headers: {
        "x-tenant-id": OTHER_TENANT_ID,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.count, 1);
    assert.equal(response.body.requests[0].tenantId, TENANT_ID);
    assert.equal(response.body.items[0].id, REQUEST_ID);
    const listQuery = fixture.queries.find((query) => query.text.includes("from operation_requests"));
    assert.equal(listQuery.params[0], TENANT_ID);
  } finally {
    await fixture.close();
  }
});

test("read returns 404 when tenant-scoped helper returns null", async () => {
  const fixture = await withOperationRequestApp();
  try {
    const response = await requestJson(fixture.server, {
      path: "/operation-requests/00000000-0000-4000-8000-000000000000",
    });

    assert.equal(response.statusCode, 404);
    assert.equal(response.body.code, "operation_request_not_found");
  } finally {
    await fixture.close();
  }
});

test("read returns operation request for tenant", async () => {
  const fixture = await withOperationRequestApp();
  try {
    const response = await requestJson(fixture.server, {
      path: `/operation-requests/${REQUEST_ID}`,
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.request.id, REQUEST_ID);
    assert.equal(response.body.request.tenantId, TENANT_ID);
  } finally {
    await fixture.close();
  }
});

test("patch rejects forbidden fields", async () => {
  const fixture = await withOperationRequestApp();
  try {
    const response = await requestJson(fixture.server, {
      method: "PATCH",
      path: `/operation-requests/${REQUEST_ID}`,
      body: {
        status: "in_review",
        sourceCallId: "55555555-5555-4555-8555-555555555555",
        requestType: "quote_request",
        customerPhone: "+994000000000",
      },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.code, "operation_request_patch_forbidden_fields");
  } finally {
    await fixture.close();
  }
});

test("patch allows operational fields and merges notes into meta", async () => {
  const fixture = await withOperationRequestApp();
  try {
    const response = await requestJson(fixture.server, {
      method: "PATCH",
      path: `/operation-requests/${REQUEST_ID}`,
      body: {
        status: "in_review",
        priority: "high",
        title: "Updated title",
        description: "Updated description",
        assignedTo: "operator-1",
        dueAt: "2026-05-24T10:00:00.000Z",
        resolvedAt: "2026-05-25T10:00:00.000Z",
        notes: "Call customer back",
        meta: {
          operatorNotes: "Prefers morning",
        },
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.request.status, "in_review");
    assert.equal(response.body.request.priority, "high");
    assert.equal(response.body.request.title, "Updated title");
    assert.equal(response.body.request.description, "Updated description");
    assert.equal(response.body.request.assignedTo, "operator-1");
    assert.equal(response.body.request.dueAt, "2026-05-24T10:00:00.000Z");
    assert.equal(response.body.request.resolvedAt, "2026-05-25T10:00:00.000Z");
    assert.equal(response.body.request.meta.source, "voice_action_runtime");
    assert.equal(response.body.request.meta.notes, "Call customer back");
    assert.equal(response.body.request.meta.operatorNotes, "Prefers morning");
    assert.equal(fixture.auditEntries[0].action, "operation_request.updated");
    assert.equal(fixture.auditEntries[0].meta.status.changed, true);
    assert.equal(fixture.auditEntries[0].meta.priority.changed, true);
  } finally {
    await fixture.close();
  }
});

test("patch status resolved auto-fills resolvedAt", async () => {
  const fixture = await withOperationRequestApp();
  try {
    const response = await requestJson(fixture.server, {
      method: "PATCH",
      path: `/operation-requests/${REQUEST_ID}`,
      body: {
        status: "resolved",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.request.status, "resolved");
    assert.ok(response.body.request.resolvedAt);
  } finally {
    await fixture.close();
  }
});

test("patch uses tenant-scoped update and preserves protected fields", async () => {
  const fixture = await withOperationRequestApp();
  try {
    const response = await requestJson(fixture.server, {
      method: "PATCH",
      path: `/operation-requests/${REQUEST_ID}`,
      body: {
        priority: "urgent",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.request.sourceCallId, "33333333-3333-4333-8333-333333333333");
    assert.equal(response.body.request.sourceToolCallId, "tool-call-1");
    assert.equal(response.body.request.requestType, "repair_request");
    assert.equal(response.body.request.customerPhone, "+994501112233");
    const updateQuery = fixture.queries.find((query) => query.text.includes("update operation_requests"));
    assert.match(updateQuery.text, /where id = \$1 and tenant_id = \$2/);
    assert.equal(updateQuery.params[1], TENANT_ID);
  } finally {
    await fixture.close();
  }
});

test("missing tenant context returns unauthorized", async () => {
  const fixture = await withOperationRequestApp({
    auth: {
      tenantId: "",
      tenantKey: "",
    },
  });
  try {
    const response = await requestJson(fixture.server, {
      path: "/operation-requests",
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.body.code, "missing_authenticated_tenant_context");
  } finally {
    await fixture.close();
  }
});

test("operation request writes use existing inbox write permission guard", () => {
  const { requireOperationalSurfaceWriteAccess } = apiRouterTest;
  const req = {
    method: "PATCH",
    originalUrl: "/api/operation-requests/req-1",
    auth: {
      userId: "user-1",
      tenantId: TENANT_ID,
      tenantKey: "acme",
      role: "member",
    },
    user: {
      role: "member",
    },
  };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  let nextCalled = false;

  requireOperationalSurfaceWriteAccess(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

test("operation requests route is mounted behind authenticated API middleware", async () => {
  const app = express();
  app.use(express.json());
  app.use("/api", apiRouter({ db: makeDb().db, dbDisabled: false, audit: null }));

  const server = await new Promise((resolve) => {
    const nextServer = app.listen(0, () => resolve(nextServer));
  });

  try {
    const response = await requestJson(server, {
      path: "/api/operation-requests",
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.body.ok, false);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});
