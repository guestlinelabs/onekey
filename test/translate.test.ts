import { readFile, readdir } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	type State,
	diffState,
	getLanguagesInfo,
	loadState,
	saveState,
	touch,
} from "../src/state";
import { translate } from "../src/translate";
import type { AiResponse, LanguageInfo } from "../src/types";

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
	readFile: vi.fn(),
	readdir: vi.fn(),
}));

// Mock state module
vi.mock("../src/state", () => ({
	loadState: vi.fn(),
	saveState: vi.fn(),
	getLanguagesInfo: vi.fn(),
	diffState: vi.fn(),
	touch: vi.fn(),
}));

// Mock fetch globally
global.fetch = vi.fn();

const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir as (path: string) => Promise<string[]>);
const mockLoadState = vi.mocked(loadState);
const mockSaveState = vi.mocked(saveState);
const mockGetLanguagesInfo = vi.mocked(getLanguagesInfo);
const mockDiffState = vi.mocked(diffState);
const mockTouch = vi.mocked(touch);
const mockFetch = vi.mocked(fetch);

describe("translate", () => {
	const mockState: State = {
		version: "0",
		baseLocale: "en-GB",
		translationsPath: "public/translations",
		locales: [
			{
				code: "en-GB",
				englishName: "English",
				localName: "English",
				keys: {},
			},
			{
				code: "es-ES",
				englishName: "Spanish",
				localName: "Español",
				keys: {},
			},
		],
	};

	const mockLanguages: LanguageInfo[] = [
		{
			code: "en-GB",
			englishName: "English",
			localName: "English",
			default: true,
		},
		{
			code: "es-ES",
			englishName: "Spanish",
			localName: "Español",
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
		mockLoadState.mockResolvedValue(mockState);
		mockGetLanguagesInfo.mockReturnValue(mockLanguages);
		mockSaveState.mockResolvedValue(undefined);
		mockDiffState.mockReturnValue([]);
		mockTouch.mockImplementation(() => {});
		mockReaddir.mockResolvedValue(["main.json"]);
		mockReadFile.mockResolvedValue('{"hello": "Hello", "goodbye": "Goodbye"}');
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("translate function", () => {
		it("should throw error when apiUrl is missing", async () => {
			await expect(
				translate({
					path: "public/translations",
					apiUrl: "",
					apiKey: "test-key",
				}),
			).rejects.toThrow("Missing required parameters: apiUrl or apiKey");
		});

		it("should throw error when apiKey is missing", async () => {
			await expect(
				translate({
					path: "public/translations",
					apiUrl: "https://api.example.com",
				}),
			).rejects.toThrow("Missing required parameters: apiUrl or apiKey");
		});

		it("should throw error when no state found", async () => {
			mockLoadState.mockRejectedValue(new Error("ENOENT: no such file"));

			await expect(
				translate({
					path: "public/translations",
					apiUrl: "https://api.example.com",
					apiKey: "test-key",
				}),
			).rejects.toThrow("ENOENT: no such file");
		});

		it("should throw error when no default language found", async () => {
			mockGetLanguagesInfo.mockReturnValue([
				{
					code: "es-ES",
					englishName: "Spanish",
					localName: "Español",
				},
			]);

			await expect(
				translate({
					path: "public/translations",
					apiUrl: "https://api.example.com",
					apiKey: "test-key",
				}),
			).rejects.toThrow("No default language found");
		});

		it("should handle stats mode correctly", async () => {
			const mockDiffs = [
				{
					locale: "es-ES",
					key: "main.hello",
					baseTs: "2025-01-15T10:00:00Z",
					localeTs: "2025-01-15T09:00:00Z",
				},
			];

			mockDiffState.mockReturnValue(mockDiffs);

			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			// Mock fetch to return a successful response
			mockFetch.mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						id: "test-id",
						object: "chat.completion",
						choices: [
							{
								message: {
									content: '{"hello": "Hola", "goodbye": "Adiós"}',
								},
							},
						],
					}),
			} as Response);

			const result = await translate({
				path: "public/translations",
				apiUrl: "https://api.example.com",
				apiKey: "test-key",
				stats: true,
			});

			expect(mockDiffState).toHaveBeenCalledWith(mockState);
			expect(consoleSpy).toHaveBeenCalledWith("Stale translations by locale:");
			expect(consoleSpy).toHaveBeenCalledWith("  es-ES: 1 stale keys");
			expect(result).toBeDefined();

			consoleSpy.mockRestore();
		});

		it("should handle missing translation files", async () => {
			mockReadFile.mockRejectedValue(new Error("File not found: test.json"));

			await expect(
				translate({
					path: "public/translations",
					apiUrl: "https://api.example.com",
					apiKey: "test-key",
				}),
			).rejects.toThrow("File not found: test.json");
		});

		it("should call required functions with correct parameters", async () => {
			// Mock fetch to return a successful response
			mockFetch.mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						id: "test-id",
						object: "chat.completion",
						choices: [
							{
								message: {
									content: '{"hello": "Hola", "goodbye": "Adiós"}',
								},
							},
						],
					}),
			} as Response);

			const result = await translate({
				path: "public/translations",
				apiUrl: "https://api.example.com",
				apiKey: "test-key",
			});

			expect(mockLoadState).toHaveBeenCalled();
			expect(mockGetLanguagesInfo).toHaveBeenCalledWith(mockState);
			expect(result).toBeDefined();
		});

		it("should handle custom baseLocale when provided", async () => {
			// Mock fetch to return a successful response
			mockFetch.mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						id: "test-id",
						object: "chat.completion",
						choices: [
							{
								message: {
									content: '{"hello": "Hola", "goodbye": "Adiós"}',
								},
							},
						],
					}),
			} as Response);

			const result = await translate({
				path: "public/translations",
				apiUrl: "https://api.example.com",
				apiKey: "test-key",
				baseLocale: "es-ES",
			});

			expect(mockGetLanguagesInfo).toHaveBeenCalledWith(mockState);
			expect(result).toBeDefined();
		});

		it("should handle updateAll mode", async () => {
			// Mock fetch to return a successful response
			mockFetch.mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						id: "test-id",
						object: "chat.completion",
						choices: [
							{
								message: {
									content: '{"hello": "Hola", "goodbye": "Adiós"}',
								},
							},
						],
					}),
			} as Response);

			const result = await translate({
				path: "public/translations",
				apiUrl: "https://api.example.com",
				apiKey: "test-key",
				updateAll: true,
			});

			expect(result).toBeDefined();
		});

		it("should handle custom context and tone", async () => {
			// Mock fetch to return a successful response
			mockFetch.mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						id: "test-id",
						object: "chat.completion",
						choices: [
							{
								message: {
									content: '{"hello": "Hola", "goodbye": "Adiós"}',
								},
							},
						],
					}),
			} as Response);

			const result = await translate({
				path: "public/translations",
				apiUrl: "https://api.example.com",
				apiKey: "test-key",
				context: "Custom context",
				tone: "informal",
			});

			expect(result).toBeDefined();
		});
	});

	describe("File operations", () => {
		it("should handle existing translations", async () => {
			// Mock existing translations for Spanish
			mockReadFile
				.mockResolvedValueOnce('{"hello": "Hello", "goodbye": "Goodbye"}') // en-GB
				.mockResolvedValueOnce('{"hello": "Hola"}'); // es-ES existing

			// Mock fetch to return a successful response
			mockFetch.mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						id: "test-id",
						object: "chat.completion",
						choices: [
							{
								message: {
									content: '{"goodbye": "Adiós"}',
								},
							},
						],
					}),
			} as Response);

			const result = await translate({
				path: "public/translations",
				apiUrl: "https://api.example.com",
				apiKey: "test-key",
			});

			expect(result).toBeDefined();
		});
	});

	describe("Key flattening", () => {
		it("should handle nested translation objects", async () => {
			const nestedTranslations = {
				hello: "Hello",
				nested: {
					deep: {
						key: "Nested value",
					},
				},
			};

			mockReadFile.mockResolvedValue(JSON.stringify(nestedTranslations));

			// Mock fetch to return a successful response
			mockFetch.mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						id: "test-id",
						object: "chat.completion",
						choices: [
							{
								message: {
									content: JSON.stringify(nestedTranslations),
								},
							},
						],
					}),
			} as Response);

			const result = await translate({
				path: "public/translations",
				apiUrl: "https://api.example.com",
				apiKey: "test-key",
			});

			expect(result).toBeDefined();
		});
	});
});
