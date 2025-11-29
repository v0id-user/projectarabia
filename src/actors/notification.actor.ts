import { logger } from "@/lib/logger";
import { defineRoom, createActorHandler } from "verani";
import { dehydrateSignedToken } from "@/lib/tokens";
import type { SignedToken } from "@/lib/tokens";

type SessionData = {
  userId: string;
  email: string;
  moderator: boolean;
};

export const notificationRoom = defineRoom({
  name: "notification",
  websocketPath: "/ws/notification",

  extractMeta: async (ctx) => {
    logger.info("notification.extractMeta", { action: "extracting-token" });

    // Extract token from URL query parameters
    const url = new URL(ctx.url);
    const tokenParam = url.searchParams.get("token");

    if (!tokenParam) {
      logger.warn("notification.extractMeta", {
        action: "missing-token",
        url: ctx.url,
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
