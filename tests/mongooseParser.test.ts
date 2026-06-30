import mongoose, { Schema } from "mongoose";
import { MongooseParser } from "../src/schema-parser/mongooseParser";
import { join } from "path";

describe("MongooseParser", () => {
  describe("constructor", () => {
    it("accepts a path inside the project root", () => {
      expect(() => new MongooseParser(join("src", "models"))).not.toThrow();
    });

    it("rejects a models path outside the project root", () => {
      expect(() => new MongooseParser(join("..", "..", "etc"))).toThrow(/Invalid models path/);
    });

    it("exposes an empty model map and the mongoose connection before loading", () => {
      const parser = new MongooseParser(join("src", "models"));
      expect(parser.getModels().size).toBe(0);
      expect(parser.getConnection()).toBe(mongoose);
    });
  });

  describe("parseMongooseModel", () => {
    let parser: any;

    beforeAll(() => {
      parser = new MongooseParser(join("src", "models"));
    });

    function build(name: string, definition: Record<string, any>, options: any = {}) {
      // Avoid OverwriteModelError between tests.
      if (mongoose.models[name]) {
        mongoose.deleteModel(name);
      }
      const schema = new Schema(definition, options);
      return mongoose.model(name, schema);
    }

    it("maps an _id path to an id primary-key field", () => {
      const model = build("PM_Basic", { title: { type: String } });
      const parsed = parser.parseMongooseModel("PM_Basic", model);

      const idField = parsed.fields.find((f: any) => f.name === "id");
      expect(idField).toMatchObject({
        name: "id",
        type: "objectid",
        isPrimaryKey: true,
        isUnique: true,
      });
    });

    it("maps scalar types and required/unique flags", () => {
      const model = build("PM_Scalars", {
        email: { type: String, required: true, unique: true },
        age: { type: Number },
        active: { type: Boolean, default: true },
        bornAt: { type: Date },
      });
      const parsed = parser.parseMongooseModel("PM_Scalars", model);
      const f = (n: string) => parsed.fields.find((x: any) => x.name === n);

      expect(f("email")).toMatchObject({ type: "string", isRequired: true, isUnique: true });
      expect(f("age").type).toBe("number");
      expect(f("active")).toMatchObject({ type: "boolean", defaultValue: true });
      expect(f("bornAt").type).toBe("datetime");
    });

    it("maps a String enum to an enum field with values", () => {
      const model = build("PM_Enum", {
        role: { type: String, enum: ["ADMIN", "USER"] },
      });
      const parsed = parser.parseMongooseModel("PM_Enum", model);
      const role = parsed.fields.find((f: any) => f.name === "role");

      expect(role.type).toBe("enum");
      expect(role.enumValues).toEqual(["ADMIN", "USER"]);
    });

    it("treats a referenced ObjectId as a one-to-one foreign-key relation", () => {
      const model = build("PM_Ref", {
        author: { type: Schema.Types.ObjectId, ref: "User" },
      });
      const parsed = parser.parseMongooseModel("PM_Ref", model);
      const author = parsed.fields.find((f: any) => f.name === "author");

      expect(author).toMatchObject({
        type: "objectid",
        isForeignKey: true,
        relationModel: "User",
      });
      expect(parsed.relations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "author", type: "oneToOne", model: "User" }),
        ])
      );
    });

    it("treats an array of referenced ObjectIds as a many-to-many relation", () => {
      const model = build("PM_Refs", {
        tags: [{ type: Schema.Types.ObjectId, ref: "Tag" }],
      });
      const parsed = parser.parseMongooseModel("PM_Refs", model);

      expect(parsed.relations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "tags", type: "manyToMany", model: "Tag" }),
        ])
      );
    });

    it("maps plain arrays and mixed/embedded paths", () => {
      const model = build("PM_Containers", {
        labels: { type: [String] },
        meta: { type: Schema.Types.Mixed },
      });
      const parsed = parser.parseMongooseModel("PM_Containers", model);

      expect(parsed.fields.find((f: any) => f.name === "labels").type).toBe("array");
      expect(parsed.fields.find((f: any) => f.name === "meta").type).toBe("json");
    });
  });
});
