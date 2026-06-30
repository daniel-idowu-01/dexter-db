jest.mock(
  "@prisma/client",
  () => ({
    PrismaClient: jest.fn().mockImplementation(() => ({
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
    })),
  }),
  { virtual: true }
);

import { Seeder } from "../src/seeder";
import { SchemaField, SchemaModel } from "../src/types";
import mongoose from "mongoose";

const PG_URL = "postgresql://user:pass@localhost:5432/test";
const MONGO_URL = "mongodb://localhost:27017/test";

function newSeeder(url: string): any {
  return new Seeder({ dbUrl: url }) as any;
}

describe("Seeder", () => {
  describe("detectDbType", () => {
    it("detects mongodb and mongodb+srv", () => {
      expect(newSeeder("mongodb://localhost/test").dbType).toBe("mongodb");
      expect(newSeeder("mongodb+srv://host/test").dbType).toBe("mongodb");
    });

    it("detects postgres and postgresql", () => {
      expect(newSeeder("postgres://u@h/test").dbType).toBe("postgresql");
      expect(newSeeder(PG_URL).dbType).toBe("postgresql");
    });

    it("is case-insensitive about the scheme", () => {
      expect(newSeeder("MongoDB://localhost/test").dbType).toBe("mongodb");
    });

    it("throws on an unsupported scheme", () => {
      expect(() => newSeeder("mysql://localhost/test")).toThrow(/Unsupported DATABASE_URL/);
    });

    it("respects an explicit dbType option over the URL", () => {
      const seeder = new Seeder({ dbUrl: MONGO_URL, dbType: "postgresql" }) as any;
      expect(seeder.dbType).toBe("postgresql");
    });
  });

  describe("generateFieldValue", () => {
    let seeder: any;
    beforeEach(() => {
      seeder = newSeeder(MONGO_URL);
    });

    it("returns undefined for id / _id fields", async () => {
      expect(await seeder.generateFieldValue({ name: "id", type: "string" })).toBeUndefined();
      expect(await seeder.generateFieldValue({ name: "_id", type: "string" })).toBeUndefined();
    });

    it("returns undefined when the field config is ignored", async () => {
      const v = await seeder.generateFieldValue({ name: "x", type: "string" }, { ignore: true });
      expect(v).toBeUndefined();
    });

    it("returns a static schema default value", async () => {
      const v = await seeder.generateFieldValue({ name: "role", type: "string", defaultValue: "user" });
      expect(v).toBe("user");
    });

    it("returns undefined for function-valued schema defaults", async () => {
      const v = await seeder.generateFieldValue({
        name: "createdAt",
        type: "date",
        defaultValue: () => new Date(),
      });
      expect(v).toBeUndefined();
    });

    it("uses a config default value when the schema has none", async () => {
      const v = await seeder.generateFieldValue({ name: "tier", type: "string" }, { defaultValue: "gold" });
      expect(v).toBe("gold");
    });

    it("generates a string", async () => {
      const v = await seeder.generateFieldValue({ name: "email", type: "string" });
      expect(typeof v).toBe("string");
      expect(v).toContain("@");
    });

    it("generates a number", async () => {
      const v = await seeder.generateFieldValue({ name: "age", type: "number" });
      expect(typeof v).toBe("number");
    });

    it("generates a Date for date and datetime types", async () => {
      expect(await seeder.generateFieldValue({ name: "when", type: "date" })).toBeInstanceOf(Date);
      expect(await seeder.generateFieldValue({ name: "when", type: "datetime" })).toBeInstanceOf(Date);
    });

    it("generates a boolean", async () => {
      expect(typeof (await seeder.generateFieldValue({ name: "flag", type: "boolean" }))).toBe("boolean");
    });

    it("generates an enum value from the schema enumValues", async () => {
      const v = await seeder.generateFieldValue({ name: "status", type: "enum", enumValues: ["A", "B"] });
      expect(["A", "B"]).toContain(v);
    });

    it("generates an ObjectId", async () => {
      const v = await seeder.generateFieldValue({ name: "ref", type: "objectid" });
      expect(v).toBeInstanceOf(mongoose.Types.ObjectId);
    });

    it("generates an array within the configured bounds", async () => {
      const v = await seeder.generateFieldValue({ name: "tags", type: "array" }, { min: 2, max: 2 });
      expect(Array.isArray(v)).toBe(true);
      expect(v).toHaveLength(2);
    });

    it("samples array values from the config values list", async () => {
      const v = await seeder.generateFieldValue(
        { name: "tags", type: "array" },
        { min: 3, max: 3, values: ["x"] }
      );
      expect(v).toEqual(["x", "x", "x"]);
    });

    it("returns an empty object for json types", async () => {
      const v = await seeder.generateFieldValue({ name: "meta", type: "json" });
      expect(v).toEqual({});
    });

    it("falls back to a string for unknown types", async () => {
      const v = await seeder.generateFieldValue({ name: "weird", type: "totally-unknown" });
      expect(typeof v).toBe("string");
    });
  });

  describe("shouldSkipField", () => {
    let seeder: any;
    beforeEach(() => {
      seeder = newSeeder(MONGO_URL);
    });

    it("skips id and _id", () => {
      expect(seeder.shouldSkipField({ name: "id" }, {})).toBe(true);
      expect(seeder.shouldSkipField({ name: "_id" }, {})).toBe(true);
    });

    it("skips ignored fields", () => {
      expect(seeder.shouldSkipField({ name: "secret" }, { fields: { secret: { ignore: true } } })).toBe(true);
    });

    it("keeps normal fields", () => {
      expect(seeder.shouldSkipField({ name: "email" }, {})).toBe(false);
    });
  });

  describe("resolveReference", () => {
    let seeder: any;
    beforeEach(() => {
      seeder = newSeeder(PG_URL);
      seeder.usedUniqueRefs.clear();
    });

    it("returns null when the field has no relation model", async () => {
      expect(await seeder.resolveReference({ name: "x" }, "Model")).toBeNull();
    });

    it("picks an id from already-generated related data", async () => {
      seeder.generatedData.set("User", [{ id: 1 }, { id: 2 }, { id: 3 }]);
      const field: SchemaField = {
        name: "userId",
        type: "number",
        isRequired: true,
        relationModel: "User",
        relationField: "id",
      };
      const ref = await seeder.resolveReference(field, "Post");
      expect([1, 2, 3]).toContain(ref);
    });

    it("returns distinct ids for unique references until exhausted", async () => {
      seeder.generatedData.set("User", [{ id: 1 }, { id: 2 }]);
      const field: SchemaField = {
        name: "userId",
        type: "number",
        isRequired: true,
        relationModel: "User",
        relationField: "id",
        isUnique: true,
      };
      const first = await seeder.resolveReference(field, "Profile", true);
      const second = await seeder.resolveReference(field, "Profile", true);
      const third = await seeder.resolveReference(field, "Profile", true);

      expect(new Set([first, second])).toEqual(new Set([1, 2]));
      // all unique ids consumed -> no DB fallback configured -> null
      expect(third).toBeNull();
    });
  });

  describe("insertData", () => {
    it("strips undefined values and creates records (prisma path)", async () => {
      const seeder = newSeeder(PG_URL);
      const created: any[] = [];
      const delegate = {
        create: jest.fn(async ({ data }: any) => {
          const rec = { id: created.length + 1, ...data };
          created.push(rec);
          return rec;
        }),
      };

      const result = await seeder.insertData("User", delegate, [
        { name: "a", skip: undefined },
        { name: "b" },
      ]);

      expect(result.count).toBe(2);
      expect(delegate.create).toHaveBeenCalledTimes(2);
      expect(delegate.create.mock.calls[0][0].data).not.toHaveProperty("skip");
    });

    it("inserts many at once (mongodb path)", async () => {
      const seeder = newSeeder(MONGO_URL);
      const model = {
        insertMany: jest.fn(async (data: any[]) => data.map((d, i) => ({ _id: i, ...d }))),
      };

      const result = await seeder.insertData("User", model, [{ name: "a" }, { name: "b" }]);
      expect(result.count).toBe(2);
      expect(model.insertMany).toHaveBeenCalledTimes(1);
    });
  });

  describe("getPrismaDelegate", () => {
    it("resolves a delegate by case-insensitive name", () => {
      const seeder = newSeeder(PG_URL);
      seeder.prismaClient = { user: { findMany: jest.fn() }, blogPost: { findMany: jest.fn() } };
      expect(seeder.getPrismaDelegate("User")).toBe(seeder.prismaClient.user);
      expect(seeder.getPrismaDelegate("blogPost")).toBe(seeder.prismaClient.blogPost);
    });

    it("throws when the prisma client is not initialized", () => {
      const seeder = newSeeder(PG_URL);
      seeder.prismaClient = undefined;
      expect(() => seeder.getPrismaDelegate("User")).toThrow(/not initialized/);
    });

    it("throws when no matching delegate exists", () => {
      const seeder = newSeeder(PG_URL);
      seeder.prismaClient = { user: {} };
      expect(() => seeder.getPrismaDelegate("Comment")).toThrow(/not found/);
    });
  });

  describe("getSortField", () => {
    let seeder: any;
    beforeEach(() => {
      seeder = newSeeder(PG_URL);
    });

    it("prefers a createdAt field", () => {
      seeder.models = [{ name: "U", fields: [{ name: "id", isPrimaryKey: true }, { name: "createdAt" }] }];
      expect(seeder.getSortField("U")).toBe("createdAt");
    });

    it("falls back to the primary key when there is no createdAt", () => {
      seeder.models = [{ name: "U", fields: [{ name: "id", isPrimaryKey: true }, { name: "email" }] }];
      expect(seeder.getSortField("U")).toBe("id");
    });

    it("falls back to the first field when there is no primary key", () => {
      seeder.models = [{ name: "U", fields: [{ name: "slug" }, { name: "email" }] }];
      expect(seeder.getSortField("U")).toBe("slug");
    });

    it("returns 'id' when the model is unknown", () => {
      seeder.models = [];
      expect(seeder.getSortField("Missing")).toBe("id");
    });
  });

  describe("sortModelsByDependencies", () => {
    it("orders dependencies before dependents", () => {
      const seeder = newSeeder(PG_URL);
      seeder.models = [
        {
          name: "Comment",
          fields: [{ name: "postId", isForeignKey: true, relationModel: "Post" }],
          relations: [],
        },
        {
          name: "Post",
          fields: [{ name: "authorId", isForeignKey: true, relationModel: "User" }],
          relations: [],
        },
        { name: "User", fields: [{ name: "id", isPrimaryKey: true }], relations: [] },
      ];

      const order = seeder.sortModelsByDependencies().map((m: SchemaModel) => m.name);
      expect(order.indexOf("User")).toBeLessThan(order.indexOf("Post"));
      expect(order.indexOf("Post")).toBeLessThan(order.indexOf("Comment"));
    });

    it("does not loop on circular dependencies", () => {
      const seeder = newSeeder(PG_URL);
      seeder.models = [
        { name: "A", fields: [{ name: "bId", isForeignKey: true, relationModel: "B" }], relations: [] },
        { name: "B", fields: [{ name: "aId", isForeignKey: true, relationModel: "A" }], relations: [] },
      ];
      const order = seeder.sortModelsByDependencies().map((m: SchemaModel) => m.name);
      expect(order.sort()).toEqual(["A", "B"]);
    });
  });

  describe("seed", () => {
    it("clamps the count, generates data, and inserts (prisma path)", async () => {
      const seeder = newSeeder(PG_URL);
      const created: any[] = [];
      const delegate = {
        create: jest.fn(async ({ data }: any) => {
          const rec = { id: created.length + 1, ...data };
          created.push(rec);
          return rec;
        }),
        deleteMany: jest.fn(async () => ({ count: 0 })),
      };
      seeder.prismaClient = { user: delegate };
      seeder.models = [
        {
          name: "User",
          fields: [
            { name: "id", type: "number", isPrimaryKey: true },
            { name: "email", type: "string", isUnique: true },
            { name: "name", type: "string" },
          ],
          relations: [],
        },
      ];

      const result = await seeder.seed("User", 3);
      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
      expect(delegate.create).toHaveBeenCalledTimes(3);
      expect(seeder.generatedData.get("User")).toHaveLength(3);
    });

    it("resets the table first when reset is requested", async () => {
      const seeder = newSeeder(PG_URL);
      const delegate = {
        create: jest.fn(async ({ data }: any) => ({ id: 1, ...data })),
        deleteMany: jest.fn(async () => ({ count: 5 })),
      };
      seeder.prismaClient = { user: delegate };
      seeder.models = [
        { name: "User", fields: [{ name: "id", isPrimaryKey: true }, { name: "name", type: "string" }], relations: [] },
      ];

      await seeder.seed("User", 1, { reset: true });
      expect(delegate.deleteMany).toHaveBeenCalledWith({});
    });

    it("returns a failure result for an unknown model", async () => {
      const seeder = newSeeder(PG_URL);
      seeder.prismaClient = {};
      seeder.models = [];

      const result = await seeder.seed("Ghost", 1);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found in schema/);
    });

    it("resolves foreign keys from previously seeded data", async () => {
      const seeder = newSeeder(PG_URL);
      const posts: any[] = [];
      const userDelegate = { create: jest.fn() };
      const postDelegate = {
        create: jest.fn(async ({ data }: any) => {
          const rec = { id: posts.length + 1, ...data };
          posts.push(rec);
          return rec;
        }),
      };
      seeder.prismaClient = { user: userDelegate, post: postDelegate };
      seeder.models = [
        { name: "User", fields: [{ name: "id", isPrimaryKey: true }], relations: [] },
        {
          name: "Post",
          fields: [
            { name: "id", type: "number", isPrimaryKey: true },
            { name: "title", type: "string" },
            { name: "authorId", type: "number", isForeignKey: true, relationModel: "User", relationField: "id" },
          ],
          relations: [],
        },
      ];
      seeder.generatedData.set("User", [{ id: 10 }, { id: 20 }]);

      const result = await seeder.seed("Post", 2);
      expect(result.success).toBe(true);
      const authorIds = postDelegate.create.mock.calls.map((c) => c[0].data.authorId);
      authorIds.forEach((id) => expect([10, 20]).toContain(id));
    });
  });

  describe("seedAll", () => {
    it("seeds every model in dependency order", async () => {
      const seeder = newSeeder(PG_URL);
      const seededOrder: string[] = [];
      jest.spyOn(seeder, "seed").mockImplementation(async (...args: any[]) => {
        const name = args[0] as string;
        seededOrder.push(name);
        return { model: name, count: 1, success: true };
      });

      seeder.models = [
        { name: "Post", fields: [{ name: "uId", isForeignKey: true, relationModel: "User" }], relations: [] },
        { name: "User", fields: [{ name: "id", isPrimaryKey: true }], relations: [] },
      ];

      const results = await seeder.seedAll();
      expect(results).toHaveLength(2);
      expect(seededOrder).toEqual(["User", "Post"]);
    });
  });

  describe("getModels / getPrimaryKeyField", () => {
    it("exposes the parsed models", () => {
      const seeder = newSeeder(PG_URL);
      seeder.models = [{ name: "User", fields: [], relations: [] }];
      expect(seeder.getModels()).toHaveLength(1);
    });

    it("finds the primary key field", () => {
      const seeder = newSeeder(PG_URL);
      seeder.models = [
        { name: "User", fields: [{ name: "uuid", isPrimaryKey: true }, { name: "email" }] },
      ];
      expect(seeder.getPrimaryKeyField("User")).toBe("uuid");
    });

    it("returns undefined when there is no primary key", () => {
      const seeder = newSeeder(PG_URL);
      seeder.models = [{ name: "User", fields: [{ name: "email" }] }];
      expect(seeder.getPrimaryKeyField("User")).toBeUndefined();
    });
  });
});
