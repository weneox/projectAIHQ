import { expect, test } from "@playwright/test";

function ok(body) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function mockApi(page) {
  const counters = {
    truthCompareRequests: 0,
  };
  page.__mockCounters = counters;

  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (!path.startsWith("/api/")) {
      return route.continue();
    }

    if (path === "/api/auth/me") {
      return route.fulfill(
        ok({
          ok: true,
          authenticated: true,
          user: {
            id: "user-1",
            full_name: "Operator",
            user_email: "operator@aihq.test",
            role: "owner",
            tenant_key: "neox",
          },
        })
      );
    }

    if (path === "/api/app/bootstrap") {
      return route.fulfill(
        ok({
          ok: true,
          viewerRole: "owner",
          workspace: {
            tenantKey: "neox",
            tenant: { tenant_key: "neox", display_name: "NEOX" },
            businessProfile: {
              companyName: "North Clinic",
              description: "Clinic in Baku",
            },
            progress: {
              setupCompleted: true,
              nextRoute: "/",
              nextSetupRoute: "/setup/studio",
              nextStudioStage: "ready",
            },
          },
          setup: {
            progress: {
              setupCompleted: true,
              nextRoute: "/",
              nextSetupRoute: "/setup/studio",
              nextStudioStage: "ready",
            },
          },
        })
      );
    }

    if (path === "/api/setup/review/current") {
      return route.fulfill(
        ok({
          ok: true,
          concurrency: {
            sessionId: "review-session-1",
            sessionStatus: "active",
            draftVersion: "draft-v3",
          },
          finalizeProtection: {
            lockConflict: false,
          },
          review: {
            session: {
              id: "review-session-1",
              status: "active",
            },
            draft: {
              version: "draft-v3",
              businessProfile: {
                companyName: "North Clinic",
                description: "Clinic in Baku",
              },
              draftPayload: {
                profile: {
                  companyName: "North Clinic",
                  description: "Clinic in Baku",
                },
              },
              knowledgeItems: [],
              services: [],
            },
            sources: [
              {
                id: "source-1",
                sourceType: "website",
                label: "Website",
                url: "https://north.example",
                isPrimary: true,
              },
            ],
            events: [],
          },
        })
      );
    }

    if (path === "/api/knowledge/candidates") {
      return route.fulfill(ok({ ok: true, items: [] }));
    }

    if (path === "/api/setup/services") {
      return route.fulfill(ok({ ok: true, items: [] }));
    }

    if (path === "/api/setup/truth/current") {
      return route.fulfill(
        ok({
          ok: true,
          truth: {
            profile: {
              companyName: "North Clinic",
              websiteUrl: "https://north.example",
            },
            fieldProvenance: {
              companyName: {
                sourceLabel: "Website",
                sourceUrl: "https://north.example/about",
                authorityRank: 1,
              },
            },
            approvedAt: "2026-03-25T10:00:00.000Z",
            approvedBy: "reviewer@aihq.test",
            history: [
              {
                id: "truth-v3",
                version: "v3",
                versionLabel: "Truth version v3",
                previousVersionId: "truth-v2",
                profileStatus: "approved",
                approvedAt: "2026-03-24T09:00:00.000Z",
                approvedBy: "owner@aihq.test",
                sourceSummary: "Website, https://north.example/about",
                changedFields: ["companyName", "websiteUrl"],
                fieldChanges: [
                  {
                    key: "companyName",
                    label: "Company name",
                    before: "Old Clinic",
                    after: "North Clinic",
                  },
                ],
                diff: {
                  summary: "companyName and websiteUrl changed",
                },
              },
              {
                id: "truth-v2",
                version: "v2",
                versionLabel: "Truth version v2",
                previousVersionId: "truth-v1",
                profileStatus: "approved",
                approvedAt: "2026-03-20T09:00:00.000Z",
                approvedBy: "owner@aihq.test",
              },
            ],
          },
        })
      );
    }

    if (path === "/api/setup/truth/history/truth-v3") {
      counters.truthCompareRequests += 1;
      return route.fulfill(
        ok({
          ok: true,
          detail: {
            id: "truth-v3",
            version: "v3",
            versionLabel: "Truth version v3",
            profileStatus: "approved",
            approvedAt: "2026-03-25T10:00:00.000Z",
            approvedBy: "reviewer@aihq.test",
            sourceSummary: "Website, https://north.example/about",
          },
          compare: {
            id: "truth-v2",
            version: "v2",
            versionLabel: "Truth version v2",
            approvedAt: "2026-03-24T09:00:00.000Z",
            approvedBy: "owner@aihq.test",
          },
          changedFields: ["companyName", "websiteUrl"],
          fieldChanges: [
            {
              key: "companyName",
              label: "Company name",
              before: "Old Clinic",
              after: "North Clinic",
            },
          ],
          sectionChanges: [
            {
              key: "profile",
              label: "Business profile",
              summary: "Core identity fields were refreshed from approved review.",
            },
          ],
          diff: {
            summary: "companyName and websiteUrl changed",
          },
        })
      );
    }

    if (path === "/api/setup/truth/history/truth-v2") {
      counters.truthCompareRequests += 1;
      return route.fulfill(
        ok({
          ok: true,
          detail: {
            id: "truth-v2",
            version: "v2",
            versionLabel: "Truth version v2",
            profileStatus: "approved",
            approvedAt: "2026-03-20T09:00:00.000Z",
            approvedBy: "owner@aihq.test",
          },
          compare: {
            id: "truth-v1",
            version: "v1",
            versionLabel: "Truth version v1",
          },
          changedFields: [],
          fieldChanges: [],
          sectionChanges: [],
          diff: {},
        })
      );
    }

    if (path === "/api/settings/workspace") {
      return route.fulfill(
        ok({
          ok: true,
          tenantKey: "neox",
          viewerRole: "owner",
          tenant: {
            tenant_key: "neox",
            display_name: "NEOX",
            timezone: "Asia/Baku",
            language: "en",
          },
          profile: {},
          aiPolicy: {},
        })
      );
    }

    if (path === "/api/settings/agents") {
      return route.fulfill(ok({ ok: true, agents: [] }));
    }

    if (path === "/api/settings/business-facts") {
      return route.fulfill(ok({ ok: true, facts: [] }));
    }

    if (path === "/api/settings/channel-policies") {
      return route.fulfill(ok({ ok: true, policies: [] }));
    }

    if (path === "/api/settings/locations") {
      return route.fulfill(ok({ ok: true, locations: [] }));
    }

    if (path === "/api/settings/contacts") {
      return route.fulfill(ok({ ok: true, contacts: [] }));
    }

    if (path === "/api/settings/sources") {
      return route.fulfill(
        ok({
          ok: true,
          tenantKey: "neox",
          items: [
            {
              id: "source-1",
              source_type: "website",
              display_name: "Main Website",
              source_url: "https://north.example",
              status: "connected",
              sync_status: "completed",
              is_enabled: true,
              review: {
                required: true,
                sessionId: "review-session-1",
                projectionStatus: "pending_review",
                candidateDraftCount: 2,
                candidateCreatedCount: 1,
                canonicalProjection: "protected",
              },
            },
          ],
          count: 1,
        })
      );
    }

    if (path === "/api/settings/knowledge/review-queue") {
      return route.fulfill(
        ok({
          ok: true,
          tenantKey: "neox",
          items: [
            {
              id: "candidate-1",
              category: "general",
              item_key: "company_name",
              confidence_label: "high",
              confidence: 0.92,
              source_type: "website",
              status: "pending",
              title: "North Clinic",
              source_display_name: "Main Website",
              first_seen_at: "2026-03-25T09:00:00.000Z",
              value_text: "North Clinic",
              source_evidence_json: [],
            },
          ],
          count: 1,
        })
      );
    }

    if (path === "/api/inbox/threads") {
      return route.fulfill(ok({ ok: true, threads: [] }));
    }

    if (path === "/api/leads") {
      return route.fulfill(ok({ ok: true, leads: [] }));
    }

    if (path === "/api/comments") {
      return route.fulfill(ok({ ok: true, comments: [] }));
    }

    if (path === "/api/voice/calls") {
      return route.fulfill(ok({ ok: true, calls: [] }));
    }

    return route.fulfill(ok({ ok: true }));
  });
}

