import { readFile } from "node:fs/promises";
import path from "node:path";
import prettier from "prettier";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { TranslationSchema } from "../src/types";

import { readJSON } from "../src/utils";

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
	mkdir: vi.fn(),
	readFile: vi.fn(),
	writeFile: vi.fn(),
}));

// Mock path
vi.mock("node:path", () => ({
	default: {
		resolve: vi.fn(),
	},
}));

// Mock prettier
vi.mock("prettier", () => ({
	default: {
		format: vi.fn(),
		resolveConfig: vi.fn(),
	},
}));

// Mock other modules
vi.mock("../src/generate-translation-keys", () => ({
	generateKeys: vi.fn(),
}));

vi.mock("../src/types", () => ({
	TranslationSchema: z.object({
		hello: z.string(),
		goodbye: z.string(),
	}),
}));

const mockReadFile = vi.mocked(readFile);
const mockPathResolve = vi.mocked(path.resolve);
const mockPrettierFormat = vi.mocked(prettier.format);
const mockPrettierResolveConfig = vi.mocked(prettier.resolveConfig);

describe("Utils", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockPathResolve.mockImplementation((...args) => {
			if (args[0] === process.cwd()) {
				return args.slice(1).join("/");
			}
			return args.join("/");
		});
		mockPrettierFormat.mockResolvedValue('{"hello": "world"}');
		mockPrettierResolveConfig.mockResolvedValue({});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("readJSON", () => {
		it("should read and parse JSON successfully", async () => {
			const mockContent = '{"hello": "world", "goodbye": "bye"}';
			mockReadFile.mockResolvedValue(mockContent);

			const result = await readJSON(TranslationSchema, "/test/path.json");

			expect(mockReadFile).toHaveBeenCalledWith("/test/path.json", "utf-8");
			expect(result).toEqual({
				hello: "world",
				goodbye: "bye",
			});
		});

		it("should throw error when file read fails", async () => {
			mockReadFile.mockRejectedValue(new Error("File not found"));

			await expect(
				readJSON(TranslationSchema, "/test/path.json"),
			).rejects.toThrow("File not found");
		});

		it("should throw error when JSON is invalid", async () => {
			mockReadFile.mockResolvedValue("invalid json");

			await expect(
				readJSON(TranslationSchema, "/test/path.json"),
			).rejects.toThrow();
		});

		it("should throw error when schema validation fails", async () => {
			mockReadFile.mockResolvedValue('{"invalid": "data"}');

			await expect(
				readJSON(TranslationSchema, "/test/path.json"),
			).rejects.toThrow();
		});
	});
});
