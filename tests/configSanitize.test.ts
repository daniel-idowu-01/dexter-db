import { sanitizeConfigInput } from "../src/utils/configSanitize";

describe("sanitizeConfigInput", () => {
  it("returns primitives unchanged", () => {
    expect(sanitizeConfigInput("hello")).toBe("hello");
    expect(sanitizeConfigInput(42)).toBe(42);
    expect(sanitizeConfigInput(true)).toBe(true);
    expect(sanitizeConfigInput(null)).toBeNull();
    expect(sanitizeConfigInput(undefined)).toBeUndefined();
  });

  it("strips __proto__ keys from objects", () => {
    const malicious = JSON.parse('{"__proto__": {"polluted": true}, "safe": 1}');
    const result = sanitizeConfigInput<Record<string, unknown>>(malicious);

    expect(result).toEqual({ safe: 1 });
    expect(({} as any).polluted).toBeUndefined();
  });

  it("strips constructor and prototype keys", () => {
    const input = {
      constructor: { bad: true },
      prototype: { bad: true },
      keep: "value",
    } as Record<string, unknown>;

    const result = sanitizeConfigInput(input);
    expect(result).toEqual({ keep: "value" });
  });

  it("recursively sanitizes nested objects", () => {
    const input = {
      models: {
        User: JSON.parse('{"count": 5, "__proto__": {"x": 1}}'),
      },
    };

    const result = sanitizeConfigInput<any>(input);
    expect(result.models.User).toEqual({ count: 5 });
  });

  it("sanitizes objects inside arrays", () => {
    const input = {
      list: [JSON.parse('{"__proto__": {"x": 1}, "ok": true}')],
    };

    const result = sanitizeConfigInput<any>(input);
    expect(result.list[0]).toEqual({ ok: true });
  });

  it("preserves Date instances", () => {
    const date = new Date("2024-01-01T00:00:00.000Z");
    const result = sanitizeConfigInput({ when: date });
    expect(result.when).toBeInstanceOf(Date);
    expect((result.when as Date).getTime()).toBe(date.getTime());
  });

  it("preserves normal nested structure and key order", () => {
    const input = {
      global: { reset: true },
      models: { Post: { count: 10, fields: { title: { type: "string" } } } },
    };
    const result = sanitizeConfigInput(input);
    expect(result).toEqual(input);
  });
});