async function mockViewerRole(page, role = "owner") {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill(
      ok({
        ok: true,
        authenticated: true,
        user: {
          id: "user-1",
          full_name: "Operator",
          user_email: "operator@aihq.test",
          role,
          tenant_key: "neox",
        },
      })
    );
  });

  await page.route("**/api/app/bootstrap", async (route) => {
    await route.fulfill(
      ok({
        ok: true,
        viewerRole: role,
        workspace: {
          tenantKey: "neox",
          tenant: { tenant_key: "neox", display_name: "NEOX" },
          businessProfile: {
            companyName: "North Clinic",
            description: "Clinic in Baku",
          },
          progress: {
            setupCompleted: true,
            nextRoute: "/",
            nextSetupRoute: "/setup/studio",
            nextStudioStage: "ready",
          },
        },
        setup: {
          progress: {
            setupCompleted: true,
            nextRoute: "/",
            nextSetupRoute: "/setup/studio",
            nextStudioStage: "ready",
          },
        },
      })
    );
  });
}

test.beforeEach(async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error);
  });
  pageErrors.length = 0;
  await mockApi(page);
  page.__pageErrors = pageErrors;
});

test.afterEach(async ({ page }) => {
  expect(page.__pageErrors || []).toEqual([]);
});

test("/setup/studio opens on Entry first with explicit review/truth actions", async ({
  page,
}) => {
  await page.goto("/setup/studio");

  await expect(
    page.getByRole("heading", {
      name: /build your business draft from real signals/i,
    })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /create draft/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /resume review/i })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /open review workspace/i })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /view approved truth/i })
  ).toBeVisible();
});

