import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { useAppSession } from "./-sessions/useSession";
import { getSafeUserByIdWithStatus } from "@/services/user";
import { logger } from "@/lib/logger";
import {
  getAllUsersWithStatus,
  getReportsWithContext,
  getHiddenContent,
  getDashboardStats,
} from "@/db/queries/admin";
import { z } from "zod";

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

// Input schemas
const usersListInputSchema = z.object({
  page: z.number().optional().default(1),
  limit: z.number().optional().default(50),
  roleFilter: z.enum(["all", "user", "moderator"]).optional(),
  statusFilter: z.enum(["all", "banned", "muted"]).optional(),
  searchUsername: z.string().optional(),
});

const reportsListInputSchema = z.object({
  page: z.number().optional().default(1),
  limit: z.number().optional().default(50),
});

const hiddenContentInputSchema = z.object({
  type: z.enum(["all", "post", "comment"]).optional().default("all"),
  page: z.number().optional().default(1),
  limit: z.number().optional().default(50),
});

// Server functions for fetching admin data
export const getUsersListFn = createServerFn({ method: "POST" })
  .middleware([moderatorMiddleware])
  .inputValidator((data: z.infer<typeof usersListInputSchema>) => data)
  .handler(async ({ data }) => {
    try {
      logger.info("getUsersListFn", { page: data.page, limit: data.limit });

      const result = await getAllUsersWithStatus(
        data.page,
        data.limit,
        data.roleFilter,
        data.statusFilter,
        data.searchUsername,
      );

      logger.info("getUsersListFn:success", {
        page: data.page,
        total: result.total,
        usersCount: result.users.length,
      });

      return result;
    } catch (error) {
      logger.error("getUsersListFn", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });

export const getReportsListFn = createServerFn({ method: "POST" })
  .middleware([moderatorMiddleware])
  .inputValidator((data: z.infer<typeof reportsListInputSchema>) => data)
  .handler(async ({ data }) => {
    try {
      logger.info("getReportsListFn", { page: data.page, limit: data.limit });

      const result = await getReportsWithContext(data.page, data.limit);

      logger.info("getReportsListFn:success", {
        page: data.page,
        total: result.total,
        reportsCount: result.reports.length,
      });

      return result;
    } catch (error) {
      logger.error("getReportsListFn", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });

export const getHiddenContentFn = createServerFn({ method: "POST" })
  .middleware([moderatorMiddleware])
  .inputValidator((data: z.infer<typeof hiddenContentInputSchema>) => data)
  .handler(async ({ data }) => {
    try {
      logger.info("getHiddenContentFn", {
        type: data.type,
        page: data.page,
        limit: data.limit,
      });

      const result = await getHiddenContent(data.type, data.page, data.limit);

      logger.info("getHiddenContentFn:success", {
        type: data.type,
        page: data.page,
        total: result.total,
        contentCount: result.content.length,
      });

      return result;
    } catch (error) {
      logger.error("getHiddenContentFn", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });

export const getDashboardStatsFn = createServerFn({ method: "POST" })
  .middleware([moderatorMiddleware])
  .handler(async () => {
    try {
      logger.info("getDashboardStatsFn");

      const stats = await getDashboardStats();

      logger.info("getDashboardStatsFn:success", {
        totalUsers: stats.totalUsers,
        totalPosts: stats.totalPosts,
        activeReports: stats.activeReports,
      });

      return stats;
    } catch (error) {
      logger.error("getDashboardStatsFn", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });
