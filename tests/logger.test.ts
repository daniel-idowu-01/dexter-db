import { Logger } from "../src/utils/logger";

describe("Logger", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it("should log info messages", () => {
    Logger.info("Test info");
    expect(console.log).toHaveBeenCalled();
  });

  it("should log success messages", () => {
    Logger.success("Test success");
    expect(console.log).toHaveBeenCalled();
  });

  it("should log warning messages", () => {
    Logger.warning("Test warning");
    expect(console.log).toHaveBeenCalled();
  });

  it("should log error messages", () => {
    Logger.error("Test error");
    expect(console.error).toHaveBeenCalled();
  });

  it("should log debug messages only when DEBUG is set", () => {
    const originalEnv = process.env.DEBUG;
    delete process.env.DEBUG;

    Logger.debug("Test debug");
    expect(console.log).not.toHaveBeenCalled();

    process.env.DEBUG = "true";
    Logger.debug("Test debug");
    expect(console.log).toHaveBeenCalled();

    process.env.DEBUG = originalEnv;
  });

  it("should log step messages", () => {
    Logger.step("Test step");
    expect(console.log).toHaveBeenCalled();
  });
});

