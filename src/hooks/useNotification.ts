import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useCallback,
} from "react";
import { VeraniClient } from "verani";

export interface UseNotificationReturn {
  client: VeraniClient | null;
  close: () => void;
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnected: boolean;
  isReconnecting: boolean;
  isError: boolean;
}

export function useNotification(
  onNotification: (notification: Notification) => void,
): UseNotificationReturn {
  const [client, setClient] = useState<VeraniClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isError, setIsError] = useState(false);

  // We want the latest onNotification provided by the user.
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;

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

    newClient.on("notification.update", (notification: Notification) => {
      onNotificationRef.current(notification);
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

    setClient(newClient);

    return () => {
      newClient.close();
      setClient(null);
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
    if (client) {
      client.close();
    }
  }, [client]);

  return {
    client,
    close,
    isConnected,
    isConnecting,
    isDisconnected,
    isReconnecting,
    isError,
  };
}
