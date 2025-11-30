import type { QueueNotificationMessage } from "@/actions/-mailer/helpers";

/**
 * Extracted notification data from batched messages
 */
export interface NotificationData {
  recipientId: string;
  postId: string;
  postTitle: string;
  notificationType: "post_comment" | "comment_reply";
  uniqueCommenters: string[];
  commentCount: number;
  targetId: string;
}

/**
 * Extract common notification data from batched messages
 */
export function extractNotificationData(
  batchedMessages: QueueNotificationMessage[],
): NotificationData {
  const firstMessage = batchedMessages[0];
  const uniqueCommenters = [
    ...new Set(batchedMessages.map((m) => m.commenterUsername)),
  ];

  return {
    recipientId: firstMessage.recipientId,
    postId: firstMessage.postId,
    postTitle: firstMessage.postTitle,
    notificationType: firstMessage.notificationType,
    uniqueCommenters,
    commentCount: batchedMessages.length,
    targetId: firstMessage.targetId,
  };
}

/**
 * Build real-time notification payload for WebSocket emission
 */
export function buildRealtimeNotificationPayload(
  data: NotificationData,
): {
  type: "inbox_changed";
  notificationType: "post_comment" | "comment_reply";
  postId: string;
  postTitle: string;
  commentCount: number;
  commenters: string[];
} {
  return {
    type: "inbox_changed",
    notificationType: data.notificationType,
    postId: data.postId,
    postTitle: data.postTitle,
    commentCount: data.commentCount,
    commenters: data.uniqueCommenters,
  };
}

