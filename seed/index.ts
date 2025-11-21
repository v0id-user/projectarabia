import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { seedUsers } from "./users";
import { seedPosts } from "./posts";
import { seedComments } from "./comments";
import * as schema from "../src/schemas/db/schema";
import { sql } from "drizzle-orm";

async function seedDatabase() {
  console.log("🚀 Starting database seeding...\n");

  // Connect to the local SQLite database
  const dbPath = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/e7b3435c5682e58442b380529a7382fade69fb3034c763824544122e980c535b.sqlite";

  try {
    const sqlite = new Database(dbPath);
    const db = drizzle(sqlite, { schema });

    console.log("✅ Connected to database\n");

    // Optional: Reset database (clear existing data)
    const shouldReset = process.argv.includes("--reset");

    if (shouldReset) {
      console.log("🗑️  Resetting database...");

      // Disable foreign keys temporarily
      sqlite.exec("PRAGMA foreign_keys = OFF");

      // Delete all data from tables in reverse order of dependencies
      await db.delete(schema.comments).execute();
      await db.delete(schema.votes).execute();
      await db.delete(schema.posts).execute();
      await db.delete(schema.reports).execute();
      await db.delete(schema.verifications).execute();
      await db.delete(schema.userBadges).execute();
      await db.delete(schema.users).execute();

      // Re-enable foreign keys
      sqlite.exec("PRAGMA foreign_keys = ON");

      console.log("✅ Database reset complete\n");
    }

    // Seed users first
    const users = await seedUsers(db);
    const userIds = users.map((u) => u.id);

    console.log("");

    // Seed posts second (depends on users)
    const posts = await seedPosts(db, userIds);
    const postIds = posts.map((p) => p.id);

    console.log("");

    // Seed comments last (depends on posts and users)
    await seedComments(db, postIds, userIds);

    console.log("\n✨ Database seeding completed successfully!");
    console.log(`\n📊 Summary:`);
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Posts: ${posts.length}`);
    console.log(`   - Comments: 500 (350 top-level, 150 nested)`);

    // Close the database connection
    sqlite.close();

  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

// Run the seed function
seedDatabase();

