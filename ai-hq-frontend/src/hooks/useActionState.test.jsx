import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useActionState } from "./useActionState.js";

describe("useActionState", () => {
  it("tracks one pending action and clears it after completion", async () => {
    const { result } = renderHook(() => useActionState());

    const deferred = {};
    deferred.promise = new Promise((resolve) => {
      deferred.resolve = resolve;
    });

    let taskPromise;
    act(() => {
      taskPromise = result.current.runAction("export-json", () => deferred.promise);
    });

    expect(result.current.pendingAction).toBe("export-json");
    expect(result.current.isActionPending("export-json")).toBe(true);

    await act(async () => {
      deferred.resolve(true);
      await taskPromise;
    });

    expect(result.current.pendingAction).toBe("");
    expect(result.current.isActionPending("export-json")).toBe(false);
  });
});
