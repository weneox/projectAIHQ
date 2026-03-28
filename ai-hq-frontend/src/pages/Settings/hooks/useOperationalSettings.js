import { useCallback, useState } from "react";

import {
  getOperationalSettings,
  saveOperationalChannelSettings,
  saveOperationalVoiceSettings,
} from "../../../api/settings.js";
import { useSettingsSurfaceState } from "./useSettingsSurfaceState.js";

function emptyOperationalData() {
  return {
    tenant: {
      tenantId: "",
      tenantKey: "",
      companyName: "",
    },
    voice: {
      settings: null,
      operational: {},
      missingFields: [],
    },
    channels: {
      items: [],
      meta: {
        channel: null,
        operational: {},
        missingFields: [],
        providerSecrets: {
          provider: "meta",
          secretsRef: "meta",
          requiredSecretKeys: [],
          optionalSecretKeys: [],
          presentSecretKeys: [],
          missingSecretKeys: [],
          ready: false,
        },
      },
    },
    operationalChannels: {},
    viewerRole: "member",
    capabilities: {},
    dataGovernance: {
      retention: {
        items: [],
      },
      backupRestore: {
        status: "unknown",
        selfServeRestore: false,
        automatedBackupOrRestoreVerification: false,
        message: "",
        runbooks: [],
      },
    },
  };
}

export function useOperationalSettings({ tenantKey, setMessage }) {
  const {
    data: operationalData,
    setData: setOperationalData,
    surface,
    beginRefresh,
    succeedRefresh,
    failRefresh,
    beginSave,
    succeedSave,
    failSave,
    clearSaveState,
  } = useSettingsSurfaceState({
    initialData: emptyOperationalData,
    initialLoading: true,
  });
  const [savingVoice, setSavingVoice] = useState(false);
  const [savingChannel, setSavingChannel] = useState(false);

  const refreshOperationalSettings = useCallback(async (tenantKeyOverride = "") => {
    const resolvedTenantKey = String(tenantKeyOverride || tenantKey || "").trim();
    if (!resolvedTenantKey) {
      return failRefresh("", {
        fallbackData: emptyOperationalData(),
        unavailable: false,
      });
    }

    beginRefresh();
    try {
      const payload = await getOperationalSettings();
      return succeedRefresh(payload);
    } catch (err) {
      const message = String(err?.message || err);
      setMessage?.(message);
      return failRefresh(message, {
        fallbackData: emptyOperationalData(),
      });
    }
  }, [beginRefresh, failRefresh, setMessage, succeedRefresh, tenantKey]);

  const saveVoiceSettings = useCallback(
    async (payload) => {
      setSavingVoice(true);
      beginSave();

      try {
        const next = await saveOperationalVoiceSettings(payload);
        setOperationalData(next);
        succeedSave({
          nextData: next,
          message: "Operational voice settings saved.",
        });
        return next;
      } catch (err) {
        failSave(err);
        throw err;
      } finally {
        setSavingVoice(false);
      }
    },
    [beginSave, failSave, setOperationalData, succeedSave]
  );

  const saveChannelSettings = useCallback(async (channelType, payload) => {
    setSavingChannel(true);
    beginSave();

    try {
      const next = await saveOperationalChannelSettings(channelType, payload);
      setOperationalData(next);
      succeedSave({
        nextData: next,
        message: "Operational channel settings saved.",
      });
      return next;
    } catch (err) {
      failSave(err);
      throw err;
    } finally {
      setSavingChannel(false);
    }
  }, [beginSave, failSave, setOperationalData, succeedSave]);

  return {
    surface: {
      ...surface,
      refresh: refreshOperationalSettings,
      clearSaveState,
    },
    savingVoice,
    savingChannel,
    operationalData,
    refreshOperationalSettings,
    saveVoiceSettings,
    saveChannelSettings,
  };
}
