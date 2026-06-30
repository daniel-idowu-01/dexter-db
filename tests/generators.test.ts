import {
  StringGenerator,
  NumberGenerator,
  DateGenerator,
  BooleanGenerator,
  EnumGenerator,
  ObjectIdGenerator,
} from "../src/generators";
import { FieldConfig } from "../src/types";

describe("Generators", () => {
  describe("StringGenerator", () => {
    const generator = new StringGenerator();

    it("should generate email for email fields", () => {
      const value = generator.generate("email");
      expect(value).toContain("@");
      expect(typeof value).toBe("string");
    });

    it("should generate first name for firstName fields", () => {
      expect(typeof generator.generate("firstName")).toBe("string");
      expect(generator.generate("firstName").length).toBeGreaterThan(0);
    });

    it("should generate last name for lastName fields", () => {
      expect(typeof generator.generate("lastName")).toBe("string");
    });

    it("should generate full name for fullName fields", () => {
      const value = generator.generate("fullName");
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    });

    it("should generate a name for generic username fields", () => {
      expect(typeof generator.generate("username")).toBe("string");
    });

    it("should generate a phone number for phone fields", () => {
      expect(typeof generator.generate("phoneNumber")).toBe("string");
    });

    it("should generate an address for address/street fields", () => {
      expect(typeof generator.generate("address")).toBe("string");
      expect(typeof generator.generate("streetName")).toBe("string");
    });

    it("should generate a city for city fields", () => {
      expect(typeof generator.generate("city")).toBe("string");
    });

    it("should generate a country for country fields", () => {
      expect(typeof generator.generate("country")).toBe("string");
    });

    it("should generate a zip code for zip/postal fields", () => {
      expect(typeof generator.generate("zipCode")).toBe("string");
      expect(typeof generator.generate("postalCode")).toBe("string");
    });

    it("should generate a url for url/website fields", () => {
      expect(generator.generate("websiteUrl")).toMatch(/^https?:\/\//);
    });

    it("should generate a paragraph for description/bio fields", () => {
      expect(generator.generate("description").length).toBeGreaterThan(0);
      expect(generator.generate("bio").length).toBeGreaterThan(0);
    });

    it("should generate a sentence for title fields", () => {
      expect(typeof generator.generate("title")).toBe("string");
    });

    it("should generate a password for password/hash fields", () => {
      expect(generator.generate("password").length).toBeGreaterThan(0);
      expect(generator.generate("passwordHash").length).toBeGreaterThan(0);
    });

    it("should generate a uuid for uuid/id fields", () => {
      const value = generator.generate("uuid");
      expect(value).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it("should use a custom faker generator path from config", () => {
      const value = generator.generate("token", { generator: "internet.url" });
      expect(value).toMatch(/^https?:\/\//);
    });

    it("should resolve two-level faker generator paths that need `this` context", () => {
      // person.firstName / internet.email are namespaced methods that rely on
      // their parent module as `this`.
      expect(typeof generator.generate("token", { generator: "person.firstName" })).toBe("string");
      expect(generator.generate("token", { generator: "internet.email" })).toContain("@");
    });

    it("should fall back when the custom generator path is not a function", () => {
      const value = generator.generate("token", { generator: "internet" });
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    });

    it("should reject unsafe (prototype pollution) generator paths", () => {
      const value = generator.generate("token", { generator: "constructor.constructor" });
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    });

    it("should reject generator paths with invalid characters", () => {
      const value = generator.generate("token", { generator: "internet.email()" });
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    });

    it("should generate from a regex pattern when provided", () => {
      const value = generator.generate("code", { pattern: "[A-Z]{3}" });
      expect(value).toMatch(/^[A-Z]{3}$/);
    });

    it("should fall back for an invalid regex pattern", () => {
      const value = generator.generate("code", { pattern: "[" });
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    });

    it("should fall back when the pattern exceeds the maximum length", () => {
      const longPattern = "a".repeat(241);
      const value = generator.generate("code", { pattern: longPattern });
      expect(typeof value).toBe("string");
      expect(value).not.toBe(longPattern);
    });

    it("should fall back to lorem words for unknown field names", () => {
      const value = generator.generate("randomThing");
      expect(typeof value).toBe("string");
      expect(value.split(" ").length).toBe(3);
    });
  });

  describe("NumberGenerator", () => {
    const generator = new NumberGenerator();

    it("should generate integer within range", () => {
      const value = generator.generate("count", { min: 1, max: 100 });
      expect(typeof value).toBe("number");
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(100);
    });

    it("should use default range when no config supplied", () => {
      const value = generator.generate("count");
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1000);
    });

    it("should generate age for age fields", () => {
      const value = generator.generate("age");
      expect(value).toBeGreaterThanOrEqual(18);
      expect(value).toBeLessThanOrEqual(100);
    });

    it("should generate price/cost/amount within bounds", () => {
      for (const name of ["price", "cost", "amount"]) {
        const value = generator.generate(name);
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThanOrEqual(10000);
      }
    });

    it("should generate rating/score between 0 and 5", () => {
      for (const name of ["rating", "score"]) {
        const value = generator.generate(name);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(5);
      }
    });

    it("should generate percentage between 0 and 100", () => {
      const value = generator.generate("percentage");
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    });
  });

  describe("DateGenerator", () => {
    const generator = new DateGenerator();

    it("should generate a date object by default", () => {
      expect(generator.generate("someDate")).toBeInstanceOf(Date);
    });

    it("should generate a birthdate for birth/dob fields", () => {
      const value = generator.generate("birthDate");
      expect(value).toBeInstanceOf(Date);
      expect(value.getTime()).toBeLessThan(Date.now());
      expect(generator.generate("dob")).toBeInstanceOf(Date);
    });

    it("should generate a recent date for created/updated fields", () => {
      const value = generator.generate("createdAt");
      expect(value).toBeInstanceOf(Date);
      expect(value.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it("should generate a future date for future fields", () => {
      const value = generator.generate("futureEvent");
      expect(value).toBeInstanceOf(Date);
      expect(value.getTime()).toBeGreaterThan(Date.now());
    });

    it("should generate a past date for past fields", () => {
      const value = generator.generate("pastEvent");
      expect(value).toBeInstanceOf(Date);
      expect(value.getTime()).toBeLessThan(Date.now());
    });
  });

  describe("BooleanGenerator", () => {
    const generator = new BooleanGenerator();

    it("should generate boolean value", () => {
      expect(typeof generator.generate("isActive")).toBe("boolean");
    });

    it("should generate boolean for has/active prefixed fields", () => {
      expect(typeof generator.generate("hasAccess")).toBe("boolean");
      expect(typeof generator.generate("active")).toBe("boolean");
      expect(typeof generator.generate("anything")).toBe("boolean");
    });
  });

  describe("EnumGenerator", () => {
    const generator = new EnumGenerator();

    it("should pick from enum values", () => {
      const value = generator.generate("color", { values: ["red", "green", "blue"] });
      expect(["red", "green", "blue"]).toContain(value);
    });

    it("should return null if no values provided", () => {
      expect(generator.generate("status")).toBeNull();
    });

    it("should return null for an empty values array", () => {
      expect(generator.generate("status", { values: [] })).toBeNull();
    });
  });

  describe("ObjectIdGenerator", () => {
    const generator = new ObjectIdGenerator();

    it("should generate a 24-character hex string", () => {
      const value = generator.generate("ref");
      expect(value).toMatch(/^[0-9a-f]{24}$/);
    });

    it("should generate unique values across calls", () => {
      const a = generator.generate("ref");
      const b = generator.generate("ref");
      expect(a).not.toBe(b);
    });
  });
});
