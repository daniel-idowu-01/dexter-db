# Testing with a Real Database

This guide will help you test the Dexter DB seeder with a real PostgreSQL database.

## Option 1: Local PostgreSQL Database

### Step 1: Install PostgreSQL

**Windows:**
- Download from [postgresql.org](https://www.postgresql.org/download/windows/)
- Or use Chocolatey: `choco install postgresql`

**macOS:**
```bash
brew install postgresql
brew services start postgresql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Step 2: Create a Test Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE dexter_test;

# Create a user (optional)
CREATE USER dexter_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE dexter_test TO dexter_user;

# Exit
\q
```

### Step 3: Setup Prisma Schema

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  firstName String
  lastName  String
  age       Int?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  posts     Post[]
  profile   Profile?
}

model Profile {
  id        Int      @id @default(autoincrement())
  bio       String?
  avatar    String?
  userId    Int      @unique
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Step 4: Configure Environment

Create `.env` file:

```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/dexter_test?schema=public"
```

Or with a custom user:
```env
DATABASE_URL="postgresql://dexter_user:your_password@localhost:5432/dexter_test?schema=public"
```

### Step 5: Initialize Database

```bash
# Generate Prisma client
npm run prisma:generate

# Create database tables (run migrations)
npx prisma migrate dev --name init

# Or push schema directly (for testing)
npx prisma db push
```

### Step 6: Test the Seeder

```bash
# Build the project
npm run build

# Seed a single model
npm start seed --model User --count 10

# Seed all models
npm start seed

# List available models
npm start list
```

## Option 2: Docker PostgreSQL (Recommended for Testing)

### Step 1: Create Docker Compose File

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: dexter-postgres
    environment:
      POSTGRES_USER: dexter
      POSTGRES_PASSWORD: dexter123
      POSTGRES_DB: dexter_test
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Step 2: Start Database

```bash
docker-compose up -d
```

### Step 3: Use the Same Setup Steps

Follow steps 3-6 from Option 1, using this DATABASE_URL:

```env
DATABASE_URL="postgresql://dexter:dexter123@localhost:5432/dexter_test?schema=public"
```

## Option 3: Cloud Database (Supabase/Neon/Railway)

### Using Supabase (Free Tier)

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Get your connection string from Settings → Database
4. Use it in your `.env`:

```env
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
```

### Using Neon (Free Tier)

1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string
4. Use it in your `.env`

## Testing Script

Create a test script to verify everything works:

```typescript
// test-seeder.ts
import { Seeder } from "./src/seeder";
import { config } from "dotenv";

config();

async function testSeeder() {
  const seeder = new Seeder({
    dbUrl: process.env.DATABASE_URL!,
  });

  try {
    console.log("Initializing seeder...");
    await seeder.initialize();

    console.log("Seeding User model...");
    const userResult = await seeder.seed("User", 5);
    console.log("User result:", userResult);

    console.log("Seeding Post model...");
    const postResult = await seeder.seed("Post", 10);
    console.log("Post result:", postResult);

    console.log("✅ Seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await seeder.disconnect();
  }
}

testSeeder();
```

Run it:
```bash
npx ts-node test-seeder.ts
```

## Verify Data

### Using Prisma Studio

```bash
npm run prisma:studio
```

This opens a browser interface to view your seeded data.

### Using psql

```bash
psql -U postgres -d dexter_test

# View users
SELECT * FROM "User";

# View posts
SELECT * FROM "Post";

# Count records
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "Post";
```

## Clean Up

### Reset Database

```bash
# Drop all data
npx prisma migrate reset

# Or manually
psql -U postgres -d dexter_test -c "TRUNCATE TABLE \"User\", \"Post\", \"Profile\" CASCADE;"
```

### Stop Docker (if using)

```bash
docker-compose down
docker-compose down -v  # Remove volumes too
```

## Troubleshooting

### "Connection refused"
- Check if PostgreSQL is running
- Verify DATABASE_URL is correct
- Check firewall settings

### "Database does not exist"
- Create the database first
- Check database name in DATABASE_URL

### "Prisma client not found"
```bash
npm run prisma:generate
```

### "Table does not exist"
```bash
npx prisma db push
# or
npx prisma migrate dev
```

## Next Steps

1. Create a custom config file (`seeder.config.json`) to customize field generation
2. Test with different model counts
3. Test relational dependencies
4. Test with enums and custom types

