import { useCallback, useState } from "react";

import {
  getOperationalSettings,
  saveOperationalChannelSettings,
  saveOperationalVoiceSettings,
} from "../../../api/settings.js";

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
  };
}

export function useOperationalSettings({ tenantKey, setMessage }) {
  const [loading, setLoading] = useState(true);
  const [savingVoice, setSavingVoice] = useState(false);
  const [savingChannel, setSavingChannel] = useState(false);
  const [operationalData, setOperationalData] = useState(emptyOperationalData);
  const [operationalMessage, setOperationalMessage] = useState("");

  const refreshOperationalSettings = useCallback(async (tenantKeyOverride = "") => {
    const resolvedTenantKey = String(tenantKeyOverride || tenantKey || "").trim();
    if (!resolvedTenantKey) {
      setLoading(false);
      return emptyOperationalData();
    }

    setLoading(true);
    setOperationalMessage("");

    try {
      const payload = await getOperationalSettings();
      setOperationalData(payload);
      return payload;
    } catch (err) {
      const message = String(err?.message || err);
      setOperationalMessage(message);
      setMessage?.(message);
      return emptyOperationalData();
    } finally {
      setLoading(false);
    }
  }, [setMessage, tenantKey]);

  const saveVoiceSettings = useCallback(
    async (payload) => {
      setSavingVoice(true);
      setOperationalMessage("");

      try {
        const next = await saveOperationalVoiceSettings(payload);
        setOperationalData(next);
        setOperationalMessage("Operational voice settings saved.");
        return next;
      } catch (err) {
        const message = String(err?.message || err);
        setOperationalMessage(message);
        throw err;
      } finally {
        setSavingVoice(false);
      }
    },
    []
  );

  const saveChannelSettings = useCallback(async (channelType, payload) => {
    setSavingChannel(true);
    setOperationalMessage("");

    try {
      const next = await saveOperationalChannelSettings(channelType, payload);
      setOperationalData(next);
      setOperationalMessage("Operational channel settings saved.");
      return next;
    } catch (err) {
      const message = String(err?.message || err);
      setOperationalMessage(message);
      throw err;
    } finally {
      setSavingChannel(false);
    }
  }, []);

  return {
    loading,
    savingVoice,
    savingChannel,
    operationalData,
    operationalMessage,
    setOperationalMessage,
    refreshOperationalSettings,
    saveVoiceSettings,
    saveChannelSettings,
  };
}
