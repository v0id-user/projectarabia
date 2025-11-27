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
import { ChatRoom } from "@/actors/chat.actor";
import { UserInbox } from "@/dos/inbox";
import { NotificationRoom } from "@/actors/notification.actor";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (request.url.startsWith("/ws/chat")) {
      const stub = ChatRoom.get("projectarabia-chat");
      return stub.fetch(request);
    }

    return handleRequest.fetch(request, {
      context: { cloudflare: { env, ctx } },
    });
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
        const firstMessage = batchedMessages[0];
        const recipientId = firstMessage.recipientId;
        const targetId = firstMessage.targetId;
        const notificationType = firstMessage.notificationType;

        // Get recipient email based on notification type
        let recipientEmail: string | null = null;

        if (notificationType === "post_comment") {
          // Fetch post owner email
          const postOwner = await getPostOwnerEmail(targetId);
          recipientEmail = postOwner?.email || null;
        } else if (notificationType === "comment_reply") {
          // Fetch comment owner email
          const commentOwner = await getCommentOwnerEmail(targetId);
          recipientEmail = commentOwner?.email || null;
        }

        if (!recipientEmail) {
          console.log(
            `Skipping notification - recipient has no email: ${recipientId} skipping notification type: ${notificationType}`,
          );
          continue;
        }

        // Prepare email and check cooldown
        const prepared = await prepareNotificationEmail(
          recipientEmail,
          recipientId,
          notificationType,
          targetId,
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

    console.log("Queue processing completed");
  },
};

export {ChatRoom, UserInbox, NotificationRoom}
