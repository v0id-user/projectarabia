import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { useAppSession } from "./-sessions/useSession";
import type { PostSubmition } from "@/schemas/forms/post";
import { adminHidePost, adminEditPost } from "@/services/posts";
import { adminHideComment } from "@/services/comments";
import {
  promoteUserToModerator,
  depromoteUser,
  getSafeUserByIdWithStatus,
} from "@/services/user";
import { logger } from "@/lib/logger";
import { banUser, unbanUser } from "@/db/queries/users_status";
import { findPostById } from "@/db/queries/posts";
import { findCommentById } from "@/db/queries/comments";
import { findUserByUsername, findUserById } from "@/db/queries/users";
import { restoreHiddenPost, restoreHiddenComment } from "@/services/admin";

// Helper function to check if a user is the SuperUser account
const isSuperUserAccount = (
  username: string | null,
  email: string | null,
): boolean => {
  return username === "v0id_user" && email === "b11z@v0id.me";
};

// Create a server function middleware for SuperUser-only validation
const superUserMiddleware = createMiddleware({
  type: "function",
}).server(async ({ next }) => {
  const session = await useAppSession();
  if (!session.data?.userId) {
    logger.warn("superUserMiddleware", {
      tag: "superUserMiddleware",
      action: "unauthorized",
    });
    throw new Error("يجب تسجيل الدخول للتعديل");
  }

  const user = await getSafeUserByIdWithStatus(session.data.userId);

  // Check if user exists
  if (!user) {
    logger.warn("superUserMiddleware", {
      tag: "superUserMiddleware",
      action: "user_not_found",
      userId: session.data.userId,
    });
    throw new Error("المستخدم غير موجود");
  }

  // Verify user is the SuperUser
  const isSuperUser =
    user.username === "v0id_user" &&
    user.email === "b11z@v0id.me" &&
    user.verified === true;

  if (!isSuperUser) {
    logger.warn("superUserMiddleware", {
      tag: "superUserMiddleware",
      action: "insufficient_permissions",
      userId: session.data.userId,
      username: user.username,
      email: user.email,
      verified: user.verified,
    });
    throw new Error("ليس لديك صلاحيات التعديل");
  }

  return next({
    context: {
      isSuperUser: true,
    },
  });
});

// Create a server function middleware for moderator validation (moderators + SuperUser)
const moderatorMiddleware = createMiddleware({
  type: "function",
}).server(async ({ next }) => {
  const session = await useAppSession();
  if (!session.data?.userId) {
    logger.warn("moderatorMiddleware", {
      tag: "moderatorMiddleware",
      action: "unauthorized",
    });
    throw new Error("يجب تسجيل الدخول للتعديل");
  }

  const user = await getSafeUserByIdWithStatus(session.data.userId);

  // Check if user exists
  if (!user) {
    logger.warn("moderatorMiddleware", {
      tag: "moderatorMiddleware",
      action: "user_not_found",
      userId: session.data.userId,
    });
    throw new Error("المستخدم غير موجود");
  }

  // Check if user is SuperUser
  const isSuperUser =
    user.username === "v0id_user" &&
    user.email === "b11z@v0id.me" &&
    user.verified === true;

  // Check if user is moderator
  const isModerator = user.role === "moderator";

  // User must be either SuperUser or moderator
  if (!isSuperUser && !isModerator) {
    logger.warn("moderatorMiddleware", {
      tag: "moderatorMiddleware",
      action: "insufficient_permissions",
      userId: session.data.userId,
      username: user.username,
      role: user.role,
    });
    throw new Error("ليس لديك صلاحيات التعديل");
  }

  return next({
    context: {
      isSuperUser,
      isModerator,
    },
  });
});

