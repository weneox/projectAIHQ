import { describe, expect, it } from "vitest";

import { __test__ } from "./notifications.js";

describe("notifications api helpers", () => {
  it("normalizes unread notifications safely", () => {
    const result = __test__.normalizeNotification({
      id: "notif-1",
      recipient: "ceo",
      type: "WARN",
      title: "Attention required",
      body: "Review the latest execution.",
      payload: { route: "/executions" },
      created_at: "2026-03-29T10:00:00.000Z",
      read_at: null,
    });

    expect(result).toMatchObject({
      id: "notif-1",
      recipient: "ceo",
      type: "warn",
      title: "Attention required",
      body: "Review the latest execution.",
      unread: true,
    });
  });

  it("normalizes read notifications safely", () => {
    const result = __test__.normalizeNotification({
      id: "notif-2",
      readAt: "2026-03-29T11:00:00.000Z",
    });

    expect(result.unread).toBe(false);
    expect(result.readAt).toBe("2026-03-29T11:00:00.000Z");
  });
});
