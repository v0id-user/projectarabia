import type { PostSubmition } from "@/schemas/forms/post";
import {
  createPost as dbCreatePost,
  findPostById,
  deletePost as dbDeletePost,
  findPostByIdWithUsername,
  updatePost as dbUpdatePost,
  getPostsInRange,
  findPostsByTitlePrefix,
  findPostsByUsername as dbFindPostsByUsername,
  getAvailableMonths as dbGetAvailableMonths,
  getPostsByMonth as dbGetPostsByMonth,
} from "@/db/queries/posts";
import { getUserStatus } from "@/db/queries/users_status";
import { findCommentsByPostIdWithUsernames } from "@/db/queries/comments";
import {
  findReportByPostIdAndUserId,
  findReportByCommentIdAndUserId,
} from "@/db/queries/reports";
import {
  findVoteByPostIdAndUserId,
  findVoteByCommentIdAndUserId,
} from "@/db/queries/votes";
import { validateTurnstile } from "./cloudflare";
import { rankPosts } from "@/thealgorithm/ranking";
import type {
  PostWithUsername,
  CommentWithUsername,
  PostWithComments,
} from "@/types/posts";
import { getUserBadges } from "./badges";
import { findUserByUsername } from "@/db/queries/users";
import { differenceInMinutes } from "date-fns";
import { EDIT_COOLDOWN_MINUTES } from "@/constants/limts";
import { timeUntil } from "@/lib/time";

// Re-export types for backwards compatibility
export type { PostWithUsername, CommentWithUsername, PostWithComments };

// Common validation helpers (DRY)
async function validateUserStatus(
  userId: string,
): Promise<
  { valid: true } | { valid: false; error: string; errorCode: string }
> {
  const status = await getUserStatus(userId);

  if (status?.bannedUntil) {
    const bannedUntilDate = new Date(status.bannedUntil);
    const now = new Date();
    if (now < bannedUntilDate) {
      return {
        valid: false,
        error: `حسابك محظور، ينتهي الحظر ${timeUntil(status.bannedUntil)}`,
        errorCode: "USER_BANNED",
      };
    }
  }

  if (status?.mutedUntil) {
    const mutedUntilDate = new Date(status.mutedUntil);
    const now = new Date();
    if (now < mutedUntilDate) {
      return {
        valid: false,
        error: `حسابك مكتوم، ينتهي الكتم ${timeUntil(status.mutedUntil)}`,
        errorCode: "USER_MUTED",
      };
    }
  }

  return { valid: true };
}

function validatePostData(post: {
  title?: string | null;
  text?: string | null;
  url?: string | null;
}): { valid: true } | { valid: false; error: string; errorCode: string } {
  // Validate title
  if (!post.title || post.title.trim() === "") {
    return {
      valid: false,
      error: "العنوان مطلوب",
      errorCode: "TITLE_REQUIRED",
    };
  }

  if (post.title.length > 128) {
    return {
      valid: false,
      error: "العنوان يجب ألا يتجاوز 128 حرفاً",
      errorCode: "TITLE_TOO_LONG",
    };
  }

  // Validate text (required, 50-2048 characters)
  if (!post.text || post.text.trim() === "") {
    return {
      valid: false,
      error: "النص مطلوب",
      errorCode: "TEXT_REQUIRED",
    };
  }

  if (post.text.length < 50) {
    return {
      valid: false,
      error: "النص يجب أن يكون 50 حرفاً على الأقل",
      errorCode: "TEXT_TOO_SHORT",
    };
  }

  if (post.text.length > 2048) {
    return {
      valid: false,
      error: "النص يجب ألا يتجاوز 2048 حرفاً",
      errorCode: "TEXT_TOO_LONG",
    };
  }

  // Validate URL (optional, but must be valid if provided)
  if (post.url && post.url.trim() !== "") {
    try {
      new URL(post.url);
    } catch {
      return {
        valid: false,
        error: "الرابط يجب أن يكون صحيحاً",
        errorCode: "INVALID_URL",
      };
    }
  }

  return { valid: true };
}

// Create new post
export async function createPost(
  data: PostSubmition,
  userId: string,
): Promise<
  | { success: true; postId: string }
  | { success: false; error: string; errorCode: string }