export const adminHidePostFn = createServerFn({ method: "POST" })
  .middleware([moderatorMiddleware])
  .inputValidator((data: { postId: string; reason: string }) => data)
  .handler(async ({ data }) => {
    const { postId, reason } = data;
    const session = await useAppSession();

    const post = await findPostById(postId);
    if (!post) {
      logger.error("adminHidePostFn", {
        tag: "adminHidePostFn",
        action: "post_not_found",
        postId,
      });
      return {
        success: false,
        error: "المنشور غير موجود",
        errorCode: "POST_NOT_FOUND",
      };
    }

    // Check if post owner is SuperUser
    const postOwner = await findUserById(post.userId);
    if (postOwner && isSuperUserAccount(postOwner.username, postOwner.email)) {
      logger.warn("adminHidePostFn", {
        tag: "adminHidePostFn",
        action: "superuser_protection",
        postId,
      });
      return {
        success: false,
        error: "لا يمكن إخفاء منشورات المشرف الأساسي",
        errorCode: "SUPERUSER_PROTECTED",
      };
    }

    if (post.userId === session.data.userId) {
      logger.warn("adminHidePostFn", {
        tag: "adminHidePostFn",
        action: "self_action_prevented",
        postId,
      });
      return {
        success: false,
        error: "لا يمكنك إخفاء منشوراتك الخاصة",
        errorCode: "SELF_ACTION_NOT_ALLOWED",
      };
    }

    logger.info("adminHidePostFn", { postId, reason });

    const result = await adminHidePost(postId);
    if (!result.success) {
      logger.error("adminHidePostFn", {
        postId,
        error: result.error,
        errorCode: result.errorCode,
      });
      return result;
    }

    logger.info("adminHidePostFn", { action: "success", postId });
    return {
      success: true,
      postId: result.postId,
    };
  });

export const adminHideCommentFn = createServerFn({ method: "POST" })
  .middleware([moderatorMiddleware])
  .inputValidator((data: { commentId: string }) => data)
  .handler(async ({ data }) => {
    const { commentId } = data;
    const session = await useAppSession();

    const comment = await findCommentById(commentId);
    if (!comment) {
      logger.error("adminHideCommentFn", {
        tag: "adminHideCommentFn",
        action: "comment_not_found",
        commentId,
      });
      return {
        success: false,
        error: "التعليق غير موجود",
        errorCode: "COMMENT_NOT_FOUND",
      };
    }

    // Check if comment owner is SuperUser
    const commentOwner = await findUserById(comment.userId);
    if (
      commentOwner &&
      isSuperUserAccount(commentOwner.username, commentOwner.email)
    ) {
      logger.warn("adminHideCommentFn", {
        tag: "adminHideCommentFn",
        action: "superuser_protection",
        commentId,
      });
      return {
        success: false,
        error: "لا يمكن إخفاء تعليقات المشرف الأساسي",
        errorCode: "SUPERUSER_PROTECTED",
      };
    }

    if (comment.userId === session.data.userId) {
      logger.warn("adminHideCommentFn", {
        tag: "adminHideCommentFn",
        action: "self_action_prevented",
        commentId,
      });
      return {
        success: false,
        error: "لا يمكنك إخفاء تعليقاتك الخاصة",
        errorCode: "SELF_ACTION_NOT_ALLOWED",
      };
    }

    logger.info("adminHideCommentFn", { commentId });

    const result = await adminHideComment(commentId);
    if (!result.success) {
      logger.error("adminHideCommentFn", {
        commentId,
        error: result.error,
        errorCode: result.errorCode,
      });
      return result;
    }

    logger.info("adminHideCommentFn", { action: "success", commentId });
    return {
      success: true,
      commentId: result.commentId,
    };
  });