test("unauthenticated users are sent into login flow from root", async ({ page }) => {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill(
      ok({
        ok: true,
        authenticated: false,
      })
    );
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: /back inside/i })).toBeVisible();
});

test("authenticated users land on real setup flow instead of demo root when setup is incomplete", async ({
  page,
}) => {
  await page.route("**/api/app/bootstrap", async (route) => {
    await route.fulfill(
      ok({
        ok: true,
        viewerRole: "owner",
        workspace: {
          tenantKey: "neox",
          progress: {
            setupCompleted: false,
            nextRoute: "/",
            nextSetupRoute: "/setup/studio",
            nextStudioStage: "entry",
          },
        },
        setup: {
          progress: {
            setupCompleted: false,
            nextRoute: "/",
            nextSetupRoute: "/setup/studio",
            nextStudioStage: "entry",
          },
        },
      })
    );
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/setup\/studio$/);
  await expect(
    page.getByRole("heading", {
      name: /build your business draft from real signals/i,
    })
  ).toBeVisible();
});

test("authenticated users land on approved truth when setup is already complete", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/truth$/);
  await expect(
    page.getByRole("heading", { name: /business truth/i })
  ).toBeVisible();
});

test("/truth renders approved truth", async ({ page }) => {
  await page.goto("/truth");

  await expect(
    page.getByRole("heading", { name: /business truth/i })
  ).toBeVisible();
  await expect(page.getByText("reviewer@aihq.test")).toBeVisible();
  await expect(page.getByText(/field-level provenance is available/i)).toBeVisible();
  await expect(page.getByText(/truth version timeline/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /view compare/i }).first()
  ).toBeVisible();
});

test("/truth compare flow renders rich and sparse version detail safely", async ({
  page,
}) => {
  await page.goto("/truth");

  const compareButtons = page.getByRole("button", { name: /view compare/i });
  await expect(compareButtons).toHaveCount(2);

  await compareButtons.first().click();
  const compareDialog = page.getByLabel("Truth version compare");
  await expect(compareDialog.getByText(/version detail/i)).toBeVisible();
  await expect(compareDialog.getByText(/selected version/i)).toBeVisible();
  await expect(compareDialog.getByText(/compared against/i)).toBeVisible();
  await expect(compareDialog.getByText(/truth version v3/i)).toBeVisible();
  await expect(compareDialog.getByText(/truth version v2/i)).toBeVisible();
  await expect(compareDialog.getByText(/changed fields/i)).toBeVisible();
  await expect(compareDialog.getByText(/company name/i)).toBeVisible();
  await expect(compareDialog.getByText(/^before$/i)).toBeVisible();
  await expect(compareDialog.getByText(/^after$/i)).toBeVisible();
  await expect(compareDialog.getByText(/business profile/i)).toBeVisible();
  expect(page.__mockCounters.truthCompareRequests).toBeGreaterThan(0);

  await page.keyboard.press("Escape");
  await expect(compareDialog).not.toBeVisible();

  await compareButtons.nth(1).click();
  await expect(compareDialog.getByText("Version detail").first()).toBeVisible();
  await expect(
    compareDialog.getByText(/the backend did not return structured diff detail/i)
  ).toBeVisible();
});

test("/settings renders truth-maintenance sources and knowledge review", async ({
  page,
}) => {
  await page.goto("/settings");

  await page.getByRole("button", { name: /sources/i }).click();
  await expect(page.getByText(/sync refreshes source evidence only/i)).toBeVisible();
  await expect(page.getByText(/2 review items waiting/i)).toBeVisible();

  await page.getByRole("button", { name: /knowledge review/i }).click();
  await expect(
    page.getByText(/this is source evidence under review, not approved truth yet/i)
  ).toBeVisible();
});

