import { resolvePathWithinRoot, joinSafe } from "../src/utils/pathSecurity";
import { join, resolve } from "path";

describe("resolvePathWithinRoot", () => {
  const cwd = process.cwd();

  it("allows paths inside the project directory", () => {
    expect(() => resolvePathWithinRoot(join("src", "models"))).not.toThrow();
    expect(() => resolvePathWithinRoot(join(cwd, "src", "models"))).not.toThrow();
  });

  it("returns an absolute resolved path", () => {
    const result = resolvePathWithinRoot("src");
    expect(result).toBe(resolve(cwd, "src"));
  });

  it("allows the root itself", () => {
    expect(() => resolvePathWithinRoot(cwd)).not.toThrow();
    expect(resolvePathWithinRoot(".")).toBe(resolve(cwd));
  });

  it("rejects traversal outside the project root", () => {
    expect(() => resolvePathWithinRoot(join(cwd, "..", "..", "etc", "passwd"))).toThrow(
      /outside project directory/
    );
  });

  it("rejects relative traversal that escapes the root", () => {
    expect(() => resolvePathWithinRoot(join("..", "secrets"))).toThrow(/outside project directory/);
  });

  it("honors a custom root argument", () => {
    const root = resolve(cwd, "src");
    expect(() => resolvePathWithinRoot("models", root)).not.toThrow();
    expect(() => resolvePathWithinRoot(join("..", "package.json"), root)).toThrow(
      /outside project directory/
    );
  });

  it("does not treat a sibling directory with a shared prefix as inside", () => {
    const root = resolve(cwd, "src");
    // e.g. <cwd>/src-other should not be considered within <cwd>/src
    expect(() => resolvePathWithinRoot(resolve(cwd, "src-other"), root)).toThrow(
      /outside project directory/
    );
  });
});

describe("joinSafe", () => {
  const base = resolve(process.cwd(), "src", "models");

  it("joins a plain file name under the base directory", () => {
    expect(joinSafe(base, "User.ts")).toBe(resolve(base, "User.ts"));
  });

  it("rejects file names containing path separators", () => {
    expect(() => joinSafe(base, join("nested", "User.ts"))).toThrow(/Invalid model file name/);
  });

  it("rejects parent-directory traversal in the file name", () => {
    expect(() => joinSafe(base, "..")).toThrow(/Invalid model file name/);
    expect(() => joinSafe(base, "..\\evil.ts")).toThrow(/Invalid model file name/);
    expect(() => joinSafe(base, "../evil.ts")).toThrow(/Invalid model file name/);
  });
});
