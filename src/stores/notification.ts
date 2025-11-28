import { create } from "zustand";

// NotificationData now explicitly includes "id"
export interface NotificationData {
  id: string;
  eventType: string;
  eventData: any;
}

export interface NotificationState {
  notifications: NotificationData[];
  setNotifications: (notifications: NotificationData[]) => void;
  addNotification: (notification: NotificationData) => void;
  removeNotification: (notificationId: string) => void;
  clearNotifications: () => void;

  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnected: boolean;
  isReconnecting: boolean;
  isError: boolean;
  setIsConnected: (value: boolean) => void;
  setIsConnecting: (value: boolean) => void;
  setIsDisconnected: (value: boolean) => void;
  setIsReconnecting: (value: boolean) => void;
  setIsError: (value: boolean) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  setNotifications: (notifications: NotificationData[]) => set({ notifications }),
  addNotification: (notification: NotificationData) =>
    set((state) => ({ notifications: [...state.notifications, notification] })),
  removeNotification: (notificationId: string) =>
    set((state) => ({
      notifications: state.notifications.filter(
        (notification) => notification.id !== notificationId,
      ),
    })),
  clearNotifications: () => set({ notifications: [] }),

  // Connection state
  isConnected: false,
  isConnecting: false,
  isDisconnected: true,
  isReconnecting: false,
  isError: false,
  setIsConnected: (value: boolean) => set({ isConnected: value }),
  setIsConnecting: (value: boolean) => set({ isConnecting: value }),
  setIsDisconnected: (value: boolean) => set({ isDisconnected: value }),
  setIsReconnecting: (value: boolean) => set({ isReconnecting: value }),
  setIsError: (value: boolean) => set({ isError: value }),
}));