> {
  // Validate Turnstile token
  const turnstileResult = await validateTurnstile(data.cf_turnstile);
  if (!turnstileResult.success) {
    return {
      success: false,
      error: "فشل التحقق من أنك لست روبوت. يرجى المحاولة مرة أخرى.",
      errorCode: "TURNSTILE_FAILED",
    };
  }

  // Check user status
  const userStatusValidation = await validateUserStatus(userId);
  if (!userStatusValidation.valid) {
    return {
      success: false,
      error: userStatusValidation.error,
      errorCode: userStatusValidation.errorCode,
    };
  }

  // Validate post data
  const postValidation = validatePostData(data.post);
  if (!postValidation.valid) {
    return {
      success: false,
      error: postValidation.error,
      errorCode: postValidation.errorCode,
    };
  }

  // Create post in database
  const { post } = data;
  const newPost = await dbCreatePost({
    title: post.title?.trim(),
    text: post.text?.trim(),
    url: post.url && post.url.trim() !== "" ? post.url.trim() : null,
    userId,
  });

  return {
    success: true,
    postId: newPost.id,
  };
}

export async function getPostByIdJoinedWithComments(
  postId: string,
  userId?: string,
): Promise<PostWithComments | null> {
  // Query 1: Fetch post with author username
  const postWithUser = await findPostByIdWithUsername(postId);

  // Return null if post not found
  if (!postWithUser || !postWithUser.username) {
    return null;
  }

  // Query 2: Fetch all comments with commenter usernames
  const commentsWithUsers = await findCommentsByPostIdWithUsernames(postId);

  let didReport = false;
  let didVote = false;
  if (userId) {
    // Query 3: Fetch if the user has reported the post
    const report = await findReportByPostIdAndUserId(postId, userId);
    didReport = !!report;

    // Fetch if the user has voted on the post
    const vote = await findVoteByPostIdAndUserId(postId, userId);
    didVote = !!vote;
  }

  // Query 4: Fetch the user's badges
  const author = await findUserByUsername(postWithUser.username);
  if (!author) {
    return null;
  }

  const userBadges = await getUserBadges(author.id);

  // Format and return the data structure
  const post: PostWithUsername = {
    postId: postWithUser.id,
    title: postWithUser.title,
    url: postWithUser.url,
    text: postWithUser.text,
    votes: postWithUser.votes,
    username: postWithUser.username || "unknown",
    userBadges: userBadges,
    commentCount: postWithUser.commentCount,
    createdAt: postWithUser.createdAt || new Date().toISOString(),
    updatedAt: postWithUser.updatedAt ?? undefined,
    didReport: !!didReport,
    didVote: !!didVote,
    hidden: postWithUser.hidden ?? false,
  };

  // Query 5: Fetch if the user has reported and voted on the comments
  let commentReports: boolean[] = [];
  let commentVotes: boolean[] = [];
  if (userId) {
    // Run all the report and vote queries in parallel so we can await them all at once
    const results = await Promise.all(
      commentsWithUsers.map(async (comment) => {
        const report = await findReportByCommentIdAndUserId(comment.id, userId);
        const vote = await findVoteByCommentIdAndUserId(comment.id, userId);
        return { didReport: !!report, didVote: !!vote };
      }),
    );
    commentReports = results.map((r) => r.didReport);
    commentVotes = results.map((r) => r.didVote);
  }

  const commentsFormatted: CommentWithUsername[] = commentsWithUsers.map(
    (comment, index) => ({
      id: comment.id,
      username: comment.username || "unknown",
      text: comment.text,
      votes: comment.votes,
      createdAt: comment.createdAt || new Date().toISOString(),
      updatedAt:
        comment.updatedAt || comment.createdAt || new Date().toISOString(),
      parentId: comment.parentId,
      didReport: commentReports[index] || false,
      didVote: commentVotes[index] || false,
      hidden: comment.hidden ?? false,
    }),
  );

  return {
    post,
    comments: commentsFormatted,
  };
}

export async function getPostById(id: string) {
  return await findPostById(id);
}

export async function editPost(
  data: PostSubmition,
  postId: string,
  userId: string,
): Promise<
  | { success: true; postId: string }
  | { success: false; error: string; errorCode: string }
