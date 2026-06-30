import { ConfigLoader } from "../src/config/config";
import { SeederConfig } from "../src/types";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";

describe("ConfigLoader", () => {
  const testConfigPath = join(__dirname, "test-config.json");
  const testYamlPath = join(__dirname, "test-config.yaml");
  const testBadPath = join(__dirname, "test-config-bad.json");

  afterEach(() => {
    for (const p of [testConfigPath, testYamlPath, testBadPath]) {
      if (existsSync(p)) {
        unlinkSync(p);
      }
    }
    delete process.env.SEEDER_CONFIG_PATH;
  });

  it("should load JSON config file", () => {
    const testConfig: SeederConfig = {
      models: {
        User: {
          count: 50,
          fields: {
            email: { generator: "internet.email" },
          },
        },
      },
    };

    writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

    const loaded = ConfigLoader.load(testConfigPath);
    expect(loaded.models?.User?.count).toBe(50);
    expect(loaded.models?.User?.fields?.email?.generator).toBe("internet.email");
  });

  it("should load a YAML config file", () => {
    const yaml = [
      "global:",
      "  reset: true",
      "models:",
      "  Post:",
      "    count: 7",
    ].join("\n");
    writeFileSync(testYamlPath, yaml);

    const loaded = ConfigLoader.load(testYamlPath);
    expect(loaded.global?.reset).toBe(true);
    expect(loaded.models?.Post?.count).toBe(7);
  });

  it("should return empty config if file not found", () => {
    expect(ConfigLoader.load("./non-existent.json")).toEqual({});
  });

  it("should return empty config when JSON is invalid", () => {
    writeFileSync(testBadPath, "{ not valid json ");
    expect(ConfigLoader.load(testBadPath)).toEqual({});
  });

  it("should reject unsafe config paths outside the project root", () => {
    const loaded = ConfigLoader.load(join("..", "..", "etc", "passwd"));
    expect(loaded).toEqual({});
  });

  it("should strip prototype-pollution keys from loaded config", () => {
    writeFileSync(
      testConfigPath,
      '{"__proto__":{"polluted":true},"models":{"User":{"count":1}}}'
    );

    const loaded = ConfigLoader.load(testConfigPath) as any;
    expect(loaded.models.User.count).toBe(1);
    expect(({} as any).polluted).toBeUndefined();
  });

  it("should honor the SEEDER_CONFIG_PATH environment variable", () => {
    writeFileSync(testConfigPath, JSON.stringify({ models: { X: { count: 3 } } }));
    process.env.SEEDER_CONFIG_PATH = testConfigPath;

    const loaded = ConfigLoader.load();
    expect(loaded.models?.X?.count).toBe(3);
  });

  describe("mergeWithDefaults", () => {
    it("should merge user global config over defaults", () => {
      const merged = ConfigLoader.mergeWithDefaults({ global: { reset: true } });
      expect(merged.global?.reset).toBe(true);
      expect(merged.global?.incremental).toBe(false);
      expect(merged.global?.randomize).toBe(false);
    });

    it("should provide defaults for an empty config", () => {
      const merged = ConfigLoader.mergeWithDefaults({});
      expect(merged.global).toEqual({ reset: false, incremental: false, randomize: false });
      expect(merged.models).toEqual({});
    });

    it("should preserve user models", () => {
      const merged = ConfigLoader.mergeWithDefaults({ models: { User: { count: 9 } } });
      expect(merged.models?.User?.count).toBe(9);
    });
  });

  describe("getModelConfig", () => {
    it("should return the model config when present", () => {
      const config: SeederConfig = { models: { User: { count: 100 } } };
      expect(ConfigLoader.getModelConfig(config, "User").count).toBe(100);
    });

    it("should return an empty object for unknown models", () => {
      const config: SeederConfig = { models: { User: { count: 100 } } };
      expect(ConfigLoader.getModelConfig(config, "Post")).toEqual({});
    });

    it("should return an empty object when no models are configured", () => {
      expect(ConfigLoader.getModelConfig({}, "User")).toEqual({});
    });
  });
});
