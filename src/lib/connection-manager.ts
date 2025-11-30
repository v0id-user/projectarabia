import {
  VeraniClient,
  type ConnectionState as VeraniConnectionState,
} from "verani/client";
import type { ConnectionState } from "@/stores/connection";
import type { SignedToken } from "./tokens";

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
  token?: SignedToken;
  reconnection?: {
    enabled?: boolean;
    maxAttempts?: number;
  };
  // biome-ignore lint/suspicious/noExplicitAny: for now we will allow any data until i implement a proper type infer
  eventHandlers?: Record<string, (...args: any[]) => void>;
}

export interface ConnectionManager {
  getClient: () => VeraniClient | null;
  setup: (token?: SignedToken) => Promise<void>;
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
  // biome-ignore lint/suspicious/noExplicitAny: for now we will allow any data until i implement a proper type infer
  const customEventHandlers = new Map<string, (...args: any[]) => void>();

  // Map VeraniClient's ConnectionState to our boolean flags
  function syncStateFromVerani(state: VeraniConnectionState): void {
    stateAccessor.setIsConnected(state === "connected");
    stateAccessor.setIsConnecting(state === "connecting");
    stateAccessor.setIsDisconnected(state === "disconnected");
    stateAccessor.setIsReconnecting(state === "reconnecting");
    stateAccessor.setIsError(state === "error");
  }

  async function setup(providedToken?: SignedToken): Promise<void> {
    // If connection is already being established, wait for it
    if (connectionPromise) {
      return connectionPromise;
    }

    // If client already exists and is in a valid state, don't create a new one
    if (clientInstance) {
      const state = clientInstance.getState();
      // Reuse existing client if it's connected or connecting
      if (state === "connected" || state === "connecting") {
        return Promise.resolve();
      }
      // If client exists but is in error/disconnected state, clean it up first
      if (state === "error" || state === "disconnected") {
        cleanup();
      }
    }

    // Create connection promise to prevent concurrent attempts
    connectionPromise = (async () => {
      // Use provided token, fallback to config token
      const token = providedToken ?? config.token;

      // Append token to URL if provided
      let connectionUrl = config.url;
      if (token?.signed) {
        const separator = config.url.includes("?") ? "&" : "?";
        connectionUrl = `${config.url}${separator}token=${encodeURIComponent(token.signed)}`;
      }

      const newClient = new VeraniClient(connectionUrl, {
        reconnection: {
          enabled: config.reconnection?.enabled ?? true,
          maxAttempts: config.reconnection?.maxAttempts ?? 3,
        },
        pingInterval: 10000,
        pongTimeout: 5000,
      });

      // Use VeraniClient's built-in state change handler to sync state
      newClient.onStateChange((state) => {
        syncStateFromVerani(state);
        // Reset connection promise on error to allow retry
        if (state === "error") {
          connectionPromise = null;
        }
      });

      // Attach custom event handlers if provided
      if (config.eventHandlers) {
        for (const [eventName, handler] of Object.entries(
          config.eventHandlers,
        )) {
          customEventHandlers.set(eventName, handler);
          newClient.on(eventName, handler);
        }
      }

      clientInstance = newClient;
      // Sync initial state
      syncStateFromVerani(newClient.getState());
      connectionPromise = null; // Clear promise after successful setup
    })();

    return connectionPromise;
  }

  function cleanup(): void {
    if (!clientInstance) {
      return;
    }

    // Remove custom event listeners before closing
    for (const [eventName, handler] of customEventHandlers.entries()) {
      try {
        clientInstance.off(eventName, handler);
      } catch (error) {
        console.error(`Error removing ${eventName} listener:`, error);
      }
    }

    // Close the connection (VeraniClient handles cleanup internally)
    try {
      clientInstance.close();
    } catch (error) {
      console.error("Error closing client connection:", error);
    }

    clientInstance = null;
    connectionPromise = null; // Clear connection promise

    // Clear custom event handlers
    customEventHandlers.clear();

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
