import { desc, eq, gt, and, lte, like, or, lt } from "drizzle-orm";
import { db } from "@/schemas/db";
import { posts, users } from "@/schemas/db/schema";
import { subDays } from "date-fns";
import type { Post } from "@/schemas/db/posts";
import type { PostSubmition } from "@/schemas/forms/post";
import { logger } from "@/lib/logger";

/** QUERY OPERATIONS */
export async function createPost(data: {
  title: string;
  text: string | null;
  url: string | null;
  userId: string;
}) {
  try {
    logger.info("queries/posts:createPost", {
      userId: data.userId,
      hasUrl: !!data.url,
    });
    const result = await db
      .insert(posts)
      .values({
        title: data.title,
        text: data.text,
        url: data.url,
        userId: data.userId,
        votes: 0,
        commentCount: 0,
      })
      .returning()
      .get();
    logger.info("queries/posts:createPost:success", {
      postId: result.id,
      userId: data.userId,
    });
    return result;
  } catch (error) {
    logger.error("queries/posts:createPost", {
      userId: data.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function deletePost(id: string) {
  try {
    logger.info("queries/posts:deletePost", { postId: id });
    const result = await db
      .update(posts)
      .set({ hidden: true })
      .where(eq(posts.id, id))
      .returning()
      .get();
    logger.info("queries/posts:deletePost:success", { postId: id });
    return result;
  } catch (error) {
    logger.error("queries/posts:deletePost", {
      postId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function findPostById(id: string) {
  return await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.id, id),
        eq(posts.hidden, false),
        lte(posts.reportCount, 10),
      ),
    )
    .get();
}

export async function findPostByIdWithUsername(id: string) {
  return await db
    .select({
      id: posts.id,
      title: posts.title,
      url: posts.url,
      text: posts.text,
      votes: posts.votes,
      commentCount: posts.commentCount,
      createdAt: posts.createdAt,
      username: users.username,
      hidden: posts.hidden,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .leftJoin(users, eq(posts.userId, users.id))
    .where(and(eq(posts.id, id), lte(posts.reportCount, 10)))
    .get();
}

/** UPDATE OPERATIONS */
export async function incrementCommentCount(postId: string) {
  try {
    const post = await db
      .select()
      .from(posts)
      .where(eq(posts.id, postId))
      .get();

    if (!post) {
      logger.warn("queries/posts:incrementCommentCount:notFound", { postId });
      throw new Error("Post not found");
    }

    await db
      .update(posts)
      .set({ commentCount: post.commentCount + 1 })
      .where(eq(posts.id, postId));
  } catch (error) {
    logger.error("queries/posts:incrementCommentCount", {
      postId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function decrementCommentCount(postId: string) {
  const post = await db.select().from(posts).where(eq(posts.id, postId)).get();

  if (!post) {
    throw new Error("Post not found");
  }

  await db
    .update(posts)
    .set({ commentCount: post.commentCount - 1 })
    .where(eq(posts.id, postId));
}

export async function incrementVoteCount(postId: string) {
  try {
    const post = await db
      .select()
      .from(posts)
      .where(eq(posts.id, postId))
      .get();

    if (!post) {
      logger.warn("queries/posts:incrementVoteCount:notFound", { postId });
      throw new Error("Post not found");
    }

    await db
      .update(posts)
      .set({ votes: post.votes + 1 })
      .where(eq(posts.id, postId));
  } catch (error) {
    logger.error("queries/posts:incrementVoteCount", {
      postId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function decrementVoteCount(postId: string) {
  const post = await db.select().from(posts).where(eq(posts.id, postId)).get();

  if (!post) {
    throw new Error("Post not found");
  }

  await db
    .update(posts)
    .set({ votes: post.votes - 1 })
    .where(eq(posts.id, postId));
}

export async function incrementReportCountPost(postId: string) {
  try {
    const post = await db
      .select()
      .from(posts)
      .where(eq(posts.id, postId))
      .get();

    if (!post) {
      logger.warn("queries/posts:incrementReportCountPost:notFound", {
        postId,
      });
      throw new Error("Post not found");
    }

    await db
      .update(posts)
      .set({ reportCount: post.reportCount ? post.reportCount + 1 : 1 })
      .where(eq(posts.id, postId));
    logger.info("queries/posts:incrementReportCountPost:success", { postId });
  } catch (error) {
    logger.error("queries/posts:incrementReportCountPost", {
      postId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function decrementReportCountPost(postId: string) {
  const post = await db.select().from(posts).where(eq(posts.id, postId)).get();

  if (!post) {
    throw new Error("Post not found");
  }

  await db
    .update(posts)
    .set({ reportCount: post.reportCount ? post.reportCount - 1 : 0 })
    .where(eq(posts.id, postId));
}

export async function unhidePost(postId: string) {
  try {
    logger.info("queries/posts:unhidePost", { postId });
    const result = await db
      .update(posts)
      .set({ hidden: false })
      .where(eq(posts.id, postId))
      .returning()
      .get();
    logger.info("queries/posts:unhidePost:success", { postId });
    return result;
  } catch (error) {
    logger.error("queries/posts:unhidePost", {
      postId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/** FEED OPERATIONS */
export async function getPostsInRange(
  days = 3,
  limit = 500,
  cursor?: string,
): Promise<
  (Post & {
    username: string;
    reportCount: number | null;
    flagged: boolean | null;
    hidden: boolean | null;
  })[]
> {
  // Fetch all posts within time window
  const since = subDays(new Date(), days).toISOString();

  const conditions = [
    gt(posts.createdAt, since),
    eq(posts.hidden, false),
    lte(posts.reportCount, 10),
  ];

  // Add cursor condition if provided (cursor is a timestamp)
  if (cursor) {
    conditions.push(lt(posts.createdAt, cursor));
  }

  const recentPosts = await db
    .select()
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .leftJoin(users, eq(posts.userId, users.id))
    .limit(limit);

  return recentPosts.map((post) => ({
    id: post.posts.id,
    title: post.posts.title,
    url: post.posts.url,
    text: post.posts.text,
    votes: post.posts.votes,
    commentCount: post.posts.commentCount,
    createdAt: post.posts.createdAt,
    updatedAt: post.posts.updatedAt,
    userId: post.posts.userId,
    reportCount: post.posts.reportCount ?? null,
    flagged: post.posts.flagged ?? null,
    hidden: post.posts.hidden ?? null,
    username: post.users?.username || "",
  }));
}

export async function updatePost(post: PostSubmition, postId: string) {
  try {
    logger.info("queries/posts:updatePost", { postId });
    const oldPost = await findPostById(postId);

    if (!oldPost) {
      logger.warn("queries/posts:updatePost:notFound", { postId });
      throw new Error("Post not found");
    }

    const result = await db
      .update(posts)
      .set({
        title: post.post.title?.trim() || oldPost.title,
        url:
          post.post.url && post.post.url.trim() !== ""
            ? post.post.url.trim()
            : null,
        text: post.post.text?.trim() || oldPost.text,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(posts.id, postId))
      .returning()
      .get();
    logger.info("queries/posts:updatePost:success", { postId });
    return result;
  } catch (error) {
    logger.error("queries/posts:updatePost", {
      postId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// Helper function to normalize Arabic alef variations
function normalizeArabicAlef(text: string): string {
  // Replace all alef variations (أ إ آ) with base alef (ا)
  return text.replace(/[أإآ]/g, "ا");
}

// Helper function to generate alef pattern variations for SQL LIKE
function generateAlefPatterns(prefix: string): string[] {
  const alefVariations = ["ا", "أ", "إ", "آ"];

  // Normalize the prefix first
  const normalized = normalizeArabicAlef(prefix);

  // Find all positions with alef
  const alefPositions: number[] = [];
  for (let i = 0; i < normalized.length; i++) {
    if (normalized[i] === "ا") {
      alefPositions.push(i);
    }
  }

  // If no alefs, return the original prefix
  if (alefPositions.length === 0) {
    return [prefix];
  }

  // Generate combinations (limit to reasonable number to avoid explosion)
  // For each alef position, we'll generate patterns with each variation
  const generateCombinations = (
    text: string,
    positions: number[],
    index: number,
  ): string[] => {
    if (index >= positions.length) {
      return [text];
    }

    const results: string[] = [];
    const pos = positions[index];

    for (const variation of alefVariations) {
      const newText =
        text.substring(0, pos) + variation + text.substring(pos + 1);
      results.push(...generateCombinations(newText, positions, index + 1));
    }

    return results;
  };

  // Limit to first 2 alef positions to avoid too many combinations
  const limitedPositions = alefPositions.slice(0, 2);
  const combinations = generateCombinations(normalized, limitedPositions, 0);

  // Remove duplicates
  return [...new Set(combinations)];
}

// Get posts by title prefix with Arabic alef normalization support
export async function findPostsByTitlePrefix(
  prefix: string,
  days: number,
  limit: number,
  cursor?: string,
): Promise<
  (Post & {
    username: string;
    reportCount: number | null;
    flagged: boolean | null;
    hidden: boolean | null;
  })[]
> {
  const since = subDays(new Date(), days).toISOString();

  // Generate pattern variations for alef characters
  const patterns = generateAlefPatterns(prefix);

  // Create LIKE conditions for each pattern variation
  const likeConditions = patterns.map((pattern) =>
    like(posts.title, `${pattern}%`),
  );

  const conditions = [
    gt(posts.createdAt, since),
    eq(posts.hidden, false),
    lte(posts.reportCount, 10),
    or(...likeConditions),
  ];

  // Add cursor condition if provided (cursor is a timestamp)
  if (cursor) {
    conditions.push(lt(posts.createdAt, cursor));
  }

  // Query with SQL LIKE using OR for all pattern variations
  const filteredPosts = await db
    .select()
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .leftJoin(users, eq(posts.userId, users.id))
    .limit(limit)
    .all();

  return filteredPosts.map((post) => ({
    id: post.posts.id,
    title: post.posts.title,
    url: post.posts.url,
    text: post.posts.text,
    votes: post.posts.votes,
    commentCount: post.posts.commentCount,
    createdAt: post.posts.createdAt,
    updatedAt: post.posts.updatedAt,
    userId: post.posts.userId,
    reportCount: post.posts.reportCount ?? null,
    flagged: post.posts.flagged ?? null,
    hidden: post.posts.hidden ?? null,
    username: post.users?.username || "",
  }));
}

// Get posts by username
export async function findPostsByUsername(
  username: string,
  limit: number,
  cursor?: string,
): Promise<
  (Post & {
    username: string;
    reportCount: number | null;
    flagged: boolean | null;
    hidden: boolean | null;
  })[]
> {
  const conditions = [
    eq(users.username, username),
    eq(posts.hidden, false),
    lte(posts.reportCount, 10),
  ];

  // Add cursor condition if provided (cursor is a timestamp)
  if (cursor) {
    conditions.push(lt(posts.createdAt, cursor));
  }

  const userPosts = await db
    .select()
    .from(posts)
    .leftJoin(users, eq(posts.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(limit)
    .all();

  return userPosts.map((post) => ({
    id: post.posts.id,
    title: post.posts.title,
    url: post.posts.url,
    text: post.posts.text,
    votes: post.posts.votes,
    commentCount: post.posts.commentCount,
    createdAt: post.posts.createdAt,
    updatedAt: post.posts.updatedAt,
    userId: post.posts.userId,
    reportCount: post.posts.reportCount ?? null,
    flagged: post.posts.flagged ?? null,
    hidden: post.posts.hidden ?? null,
    username: post.users?.username || "",
  }));
}

// Get available months with post counts
export async function getAvailableMonths(): Promise<
  { month: string; count: number }[]
> {
  // Get all posts ordered by creation date
  const allPosts = await db
    .select({
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(and(eq(posts.hidden, false), lte(posts.reportCount, 10)))
    .orderBy(desc(posts.createdAt))
    .all();

  // Group by month
  const monthMap = new Map<string, number>();

  for (const post of allPosts) {
    const date = new Date(post.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + 1);
  }

  // Convert to array and sort by month descending
  return Array.from(monthMap.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

// Get posts for a specific month
export async function getPostsByMonth(
  month: string,
  limit: number,
  cursor?: string,
): Promise<
  (Post & {
    username: string;
    reportCount: number | null;
    flagged: boolean | null;
    hidden: boolean | null;
  })[]
> {
  // Parse month (format: YYYY-MM)
  const [year, monthNum] = month.split("-");

  // Use UTC dates to avoid timezone issues
  const startDate = new Date(
    Date.UTC(parseInt(year, 10), parseInt(monthNum, 10) - 1, 1),
  );
  const endDate = new Date(
    Date.UTC(parseInt(year, 10), parseInt(monthNum, 10), 1),
  );

  const conditions = [
    gt(posts.createdAt, startDate.toISOString()),
    lt(posts.createdAt, endDate.toISOString()),
    eq(posts.hidden, false),
    lte(posts.reportCount, 10),
  ];

  // Add cursor condition if provided (cursor is a timestamp)
  if (cursor) {
    conditions.push(lt(posts.createdAt, cursor));
  }

  const monthPosts = await db
    .select()
    .from(posts)
    .leftJoin(users, eq(posts.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(limit)
    .all();

  return monthPosts.map((post) => ({
    id: post.posts.id,
    title: post.posts.title,
    url: post.posts.url,
    text: post.posts.text,
    votes: post.posts.votes,
    commentCount: post.posts.commentCount,
    createdAt: post.posts.createdAt,
    updatedAt: post.posts.updatedAt,
    userId: post.posts.userId,
    reportCount: post.posts.reportCount ?? null,
    flagged: post.posts.flagged ?? null,
    hidden: post.posts.hidden ?? null,
    username: post.users?.username || "",
  }));
}
