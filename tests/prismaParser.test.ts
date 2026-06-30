import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { PrismaParser } from "../src/schema-parser/prismaParser";

const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);

jest.mock(
  "@prisma/client",
  () => ({
    PrismaClient: jest.fn().mockImplementation(() => ({
      $connect: mockConnect,
      $disconnect: mockDisconnect,
    })),
  }),
  { virtual: true }
);

describe("PrismaParser", () => {
  const schemaPath = join(__dirname, "temp-schema.prisma");

  afterEach(() => {
    if (existsSync(schemaPath)) {
      unlinkSync(schemaPath);
    }
    jest.clearAllMocks();
  });

  it("parses models and enum values from Prisma schema", async () => {
    const schema = `
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String
  posts     Post[]
}

model Post {
  id        Int         @id @default(autoincrement())
  title     String
  authorId  Int
  author    User        @relation(fields: [authorId], references: [id])
  status    PostStatus  @default(DRAFT)
}

enum PostStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}
`;

    writeFileSync(schemaPath, schema);
    const parser = new PrismaParser(schemaPath, "postgresql://user:pass@localhost:5432/test");

    const models = await parser.parseSchema();

    expect(models).toHaveLength(2);
    const userModel = models.find((m) => m.name === "User");
    const postModel = models.find((m) => m.name === "Post");

    expect(userModel).toBeDefined();
    expect(postModel).toBeDefined();
    expect(userModel?.fields.map((f) => f.name)).toEqual(["id", "email", "name"]);
    expect(postModel?.fields.map((f) => f.name)).toEqual(["id", "title", "authorId", "status"]);
    expect(postModel?.fields.find((f) => f.name === "status")?.enumValues).toEqual(["DRAFT", "PUBLISHED", "ARCHIVED"]);
  });

  it("skips optional Prisma relation fields without explicit @relation", async () => {
    const schema = `
model User {
  id      Int      @id @default(autoincrement())
  email   String   @unique
  profile Profile?
}

model Profile {
  id     Int   @id @default(autoincrement())
  userId Int   @unique
  user   User  @relation(fields: [userId], references: [id])
}
`;

    writeFileSync(schemaPath, schema);
    const parser = new PrismaParser(schemaPath, "postgresql://user:pass@localhost:5432/test");
    const models = await parser.parseSchema();
    const userModel = models.find((m) => m.name === "User");

    expect(userModel).toBeDefined();
    expect(userModel?.fields.map((f) => f.name)).toEqual(["id", "email"]);
  });

  it("extracts foreign key relationModel and relationField for scalar FK fields", async () => {
    const schema = `
model User {
  id    Int    @id @default(autoincrement())
  email String @unique
  posts Post[]
}

model Post {
  id       Int    @id @default(autoincrement())
  title    String
  authorId Int
  author   User   @relation(fields: [authorId], references: [id], onDelete: Cascade)
}
`;

    writeFileSync(schemaPath, schema);
    const parser = new PrismaParser(schemaPath, "postgresql://user:pass@localhost:5432/test");
    const models = await parser.parseSchema();
    const postModel = models.find((m) => m.name === "Post");
    const authorIdField = postModel?.fields.find((f) => f.name === "authorId");

    expect(authorIdField).toBeDefined();
    expect(authorIdField?.isForeignKey).toBe(true);
    expect(authorIdField?.relationModel).toBe("User");
    expect(authorIdField?.relationField).toBe("id");
  });

  it("connects and disconnects with Prisma client", async () => {
    const schema = `model Test { id Int @id @default(autoincrement()) }`;
    writeFileSync(schemaPath, schema);

    const parser = new PrismaParser(schemaPath, "postgresql://user:pass@localhost:5432/test");
    await parser.connect();
    expect(mockConnect).toHaveBeenCalled();

    await parser.disconnect();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("normalizes scalar Prisma types to internal types", async () => {
    const schema = `
model Sample {
  id        Int      @id @default(autoincrement())
  name      String
  count     Int
  price     Float
  big       BigInt
  amount    Decimal
  active    Boolean
  createdAt DateTime @default(now())
  meta      Json
}
`;
    writeFileSync(schemaPath, schema);
    const parser = new PrismaParser(schemaPath, "postgresql://user:pass@localhost:5432/test");
    const models = await parser.parseSchema();
    const fields = models[0].fields;
    const typeOf = (n: string) => fields.find((f) => f.name === n)?.type;

    expect(typeOf("name")).toBe("string");
    expect(typeOf("count")).toBe("number");
    expect(typeOf("price")).toBe("number");
    expect(typeOf("big")).toBe("number");
    expect(typeOf("amount")).toBe("number");
    expect(typeOf("active")).toBe("boolean");
    expect(typeOf("createdAt")).toBe("datetime");
    expect(typeOf("meta")).toBe("string");
  });

  it("parses scalar default values and ignores generated defaults", async () => {
    const schema = `
model Settings {
  id        Int      @id @default(autoincrement())
  label     String   @default("hello")
  retries   Int      @default(3)
  ratio     Float    @default(1.5)
  enabled   Boolean  @default(true)
  disabled  Boolean  @default(false)
  uuidField String   @default(uuid())
  createdAt DateTime @default(now())
}
`;
    writeFileSync(schemaPath, schema);
    const parser = new PrismaParser(schemaPath, "postgresql://user:pass@localhost:5432/test");
    const fields = (await parser.parseSchema())[0].fields;
    const def = (n: string) => fields.find((f) => f.name === n)?.defaultValue;

    expect(def("label")).toBe("hello");
    expect(def("retries")).toBe(3);
    expect(def("ratio")).toBe(1.5);
    expect(def("enabled")).toBe(true);
    expect(def("disabled")).toBe(false);
    // generated defaults are deferred to the database, not seeded
    expect(def("uuidField")).toBeUndefined();
    expect(def("createdAt")).toBeUndefined();
  });

  it("marks @id as primary key and @unique as unique", async () => {
    const schema = `
model Account {
  id    Int    @id @default(autoincrement())
  email String @unique
  name  String
}
`;
    writeFileSync(schemaPath, schema);
    const parser = new PrismaParser(schemaPath, "postgresql://user:pass@localhost:5432/test");
    const fields = (await parser.parseSchema())[0].fields;

    expect(fields.find((f) => f.name === "id")?.isPrimaryKey).toBe(true);
    expect(fields.find((f) => f.name === "email")?.isUnique).toBe(true);
    expect(fields.find((f) => f.name === "name")?.isUnique).toBe(false);
  });

  it("skips @updatedAt fields", async () => {
    const schema = `
model Doc {
  id        Int      @id @default(autoincrement())
  title     String
  updatedAt DateTime @updatedAt
}
`;
    writeFileSync(schemaPath, schema);
    const parser = new PrismaParser(schemaPath, "postgresql://user:pass@localhost:5432/test");
    const fields = (await parser.parseSchema())[0].fields;
    expect(fields.map((f) => f.name)).not.toContain("updatedAt");
  });

  it("detects enum field types and their values", async () => {
    const schema = `
enum Role {
  ADMIN
  USER // a regular user
  GUEST
}

model Member {
  id   Int  @id @default(autoincrement())
  role Role @default(USER)
}
`;
    writeFileSync(schemaPath, schema);
    const parser = new PrismaParser(schemaPath, "postgresql://user:pass@localhost:5432/test");
    const roleField = (await parser.parseSchema())[0].fields.find((f) => f.name === "role");

    expect(roleField?.type).toBe("enum");
    expect(roleField?.enumValues).toEqual(["ADMIN", "USER", "GUEST"]);
  });

  it("extracts relations including array (many) relations", async () => {
    const schema = `
model User {
  id    Int    @id @default(autoincrement())
  posts Post[]
}

model Post {
  id       Int  @id @default(autoincrement())
  authorId Int
  author   User @relation(fields: [authorId], references: [id])
}
`;
    writeFileSync(schemaPath, schema);
    const parser = new PrismaParser(schemaPath, "postgresql://user:pass@localhost:5432/test");
    const models = await parser.parseSchema();
    const userRelations = models.find((m) => m.name === "User")?.relations;
    const postsRelation = userRelations?.find((r) => r.name === "posts");

    expect(postsRelation?.type).toBe("manyToMany");
    expect(postsRelation?.model).toBe("Post");
  });

  it("introspectDatabase returns the parsed models", async () => {
    const schema = `model Solo { id Int @id @default(autoincrement()) name String }`;
    writeFileSync(schemaPath, schema);
    const parser = new PrismaParser(schemaPath, "postgresql://user:pass@localhost:5432/test");
    const models = await parser.introspectDatabase();
    expect(models.map((m) => m.name)).toEqual(["Solo"]);
  });

  it("throws when the schema file cannot be read", async () => {
    const parser = new PrismaParser(
      join(__dirname, "does-not-exist.prisma"),
      "postgresql://user:pass@localhost:5432/test"
    );
    await expect(parser.parseSchema()).rejects.toThrow();
  });
});
