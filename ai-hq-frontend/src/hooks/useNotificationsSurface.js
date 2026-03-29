import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  listNotifications,
  markNotificationRead,
} from "../api/notifications.js";
import { realtimeStore } from "../lib/realtime/realtimeStore.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function getErrorMessage(error, fallback) {
  return s(error?.message || error || fallback, fallback);
}

export function useNotificationsSurface({
  recipient = "ceo",
  limit = 20,
} = {}) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const pollTimerRef = useRef(0);

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await listNotifications({
          recipient,
          unreadOnly: false,
          limit,
        });

        setItems(response.notifications);
        setError("");
        setUnavailable(Boolean(response.dbDisabled));
        setLastUpdated(new Date().toISOString());
        return response.notifications;
      } catch (nextError) {
        setItems([]);
        setError(
          getErrorMessage(
            nextError,
            "Notifications are temporarily unavailable."
          )
        );
        setUnavailable(true);
        return [];
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [limit, recipient]
  );

  const markRead = useCallback(async (notificationId) => {
    const id = s(notificationId);
    if (!id) return null;

    setSavingId(id);

    try {
      const response = await markNotificationRead(id);
      const nextNotification = response.notification;

      setItems((prev) =>
        prev.map((item) => (item.id === id ? nextNotification : item))
      );
      setError("");
      setUnavailable(Boolean(response.dbDisabled));
      setLastUpdated(new Date().toISOString());
      return nextNotification;
    } catch (nextError) {
      setError(
        getErrorMessage(nextError, "Could not mark the notification as read.")
      );
      return null;
    } finally {
      setSavingId("");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const unsubscribeEvents = realtimeStore.subscribeEvents((event) => {
      const type = s(event?.type).toLowerCase();
      if (type === "notification.read") {
        const notification = event?.payload?.notification;
        if (notification?.id) {
          setItems((prev) =>
            prev.map((item) =>
              item.id === notification.id
                ? {
                    ...item,
                    readAt:
                      notification.read_at ||
                      notification.readAt ||
                      item.readAt,
                    unread: false,
                  }
                : item
            )
          );
        } else {
          refresh({ silent: true });
        }
      }
    });

    return () => {
      unsubscribeEvents();
    };
  }, [refresh]);

  useEffect(() => {
    clearInterval(pollTimerRef.current);
    pollTimerRef.current = window.setInterval(() => {
      refresh({ silent: true });
    }, 60000);

    return () => {
      clearInterval(pollTimerRef.current);
    };
  }, [refresh]);

  const unreadCount = useMemo(
    () => items.filter((item) => item.unread).length,
    [items]
  );

  return {
    open,
    setOpen,
    notifications: items,
    unreadCount,
    loading,
    refreshing,
    savingId,
    error,
    unavailable,
    lastUpdated,
    refresh,
    markRead,
  };
}
