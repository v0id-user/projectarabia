import { unhidePost } from "@/db/queries/posts";
import { unhideComment } from "@/db/queries/comments";
import { logger } from "@/lib/logger";

// === UNHIDE OPERATIONS ===

export async function restoreHiddenPost(
  postId: string,
): Promise<
  | { success: true; postId: string }
  | { success: false; error: string; errorCode: string }
> {
  try {
    logger.info("services/admin:restoreHiddenPost", { postId });

    const post = await unhidePost(postId);

    if (!post) {
      return {
        success: false,
        error: "المنشور غير موجود",
        errorCode: "POST_NOT_FOUND",
      };
    }

    logger.info("services/admin:restoreHiddenPost:success", { postId });

    return {
      success: true,
      postId: post.id,
    };
  } catch (error) {
    logger.error("services/admin:restoreHiddenPost", {
      postId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: "فشل استعادة المنشور",
      errorCode: "RESTORE_POST_FAILED",
    };
  }
}

export async function restoreHiddenComment(
  commentId: string,
): Promise<
  | { success: true; commentId: string }
  | { success: false; error: string; errorCode: string }
> {
  try {
    logger.info("services/admin:restoreHiddenComment", { commentId });

    const comment = await unhideComment(commentId);

    if (!comment) {
      return {
        success: false,
        error: "التعليق غير موجود",
        errorCode: "COMMENT_NOT_FOUND",
      };
    }

    logger.info("services/admin:restoreHiddenComment:success", { commentId });

    return {
      success: true,
      commentId: comment.id,
    };
  } catch (error) {
    logger.error("services/admin:restoreHiddenComment", {
      commentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: "فشل استعادة التعليق",
      errorCode: "RESTORE_COMMENT_FAILED",
    };
  }
}

// === BULK OPERATIONS ===

export async function bulkHidePosts(postIds: string[]): Promise<{
  success: boolean;
  successCount: number;
  failedIds: string[];
}> {
  try {
    logger.info("services/admin:bulkHidePosts", { count: postIds.length });

    const results = await Promise.allSettled(
      postIds.map((postId) =>
        import("@/db/queries/posts").then((m) => m.deletePost(postId)),
      ),
    );

    const failedIds: string[] = [];
    let successCount = 0;

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successCount++;
      } else {
        failedIds.push(postIds[index]);
      }
    });

    logger.info("services/admin:bulkHidePosts:success", {
      successCount,
      failedCount: failedIds.length,
    });

    return {
      success: failedIds.length === 0,
      successCount,
      failedIds,
    };
  } catch (error) {
    logger.error("services/admin:bulkHidePosts", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      successCount: 0,
      failedIds: postIds,
    };
  }
}

export async function bulkUnhidePosts(postIds: string[]): Promise<{
  success: boolean;
  successCount: number;
  failedIds: string[];
}> {
  try {
    logger.info("services/admin:bulkUnhidePosts", { count: postIds.length });

    const results = await Promise.allSettled(
      postIds.map((postId) => unhidePost(postId)),
    );

    const failedIds: string[] = [];
    let successCount = 0;

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successCount++;
      } else {
        failedIds.push(postIds[index]);
      }
    });

    logger.info("services/admin:bulkUnhidePosts:success", {
      successCount,
      failedCount: failedIds.length,
    });

    return {
      success: failedIds.length === 0,
      successCount,
      failedIds,
    };
  } catch (error) {
    logger.error("services/admin:bulkUnhidePosts", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      successCount: 0,
      failedIds: postIds,
    };
  }
}
