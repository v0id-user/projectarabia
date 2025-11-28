import { defineRoom, createActorHandler } from "verani";
import { useAppSession } from "@/actions/-sessions/useSession";
import { logger } from "@/lib/logger";

// Define your room with lifecycle hooks
export const chatRoom = defineRoom({
  name: "chat",
  websocketPath: "/ws/chat",

  extractMeta: async () => {
    const session = await useAppSession();
    logger.info("chat.extractMeta", {
      action: "check-session",
      userId: session.data?.userId,
    });

    if (!session.data?.userId) {
      logger.warn("chat.extractMeta", {
        action: "unauthorized-attempt",
        session: { ...session, data: { ...session.data } },
      });
      throw new Error("Unauthorized to connect to chat");
    }

    logger.info("chat.extractMeta", {
      action: "authorized",
      userId: session.data.userId,
    });

    return {
      userId: session.data.userId,
      clientId: session.data.userId,
      channels: ["room:projectarabia-chat"],
    };
  },

  onMessage(ctx, frame) {
    logger.info("chat.onMessage", {
      type: frame.type,
      room: ctx.actor?.sessions?.size > 0 ? "projectarabia-chat" : "unknown",
      frame: {
        ...frame,
        data: {
          ...frame.data,
          message:
            frame.type === "chat.message" ? "[REDACTED]" : frame.data?.message,
        },
      },
    });

    if (frame.type === "chat.message") {
      // Extract userId from frame.data
      const userId = frame.data.userId;
      const message = frame.data.message;

      if (!userId) {
        logger.error("chat.onMessage", {
          error: "Missing userId",
          frame,
        });
        throw new Error("User ID is required");
      }

      if (!message) {
        logger.error("chat.onMessage", {
          error: "Missing message",
          frame: {
            ...frame,
            data: { ...frame.data, message: "[REDACTED]" },
          },
        });
        throw new Error("Message is required");
      }

      logger.info("chat.onMessage", {
        action: "relay-message",
        toUserId: userId,
        room: "projectarabia-chat",
        message: "[REDACTED]",
      });

      // Send message to user
      ctx.actor.sendToUser(userId, "chat.message", message);
    }
  },
});

// Create the Durable Object class
export const ChatRoom = createActorHandler(chatRoom);