test("lead to inbox deep-link opens the intended thread when available", async ({ page }) => {
  await page.route("**/api/leads*", async (route) => {
    await route.fulfill(
      ok({
        ok: true,
        leads: [
          {
            id: "lead-1",
            full_name: "Aysel Mammadova",
            stage: "qualified",
            status: "open",
            inbox_thread_id: "thread-1",
            source: "instagram",
            interest: "Consultation",
            score: 87,
            created_at: "2026-03-25T09:00:00.000Z",
            updated_at: "2026-03-25T09:05:00.000Z",
          },
        ],
      })
    );
  });

  await page.route("**/api/inbox/threads", async (route) => {
    await route.fulfill(
      ok({
        ok: true,
        threads: [
          {
            id: "thread-1",
            customer_name: "Aysel Mammadova",
            channel: "instagram",
            status: "open",
            unread_count: 2,
            last_message_at: "2026-03-25T09:05:00.000Z",
          },
          {
            id: "thread-2",
            customer_name: "Other Customer",
            channel: "whatsapp",
            status: "open",
            unread_count: 0,
            last_message_at: "2026-03-25T08:00:00.000Z",
          },
        ],
      })
    );
  });

  await page.route("**/api/inbox/threads/thread-1", async (route) => {
    await route.fulfill(
      ok({
        ok: true,
        thread: {
          id: "thread-1",
          customer_name: "Aysel Mammadova",
          external_username: "aysel",
          channel: "instagram",
          status: "open",
          unread_count: 2,
          handoff_active: false,
        },
      })
    );
  });

  await page.route("**/api/inbox/threads/thread-1/messages?limit=200", async (route) => {
    await route.fulfill(
      ok({
        ok: true,
        messages: [
          {
            id: "msg-1",
            thread_id: "thread-1",
            direction: "inbound",
            text: "I want to book a consultation",
            created_at: "2026-03-25T09:03:00.000Z",
          },
        ],
      })
    );
  });

  await page.goto("/inbox");
  await page.getByRole("button", { name: /open in leads/i }).click();
  await expect(page.getByText(/^Leads$/)).toBeVisible();
  await page.getByRole("button", { name: /open inbox thread/i }).click();

  await expect(page).toHaveURL(/\/inbox\?threadId=thread-1$/);
  await expect(page.getByText(/aysel mammadova/i).first()).toBeVisible();
  await expect(page.getByText(/i want to book a consultation/i)).toBeVisible();
});

test("lead to inbox deep-link degrades safely when the thread is unavailable", async ({ page }) => {
  await page.route("**/api/inbox/threads", async (route) => {
    await route.fulfill(ok({ ok: true, threads: [] }));
  });

  await page.route("**/api/inbox/threads/thread-missing", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Thread not found" }),
    });
  });

  await page.route("**/api/inbox/threads/thread-missing/messages?limit=200", async (route) => {
    await route.fulfill(ok({ ok: true, messages: [] }));
  });

  await page.goto("/inbox?threadId=thread-missing");

  await expect(
    page.getByText(/requested inbox thread is no longer available/i)
  ).toBeVisible();
  await expect(page.getByText(/no threads yet/i)).toBeVisible();
});

test("operator-only routes show a clean access-denied state for non-operator users", async ({
  page,
}) => {
  await mockViewerRole(page, "member");
  await page.goto("/leads");

  await expect(page.getByText(/restricted surface/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /operator access required/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /go to business truth/i })).toBeVisible();
  await expect(page.getByText(/lead pipeline/i)).toHaveCount(0);
});

test("operator roles can still open operator surfaces directly", async ({ page }) => {
  await mockViewerRole(page, "operator");
  await page.route("**/api/leads*", async (route) => {
    await route.fulfill(ok({ ok: true, leads: [] }));
  });

  await page.goto("/leads");
  await expect(page.getByText(/^Leads$/)).toBeVisible();
  await expect(page.getByText(/lead pipeline/i)).toBeVisible();
});

test("primary navigation stays focused on the launch slice", async ({ page }) => {
  await page.goto("/truth");
  await expect(page.locator('a[href="/setup/studio"]')).toHaveCount(1);
  await expect(page.locator('a[href="/inbox"]')).toHaveCount(1);
  await expect(page.locator('a[href="/truth"]')).toHaveCount(1);
  await expect(page.locator('a[href="/settings"]')).toHaveCount(1);
  await expect(page.getByText("Command Demo")).toHaveCount(0);
  await expect(page.getByText("Analytics")).toHaveCount(0);
  await expect(page.getByText("Agents")).toHaveCount(0);
  await expect(page.locator('a[href="/proposals"]')).toHaveCount(0);
  await expect(page.locator('a[href="/leads"]')).toHaveCount(0);
  await expect(page.locator('a[href="/comments"]')).toHaveCount(0);
  await expect(page.locator('a[href="/voice"]')).toHaveCount(0);
  await expect(page.locator('a[href="/executions"]')).toHaveCount(0);
});

test("critical routes do not blank-screen", async ({ page }) => {
  for (const path of ["/inbox", "/leads", "/proposals"]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("main")).not.toBeEmpty();
  }
});
