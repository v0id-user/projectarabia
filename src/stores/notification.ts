import { create } from "zustand";

// NotificationData now explicitly includes "id"
export interface NotificationData {
  id: string;
  eventType: string;
  // biome-ignore lint/suspicious/noExplicitAny: for now we will allow any data until i implement a proper type infer
  eventData: any;
}

export interface NotificationState {
  notifications: NotificationData[];
  setNotifications: (notifications: NotificationData[]) => void;
  addNotification: (notification: NotificationData) => void;
  removeNotification: (notificationId: string) => void;
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  setNotifications: (notifications: NotificationData[]) =>
    set({ notifications }),
  addNotification: (notification: NotificationData) =>
    set((state) => ({ notifications: [...state.notifications, notification] })),
  removeNotification: (notificationId: string) =>
    set((state) => ({
      notifications: state.notifications.filter(
        (notification) => notification.id !== notificationId,
      ),
    })),
  clearNotifications: () => set({ notifications: [] }),
}));
