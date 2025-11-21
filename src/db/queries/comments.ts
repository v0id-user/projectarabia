import { db } from "@/schemas/db";
import { comments, users, posts } from "@/schemas/db/schema";
import type { Comment } from "@/schemas/db/comments";
import type { CommentSubmission } from "@/schemas/forms/comment";
import { desc, eq, asc, and, lte, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { logger } from "@/lib/logger";

export async function createComment(
  data: CommentSubmission & { userId: string },
) {
  try {
    logger.info("queries/comments:createComment", {
      userId: data.userId,
      postId: data.comment.postId,
      hasParent: !!data.comment.parentId,
    });
    const comment: Comment = {
      id: undefined as unknown as string, // Let DB generate or assign inside the model
      text: data.comment.text,
      userId: data.userId,
      postId: data.comment.postId,
      parentId: data.comment.parentId ?? null,
      reportCount: 0,
      flagged: false,
      hidden: false,
      votes: 0,
      createdAt: undefined as unknown as string, // Let DB auto-populate if needed
      updatedAt: null, // Let DB auto-populate if needed
    };
    const result = await db.insert(comments).values(comment).returning().get();
    logger.info("queries/comments:createComment:success", {
      commentId: result.id,
      postId: data.comment.postId,
      userId: data.userId,
    });
    return result;
  } catch (error) {
    logger.error("queries/comments:createComment", {
      userId: data.userId,
      postId: data.comment.postId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function updateComment(id: string, text: string) {
  try {
    logger.info("queries/comments:updateComment", { commentId: id });
    const result = await db
      .update(comments)
      .set({
        text: text,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(comments.id, id))
      .returning()
      .get();
    logger.info("queries/comments:updateComment:success", { commentId: id });
    return result;
  } catch (error) {
    logger.error("queries/comments:updateComment", {
      commentId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function hideComment(id: string) {
  try {
    logger.info("queries/comments:hideComment", { commentId: id });
    const result = await db
      .update(comments)
      .set({ hidden: true })
      .where(eq(comments.id, id))
      .returning()
      .get();
    logger.info("queries/comments:hideComment:success", { commentId: id });
    return result;
  } catch (error) {
    logger.error("queries/comments:hideComment", {
      commentId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function findCommentById(id: string) {
  return await db
    .select()
    .from(comments)
    .where(
      and(
        eq(comments.id, id),
        eq(comments.hidden, false),
        lte(comments.reportCount, 10),
      ),
    )
    .get();
}

export async function findCommentsByPostId(postId: string) {
  return await db
    .select()
    .from(comments)
    .where(
      and(
        eq(comments.postId, postId),
        eq(comments.hidden, false),
        lte(comments.reportCount, 10),
      ),
    )
    .orderBy(desc(comments.createdAt));
}

export async function findCommentsByParentId(parentId: string) {
  return await db
    .select()
    .from(comments)
    .where(
      and(
        eq(comments.parentId, parentId),
        eq(comments.hidden, false),
        lte(comments.reportCount, 10),
      ),
    )
    .orderBy(desc(comments.createdAt));
}

export async function findCommentsByPostIdWithUsernames(postId: string) {
  return await db
    .select({
      id: comments.id,
      text: comments.text,
      votes: comments.votes,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      parentId: comments.parentId,
      username: users.username,
      hidden: comments.hidden,
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(and(eq(comments.postId, postId), lte(comments.reportCount, 10)))
    .orderBy(asc(comments.createdAt))
    .all();
}

export async function incrementReportCountComment(commentId: string) {
  try {
    const comment = await db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .get();
    if (!comment) {
      logger.warn("queries/comments:incrementReportCountComment:notFound", {
        commentId,
      });
      throw new Error("Comment not found");
    }
    await db
      .update(comments)
      .set({ reportCount: comment.reportCount ? comment.reportCount + 1 : 1 })
      .where(eq(comments.id, commentId));
    logger.info("queries/comments:incrementReportCountComment:success", {
      commentId,
    });
  } catch (error) {
    logger.error("queries/comments:incrementReportCountComment", {
      commentId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function decrementReportCountComment(commentId: string) {
  const comment = await db
    .select()
    .from(comments)
    .where(eq(comments.id, commentId))
    .get();
  if (!comment) {
    throw new Error("Comment not found");
  }
  await db
    .update(comments)
    .set({ reportCount: comment.reportCount ? comment.reportCount - 1 : 0 })
    .where(eq(comments.id, commentId));
}

export async function unhideComment(commentId: string) {
  try {
    logger.info("queries/comments:unhideComment", { commentId });
    const result = await db
      .update(comments)
      .set({ hidden: false })
      .where(eq(comments.id, commentId))
      .returning()
      .get();
    logger.info("queries/comments:unhideComment:success", { commentId });
    return result;
  } catch (error) {
    logger.error("queries/comments:unhideComment", {
      commentId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function incrementVoteCountComment(commentId: string) {
  try {
    const comment = await db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .get();
    if (!comment) {
      logger.warn("queries/comments:incrementVoteCountComment:notFound", {
        commentId,
      });
      throw new Error("Comment not found");
    }
    await db
      .update(comments)
      .set({ votes: comment.votes + 1 })
      .where(eq(comments.id, commentId));
  } catch (error) {
    logger.error("queries/comments:incrementVoteCountComment", {
      commentId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function decrementVoteCountComment(commentId: string) {
  const comment = await db
    .select()
    .from(comments)
    .where(eq(comments.id, commentId))
    .get();
  if (!comment) {
    throw new Error("Comment not found");
  }
  await db
    .update(comments)
    .set({ votes: comment.votes - 1 })
    .where(eq(comments.id, commentId));
}

// Get latest comments with usernames, post titles, and parent comment text
export async function findNewComments(limit: number, cursor?: string) {
  const parentComments = alias(comments, "parentComments");

  const conditions = [
    eq(comments.hidden, false),
    lte(comments.reportCount, 10),
  ];

  // Add cursor condition if provided (cursor is a timestamp)
  if (cursor) {
    conditions.push(lt(comments.createdAt, cursor));
  }

  return await db
    .select({
      id: comments.id,
      text: comments.text,
      votes: comments.votes,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      parentId: comments.parentId,
      postId: comments.postId,
      username: users.username,
      postTitle: posts.title,
      parentText: parentComments.text,
      hidden: comments.hidden,
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .leftJoin(posts, eq(comments.postId, posts.id))
    .leftJoin(parentComments, eq(comments.parentId, parentComments.id))
    .where(and(...conditions))
    .orderBy(desc(comments.createdAt), desc(comments.id))
    .limit(limit)
    .all();
}

// Get comments by username with post titles and parent comment text
export async function findCommentsByUsername(
  username: string,
  limit: number,
  cursor?: string,
) {
  const parentComments = alias(comments, "parentComments");

  const conditions = [
    eq(users.username, username),
    eq(comments.hidden, false),
    lte(comments.reportCount, 10),
  ];

  // Add cursor condition if provided (cursor is a timestamp)
  if (cursor) {
    conditions.push(lt(comments.createdAt, cursor));
  }

  return await db
    .select({
      id: comments.id,
      text: comments.text,
      votes: comments.votes,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      parentId: comments.parentId,
      postId: comments.postId,
      username: users.username,
      postTitle: posts.title,
      parentText: parentComments.text,
      hidden: comments.hidden,
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .leftJoin(posts, eq(comments.postId, posts.id))
    .leftJoin(parentComments, eq(comments.parentId, parentComments.id))
    .where(and(...conditions))
    .orderBy(desc(comments.createdAt), desc(comments.id))
    .limit(limit)
    .all();
}