> {
  const userStatus = await getUserStatus(userId);
  const isModerator = userStatus?.role === "moderator";
  // Validate Turnstile token
  const turnstileResult = await validateTurnstile(data.cf_turnstile);
  if (!turnstileResult.success) {
    return {
      success: false,
      error: "فشل التحقق من أنك لست روبوت. يرجى المحاولة مرة أخرى.",
      errorCode: "TURNSTILE_FAILED",
    };
  }

  // Check user status
  const userStatusValidation = await validateUserStatus(userId);
  if (!userStatusValidation.valid) {
    return {
      success: false,
      error: userStatusValidation.error,
      errorCode: userStatusValidation.errorCode,
    };
  }

  // Validate post data
  const postValidation = validatePostData(data.post);
  if (!postValidation.valid) {
    return {
      success: false,
      error: postValidation.error,
      errorCode: postValidation.errorCode,
    };
  }

  // Check if post exists
  const existingPost = await findPostById(postId);
  if (!existingPost) {
    return {
      success: false,
      error: "المنشور غير موجود",
      errorCode: "POST_NOT_FOUND",
    };
  }

  const createdAtDate = new Date(existingPost.createdAt);
  const now = new Date();
  if (
    differenceInMinutes(now, createdAtDate) > EDIT_COOLDOWN_MINUTES &&
    !isModerator
  ) {
    return {
      success: false,
      error: `انتهت مهلة تعديل المنشور (${EDIT_COOLDOWN_MINUTES} دقيقة فقط)`,
      errorCode: "EDIT_COOLDOWN_EXPIRED",
    };
  }

  // Check if user owns the post
  if (existingPost.userId !== userId) {
    return {
      success: false,
      error: "ليس لديك صلاحية لتعديل هذا المنشور",
      errorCode: "UNAUTHORIZED",
    };
  }

  // Update post in database
  await dbUpdatePost(data, postId);

  return {
    success: true,
    postId: postId,
  };
}

export async function deletePost(postId: string, userId: string) {
  // Check if post exists
  const existingPost = await findPostById(postId);
  if (!existingPost) {
    return {
      success: false,
      error: "المنشور غير موجود",
      errorCode: "POST_NOT_FOUND",
    };
  }

  // Check if user owns the post
  if (existingPost.userId !== userId) {
    return {
      success: false,
      error: "ليس لديك صلاحية لحذف هذا المنشور",
      errorCode: "UNAUTHORIZED",
    };
  }

  // Delete post in database
  await dbDeletePost(postId);

  return {
    success: true,
    postId: postId,
  };
}

export async function getHotPosts(
  userId: string | undefined,
  limit: number,
  days: number,
  page: number = 1,
) {
  // Fetch ALL posts from the time window (no cursor, no limit)
  const recentPosts = await getPostsInRange(days, 500); // Get up to 500 posts for ranking

  // Fetch all report and vote statuses in parallel | TODO: this is very expensive, we should make a leftJoin query to get the statuses in one go
  let didReports: boolean[] | undefined;
  let didVotes: boolean[] | undefined;
  if (userId) {
    const results = await Promise.all(
      recentPosts.map(async (post) => {
        const report = await findReportByPostIdAndUserId(post.id, userId);
        const vote = await findVoteByPostIdAndUserId(post.id, userId);
        return { didReport: !!report, didVote: !!vote };
      }),
    );
    didReports = results.map((r) => r.didReport);
    didVotes = results.map((r) => r.didVote);
  }

  // Map posts with username, didReport, and didVote fields
  const postsWithUsername: PostWithUsername[] = recentPosts.map(
    (row, index) => ({
      postId: row.id,
      title: row.title,
      url: row.url,
      text: row.text,
      votes: row.votes,
      hidden: row.hidden ?? false,
      username: row.username,
      userBadges: [],
      commentCount: row.commentCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt ?? undefined,
      didReport: didReports ? !!didReports[index] : false,
      didVote: didVotes ? !!didVotes[index] : false,
    }),
  );

  // Rank ALL posts once
  const ranked = rankPosts(postsWithUsername);

  // Calculate offset based on page number
  const offset = (page - 1) * limit;

  // Check if there are more results after this page
  const hasMore = ranked.length > offset + limit;

  // Slice the ranked results for this page
  const posts = ranked.slice(offset, offset + limit);

  return { posts, hasMore, totalPosts: ranked.length };
}

export async function getNewestPosts(
  userId: string | undefined,
  limit: number,
  days: number,
  cursor?: string,
) {
  // Fetch limit + 1 to check if there are more
  const recentPosts = await getPostsInRange(days, limit + 1, cursor);

  // Fetch all report and vote statuses in parallel | TODO: this is very expensive, we should make a leftJoin query to get the statuses in one go
  let didReports: boolean[] | undefined;
  let didVotes: boolean[] | undefined;
  if (userId) {
    const results = await Promise.all(
      recentPosts.map(async (post) => {
        const report = await findReportByPostIdAndUserId(post.id, userId);
        const vote = await findVoteByPostIdAndUserId(post.id, userId);
        return { didReport: !!report, didVote: !!vote };
      }),
    );
    didReports = results.map((r) => r.didReport);
    didVotes = results.map((r) => r.didVote);
  }

  // Map posts with username, didReport, and didVote fields
  const postsWithUsername: PostWithUsername[] = recentPosts.map(
    (row, index) => ({
      postId: row.id,
      title: row.title,
      url: row.url,
      text: row.text,
      votes: row.votes,
      username: row.username,
      userBadges: [],
      commentCount: row.commentCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt ?? undefined,
      didReport: didReports ? !!didReports[index] : false,
      didVote: didVotes ? !!didVotes[index] : false,
      hidden: row.hidden ?? false,
    }),
  );

  // Check if there are more results
  const hasMore = postsWithUsername.length > limit;
  const posts = postsWithUsername.slice(0, limit);

  return { posts, hasMore };
}

export async function getPostsByTitlePrefix(
  prefix: string,
  userId: string | undefined,
  limit: number,
  days: number,
  cursor?: string,
) {
  // Fetch limit + 1 to check if there are more
  const filteredPosts = await findPostsByTitlePrefix(
    prefix,
    days,
    limit + 1,
    cursor,
  );

  // Fetch all report and vote statuses in parallel
  let didReports: boolean[] | undefined;
  let didVotes: boolean[] | undefined;
  if (userId) {
    const results = await Promise.all(
      filteredPosts.map(async (post) => {
        const report = await findReportByPostIdAndUserId(post.id, userId);
        const vote = await findVoteByPostIdAndUserId(post.id, userId);
        return { didReport: !!report, didVote: !!vote };
      }),
    );
    didReports = results.map((r) => r.didReport);
    didVotes = results.map((r) => r.didVote);
  }

  // Map posts with username, didReport, and didVote fields
  const postsWithUsername: PostWithUsername[] = filteredPosts.map(
    (row, index) => ({
      postId: row.id,
      title: row.title,
      url: row.url,
      text: row.text,
      votes: row.votes,
      username: row.username,
      userBadges: [],
      commentCount: row.commentCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt ?? undefined,
      didReport: didReports ? !!didReports[index] : false,
      didVote: didVotes ? !!didVotes[index] : false,
      hidden: row.hidden ?? false,
    }),
  );

  // Check if there are more results
  const hasMore = postsWithUsername.length > limit;
  const posts = postsWithUsername.slice(0, limit);

  return { posts, hasMore };
}

export async function getPostsByUsername(
  username: string,
  userId: string | undefined,
  limit: number,
  cursor?: string,
) {
  // Fetch limit + 1 to check if there are more
  const userPosts = await dbFindPostsByUsername(username, limit + 1, cursor);

  // Fetch all report and vote statuses in parallel
  let didReports: boolean[] | undefined;
  let didVotes: boolean[] | undefined;
  if (userId) {
    const results = await Promise.all(
      userPosts.map(async (post) => {
        const report = await findReportByPostIdAndUserId(post.id, userId);
        const vote = await findVoteByPostIdAndUserId(post.id, userId);
        return { didReport: !!report, didVote: !!vote };
      }),
    );
    didReports = results.map((r) => r.didReport);
    didVotes = results.map((r) => r.didVote);
  }

  // Map posts with username, didReport, and didVote fields
  const postsWithUsername: PostWithUsername[] = userPosts.map((row, index) => ({
    postId: row.id,
    title: row.title,
    url: row.url,
    text: row.text,
    votes: row.votes,
    username: row.username,
    userBadges: [],
    commentCount: row.commentCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? undefined,
    didReport: didReports ? !!didReports[index] : false,
    didVote: didVotes ? !!didVotes[index] : false,
    hidden: row.hidden ?? false,
  }));

  // Check if there are more results
  const hasMore = postsWithUsername.length > limit;
  const posts = postsWithUsername.slice(0, limit);

  return { posts, hasMore };
}

