import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import NotificationsPanel from "./NotificationsPanel.jsx";

describe("NotificationsPanel", () => {
  it("renders honest empty state", () => {
    render(<NotificationsPanel open notifications={[]} onClose={() => {}} />);

    expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument();
  });

  it("renders notifications and allows mark read", () => {
    const onMarkRead = vi.fn();

    render(
      <NotificationsPanel
        open
        onClose={() => {}}
        unreadCount={1}
        notifications={[
          {
            id: "notif-1",
            type: "warn",
            title: "Execution needs review",
            body: "A durable execution entered retryable state.",
            createdAt: "2026-03-29T10:00:00.000Z",
            readAt: "",
            unread: true,
          },
        ]}
        onMarkRead={onMarkRead}
      />
    );

    expect(screen.getByText(/execution needs review/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /mark read/i }));
    expect(onMarkRead).toHaveBeenCalledWith("notif-1");
  });
});
