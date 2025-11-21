import { db } from "@/schemas/db";
import {
  users,
  userStatus,
  posts,
  comments,
  reports,
} from "@/schemas/db/schema";
import { desc, eq, and, like, count, gt } from "drizzle-orm";
import { logger } from "@/lib/logger";

// === USER QUERIES ===

export interface UserWithStatus {
  id: string;
  username: string;
  email: string | null;
  createdAt: string;
  karma: number;
  role: "user" | "moderator";
  verified: boolean;
  bannedUntil: string | null;
  mutedUntil: string | null;
  banReason: string | null;
  muteReason: string | null;
}

export async function getAllUsersWithStatus(
  page: number = 1,
  limit: number = 50,
  roleFilter?: "user" | "moderator" | "all",
  statusFilter?: "all" | "banned" | "muted",
  searchUsername?: string,
): Promise<{ users: UserWithStatus[]; total: number; hasMore: boolean }> {
  try {
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [];

    // Role filter
    if (roleFilter && roleFilter !== "all") {
      conditions.push(eq(userStatus.role, roleFilter));
    }

    // Status filter
    const now = new Date().toISOString();
    if (statusFilter === "banned") {
      conditions.push(gt(userStatus.bannedUntil, now));
    } else if (statusFilter === "muted") {
      conditions.push(gt(userStatus.mutedUntil, now));
    }

    // Username search
    if (searchUsername && searchUsername.trim() !== "") {
      conditions.push(like(users.username, `%${searchUsername.trim()}%`));
    }

    // Get users with status
    const usersData = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        createdAt: users.createdAt,
        karma: userStatus.karma,
        role: userStatus.role,
        verified: userStatus.verified,
        bannedUntil: userStatus.bannedUntil,
        mutedUntil: userStatus.mutedUntil,
        banReason: userStatus.banReason,
        muteReason: userStatus.muteReason,
      })
      .from(users)
      .leftJoin(userStatus, eq(users.id, userStatus.userId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(limit + 1) // Get one extra to check if there are more
      .offset(offset)
      .all();

    const hasMore = usersData.length > limit;
    const paginatedUsers = usersData.slice(0, limit);

    // Get total count for pagination
    const totalResult = await db
      .select({ count: count() })
      .from(users)
      .leftJoin(userStatus, eq(users.id, userStatus.userId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .get();

    const total = totalResult?.count || 0;

    logger.info("queries/admin:getAllUsersWithStatus", {
      page,
      limit,
      total,
      hasMore,
    });

    return {
      users: paginatedUsers.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        createdAt: u.createdAt,
        karma: u.karma || 0,
        role: (u.role || "user") as "user" | "moderator",
        verified: u.verified || false,
        bannedUntil: u.bannedUntil,
        mutedUntil: u.mutedUntil,
        banReason: u.banReason,
        muteReason: u.muteReason,
      })),
      total,
      hasMore,
    };
  } catch (error) {
    logger.error("queries/admin:getAllUsersWithStatus", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// === REPORT QUERIES ===

export interface ReportWithContext {
  reportId: string;
  contentType: "post" | "comment";
  contentId: string;
  contentText: string;
  contentTitle?: string; // For posts
  authorUsername: string;
  reportCount: number;
  createdAt: string;
  reporters: {
    username: string;
    reportedAt: string;
    reason: string;
  }[];
}

export async function getReportsWithContext(
  page: number = 1,
  limit: number = 50,
): Promise<{ reports: ReportWithContext[]; total: number; hasMore: boolean }> {
  try {
    const offset = (page - 1) * limit;

    // Get reported posts
    const reportedPosts = await db
      .select({
        postId: posts.id,
        title: posts.title,
        text: posts.text,
        url: posts.url,
        authorId: posts.userId,
        reportCount: posts.reportCount,
        createdAt: posts.createdAt,
        username: users.username,
      })
      .from(posts)
      .leftJoin(users, eq(posts.userId, users.id))
      .where(gt(posts.reportCount, 0))
      .orderBy(desc(posts.reportCount), desc(posts.createdAt))
      .all();

    // Get reported comments
    const reportedComments = await db
      .select({
        commentId: comments.id,
        text: comments.text,
        postId: comments.postId,
        authorId: comments.userId,
        reportCount: comments.reportCount,
        createdAt: comments.createdAt,
        username: users.username,
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(gt(comments.reportCount, 0))
      .orderBy(desc(comments.reportCount), desc(comments.createdAt))
      .all();

    // Fetch reporters for each reported item
    const reportsWithContext: ReportWithContext[] = [];

    // Process posts
    for (const post of reportedPosts) {
      const reporters = await db
        .select({
          username: users.username,
          reportedAt: reports.createdAt,
          reason: reports.reason,
        })
        .from(reports)
        .leftJoin(users, eq(reports.userId, users.id))
        .where(eq(reports.postId, post.postId))
        .orderBy(desc(reports.createdAt))
        .all();

      reportsWithContext.push({
        reportId: post.postId,
        contentType: "post",
        contentId: post.postId,
        contentText: post.text || "",
        contentTitle: post.title,
        authorUsername: post.username || "unknown",
        reportCount: post.reportCount || 0,
        createdAt: post.createdAt,
        reporters: reporters.map((r) => ({
          username: r.username || "unknown",
          reportedAt: r.reportedAt,
          reason: r.reason,
        })),
      });
    }

    // Process comments
    for (const comment of reportedComments) {
      const reporters = await db
        .select({
          username: users.username,
          reportedAt: reports.createdAt,
          reason: reports.reason,
        })
        .from(reports)
        .leftJoin(users, eq(reports.userId, users.id))
        .where(eq(reports.commentId, comment.commentId))
        .orderBy(desc(reports.createdAt))
        .all();

      reportsWithContext.push({
        reportId: comment.commentId,
        contentType: "comment",
        contentId: comment.commentId,
        contentText: comment.text,
        authorUsername: comment.username || "unknown",
        reportCount: comment.reportCount || 0,
        createdAt: comment.createdAt,
        reporters: reporters.map((r) => ({
          username: r.username || "unknown",
          reportedAt: r.reportedAt,
          reason: r.reason,
        })),
      });
    }

    // Sort by report count and created date
    reportsWithContext.sort((a, b) => {
      if (b.reportCount !== a.reportCount) {
        return b.reportCount - a.reportCount;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Paginate
    const total = reportsWithContext.length;
    const hasMore = total > offset + limit;
    const paginatedReports = reportsWithContext.slice(offset, offset + limit);

    logger.info("queries/admin:getReportsWithContext", {
      page,
      limit,
      total,
      hasMore,
    });

    return {
      reports: paginatedReports,
      total,
      hasMore,
    };
  } catch (error) {
    logger.error("queries/admin:getReportsWithContext", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// === HIDDEN CONTENT QUERIES ===

export interface HiddenContent {
  contentType: "post" | "comment";
  contentId: string;
  contentText: string;
  contentTitle?: string; // For posts
  authorUsername: string;
  reportCount: number;
  createdAt: string;
  hiddenAt: string;
  hiddenReason: "auto" | "admin" | "user";
}

export async function getHiddenContent(
  type: "post" | "comment" | "all" = "all",
  page: number = 1,
  limit: number = 50,
): Promise<{ content: HiddenContent[]; total: number; hasMore: boolean }> {
  try {
    const offset = (page - 1) * limit;
    const hiddenContent: HiddenContent[] = [];

    // Get hidden posts
    if (type === "all" || type === "post") {
      const hiddenPosts = await db
        .select({
          postId: posts.id,
          title: posts.title,
          text: posts.text,
          reportCount: posts.reportCount,
          createdAt: posts.createdAt,
          updatedAt: posts.updatedAt,
          username: users.username,
        })
        .from(posts)
        .leftJoin(users, eq(posts.userId, users.id))
        .where(eq(posts.hidden, true))
        .orderBy(desc(posts.updatedAt))
        .all();

      for (const post of hiddenPosts) {
        let hiddenReason: "auto" | "admin" | "user" = "user";
        if ((post.reportCount || 0) > 10) {
          hiddenReason = "auto";
        } else if ((post.reportCount || 0) > 0) {
          hiddenReason = "admin";
        }

        hiddenContent.push({
          contentType: "post",
          contentId: post.postId,
          contentText: post.text || "",
          contentTitle: post.title,
          authorUsername: post.username || "unknown",
          reportCount: post.reportCount || 0,
          createdAt: post.createdAt,
          hiddenAt: post.updatedAt || post.createdAt,
          hiddenReason,
        });
      }
    }

    // Get hidden comments
    if (type === "all" || type === "comment") {
      const hiddenComments = await db
        .select({
          commentId: comments.id,
          text: comments.text,
          reportCount: comments.reportCount,
          createdAt: comments.createdAt,
          updatedAt: comments.updatedAt,
          username: users.username,
        })
        .from(comments)
        .leftJoin(users, eq(comments.userId, users.id))
        .where(eq(comments.hidden, true))
        .orderBy(desc(comments.updatedAt))
        .all();

      for (const comment of hiddenComments) {
        let hiddenReason: "auto" | "admin" | "user" = "user";
        if ((comment.reportCount || 0) > 10) {
          hiddenReason = "auto";
        } else if ((comment.reportCount || 0) > 0) {
          hiddenReason = "admin";
        }

        hiddenContent.push({
          contentType: "comment",
          contentId: comment.commentId,
          contentText: comment.text,
          authorUsername: comment.username || "unknown",
          reportCount: comment.reportCount || 0,
          createdAt: comment.createdAt,
          hiddenAt: comment.updatedAt || comment.createdAt,
          hiddenReason,
        });
      }
    }

    // Sort by hidden date
    hiddenContent.sort(
      (a, b) => new Date(b.hiddenAt).getTime() - new Date(a.hiddenAt).getTime(),
    );

    // Paginate
    const total = hiddenContent.length;
    const hasMore = total > offset + limit;
    const paginatedContent = hiddenContent.slice(offset, offset + limit);

    logger.info("queries/admin:getHiddenContent", {
      type,
      page,
      limit,
      total,
      hasMore,
    });

    return {
      content: paginatedContent,
      total,
      hasMore,
    };
  } catch (error) {
    logger.error("queries/admin:getHiddenContent", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// === STATISTICS QUERIES ===

export interface DashboardStats {
  totalUsers: number;
  totalPosts: number;
  totalComments: number;
  activeReports: number;
  bannedUsers: number;
  mutedUsers: number;
  moderators: number;
  hiddenPosts: number;
  hiddenComments: number;
  autoHiddenPosts: number;
  autoHiddenComments: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const now = new Date().toISOString();

    // Get counts in parallel
    const [
      totalUsersResult,
      totalPostsResult,
      totalCommentsResult,
      activeReportsResult,
      bannedUsersResult,
      mutedUsersResult,
      moderatorsResult,
      hiddenPostsResult,
      hiddenCommentsResult,
      autoHiddenPostsResult,
      autoHiddenCommentsResult,
    ] = await Promise.all([
      db.select({ count: count() }).from(users).get(),
      db.select({ count: count() }).from(posts).get(),
      db.select({ count: count() }).from(comments).get(),
      db.select({ count: count() }).from(reports).get(),
      db
        .select({ count: count() })
        .from(userStatus)
        .where(gt(userStatus.bannedUntil, now))
        .get(),
      db
        .select({ count: count() })
        .from(userStatus)
        .where(gt(userStatus.mutedUntil, now))
        .get(),
      db
        .select({ count: count() })
        .from(userStatus)
        .where(eq(userStatus.role, "moderator"))
        .get(),
      db
        .select({ count: count() })
        .from(posts)
        .where(eq(posts.hidden, true))
        .get(),
      db
        .select({ count: count() })
        .from(comments)
        .where(eq(comments.hidden, true))
        .get(),
      db
        .select({ count: count() })
        .from(posts)
        .where(and(eq(posts.hidden, true), gt(posts.reportCount, 10)))
        .get(),
      db
        .select({ count: count() })
        .from(comments)
        .where(and(eq(comments.hidden, true), gt(comments.reportCount, 10)))
        .get(),
    ]);

    const stats: DashboardStats = {
      totalUsers: totalUsersResult?.count || 0,
      totalPosts: totalPostsResult?.count || 0,
      totalComments: totalCommentsResult?.count || 0,
      activeReports: activeReportsResult?.count || 0,
      bannedUsers: bannedUsersResult?.count || 0,
      mutedUsers: mutedUsersResult?.count || 0,
      moderators: moderatorsResult?.count || 0,
      hiddenPosts: hiddenPostsResult?.count || 0,
      hiddenComments: hiddenCommentsResult?.count || 0,
      autoHiddenPosts: autoHiddenPostsResult?.count || 0,
      autoHiddenComments: autoHiddenCommentsResult?.count || 0,
    };

    logger.info("queries/admin:getDashboardStats", {
      totalUsers: stats.totalUsers,
      totalPosts: stats.totalPosts,
      activeReports: stats.activeReports,
    });

    return stats;
  } catch (error) {
    logger.error("queries/admin:getDashboardStats", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