export const adminEditPostFn = createServerFn({ method: "POST" })
  .middleware([moderatorMiddleware])
  .inputValidator(
    (data: PostSubmition & { postId: string; reason: string }) => data,
  )
  .handler(async ({ data }) => {
    const { postId, reason } = data;
    const session = await useAppSession();

    const post = await findPostById(postId);
    if (!post) {
      logger.error("adminEditPostFn", {
        tag: "adminEditPostFn",
        action: "post_not_found",
        postId,
      });
      return {
        success: false,
        error: "المنشور غير موجود",
        errorCode: "POST_NOT_FOUND",
      };
    }

    // Check if post owner is SuperUser
    const postOwner = await findUserById(post.userId);
    if (postOwner && isSuperUserAccount(postOwner.username, postOwner.email)) {
      logger.warn("adminEditPostFn", {
        tag: "adminEditPostFn",
        action: "superuser_protection",
        postId,
      });
      return {
        success: false,
        error: "لا يمكن تعديل منشورات المشرف الأساسي",
        errorCode: "SUPERUSER_PROTECTED",
      };
    }

    if (post.userId === session.data.userId) {
      logger.warn("adminEditPostFn", {
        tag: "adminEditPostFn",
        action: "self_action_prevented",
        postId,
      });
      return {
        success: false,
        error: "لا يمكنك تعديل منشوراتك الخاصة كمشرف",
        errorCode: "SELF_ACTION_NOT_ALLOWED",
      };
    }

    logger.info("adminEditPostFn", { postId, reason });

    const result = await adminEditPost(data, postId, reason);
    if (!result.success) {
      logger.error("adminEditPostFn", {
        postId,
        error: result.error,
        errorCode: result.errorCode,
      });
      return result;
    }

    logger.info("adminEditPostFn", { action: "success", postId });
    return {
      success: true,
      postId: result.postId,
    };
  });

export const promoteUserFn = createServerFn({ method: "POST" })
  .middleware([superUserMiddleware])
  .inputValidator((data: { username: string }) => data)
  .handler(async ({ data }) => {
    const { username } = data;
    const session = await useAppSession();

    const targetUser = await findUserByUsername(username);
    if (targetUser?.id === session.data.userId) {
      logger.warn("promoteUserFn", {
        action: "self_action_prevented",
        username,
      });
      return {
        success: false,
        error: "لا يمكنك ترقية نفسك",
        errorCode: "SELF_ACTION_NOT_ALLOWED",
      };
    }

    // Check if target user is SuperUser
    if (
      targetUser &&
      isSuperUserAccount(targetUser.username, targetUser.email)
    ) {
      logger.warn("promoteUserFn", {
        action: "superuser_protection",
        username,
      });
      return {
        success: false,
        error: "لا يمكن ترقية المشرف الأساسي",
        errorCode: "SUPERUSER_PROTECTED",
      };
    }

    const result = await promoteUserToModerator(username);
    if (!result.success) {
      logger.error("promoteUserFn", {
        username,
        error: result.error,
        errorCode: result.errorCode,
      });
      return result;
    }

    logger.info("promoteUserFn", {
      action: "success",
      username: result.username,
      userId: result.userId,
    });

    return {
      success: true,
      username: result.username,
      userId: result.userId,
    };
  });

export const deomoteUserFn = createServerFn({ method: "POST" })
  .middleware([superUserMiddleware])
  .inputValidator((data: { username: string }) => data)
  .handler(async ({ data }) => {
    const { username } = data;
    const session = await useAppSession();

    const targetUser = await findUserByUsername(username);
    if (targetUser?.id === session.data.userId) {
      logger.warn("depromoteUserFn", {
        action: "self_action_prevented",
        username,
      });
      return {
        success: false,
        error: "لا يمكنك تخفيض رتبة نفسك",
        errorCode: "SELF_ACTION_NOT_ALLOWED",
      };
    }

    // Check if target user is SuperUser
    if (
      targetUser &&
      isSuperUserAccount(targetUser.username, targetUser.email)
    ) {
      logger.warn("depromoteUserFn", {
        action: "superuser_protection",
        username,
      });
      return {
        success: false,
        error: "لا يمكن تخفيض رتبة المشرف الأساسي",
        errorCode: "SUPERUSER_PROTECTED",
      };
    }

    const result = await depromoteUser(username);
    if (!result.success) {
      logger.error("depromoteUserFn", {
        username,
        error: result.error,
        errorCode: result.errorCode,
      });
      return result;
    }

    logger.info("depromoteUserFn", {
      action: "success",
      username: result.username,
      userId: result.userId,
    });

    return {
      success: true,
      username: result.username,
      userId: result.userId,
    };
  });

