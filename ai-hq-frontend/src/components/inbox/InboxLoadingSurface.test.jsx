import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  InboxDetailSkeleton,
  InboxLeadSkeleton,
  InboxThreadListSkeleton,
} from "./InboxLoadingSurface.jsx";

describe("InboxLoadingSurface", () => {
  it("renders premium structural inbox skeletons", () => {
    render(
      <>
        <InboxThreadListSkeleton />
        <InboxDetailSkeleton />
        <InboxLeadSkeleton />
      </>
    );

    expect(screen.getByLabelText(/loading conversations/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/loading conversation detail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/loading conversation context/i)).toBeInTheDocument();
  });
});
