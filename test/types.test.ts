import { describe, expect, it } from "vitest";
import { z } from "zod";
import { LanguageInfo, TranslationSchema } from "../src/types";
import type {
	AiChoice,
	AiChoiceMessage,
	AiResponse,
	ProjectTranslations,
	TranslationConfig,
	TranslationFile,
	TranslationOutput,
} from "../src/types";

describe("types", () => {
	describe("LanguageInfo", () => {
		it("should validate correct language info", () => {
			const validLanguageInfo = {
				code: "en-GB",
				englishName: "English (United Kingdom)",
				localName: "English (United Kingdom)",
			};

			const result = LanguageInfo.safeParse(validLanguageInfo);
			expect(result.success).toBe(true);
		});

		it("should validate language info with optional default field", () => {
			const validLanguageInfoWithDefault = {
				code: "en-GB",
				englishName: "English (United Kingdom)",
				localName: "English (United Kingdom)",
				default: true,
			};

			const result = LanguageInfo.safeParse(validLanguageInfoWithDefault);
			expect(result.success).toBe(true);
		});

		it("should reject invalid language info", () => {
			const invalidLanguageInfo = {
				code: "en-GB",
				// missing englishName
				localName: "English (United Kingdom)",
			};

			const result = LanguageInfo.safeParse(invalidLanguageInfo);
			expect(result.success).toBe(false);
		});

		it("should reject language info with invalid types", () => {
			const invalidLanguageInfo = {
				code: 123, // should be string
				englishName: "English (United Kingdom)",
				localName: "English (United Kingdom)",
			};

			const result = LanguageInfo.safeParse(invalidLanguageInfo);
			expect(result.success).toBe(false);
		});
	});

	describe("TranslationSchema", () => {
		it("should validate simple string translations", () => {
			const validTranslation = {
				hello: "Hello",
				world: "World",
			};

			const result = TranslationSchema.safeParse(validTranslation);
			expect(result.success).toBe(true);
		});

		it("should validate nested translations", () => {
			const validNestedTranslation = {
				hello: "Hello",
				user: {
					profile: "User profile",
					settings: "User settings",
				},
			};

			const result = TranslationSchema.safeParse(validNestedTranslation);
			expect(result.success).toBe(true);
		});

		it("should validate mixed string and nested translations", () => {
			const validMixedTranslation = {
				hello: "Hello",
				user: {
					profile: "User profile",
				},
				goodbye: "Goodbye",
			};

			const result = TranslationSchema.safeParse(validMixedTranslation);
			expect(result.success).toBe(true);
		});

		it("should reject translations with non-string values", () => {
			const invalidTranslation = {
				hello: "Hello",
				count: 123, // should be string
			};

			const result = TranslationSchema.safeParse(invalidTranslation);
			expect(result.success).toBe(false);
		});

		it("should reject translations with non-string nested values", () => {
			const invalidNestedTranslation = {
				hello: "Hello",
				user: {
					profile: "User profile",
					count: 123, // should be string
				},
			};

			const result = TranslationSchema.safeParse(invalidNestedTranslation);
			expect(result.success).toBe(false);
		});
	});

	describe("TranslationConfig", () => {
		it("should have required properties", () => {
			const config: TranslationConfig = {
				apiUrl: "https://api.openai.com/v1",
				apiKey: "sk-test-key",
				model: "gpt-3.5-turbo",
				targetLanguageCode: "es",
				originalLanguageCode: "en",
				context: "Translation context",
				tone: "formal",
			};

			expect(config.apiUrl).toBeDefined();
			expect(config.apiKey).toBeDefined();
			expect(config.targetLanguageCode).toBeDefined();
			expect(config.originalLanguageCode).toBeDefined();
			expect(config.context).toBeDefined();
			expect(config.tone).toBeDefined();
		});

		it("should allow optional model property", () => {
			const config: TranslationConfig = {
				apiUrl: "https://api.openai.com/v1",
				apiKey: "sk-test-key",
				targetLanguageCode: "es",
				originalLanguageCode: "en",
				context: "Translation context",
				tone: "formal",
			};

			expect(config.model).toBeUndefined();
		});
	});

	describe("AI Response Types", () => {
		it("should define AiChoiceMessage correctly", () => {
			const message: AiChoiceMessage = {
				content: "Hello world",
			};

			expect(message.content).toBe("Hello world");
		});

		it("should define AiChoice correctly", () => {
			const choice: AiChoice = {
				message: {
					content: "Hello world",
				},
			};

			expect(choice.message.content).toBe("Hello world");
		});

		it("should define AiResponse correctly", () => {
			const response: AiResponse = {
				id: "chatcmpl-123",
				object: "chat.completion",
				choices: [
					{
						message: {
							content: "Hello world",
						},
					},
				],
			};

			expect(response.id).toBe("chatcmpl-123");
			expect(response.object).toBe("chat.completion");
			expect(response.choices).toHaveLength(1);
			expect(response.choices[0].message.content).toBe("Hello world");
		});
	});

	describe("TranslationFile", () => {
		it("should define TranslationFile correctly", () => {
			const translationFile: TranslationFile = {
				"en-GB": {
					hello: "Hello",
					world: "World",
				},
				"es-ES": {
					hello: "Hola",
					world: "Mundo",
				},
			};

			expect(translationFile["en-GB"].hello).toBe("Hello");
			expect(translationFile["es-ES"].hello).toBe("Hola");
		});
	});

	describe("ProjectTranslations", () => {
		it("should define ProjectTranslations correctly", () => {
			const projectTranslations: ProjectTranslations = {
				"main.json": {
					"en-GB": {
						hello: "Hello",
					},
					"es-ES": {
						hello: "Hola",
					},
				},
				"errors.json": {
					"en-GB": {
						notFound: "Not found",
					},
					"es-ES": {
						notFound: "No encontrado",
					},
				},
			};

			expect(projectTranslations["main.json"]["en-GB"].hello).toBe("Hello");
			expect(projectTranslations["main.json"]["es-ES"].hello).toBe("Hola");
		});
	});

	describe("TranslationOutput", () => {
		it("should define TranslationOutput correctly", () => {
			const translationOutput: TranslationOutput = {
				languages: [
					{
						code: "en-GB",
						englishName: "English (United Kingdom)",
						localName: "English (United Kingdom)",
					},
					{
						code: "es-ES",
						englishName: "Spanish (Spain)",
						localName: "Español (España)",
					},
				],
				translations: [
					{
						"main.json": {
							"en-GB": {
								hello: "Hello",
							},
							"es-ES": {
								hello: "Hola",
							},
						},
					},
				],
			};

			expect(translationOutput.languages).toHaveLength(2);
			expect(translationOutput.translations).toHaveLength(1);
			expect(translationOutput.languages[0].code).toBe("en-GB");
			expect(translationOutput.languages[1].code).toBe("es-ES");
		});
	});
});
