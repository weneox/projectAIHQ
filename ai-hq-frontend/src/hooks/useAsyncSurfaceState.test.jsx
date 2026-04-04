import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useAsyncSurfaceState } from "./useAsyncSurfaceState.js";

describe("useAsyncSurfaceState", () => {
  it("exposes a stable ready/unavailable/loading contract", () => {
    const { result } = renderHook(() =>
      useAsyncSurfaceState({
        initialData: () => ({ value: 0 }),
        initialLoading: true,
      })
    );

    expect(result.current.surface.loading).toBe(true);
    expect(result.current.surface.ready).toBe(false);

    act(() => {
      result.current.succeedRefresh({ value: 2 });
    });

    expect(result.current.data.value).toBe(2);
    expect(result.current.surface.loading).toBe(false);
    expect(result.current.surface.ready).toBe(true);

    act(() => {
      result.current.beginRefresh();
      result.current.failRefresh(new Error("surface failed"));
    });

    expect(result.current.surface.unavailable).toBe(true);
    expect(result.current.surface.error).toMatch(/surface failed/i);

    act(() => {
      result.current.beginSave();
      result.current.succeedSave({ message: "Saved cleanly." });
    });

    expect(result.current.surface.saving).toBe(false);
    expect(result.current.surface.saveSuccess).toBe("Saved cleanly.");

    act(() => {
      result.current.beginSave();
      result.current.failSave(new Error("Save failed"));
    });

    expect(result.current.surface.saveError).toMatch(/save failed/i);
  });
});
