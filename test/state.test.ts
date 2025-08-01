import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type KeyMeta,
	type State,
	createState,
	diffState,
	getLanguagesInfo,
	isStale,
	loadState,
	saveState,
	touch,
} from "../src/state";

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
	readFile: vi.fn(),
	writeFile: vi.fn(),
}));

// Mock path
vi.mock("node:path", () => ({
	default: {
		join: vi.fn(),
	},
}));

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);
const mockPathJoin = vi.mocked(path.join);

describe("State Management", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockPathJoin.mockReturnValue("/mock/path/oneKeyState.json");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("loadState", () => {
		it("should load state from file successfully", async () => {
			const mockState: State = {
				version: "0",
				baseLocale: "en-GB",
				translationsPath: "public/translations",
				locales: [
					{
						code: "en-GB",
						englishName: "English (United Kingdom)",
						localName: "English (United Kingdom)",
						keys: {
							"main.hello": {
								lastModified: "2025-01-15T10:00:00Z",
								current: "Hello",
							},
						},
					},
				],
			};

			mockReadFile.mockResolvedValue(JSON.stringify(mockState));

			const result = await loadState();

			expect(mockPathJoin).toHaveBeenCalledWith(
				process.cwd(),
				"oneKeyState.json",
			);
			expect(mockReadFile).toHaveBeenCalledWith(
				"/mock/path/oneKeyState.json",
				"utf-8",
			);
			expect(result).toEqual(mockState);
		});

		it("should throw error when file read fails", async () => {
			mockReadFile.mockRejectedValue(new Error("File not found"));

			await expect(loadState()).rejects.toThrow("File not found");
		});

		it("should throw error when JSON is invalid", async () => {
			mockReadFile.mockResolvedValue("invalid json");

			await expect(loadState()).rejects.toThrow();
		});
	});

	describe("createState", () => {
		it("should create new state with provided parameters", async () => {
			const result = await createState({
				baseLocale: "en-GB",
				translationsPath: "public/translations",
			});

			expect(result).toEqual({
				version: "0",
				baseLocale: "en-GB",
				translationsPath: "public/translations",
				locales: [],
			});
		});
	});

	describe("saveState", () => {
		it("should save state to file successfully", async () => {
			const mockState: State = {
				version: "0",
				baseLocale: "en-GB",
				translationsPath: "public/translations",
				locales: [],
			};

			mockWriteFile.mockResolvedValue(undefined);

			await saveState(mockState);

			expect(mockPathJoin).toHaveBeenCalledWith(
				process.cwd(),
				"oneKeyState.json",
			);
			expect(mockWriteFile).toHaveBeenCalledWith(
				"/mock/path/oneKeyState.json",
				JSON.stringify(mockState, null, 2),
				"utf-8",
			);
		});

		it("should throw error when file write fails", async () => {
			const mockState: State = {
				version: "0",
				baseLocale: "en-GB",
				translationsPath: "public/translations",
				locales: [],
			};

			mockWriteFile.mockRejectedValue(new Error("Write failed"));

			await expect(saveState(mockState)).rejects.toThrow("Write failed");
		});
	});

	describe("touch", () => {
		it("should create new locale entry when locale doesn't exist", () => {
			const state: State = {
				version: "0",
				baseLocale: "en-GB",
				translationsPath: "public/translations",
				locales: [],
			};

			const testDate = new Date("2025-01-15T10:00:00Z");
			touch(state, "es-ES", "main.hello", testDate, "Hola");

			expect(state.locales).toHaveLength(1);
			expect(state.locales[0].code).toBe("es-ES");
			expect(state.locales[0].keys["main.hello"]).toEqual({
				lastModified: testDate.toISOString(),
				current: "Hola",
			});
		});

		it("should add new key to existing locale", () => {
			const state: State = {
				version: "0",
				baseLocale: "en-GB",
				translationsPath: "public/translations",
				locales: [
					{
						code: "es-ES",
						englishName: "Spanish",
						localName: "Español",
						keys: {
							"main.hello": {
								lastModified: "2025-01-15T09:00:00Z",
								current: "Hola",
							},
						},
					},
				],
			};

			const testDate = new Date("2025-01-15T10:00:00Z");
			touch(state, "es-ES", "main.goodbye", testDate, "Adiós");

			expect(state.locales[0].keys["main.goodbye"]).toEqual({
				lastModified: testDate.toISOString(),
				current: "Adiós",
			});
		});

		it("should update existing key when translation changes", () => {
			const state: State = {
				version: "0",
				baseLocale: "en-GB",
				translationsPath: "public/translations",
				locales: [
					{
						code: "es-ES",
						englishName: "Spanish",
						localName: "Español",
						keys: {
							"main.hello": {
								lastModified: "2025-01-15T09:00:00Z",
								current: "Hola",
							},
						},
					},
				],
			};

			const testDate = new Date("2025-01-15T10:00:00Z");
			touch(state, "es-ES", "main.hello", testDate, "¡Hola!");

			expect(state.locales[0].keys["main.hello"]).toEqual({
				lastModified: testDate.toISOString(),
				current: "¡Hola!",
			});
		});

		it("should only update timestamp when no translation provided", () => {
			const state: State = {
				version: "0",
				baseLocale: "en-GB",
				translationsPath: "public/translations",
				locales: [
					{
						code: "es-ES",
						englishName: "Spanish",
						localName: "Español",
						keys: {
							"main.hello": {
								lastModified: "2025-01-15T09:00:00Z",
								current: "Hola",
							},
						},
					},
				],
			};

			const testDate = new Date("2025-01-15T10:00:00Z");
			touch(state, "es-ES", "main.hello", testDate);

			expect(state.locales[0].keys["main.hello"]).toEqual({
				lastModified: testDate.toISOString(),
				current: "Hola", // Should remain unchanged
			});
		});

		it("should not update when translation is the same", () => {
			const state: State = {
				version: "0",
				baseLocale: "en-GB",
				translationsPath: "public/translations",
				locales: [
					{
						code: "es-ES",
						englishName: "Spanish",
						localName: "Español",
						keys: {
							"main.hello": {
								lastModified: "2025-01-15T09:00:00Z",
								current: "Hola",
							},
						},
					},
				],
			};

			const testDate = new Date("2025-01-15T10:00:00Z");
			touch(state, "es-ES", "main.hello", testDate, "Hola");

			expect(state.locales[0].keys["main.hello"]).toEqual({
				lastModified: "2025-01-15T09:00:00Z", // Should remain unchanged
				current: "Hola",
			});
		});
	});

	describe("isStale", () => {
		it("should return false when base locale key doesn't exist", () => {
			const state: State = {
				version: "0",
				baseLocale: "en-GB",
				translationsPath: "public/translations",
				locales: [
					{
						code: "es-ES",
						englishName: "Spanish",
						localName: "Español",
						keys: {
							"main.hello": {
								lastModified: "2025-01-15T09:00:00Z",
								current: "Hola",
							},
						},
					},
				],
			};

			const result = isStale(state, "en-GB", "es-ES", "main.hello");
			expect(result).toBe(false);
		});

		it("should return true when locale key doesn't exist", () => {
			const state: State = {
				version: "0",
				baseLocale: "en-GB",
				translationsPath: "public/translations",
				locales: [
					{
						code: "en-GB",
						englishName: "English (United Kingdom)",
						localName: "English (United Kingdom)",
						keys: {
							"main.hello": {
								lastModified: "2025-01-15T10:00:00Z",
								current: "Hello",
							},
						},
					},
				],
			};

			const result = isStale(state, "en-GB", "es-ES", "main.hello");
			expect(result).toBe(true);
		});

		it("should return true when locale key is older than base", () => {
			const state: State = {
				version: "0",
				baseLocale: "en-GB",
				translationsPath: "public/translations",
				locales: [
					{
						code: "en-GB",
						englishName: "English (United Kingdom)",
						localName: "English (United Kingdom)",
						keys: {
							"main.hello": {
								lastModified: "2025-01-15T10:00:00Z",
								current: "Hello",
							},
						},
					},
					{
						code: "es-ES",
						englishName: "Spanish",
						localName: "Español",
						keys: {
							"main.hello": {
								lastModified: "2025-01-15T09:00:00Z",
								current: "Hola",
							},
						},
					},
				],
			};

			const result = isStale(state, "en-GB", "es-ES", "main.hello");
			expect(result).toBe(true);
		});

		it("should return false when locale key is newer than base", () => {
			const state: State = {
				version: "0",
				baseLocale: "en-GB",
				translationsPath: "public/translations",
				locales: [
					{
						code: "en-GB",
						englishName: "English (United Kingdom)",
						localName: "English (United Kingdom)",
						keys: {
							"main.hello": {
								lastModified: "2025-01-15T09:00:00Z",
								current: "Hello",
							},
						},
					},
					{
						code: "es-ES",
						englishName: "Spanish",
						localName: "Español",
						keys: {
							"main.hello": {
								lastModified: "2025-01-15T10:00:00Z",
								current: "Hola",
							},
						},
					},
				],
			};

			const result = isStale(state, "en-GB", "es-ES", "main.hello");
			expect(result).toBe(false);
		});
	});

	describe("diffState", () => {
		it("should return empty array when base locale doesn't exist", () => {
			const state: State = {
				version: "0",
				baseLocale: "en-GB",
				translationsPath: "public/translations",
				locales: [
					{
						code: "es-ES",
						englishName: "Spanish",
						localName: "Español",
						keys: {},
					},
				],
			};

			const result = diffState(state);
			expect(result).toEqual([]);
		});

		it("should return diffs for stale translations", () => {
			const state: State = {
				version: "0",
				baseLocale: "en-GB",
				translationsPath: "public/translations",
				locales: [
					{
						code: "en-GB",
						englishName: "English (United Kingdom)",
						localName: "English (United Kingdom)",
						keys: {
							"main.hello": {
								lastModified: "2025-01-15T10:00:00Z",
								current: "Hello",
							},
							"main.goodbye": {
								lastModified: "2025-01-15T11:00:00Z",
								current: "Goodbye",
							},
						},
					},
					{
						code: "es-ES",
						englishName: "Spanish",
						localName: "Español",
						keys: {
							"main.hello": {
								lastModified: "2025-01-15T09:00:00Z",
								current: "Hola",
							},
						},
					},
				],
			};

			const result = diffState(state);
			expect(result).toHaveLength(2);
			expect(result).toEqual([
				{
					locale: "es-ES",
					key: "main.hello",
					baseTs: "2025-01-15T10:00:00Z",
					localeTs: "2025-01-15T09:00:00Z",
				},
				{
					locale: "es-ES",
					key: "main.goodbye",
					baseTs: "2025-01-15T11:00:00Z",
					localeTs: "missing",
				},
			]);
		});

		it("should not include base locale in diffs", () => {
			const state: State = {
				version: "0",
				baseLocale: "en-GB",
				translationsPath: "public/translations",
				locales: [
					{
						code: "en-GB",
						englishName: "English (United Kingdom)",
						localName: "English (United Kingdom)",
						keys: {
							"main.hello": {
								lastModified: "2025-01-15T10:00:00Z",
								current: "Hello",
							},
						},
					},
				],
			};

			const result = diffState(state);
			expect(result).toEqual([]);
		});
	});

	describe("getLanguagesInfo", () => {
		it("should return language info for all locales", () => {
			const state: State = {
				version: "0",
				baseLocale: "en-GB",
				translationsPath: "public/translations",
				locales: [
					{
						code: "en-GB",
						englishName: "English (United Kingdom)",
						localName: "English (United Kingdom)",
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

			const result = getLanguagesInfo(state);
			expect(result).toEqual([
				{
					code: "en-GB",
					englishName: "English (United Kingdom)",
					localName: "English (United Kingdom)",
				},
				{
					code: "es-ES",
					englishName: "Spanish",
					localName: "Español",
				},
			]);
		});

		it("should return empty array for empty locales", () => {
			const state: State = {
				version: "0",
				baseLocale: "en-GB",
				translationsPath: "public/translations",
				locales: [],
			};

			const result = getLanguagesInfo(state);
			expect(result).toEqual([]);
		});
	});
});
