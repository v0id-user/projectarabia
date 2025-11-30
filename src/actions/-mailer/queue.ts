import { env } from "cloudflare:workers";
import type { EmailPayloadMap, BatchEmailInput } from "@/lib/email";
import type { QueueNotificationMessage } from "./helpers";
import {
  selectRandomHighlights,
  generatePostLink,
} from "./helpers";
import { extractNotificationData } from "@/lib/notifications";
import { logger } from "@/lib/logger";

const COOLDOWN_TTL_SECONDS = 30 * 60; // 30 minutes

/**
 * Prepare notification email data with cooldown check
 * Returns null if cooldown is active
 */
export async function prepareNotificationEmail(
  recipientEmail: string,
  recipientId: string,
  _notificationType: "post_comment" | "comment_reply", // Kept for backward compatibility
  targetId: string, // postId or commentId
  messages: QueueNotificationMessage[],
): Promise<{
  email: BatchEmailInput<"notification">;
  cooldownKey: string;
} | null> {
  try {
    // Check KV cooldown
    const cooldownKey = `notification:${recipientId}:${targetId}`;
    const existingCooldown = await env.ARABIAN_KV.get(cooldownKey);

    if (existingCooldown) {
      logger.info("prepareNotificationEmail", {
        tag: "prepareNotificationEmail",
        action: "cooldown_active",
        recipientId,
        targetId,
      });
      return null;
    }

    // Extract data from messages
    const notificationData = extractNotificationData(messages);
    const commentTexts = messages.map((m) => m.commentText);

    // Prepare email data
    const emailData: EmailPayloadMap["notification"] = {
      to: recipientEmail,
      notificationType: notificationData.notificationType,
      postTitle: notificationData.postTitle,
      postLink: generatePostLink(notificationData.postId),
      commenters: notificationData.uniqueCommenters,
      commentCount: notificationData.commentCount,
      highlights: selectRandomHighlights(commentTexts, 3),
    };

    logger.info("prepareNotificationEmail", {
      tag: "prepareNotificationEmail",
      action: "prepared",
      recipientId: notificationData.recipientId,
      targetId: notificationData.targetId,
      notificationType: notificationData.notificationType,
      commentCount: notificationData.commentCount,
    });

    return {
      email: {
        type: "notification",
        data: emailData,
      },
      cooldownKey,
    };
  } catch (error) {
    logger.error("prepareNotificationEmail", {
      tag: "prepareNotificationEmail",
      error: error instanceof Error ? error.message : "Unknown error",
      recipientId,
      targetId,
    });
    throw error;
  }
}

/**
 * Set cooldown for a notification
 */
export async function setCooldown(cooldownKey: string) {
  logger.debug("setCooldown", {
    tag: "setCooldown",
    cooldownKey,
    ttl: COOLDOWN_TTL_SECONDS,
  });
  await env.ARABIAN_KV.put(cooldownKey, "1", {
    expirationTtl: COOLDOWN_TTL_SECONDS,
  });
}
