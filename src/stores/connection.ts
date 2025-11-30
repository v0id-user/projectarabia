import { create } from "zustand";
import type { ConnectionStateAccessor } from "@/lib/connection-manager";

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

  getConnectionState: (connectionId) => {
    const state = get();
    return state.connections[connectionId] ?? defaultConnectionState;
  },
}));

/**
 * Creates a connection state accessor for use with connection managers.
 * This is a helper function to simplify connection manager setup.
 */
export function createConnectionStateAccessor(
  connectionId: string,
): ConnectionStateAccessor {
  return {
    getState: () =>
      useConnectionStore.getState().getConnectionState(connectionId),
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
