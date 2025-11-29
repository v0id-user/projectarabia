import { defineRoom, createActorHandler } from "verani";
import { logger } from "@/lib/logger";
import { dehydrateSignedToken } from "@/lib/tokens";
import type { SignedToken } from "@/lib/tokens";
import type { SessionData } from "@/actions/-sessions/useSession";

export const notificationRoom = defineRoom({
  name: "notification",
  websocketPath: "/ws/notification",

  extractMeta: async (req) => {
    logger.info("notification.extractMeta", { action: "extracting-token" });

    // Extract token from URL query parameters
    const url = new URL(req.url);
    const tokenParam = url.searchParams.get("token");

    if (!tokenParam) {
      logger.warn("notification.extractMeta", {
        action: "missing-token",
        url: req.url,
      });
      throw new Error("Unauthorized to connect to notification: missing token");
    }

    try {
      // Parse the signed token from the query parameter
      // The token format is "token.signature" (base64url.base64url)
      const [token, signature] = tokenParam.split(".");
      if (!token || !signature) {
        throw new Error("Malformed token format");
      }

      const signedToken: SignedToken = {
        token,
        signature,
        signed: tokenParam,
      };

      // Validate and decode the token
      const sessionData = await dehydrateSignedToken<SessionData>(signedToken);

      logger.info("notification.extractMeta", {
        action: "token-validated",
        userId: sessionData.userId,
      });

      return {
        userId: sessionData.userId,
        clientId: sessionData.userId,
        channels: ["notification:projectarabia-notification"],
      };
    } catch (error) {
      logger.warn("notification.extractMeta", {
        action: "token-validation-failed",
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error("Unauthorized to connect to notification: invalid token");
    }
  },
});

// Register event handlers (socket.io-like, recommended)
notificationRoom.on("notification.update", (ctx, data) => {
  logger.info("notification.onMessage", {
    type: "notification.update",
    room:
      ctx.actor?.sessions?.size > 0 ? "projectarabia-notification" : "unknown",
    frame: {
      type: "notification.update",
      data: {
        ...data,
        message: "[REDACTED]",
      },
    },
  });

  // Extract userId from data
  const userId = data.userId;
  if (!userId) {
    throw new Error("Missing userId");
  }

  logger.info("notification.onMessage", {
    action: "relay-message",
    toUserId: userId,
    room: "projectarabia-notification",
    message: "[REDACTED]",
  });

  // Use new emit API instead of sendToUser
  ctx.actor.emit.to(userId).emit("inbox_changed", {
    type: "inbox_changed",
  });
});

export const Notification = createActorHandler(notificationRoom);