export async function getPastMonths() {
  const months = await dbGetAvailableMonths();
  return { months };
}

export async function getPostsByMonth(
  month: string,
  userId: string | undefined,
  limit: number,
  cursor?: string,
) {
  // Fetch limit + 1 to check if there are more
  const monthPosts = await dbGetPostsByMonth(month, limit + 1, cursor);

  // Fetch all report and vote statuses in parallel
  let didReports: boolean[] | undefined;
  let didVotes: boolean[] | undefined;
  if (userId) {
    const results = await Promise.all(
      monthPosts.map(async (post) => {
        const report = await findReportByPostIdAndUserId(post.id, userId);
        const vote = await findVoteByPostIdAndUserId(post.id, userId);
        return { didReport: !!report, didVote: !!vote };
      }),
    );
    didReports = results.map((r) => r.didReport);
    didVotes = results.map((r) => r.didVote);
  }

  // Map posts with username, didReport, and didVote fields
  const postsWithUsername: PostWithUsername[] = monthPosts.map(
    (row, index) => ({
      postId: row.id,
      title: row.title,
      url: row.url,
      text: row.text,
      votes: row.votes,
      username: row.username,
      userBadges: [],
      commentCount: row.commentCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt ?? undefined,
      didReport: didReports ? !!didReports[index] : false,
      didVote: didVotes ? !!didVotes[index] : false,
      hidden: row.hidden ?? false,
    }),
  );

  // Check if there are more results
  const hasMore = postsWithUsername.length > limit;
  const posts = postsWithUsername.slice(0, limit);

  return { posts, hasMore };
}

// Admin function to edit any post (bypasses ownership check)
export async function adminEditPost(
  data: PostSubmition,
  postId: string,
  reason: string,
): Promise<
  | { success: true; postId: string }
  | { success: false; error: string; errorCode: string }
> {
  // Validate Turnstile token
  const turnstileResult = await validateTurnstile(data.cf_turnstile);
  if (!turnstileResult.success) {
    return {
      success: false,
      error: "فشل التحقق من أنك لست روبوت. يرجى المحاولة مرة أخرى.",
      errorCode: "TURNSTILE_FAILED",
    };
  }

  // Validate post data
  const postValidation = validatePostData(data.post);
  if (!postValidation.valid) {
    return {
      success: false,
      error: postValidation.error,
      errorCode: postValidation.errorCode,
    };
  }

  // Validate reason
  if (!reason || reason.trim().length === 0) {
    return {
      success: false,
      error: "سبب التعديل مطلوب",
      errorCode: "REASON_REQUIRED",
    };
  }

  if (reason.length > 512) {
    return {
      success: false,
      error: "سبب التعديل يجب ألا يتجاوز 512 حرفاً",
      errorCode: "REASON_TOO_LONG",
    };
  }

  // Check if post exists
  const existingPost = await findPostById(postId);
  if (!existingPost) {
    return {
      success: false,
      error: "المنشور غير موجود",
      errorCode: "POST_NOT_FOUND",
    };
  }

  // Admin can edit any post - skip ownership check
  // Update post in database
  await dbUpdatePost(data, postId);

  return {
    success: true,
    postId: postId,
  };
}

// Admin function to hide any post
export async function adminHidePost(
  postId: string,
): Promise<
  | { success: true; postId: string }
  | { success: false; error: string; errorCode: string }
> {
  // Check if post exists
  const existingPost = await findPostById(postId);
  if (!existingPost) {
    return {
      success: false,
      error: "المنشور غير موجود",
      errorCode: "POST_NOT_FOUND",
    };
  }

  // Admin can hide any post - skip ownership check
  await dbDeletePost(postId);

  return {
    success: true,
    postId: postId,
  };
}
