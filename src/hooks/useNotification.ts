import { useEffect, useCallback, useRef } from "react";
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

// Create connection manager instance for notifications
const notificationConnectionManager = createConnectionManager(
  {
    url: "/ws/notification",
    reconnection: {
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

  // Use ref to track this hook instance (handles React Strict Mode properly)
  const instanceIdRef = useRef<symbol | null>(null);

  useEffect(() => {
    // Create unique instance ID for this hook
    if (!instanceIdRef.current) {
      instanceIdRef.current = Symbol("notification-hook-instance");
    }
    const instanceId = instanceIdRef.current;

    // Register this instance with the connection manager
    notificationConnectionManager.registerInstance(instanceId);

    // Setup connection (will handle concurrent attempts internally)
    notificationConnectionManager.setup().catch((error) => {
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
  }, []);

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
