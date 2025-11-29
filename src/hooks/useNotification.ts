import { useEffect, useCallback, useRef, useState } from "react";
import type { VeraniClient } from "verani/client";
import {
  useNotificationStore,
  type NotificationData,
} from "@/stores/notification";
import {
  useConnectionStore,
  createConnectionStateAccessor,
} from "@/stores/connection";
import { createConnectionManager } from "@/lib/connection-manager";
import { getEphemeralTokenFn } from "@/actions/ephemeralTokens";

// Create connection manager instance for notifications
const notificationConnectionManager = createConnectionManager(
  {
    url: "/ws/notification",
    reconnection: {
      enabled: true,
      maxAttempts: 3,
    },
    eventHandlers: {
      "notification.update": (data: string) => {
        const addNotification = useNotificationStore.getState().addNotification;
        try {
          const parsed = JSON.parse(data);
          const notification: NotificationData = {
            id: crypto.randomUUID(),
            eventType: parsed.type || "unknown",
            eventData: parsed,
          };
          addNotification(notification);
        } catch (error) {
          console.error("Failed to parse notification:", error);
        }
      },
    },
  },
  createConnectionStateAccessor("notification"),
);

export interface UseNotificationReturn {
  client: VeraniClient | null;
  close: () => void;
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnected: boolean;
  isReconnecting: boolean;
  isError: boolean;
  notifications: NotificationData[];
  unreadCount: number;
}

export function useNotification(): UseNotificationReturn {
  const connectionState = useConnectionStore((state) =>
    state.getConnectionState("notification"),
  );
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = notifications.length;

  const { isConnected, isConnecting, isDisconnected, isReconnecting, isError } =
    connectionState;

  const [token, setToken] = useState<Awaited<ReturnType<typeof getEphemeralTokenFn>> | undefined>(undefined);
  const [tokenError, setTokenError] = useState<Error | null>(null);

  // Use ref to track this hook instance (handles React Strict Mode properly)
  const instanceIdRef = useRef<symbol | null>(null);

  // Fetch token before setting up connection
  useEffect(() => {
    let cancelled = false;

    async function fetchToken() {
      try {
        const ephemeralToken = await getEphemeralTokenFn();
        if (!cancelled) {
          setToken(ephemeralToken);
          setTokenError(null);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch ephemeral token:", error);
          setTokenError(error instanceof Error ? error : new Error("Failed to fetch token"));
          useConnectionStore.getState().setConnectionState("notification", {
            isError: true,
          });
        }
      }
    }

    fetchToken();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Don't setup connection if token hasn't been fetched yet or if there was an error
    if (!token || tokenError) {
      return;
    }

    // Create unique instance ID for this hook
    if (!instanceIdRef.current) {
      instanceIdRef.current = Symbol("notification-hook-instance");
    }
    const instanceId = instanceIdRef.current;

    // Register this instance with the connection manager
    notificationConnectionManager.registerInstance(instanceId);

    // Setup connection with token (will handle concurrent attempts internally)
    notificationConnectionManager.setup(token).catch((error) => {
      console.error("Failed to setup notification connection:", error);
      useConnectionStore.getState().setConnectionState("notification", {
        isError: true,
      });
    });

    // Cleanup: remove instance and cleanup if this is the last hook
    return () => {
      notificationConnectionManager.unregisterInstance(instanceId);
      // Only cleanup if this is the last active hook
      if (!notificationConnectionManager.hasActiveInstances()) {
        notificationConnectionManager.cleanup();
      }
    };
  }, [token, tokenError]);

  const close = useCallback(() => {
    notificationConnectionManager.close();
  }, []);

  return {
    client: notificationConnectionManager.getClient(),
    close,
    isConnected,
    isConnecting,
    isDisconnected,
    isReconnecting,
    isError,
    notifications,
    unreadCount,
  };
}