export const banUserFn = createServerFn({ method: "POST" })
  .middleware([superUserMiddleware])
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    const { userId } = data;
    const session = await useAppSession();

    if (userId === session.data.userId) {
      logger.error("banUserFn", {
        action: "admin_cannot_ban_self",
        userId,
      });
      return {
        success: false,
        error: "لا يمكن تعديل المشرف الرئيسي",
        errorCode: "ADMIN_CANNOT_BE_BANNED",
      };
    }

    // Check if target user is SuperUser
    const targetUser = await findUserById(userId);
    if (
      targetUser &&
      isSuperUserAccount(targetUser.username, targetUser.email)
    ) {
      logger.warn("banUserFn", {
        action: "superuser_protection",
        userId,
      });
      return {
        success: false,
        error: "لا يمكن حظر المشرف الأساسي",
        errorCode: "SUPERUSER_PROTECTED",
      };
    }

    const bannedUntil = new Date();
    bannedUntil.setMonth(bannedUntil.getMonth() + 1);

    const result = await banUser(
      userId,
      bannedUntil,
      "بان من قبل المشرف الرئيسي",
    );

    if (!result.success) {
      logger.error("banUserFn", { userId, error: result.error });
      return {
        success: false,
        error: result.error,
      };
    }

    logger.info("banUserFn", { action: "success", userId });
    return {
      success: true,
      userId,
    };
  });

export const unbanUserFn = createServerFn({ method: "POST" })
  .middleware([superUserMiddleware])
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    const { userId } = data;
    const session = await useAppSession();

    if (userId === session.data.userId) {
      logger.error("unbanUserFn", {
        action: "admin_cannot_ban_self",
        userId,
      });
      return {
        success: false,
        error: "لا يمكن تعديل المشرف الرئيسي",
        errorCode: "ADMIN_CANNOT_BE_BANNED",
      };
    }

    // Check if target user is SuperUser
    const targetUser = await findUserById(userId);
    if (
      targetUser &&
      isSuperUserAccount(targetUser.username, targetUser.email)
    ) {
      logger.warn("unbanUserFn", {
        action: "superuser_protection",
        userId,
      });
      return {
        success: false,
        error: "لا يمكن إلغاء حظر المشرف الأساسي",
        errorCode: "SUPERUSER_PROTECTED",
      };
    }

    const result = await unbanUser(userId);

    if (!result.success) {
      logger.error("unbanUserFn", { userId, error: result.error });
      return {
        success: false,
        error: result.error,
      };
    }

    logger.info("unbanUserFn", { action: "success", userId });
    return {
      success: true,
      userId,
    };
  });

export const adminUnhidePostFn = createServerFn({ method: "POST" })
  .middleware([moderatorMiddleware])
  .inputValidator((data: { postId: string }) => data)
  .handler(async ({ data }) => {
    const { postId } = data;

    logger.info("adminUnhidePostFn", { postId });

    const result = await restoreHiddenPost(postId);
    if (!result.success) {
      logger.error("adminUnhidePostFn", {
        postId,
        error: result.error,
        errorCode: result.errorCode,
      });
      return result;
    }

    logger.info("adminUnhidePostFn", { action: "success", postId });
    return {
      success: true,
      postId: result.postId,
    };
  });

export const adminUnhideCommentFn = createServerFn({ method: "POST" })
  .middleware([moderatorMiddleware])
  .inputValidator((data: { commentId: string }) => data)
  .handler(async ({ data }) => {
    const { commentId } = data;

    logger.info("adminUnhideCommentFn", { commentId });

    const result = await restoreHiddenComment(commentId);
    if (!result.success) {
      logger.error("adminUnhideCommentFn", {
        commentId,
        error: result.error,
        errorCode: result.errorCode,
      });
      return result;
    }

    logger.info("adminUnhideCommentFn", { action: "success", commentId });
    return {
      success: true,
      commentId: result.commentId,
    };
  });
