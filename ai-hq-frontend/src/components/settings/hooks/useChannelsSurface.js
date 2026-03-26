import { useCallback, useEffect } from "react";

import {
  getMetaChannelStatus,
  getMetaConnectUrl,
  disconnectMetaChannel,
} from "../../../api/settings.js";
import { dispatchRepairAction } from "../../readiness/dispatchRepairAction.js";
import { useSettingsSurfaceState } from "../../../pages/Settings/hooks/useSettingsSurfaceState.js";

function emptyMetaState() {
  return {
    connected: false,
    channel: null,
    hasToken: false,
    readiness: {},
  };
}

function normalizeMetaState(payload = {}) {
  return {
    connected: !!payload?.connected,
    channel: payload?.channel || null,
    hasToken: !!payload?.hasToken,
    readiness: payload?.readiness || {},
  };
}

export function useChannelsSurface({ canManage = true }) {
  const {
    data: meta,
    surface,
    beginRefresh,
    succeedRefresh,
    failRefresh,
    beginSave,
    succeedSave,
    failSave,
    clearSaveState,
  } = useSettingsSurfaceState({
    initialData: emptyMetaState,
    initialLoading: true,
  });

  const refreshChannels = useCallback(async () => {
    beginRefresh();
    try {
      const payload = await getMetaChannelStatus();
      return succeedRefresh(normalizeMetaState(payload));
    } catch (error) {
      return failRefresh(error, {
        fallbackData: emptyMetaState(),
      });
    }
  }, [beginRefresh, failRefresh, succeedRefresh]);

  const startMetaConnect = useCallback(async () => {
    if (!canManage) {
      failSave("This channel surface is read-only for your role.");
      return { ok: false, reason: "blocked" };
    }

    beginSave();
    const result = await dispatchRepairAction(
      {
        id: "connect_meta_channel",
        kind: "oauth",
        allowed: true,
        target: {
          provider: "meta",
        },
      },
      {
        oauthHandlers: {
          meta: getMetaConnectUrl,
        },
      }
    );

    if (!result.ok) {
      failSave(result.error || "Failed to start Meta connect.");
      return result;
    }

    succeedSave({ message: "" });
    return result;
  }, [beginSave, canManage, failSave, succeedSave]);

  const disconnectChannel = useCallback(async () => {
    if (!canManage) {
      failSave("This channel surface is read-only for your role.");
      return null;
    }

    beginSave();

    try {
      await disconnectMetaChannel();
      await refreshChannels();
      succeedSave({
        message: "Instagram connection removed.",
      });
      return true;
    } catch (error) {
      failSave(error);
      throw error;
    }
  }, [beginSave, canManage, failSave, refreshChannels, succeedSave]);

  const runRepairAction = useCallback(
    async (action = {}) => {
      beginSave();

      const result = await dispatchRepairAction(action, {
        oauthHandlers: {
          meta: getMetaConnectUrl,
        },
      });

      if (!result.ok) {
        const message =
          result.reason === "blocked"
            ? "This repair flow requires elevated access."
            : result.error || "Repair action failed.";
        failSave(message);
        return result;
      }

      succeedSave({ message: "" });
      return result;
    },
    [beginSave, failSave, succeedSave]
  );

  useEffect(() => {
    let alive = true;

    async function boot() {
      const url = new URL(window.location.href);
      const ok = url.searchParams.get("meta_connected");
      const err = url.searchParams.get("meta_error");

      await refreshChannels();
      if (!alive) return;

      if (ok === "1") {
        succeedSave({ message: "Instagram connected successfully." });
        url.searchParams.delete("meta_connected");
        url.searchParams.delete("channel");
        window.history.replaceState({}, "", url.toString());
      } else if (err) {
        failSave(`Meta connect failed: ${err}`);
        url.searchParams.delete("meta_error");
        window.history.replaceState({}, "", url.toString());
      }
    }

    boot().catch((error) => {
      if (!alive) return;
      failRefresh(error, {
        fallbackData: emptyMetaState(),
      });
    });

    return () => {
      alive = false;
    };
  }, [failRefresh, failSave, refreshChannels, succeedSave]);

  return {
    meta,
    surface: {
      ...surface,
      refresh: refreshChannels,
      clearSaveState,
    },
    refreshChannels,
    startMetaConnect,
    disconnectChannel,
    runRepairAction,
  };
}
