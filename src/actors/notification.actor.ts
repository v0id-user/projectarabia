import { useAppSession } from "@/actions/-sessions/useSession";
import { logger } from "@/lib/logger";
import { defineRoom, createActorHandler } from "verani";

export const notificationRoom = defineRoom({
  name: "notification",
  websocketPath: "/ws/notification",

  extractMeta: async () => {
    const session = await useAppSession();
    logger.info("notification.extractMeta", {
      action: "check-session",
      userId: session.data?.userId,
    });

    if (!session.data?.userId) {
      logger.warn("notification.extractMeta", {
        action: "unauthorized-attempt",
        session: { ...session, data: { ...session.data } },
      });
      throw new Error("Unauthorized to connect to notification");
    }

    logger.info("notification.extractMeta", {
      action: "authorized",
      userId: session.data.userId,
    });

    return {
      userId: session.data.userId,
      clientId: session.data.userId,
      channels: ["notification:projectarabia-notification"],
    };
  },

  onMessage(ctx, frame) {
    logger.info("notification.onMessage", {
      type: frame.type,
      room:
        ctx.actor?.sessions?.size > 0
          ? "projectarabia-notification"
          : "unknown",
      frame: {
        ...frame,
        data: {
          ...frame.data,
          message:
            frame.type === "notification.message"
              ? "[REDACTED]"
              : frame.data?.message,
        },
      },
    });

    if (frame.type === "notification.update") {
      // Extract userId from frame.data
      const userId = frame.data.userId;
      if (!userId) {
        throw new Error("Missing userId");
      }

      logger.info("notification.onMessage", {
        action: "relay-message",
        toUserId: userId,
        room: "projectarabia-notification",
        message: "[REDACTED]",
      });

      ctx.actor.sendToUser(
        userId,
        "notification.update",
        JSON.stringify({ type: "inbox_changed" }),
      );
    }
  },
});

export const Notification = createActorHandler(notificationRoom);
