import handleRequest from "@tanstack/react-start/server-entry";
import type { QueueNotificationMessage } from "@/actions/-mailer/helpers";
import {
  batchNotificationMessages,
  getPostOwnerEmail,
  getCommentOwnerEmail,
} from "@/actions/-mailer/helpers";
import {
  prepareNotificationEmail,
  setCooldown,
} from "@/actions/-mailer/queue";
import { sendBatchEmails } from "@/lib/email";
import { env } from "cloudflare:workers";
import { Chat } from "@/actors/chat.actor";
import { UserInbox } from "@/dos/inbox";
import { Notification } from "@/actors/notification.actor";
import { logger } from "@/lib/logger";
import {
  extractNotificationData,
  buildRealtimeNotificationPayload,
} from "@/lib/notifications";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    logger.info("worker:fetch: received request", { url: request.url });

    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname.startsWith("/ws/chat")) {
      logger.info("worker:fetch: forwarding request to chatStub");
      const chat = Chat.get("projectarabia-chat");
      return await chat.fetch(request);
    } else if (pathname.startsWith("/ws/notification")) {
      logger.info("worker:fetch: forwarding request to notificationStub");
      const notification = Notification.get("projectarabia-notification");
      return await notification.fetch(request);
    } else {

      logger.info("worker:fetch: path did not match any special route, forwarding to @tanstack/react-start handler", { url: request.url });
      return await handleRequest.fetch(request, {
        context: { cloudflare: { env, ctx } },
      });
    }
  },
  async queue(
    batch: MessageBatch<QueueNotificationMessage>,
    _env: Env,
    _ctx: ExecutionContext,
  ) {
    console.log(`Processing ${batch.messages.length} queue messages`);

    // Extract messages
    const messages = batch.messages.map((msg) => msg.body);

    // Batch by recipient and target
    const batched = batchNotificationMessages(messages);

    // Prepare all emails and check cooldowns
    const emailsToSend: Array<{
      email: Awaited<ReturnType<typeof prepareNotificationEmail>>;
      recipientEmail: string;
    }> = [];

    for (const [key, batchedMessages] of batched.entries()) {
      try {
        const notificationData = extractNotificationData(batchedMessages);

        // Get recipient email based on notification type
        let recipientEmail: string | null = null;

        if (notificationData.notificationType === "post_comment") {
          // Fetch post owner email
          const postOwner = await getPostOwnerEmail(notificationData.targetId);
          recipientEmail = postOwner?.email || null;
        } else if (notificationData.notificationType === "comment_reply") {
          // Fetch comment owner email
          const commentOwner = await getCommentOwnerEmail(
            notificationData.targetId,
          );
          recipientEmail = commentOwner?.email || null;
        }

        if (!recipientEmail) {
          console.log(
            `Skipping notification - recipient has no email: ${notificationData.recipientId} skipping notification type: ${notificationData.notificationType}`,
          );
          continue;
        }

        // Prepare email and check cooldown
        const prepared = await prepareNotificationEmail(
          recipientEmail,
          notificationData.recipientId,
          notificationData.notificationType,
          notificationData.targetId,
          batchedMessages,
        );

        if (prepared) {
          emailsToSend.push({
            email: prepared,
            recipientEmail,
          });
        }
      } catch (error) {
        console.error(`Error preparing batch ${key}:`, error);
        // Continue processing other batches
      }
    }

    // Send all emails in a single batch call
    if (emailsToSend.length > 0) {
      try {
        console.log(`Sending ${emailsToSend.length} emails in batch`);

        const emailPayloads = emailsToSend.map((item) => item.email!.email);
        await sendBatchEmails(emailPayloads, env.RESEND_API_KEY);

        // Set cooldowns for all successfully sent emails
        await Promise.all(
          emailsToSend.map((item) => setCooldown(item.email!.cooldownKey)),
        );

        console.log(`Successfully sent ${emailsToSend.length} emails`);
      } catch (error) {
        console.error("Error sending batch emails:", error);
      }
    }

    // Emit real-time notifications to all recipients (regardless of email cooldown)
    try {
      const notificationStub = Notification.get("projectarabia-notification");
      const notificationPromises: Promise<number>[] = [];

      for (const [, batchedMessages] of batched.entries()) {
        const notificationData = extractNotificationData(batchedMessages);
        const payload = buildRealtimeNotificationPayload(notificationData);

        // Emit real-time notification using socket.io-like API
        const emitPromise = (async () => {
          try {
            const sentCount = await (
              await notificationStub.toUser(notificationData.recipientId)
            ).emit("inbox_changed", payload);
            logger.info("worker:queue:notification-emitted", {
              recipientId: notificationData.recipientId,
              sentCount,
              notificationType: notificationData.notificationType,
            });
            return sentCount;
          } catch (error) {
            logger.error("worker:queue:notification-emit-error", {
              recipientId: notificationData.recipientId,
              error:
                error instanceof Error ? error.message : String(error),
            });
            return 0;
          }
        })();

        notificationPromises.push(emitPromise);
      }

      // Wait for all notifications to be emitted (but don't fail if some fail)
      const results = await Promise.allSettled(notificationPromises);
      const successCount = results.filter(
        (r) => r.status === "fulfilled" && r.value > 0,
      ).length;
      logger.info("worker:queue:notifications-completed", {
        total: notificationPromises.length,
        successful: successCount,
      });
    } catch (error) {
      // Log error but don't fail queue processing
      logger.error("worker:queue:notification-batch-error", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    console.log("Queue processing completed");
  },
};

export { Chat, UserInbox, Notification }
