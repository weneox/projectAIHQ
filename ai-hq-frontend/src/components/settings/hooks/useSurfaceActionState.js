import { useCallback, useState } from "react";

export function useSurfaceActionState() {
  const [pendingAction, setPendingAction] = useState("");

  const isActionPending = useCallback(
    (actionKey) => String(actionKey || "").trim() !== "" && pendingAction === actionKey,
    [pendingAction]
  );

  const runAction = useCallback(async (actionKey, task) => {
    const key = String(actionKey || "").trim();
    if (!key) {
      throw new Error("action key is required");
    }
    if (typeof task !== "function") {
      throw new Error("action task must be a function");
    }

    setPendingAction(key);
    try {
      return await task();
    } finally {
      setPendingAction("");
    }
  }, []);

  const clearAction = useCallback(() => {
    setPendingAction("");
  }, []);

  return {
    pendingAction,
    isActionPending,
    runAction,
    clearAction,
  };
}
