import { create } from "zustand";

export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnected: boolean;
  isReconnecting: boolean;
  isError: boolean;
}

export interface ConnectionStoreState {
  connections: Record<string, ConnectionState>;
  setConnectionState: (
    connectionId: string,
    state: Partial<ConnectionState>,
  ) => void;
  resetConnection: (connectionId: string) => void;
  getConnectionState: (connectionId: string) => ConnectionState;
}

const defaultConnectionState: ConnectionState = {
  isConnected: false,
  isConnecting: false,
  isDisconnected: true,
  isReconnecting: false,
  isError: false,
};

export const useConnectionStore = create<ConnectionStoreState>((set, get) => ({
  connections: {},

  setConnectionState: (connectionId, state) =>
    set((store) => ({
      connections: {
        ...store.connections,
        [connectionId]: {
          ...(store.connections[connectionId] ?? defaultConnectionState),
          ...state,
        },
      },
    })),

  resetConnection: (connectionId) =>
    set((store) => {
      const { [connectionId]: _, ...rest } = store.connections;
      return { connections: rest };
    }),

  getConnectionState: (connectionId) => {
    const state = get();
    return state.connections[connectionId] ?? defaultConnectionState;
  },
}));

// Helper hooks for specific connections
export function useNotificationConnection() {
  const connectionState = useConnectionStore((state) =>
    state.getConnectionState("notification"),
  );
  const setConnectionState = useConnectionStore(
    (state) => state.setConnectionState,
  );

  return {
    ...connectionState,
    setIsConnected: (value: boolean) =>
      setConnectionState("notification", { isConnected: value }),
    setIsConnecting: (value: boolean) =>
      setConnectionState("notification", { isConnecting: value }),
    setIsDisconnected: (value: boolean) =>
      setConnectionState("notification", { isDisconnected: value }),
    setIsReconnecting: (value: boolean) =>
      setConnectionState("notification", { isReconnecting: value }),
    setIsError: (value: boolean) =>
      setConnectionState("notification", { isError: value }),
  };
}

export function useChatConnection() {
  const connectionState = useConnectionStore((state) =>
    state.getConnectionState("chat"),
  );
  const setConnectionState = useConnectionStore(
    (state) => state.setConnectionState,
  );

  return {
    ...connectionState,
    setIsConnected: (value: boolean) =>
      setConnectionState("chat", { isConnected: value }),
    setIsConnecting: (value: boolean) =>
      setConnectionState("chat", { isConnecting: value }),
    setIsDisconnected: (value: boolean) =>
      setConnectionState("chat", { isDisconnected: value }),
    setIsReconnecting: (value: boolean) =>
      setConnectionState("chat", { isReconnecting: value }),
    setIsError: (value: boolean) =>
      setConnectionState("chat", { isError: value }),
  };
}

/**
 * Creates a connection state accessor for use with connection managers.
 * This is a helper function to simplify connection manager setup.
 */
export function createConnectionStateAccessor(
  connectionId: string,
): import("@/lib/connection-manager").ConnectionStateAccessor {
  return {
    getState: () => useConnectionStore.getState().getConnectionState(connectionId),
    setIsConnected: (value) =>
      useConnectionStore.getState().setConnectionState(connectionId, {
        isConnected: value,
      }),
    setIsConnecting: (value) =>
      useConnectionStore.getState().setConnectionState(connectionId, {
        isConnecting: value,
      }),
    setIsDisconnected: (value) =>
      useConnectionStore.getState().setConnectionState(connectionId, {
        isDisconnected: value,
      }),
    setIsReconnecting: (value) =>
      useConnectionStore.getState().setConnectionState(connectionId, {
        isReconnecting: value,
      }),
    setIsError: (value) =>
      useConnectionStore.getState().setConnectionState(connectionId, {
        isError: value,
      }),
  };
}

