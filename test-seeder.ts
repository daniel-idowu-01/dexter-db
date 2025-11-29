import { Seeder } from "./src/seeder";
import { config } from "dotenv";

config();

async function testSeeder() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL not found in environment variables");
    console.log("Please create a .env file with DATABASE_URL");
    process.exit(1);
  }

  const seeder = new Seeder({
    dbUrl: process.env.DATABASE_URL,
    verbose: true,
  });

  try {
    console.log("🚀 Initializing seeder...");
    await seeder.initialize();

    console.log("\n📊 Available models:");
    const models = seeder.getModels();
    models.forEach((model) => {
      console.log(`  - ${model.name} (${model.fields.length} fields)`);
    });

    console.log("\n🌱 Seeding User model (5 records)...");
    const userResult = await seeder.seed("User", 5);
    if (userResult.success) {
      console.log(`✅ Successfully seeded ${userResult.count} users`);
    } else {
      console.error(`❌ Failed: ${userResult.error}`);
    }

    console.log("\n🌱 Seeding Post model (10 records)...");
    const postResult = await seeder.seed("Post", 10);
    if (postResult.success) {
      console.log(`✅ Successfully seeded ${postResult.count} posts`);
    } else {
      console.error(`❌ Failed: ${postResult.error}`);
    }

    console.log("\n✅ Seeding test completed!");
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await seeder.disconnect();
    console.log("\n🔌 Disconnected from database");
  }
}

testSeeder();

