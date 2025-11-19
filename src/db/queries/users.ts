import { eq } from "drizzle-orm";
import { db } from "@/schemas/db";
import { users } from "@/schemas/db/schema";
import type { UserProfileSubmission } from "@/schemas/forms/user-profile";
import { logger } from "@/lib/logger";

// User queries
export async function findUserById(id: string) {
  return await db.select().from(users).where(eq(users.id, id)).get();
}

export async function findUserByUsername(username: string) {
  return await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .get();
}

export async function findUserByEmail(email: string) {
  return await db.select().from(users).where(eq(users.email, email)).get();
}

export async function createUser(data: {
  username: string;
  email: string | null;
  password: string;
}) {
  try {
    logger.info("queries/users:createUser", {
      username: data.username,
      hasEmail: !!data.email,
    });
    const result = await db
      .insert(users)
      .values({
        username: data.username,
        email: data.email,
        password: data.password,
      })
      .returning()
      .get();
    logger.info("queries/users:createUser:success", {
      userId: result.id,
      username: data.username,
    });
    return result;
  } catch (error) {
    logger.error("queries/users:createUser", {
      username: data.username,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function updateUserProfile(
  id: string,
  data: UserProfileSubmission,
) {
  try {
    logger.info("queries/users:updateUserProfile", { userId: id });
    const result = await db
      .update(users)
      .set({
        email: data.email,
        about: data.about,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, id))
      .returning()
      .get();
    logger.info("queries/users:updateUserProfile:success", { userId: id });
    return result;
  } catch (error) {
    logger.error("queries/users:updateUserProfile", {
      userId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function updateUserPassword(id: string, password: string) {
  try {
    logger.info("queries/users:updateUserPassword", { userId: id });
    const result = await db
      .update(users)
      .set({
        password,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, id))
      .returning()
      .get();
    logger.info("queries/users:updateUserPassword:success", { userId: id });
    return result;
  } catch (error) {
    logger.error("queries/users:updateUserPassword", {
      userId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
