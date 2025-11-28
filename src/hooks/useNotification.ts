import { useEffect, useEffectEvent, useRef, useCallback } from "react";
import { VeraniClient } from "verani/client";
import {
  useNotificationStore,
  type NotificationData,
} from "@/stores/notification";

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
  const clientRef = useRef<VeraniClient | null>(null);
  const isConnected = useNotificationStore((state) => state.isConnected);
  const setIsConnected = useNotificationStore((state) => state.setIsConnected);
  const isConnecting = useNotificationStore((state) => state.isConnecting);
  const setIsConnecting = useNotificationStore(
    (state) => state.setIsConnecting,
  );
  const isDisconnected = useNotificationStore((state) => state.isDisconnected);
  const setIsDisconnected = useNotificationStore(
    (state) => state.setIsDisconnected,
  );
  const isReconnecting = useNotificationStore((state) => state.isReconnecting);
  const setIsReconnecting = useNotificationStore(
    (state) => state.setIsReconnecting,
  );
  const isError = useNotificationStore((state) => state.isError);
  const setIsError = useNotificationStore((state) => state.setIsError);

  const addNotification = useNotificationStore(
    (state) => state.addNotification,
  );
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = notifications.length;

  const setupConnection = useEffectEvent(() => {
    setIsConnecting(true);
    setIsDisconnected(false);
    setIsReconnecting(false);
    setIsError(false);

    const newClient = new VeraniClient("/ws/notification", {
      reconnection: {
        maxAttempts: 3,
      },
    });

    newClient.on("notification.update", (data: string) => {
      try {
        const parsed = JSON.parse(data);
        // Add notification to store
        const notification: NotificationData = {
          id: crypto.randomUUID(),
          eventType: parsed.type || "unknown",
          eventData: parsed,
        };
        addNotification(notification);
      } catch (error) {
        console.error("Failed to parse notification:", error);
      }
    });

    newClient.on("open", () => {
      setIsConnected(true);
      setIsConnecting(false);
      setIsDisconnected(false);
    });

    newClient.on("close", () => {
      setIsConnected(false);
      setIsDisconnected(true);
      setIsConnecting(false);
    });

    newClient.on("reconnecting", () => {
      setIsReconnecting(true);
      setIsError(false);
    });

    newClient.on("error", () => {
      setIsError(true);
      setIsReconnecting(false);
      setIsConnected(false);
    });

    clientRef.current = newClient;

    return () => {
      newClient.close();
      clientRef.current = null;
      setIsConnected(false);
      setIsDisconnected(true);
      setIsConnecting(false);
      setIsReconnecting(false);
      setIsError(false);
    };
  });

  useEffect(() => {
    const cleanup = setupConnection();
    return cleanup;
  }, []);

  const close = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.close();
    }
  }, []);

  return {
    client: clientRef.current,
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
