import { ConfigLoader } from "../src/config/config";
import { SeederConfig } from "../src/types";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";

describe("ConfigLoader", () => {
  const testConfigPath = join(__dirname, "test-config.json");

  afterEach(() => {
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  it("should load JSON config file", () => {
    const testConfig: SeederConfig = {
      models: {
        User: {
          count: 50,
          fields: {
            email: {
              generator: "internet.email",
            },
          },
        },
      },
    };

    writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

    const loaded = ConfigLoader.load(testConfigPath);
    expect(loaded.models?.User?.count).toBe(50);
    expect(loaded.models?.User?.fields?.email?.generator).toBe("internet.email");
  });

  it("should return empty config if file not found", () => {
    const loaded = ConfigLoader.load("./non-existent.json");
    expect(loaded).toEqual({});
  });

  it("should merge with defaults", () => {
    const userConfig: SeederConfig = {
      global: {
        reset: true,
      },
    };

    const merged = ConfigLoader.mergeWithDefaults(userConfig);
    expect(merged.global?.reset).toBe(true);
    expect(merged.global?.incremental).toBe(false);
    expect(merged.global?.randomize).toBe(false);
  });

  it("should get model config", () => {
    const config: SeederConfig = {
      models: {
        User: {
          count: 100,
        },
      },
    };

    const modelConfig = ConfigLoader.getModelConfig(config, "User");
    expect(modelConfig.count).toBe(100);

    const nonExistent = ConfigLoader.getModelConfig(config, "Post");
    expect(nonExistent).toEqual({});
  });
});

