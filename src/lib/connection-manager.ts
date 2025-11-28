import { VeraniClient } from "verani/client";
import type { ConnectionState } from "@/stores/connection";

export interface ConnectionStateAccessor {
  getState: () => ConnectionState;
  setIsConnected: (value: boolean) => void;
  setIsConnecting: (value: boolean) => void;
  setIsDisconnected: (value: boolean) => void;
  setIsReconnecting: (value: boolean) => void;
  setIsError: (value: boolean) => void;
}

export interface ConnectionConfig {
  url: string;
  reconnection?: {
    maxAttempts?: number;
  };
  eventHandlers?: Record<string, (...args: any[]) => void>;
}

export interface ConnectionManager {
  getClient: () => VeraniClient | null;
  setup: () => Promise<void>;
  cleanup: () => void;
  registerInstance: (instanceId: symbol) => void;
  unregisterInstance: (instanceId: symbol) => void;
  hasActiveInstances: () => boolean;
  close: () => void;
}

/**
 * Creates a singleton connection manager for a WebSocket connection.
 * Each connection type (notification, chat, etc.) should have its own manager instance.
 *
 * @example
 * ```ts
 * // Create a connection manager for chat
 * const chatConnectionManager = createConnectionManager(
 *   {
 *     url: "/ws/chat",
 *     reconnection: { maxAttempts: 3 },
 *     eventHandlers: {
 *       "chat.message": (data) => {
 *         // Handle chat message
 *       },
 *     },
 *   },
 *   {
 *     getState: () => useConnectionStore.getState().getConnectionState("chat"),
 *     setIsConnected: (value) => useConnectionStore.getState().setConnectionState("chat", { isConnected: value }),
 *     setIsConnecting: (value) => useConnectionStore.getState().setConnectionState("chat", { isConnecting: value }),
 *     setIsDisconnected: (value) => useConnectionStore.getState().setConnectionState("chat", { isDisconnected: value }),
 *     setIsReconnecting: (value) => useConnectionStore.getState().setConnectionState("chat", { isReconnecting: value }),
 *     setIsError: (value) => useConnectionStore.getState().setConnectionState("chat", { isError: value }),
 *   },
 * );
 *
 * // Use in a hook
 * export function useChat() {
 *   const instanceIdRef = useRef<symbol | null>(null);
 *
 *   useEffect(() => {
 *     if (!instanceIdRef.current) {
 *       instanceIdRef.current = Symbol("chat-hook-instance");
 *     }
 *     const instanceId = instanceIdRef.current;
 *
 *     chatConnectionManager.registerInstance(instanceId);
 *     chatConnectionManager.setup().catch(handleError);
 *
 *     return () => {
 *       chatConnectionManager.unregisterInstance(instanceId);
 *       if (!chatConnectionManager.hasActiveInstances()) {
 *         chatConnectionManager.cleanup();
 *       }
 *     };
 *   }, []);
 *
 *   return {
 *     client: chatConnectionManager.getClient(),
 *     close: () => chatConnectionManager.close(),
 *   };
 * }
 * ```
 */
export function createConnectionManager(
  config: ConnectionConfig,
  stateAccessor: ConnectionStateAccessor,
): ConnectionManager {
  let clientInstance: VeraniClient | null = null;
  const activeHookInstances = new Set<symbol>();
  let connectionPromise: Promise<void> | null = null;
  const eventHandlers = new Map<string, (...args: any[]) => void>();

  async function setup(): Promise<void> {
    // If connection is already being established, wait for it
    if (connectionPromise) {
      return connectionPromise;
    }

    // If client already exists and is in a valid state, don't create a new one
    if (clientInstance) {
      const state = stateAccessor.getState();
      // Reuse existing client if it's connected or connecting
      if (state.isConnected || state.isConnecting) {
        return Promise.resolve();
      }
      // If client exists but is in error/disconnected state, clean it up first
      if (state.isError || state.isDisconnected) {
        cleanup();
      }
    }

    // Create connection promise to prevent concurrent attempts
    connectionPromise = (async () => {
      stateAccessor.setIsConnecting(true);
      stateAccessor.setIsDisconnected(false);
      stateAccessor.setIsReconnecting(false);
      stateAccessor.setIsError(false);

      const newClient = new VeraniClient(config.url, {
        reconnection: {
          maxAttempts: config.reconnection?.maxAttempts ?? 3,
        },
      });

      // Create default event handlers
      const openHandler = () => {
        stateAccessor.setIsConnected(true);
        stateAccessor.setIsConnecting(false);
        stateAccessor.setIsDisconnected(false);
      };

      const closeHandler = () => {
        stateAccessor.setIsConnected(false);
        stateAccessor.setIsDisconnected(true);
        stateAccessor.setIsConnecting(false);
        // If we're not intentionally closing, mark for potential reconnection
        if (activeHookInstances.size > 0) {
          stateAccessor.setIsReconnecting(false);
        }
      };

      const reconnectingHandler = () => {
        stateAccessor.setIsReconnecting(true);
        stateAccessor.setIsError(false);
      };

      const errorHandler = () => {
        stateAccessor.setIsError(true);
        stateAccessor.setIsReconnecting(false);
        stateAccessor.setIsConnected(false);
        // After max reconnection attempts, reset connection promise to allow retry
        connectionPromise = null;
      };

      // Store default handlers
      eventHandlers.set("open", openHandler);
      eventHandlers.set("close", closeHandler);
      eventHandlers.set("reconnecting", reconnectingHandler);
      eventHandlers.set("error", errorHandler);

      // Attach default event listeners
      newClient.on("open", openHandler);
      newClient.on("close", closeHandler);
      newClient.on("reconnecting", reconnectingHandler);
      newClient.on("error", errorHandler);

      // Attach custom event handlers if provided
      if (config.eventHandlers) {
        for (const [eventName, handler] of Object.entries(
          config.eventHandlers,
        )) {
          eventHandlers.set(eventName, handler);
          newClient.on(eventName, handler);
        }
      }

      clientInstance = newClient;
      connectionPromise = null; // Clear promise after successful setup
    })();

    return connectionPromise;
  }

  function cleanup(): void {
    if (!clientInstance) {
      return;
    }

    // Remove all event listeners before closing
    for (const [eventName, handler] of eventHandlers.entries()) {
      try {
        clientInstance.off(eventName, handler);
      } catch (error) {
        console.error(`Error removing ${eventName} listener:`, error);
      }
    }

    // Close the connection
    try {
      clientInstance.close();
    } catch (error) {
      console.error("Error closing client connection:", error);
    }

    clientInstance = null;
    connectionPromise = null; // Clear connection promise

    // Clear event handlers
    eventHandlers.clear();

    // Reset connection state
    stateAccessor.setIsConnected(false);
    stateAccessor.setIsDisconnected(true);
    stateAccessor.setIsConnecting(false);
    stateAccessor.setIsReconnecting(false);
    stateAccessor.setIsError(false);
  }

  function registerInstance(instanceId: symbol): void {
    activeHookInstances.add(instanceId);
  }

  function unregisterInstance(instanceId: symbol): void {
    activeHookInstances.delete(instanceId);
  }

  function hasActiveInstances(): boolean {
    return activeHookInstances.size > 0;
  }

  function close(): void {
    if (clientInstance) {
      // Clear all instances to ensure clean state
      activeHookInstances.clear();
      cleanup();
    }
  }

  return {
    getClient: () => clientInstance,
    setup,
    cleanup,
    registerInstance,
    unregisterInstance,
    hasActiveInstances,
    close,
  };
}
