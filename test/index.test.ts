import { expect, it, describe } from "vitest";

describe("index exports", () => {
  it("should export generateKeys from generate-translation-keys", async () => {
    const { generateKeys } = await import("../src/index");
    expect(generateKeys).toBeDefined();
    expect(typeof generateKeys).toBe("function");
  });

  it("should export translate from translate", async () => {
    const { translate } = await import("../src/index");
    expect(translate).toBeDefined();
    expect(typeof translate).toBe("function");
  });

  it("should export file operations", async () => {
    const {
      saveKeys,
      saveAiTranslations,
      initializeState,
      checkStatus,
      syncState,
    } = await import("../src/index");

    expect(saveKeys).toBeDefined();
    expect(saveAiTranslations).toBeDefined();
    expect(initializeState).toBeDefined();
    expect(checkStatus).toBeDefined();
    expect(syncState).toBeDefined();
  });

  it("should export state operations", async () => {
    const { loadState, saveState, touch, isStale, diffState } = await import(
      "../src/index"
    );

    expect(loadState).toBeDefined();
    expect(saveState).toBeDefined();
    expect(touch).toBeDefined();
    expect(isStale).toBeDefined();
    expect(diffState).toBeDefined();
  });

  it("should export all functions as functions", async () => {
    const exports = await import("../src/index");

    const functionExports = [
      "generateKeys",
      "translate",
      "saveKeys",
      "saveAiTranslations",
      "initializeState",
      "checkStatus",
      "syncState",
      "loadState",
      "saveState",
      "touch",
      "isStale",
      "diffState",
    ];

    for (const exportName of functionExports) {
      expect(exports[exportName as keyof typeof exports]).toBeDefined();
      expect(typeof exports[exportName as keyof typeof exports]).toBe(
        "function"
      );
    }
  });
});
