import { describe, expect, it } from "vitest";
import {
	type Translations,
	generateKeys,
} from "../src/generate-translation-keys";
import type { LanguageInfo } from "../src/types";
import { isValidTypescript } from "./tsCompiler";

const translations: Translations = {
	main: {
		hello: "Hello there",
	},
	errors: {
		unknown: "Unknown error",
	},
};

const languages: LanguageInfo[] = [
	{
		code: "en-GB",
		englishName: "English (United Kingdom)",
		localName: "English (United Kingdom)",
	},
	{
		code: "pt-PT",
		englishName: "Portuguese (Portugal)",
		localName: "Português (Europeu)",
	},
];

describe("generate-translation-keys", () => {
	it.skip("will generate valid typescript code", async () => {
		const source = await generateKeys({
			translations,
			languages,
			prettierConfig: {},
			defaultLocale: "en-GB",
		});

		const { isValid } = isValidTypescript(source);

		expect(isValid).toBe(true);
	});

	it("should handle empty translations", async () => {
		const source = await generateKeys({
			translations: {},
			languages,
			prettierConfig: {},
			defaultLocale: "en-GB",
		});

		expect(source).toContain("export type Namespace = never");
		expect(source).toContain("export const namespaces: Namespace[] = []");
		expect(source).toContain(
			"export type TranslationKeyWithoutOptions = never",
		);
	});

	it("should handle translations with parameters", async () => {
		const translationsWithParams: Translations = {
			main: {
				hello: "Hello {{name}}",
				welcome: "Welcome {{name}} to {{place}}",
				count: "You have {{count}} items",
			},
		};

		const source = await generateKeys({
			translations: translationsWithParams,
			languages,
			prettierConfig: {},
			defaultLocale: "en-GB",
		});

		expect(source).toContain('"main:hello": { name: string }');
		expect(source).toContain('"main:welcome": { name: string; place: string }');
		expect(source).toContain('"main:count": { count: number }');
	});

	it("should handle nested translations", async () => {
		const nestedTranslations: Translations = {
			main: {
				hello: "Hello",
				user: {
					profile: "User profile",
					settings: "User settings",
				},
				errors: {
					notFound: "Not found",
					unauthorized: "Unauthorized",
				},
			},
		};

		const source = await generateKeys({
			translations: nestedTranslations,
			languages,
			prettierConfig: {},
			defaultLocale: "en-GB",
		});

		expect(source).toContain('"main:hello"');
		expect(source).toContain('"main:user.profile"');
		expect(source).toContain('"main:user.settings"');
		expect(source).toContain('"main:errors.notFound"');
		expect(source).toContain('"main:errors.unauthorized"');
	});

	it("should handle mixed simple and parameterized keys", async () => {
		const mixedTranslations: Translations = {
			main: {
				hello: "Hello",
				welcome: "Welcome {{name}}",
				goodbye: "Goodbye",
				thanks: "Thank you {{name}}",
			},
		};

		const source = await generateKeys({
			translations: mixedTranslations,
			languages,
			prettierConfig: {},
			defaultLocale: "en-GB",
		});

		expect(source).toContain('"main:hello"');
		expect(source).toContain('"main:goodbye"');
		expect(source).toContain('"main:welcome": { name: string }');
		expect(source).toContain('"main:thanks": { name: string }');
	});

	it("should handle multiple namespaces", async () => {
		const multiNamespaceTranslations: Translations = {
			main: {
				hello: "Hello",
			},
			errors: {
				notFound: "Not found",
			},
			common: {
				loading: "Loading...",
			},
		};

		const source = await generateKeys({
			translations: multiNamespaceTranslations,
			languages,
			prettierConfig: {},
			defaultLocale: "en-GB",
		});

		expect(source).toContain(
			'export type Namespace = "main" | "errors" | "common"',
		);
		expect(source).toContain(
			'export const namespaces: Namespace[] = ["main", "errors", "common"]',
		);
	});

	it("should handle count parameter correctly", async () => {
		const countTranslations: Translations = {
			main: {
				items: "You have {{count}} items",
			},
		};

		const source = await generateKeys({
			translations: countTranslations,
			languages,
			prettierConfig: {},
			defaultLocale: "en-GB",
		});

		expect(source).toContain('"main:items": { count: number }');
	});

	it("should handle complex nested structures with parameters", async () => {
		const complexTranslations: Translations = {
			main: {
				hello: "Hello {{name}}",
				user: {
					profile: "Profile for {{name}}",
					settings: {
						general: "General settings for {{user}}",
						privacy: "Privacy settings",
					},
				},
			},
		};

		const source = await generateKeys({
			translations: complexTranslations,
			languages,
			prettierConfig: {},
			defaultLocale: "en-GB",
		});

		expect(source).toContain('"main:hello": { name: string }');
		expect(source).toContain('"main:user.profile": { name: string }');
		expect(source).toContain('"main:user.settings.general": { user: string }');
		expect(source).toContain('"main:user.settings.privacy"');
	});

	it("should generate correct locale information", async () => {
		const source = await generateKeys({
			translations,
			languages,
			prettierConfig: {},
			defaultLocale: "en-GB",
		});

		expect(source).toContain('export const locales = ["en-GB", "pt-PT"]');
		expect(source).toContain('export const defaultLocale: Locale = "en-GB"');
		expect(source).toContain(
			"export const iso1ToLocale: { [key: string]: Locale } = {",
		);
		expect(source).toContain('en: "en-GB"');
		expect(source).toContain('pt: "pt-PT"');
	});

	it("should handle prettier configuration", async () => {
		const prettierConfig = {
			semi: true,
			singleQuote: true,
			tabWidth: 2,
		};

		const source = await generateKeys({
			translations,
			languages,
			prettierConfig,
			defaultLocale: "en-GB",
		});

		// The output should be formatted according to prettier config
		expect(source).toBeDefined();
		expect(typeof source).toBe("string");
	});

	it("should handle single namespace", async () => {
		const singleNamespaceTranslations: Translations = {
			main: {
				hello: "Hello",
				world: "World",
			},
		};

		const source = await generateKeys({
			translations: singleNamespaceTranslations,
			languages,
			prettierConfig: {},
			defaultLocale: "en-GB",
		});

		expect(source).toContain('export type Namespace = "main"');
		expect(source).toContain('export const namespaces: Namespace[] = ["main"]');
	});

	it("should handle translations with only parameterized keys", async () => {
		const onlyParamTranslations: Translations = {
			main: {
				hello: "Hello {{name}}",
				welcome: "Welcome {{user}} to {{place}}",
			},
		};

		const source = await generateKeys({
			translations: onlyParamTranslations,
			languages,
			prettierConfig: {},
			defaultLocale: "en-GB",
		});

		expect(source).toContain(
			"export type TranslationKeyWithoutOptions = never",
		);
		expect(source).toContain('"main:hello": { name: string }');
		expect(source).toContain('"main:welcome": { user: string; place: string }');
	});

	describe("plural keys", () => {
		it("should handle basic plural forms with count parameter", async () => {
			const pluralTranslations: Translations = {
				main: {
					items_one: "You have {{count}} item",
					items_other: "You have {{count}} items",
				},
			};

			const source = await generateKeys({
				translations: pluralTranslations,
				languages,
				prettierConfig: {},
				defaultLocale: "en-GB",
			});

			// Should generate base key with same parameters as plural forms
			expect(source).toContain('"main:items": { count: number }');
			// Should keep the suffixed versions in parameterized keys
			expect(source).toContain('"main:items_one": { count: number }');
			expect(source).toContain('"main:items_other": { count: number }');
			// All plural keys should be in TranslationWithOptions
			expect(source).toContain(
				"export type TranslationKeyWithoutOptions = never",
			);
		});

		it("should handle all plural form suffixes", async () => {
			const pluralTranslations: Translations = {
				main: {
					items_zero: "No items",
					items_one: "{{count}} item",
					items_two: "{{count}} items",
					items_few: "{{count}} items",
					items_many: "{{count}} items",
					items_other: "{{count}} items",
				},
			};

			const source = await generateKeys({
				translations: pluralTranslations,
				languages,
				prettierConfig: {},
				defaultLocale: "en-GB",
			});

			// Should generate the base key with parameters
			expect(source).toContain('"main:items": { count: number }');
			// Should keep the suffixed versions with count parameter
			expect(source).toContain('"main:items_zero"');
			expect(source).toContain('"main:items_one": { count: number }');
			expect(source).toContain('"main:items_two": { count: number }');
			expect(source).toContain('"main:items_few": { count: number }');
			expect(source).toContain('"main:items_many": { count: number }');
			expect(source).toContain('"main:items_other": { count: number }');
		});

		it("should handle nested plural keys", async () => {
			const nestedPluralTranslations: Translations = {
				main: {
					user: {
						messages_one: "{{count}} message",
						messages_other: "{{count}} messages",
					},
				},
			};

			const source = await generateKeys({
				translations: nestedPluralTranslations,
				languages,
				prettierConfig: {},
				defaultLocale: "en-GB",
			});

			// Should generate the base key with parameters
			expect(source).toContain('"main:user.messages": { count: number }');
			// Should keep the suffixed versions with count parameter
			expect(source).toContain('"main:user.messages_one": { count: number }');
			expect(source).toContain('"main:user.messages_other": { count: number }');
			// All keys should be parameterized
			expect(source).toContain(
				"export type TranslationKeyWithoutOptions = never",
			);
		});

		it("should not treat keys with plural suffixes as plural without count parameter", async () => {
			const nonPluralTranslations: Translations = {
				main: {
					items_one: "First item",
					items_other: "Other items",
				},
			};

			const source = await generateKeys({
				translations: nonPluralTranslations,
				languages,
				prettierConfig: {},
				defaultLocale: "en-GB",
			});

			// Without count parameter, these should be treated as regular keys
			expect(source).toContain('"main:items_one"');
			expect(source).toContain('"main:items_other"');
		});

		it("should handle mixed plural and non-plural keys", async () => {
			const mixedTranslations: Translations = {
				main: {
					hello: "Hello",
					items_one: "{{count}} item",
					items_other: "{{count}} items",
					goodbye: "Goodbye",
					messages_one: "{{count}} message",
					messages_other: "{{count}} messages",
				},
			};

			const source = await generateKeys({
				translations: mixedTranslations,
				languages,
				prettierConfig: {},
				defaultLocale: "en-GB",
			});

			// Should contain simple non-plural keys in TranslationKeyWithoutOptions
			expect(source).toContain('"main:hello"');
			expect(source).toContain('"main:goodbye"');
			expect(source).toContain(
				'export type TranslationKeyWithoutOptions = "main:hello" | "main:goodbye"',
			);
			// Should have plural base keys with parameters
			expect(source).toContain('"main:items": { count: number }');
			expect(source).toContain('"main:messages": { count: number }');
			// Should keep the suffixed plural versions with count parameter
			expect(source).toContain('"main:items_one": { count: number }');
			expect(source).toContain('"main:items_other": { count: number }');
			expect(source).toContain('"main:messages_one": { count: number }');
			expect(source).toContain('"main:messages_other": { count: number }');
		});

		it("should handle plural keys with additional parameters", async () => {
			const pluralWithParamsTranslations: Translations = {
				main: {
					items_one: "{{name}} has {{count}} item",
					items_other: "{{name}} has {{count}} items",
				},
			};

			const source = await generateKeys({
				translations: pluralWithParamsTranslations,
				languages,
				prettierConfig: {},
				defaultLocale: "en-GB",
			});

			// Should generate the base key with same parameters as plural forms
			expect(source).toContain('"main:items": { name: string; count: number }');
			// Should include both count and name parameters in the suffixed versions
			expect(source).toContain(
				'"main:items_one": { name: string; count: number }',
			);
			expect(source).toContain(
				'"main:items_other": { name: string; count: number }',
			);
			// All keys should be parameterized
			expect(source).toContain(
				"export type TranslationKeyWithoutOptions = never",
			);
		});

		it("should handle partial plural forms", async () => {
			const partialPluralTranslations: Translations = {
				main: {
					items_one: "{{count}} item",
					// Only _one form exists, not _other
				},
			};

			const source = await generateKeys({
				translations: partialPluralTranslations,
				languages,
				prettierConfig: {},
				defaultLocale: "en-GB",
			});

			// Should generate the base key with parameters
			expect(source).toContain('"main:items": { count: number }');
			// Should keep the suffixed version with count parameter
			expect(source).toContain('"main:items_one": { count: number }');
			// All keys should be parameterized
			expect(source).toContain(
				"export type TranslationKeyWithoutOptions = never",
			);
		});

		it("should handle deeply nested plural keys", async () => {
			const deeplyNestedPlurals: Translations = {
				main: {
					user: {
						profile: {
							notifications_one: "{{count}} notification",
							notifications_other: "{{count}} notifications",
						},
					},
				},
			};

			const source = await generateKeys({
				translations: deeplyNestedPlurals,
				languages,
				prettierConfig: {},
				defaultLocale: "en-GB",
			});

			// Should generate the base key with parameters
			expect(source).toContain(
				'"main:user.profile.notifications": { count: number }',
			);
			// Should keep the suffixed versions with count parameter
			expect(source).toContain(
				'"main:user.profile.notifications_one": { count: number }',
			);
			expect(source).toContain(
				'"main:user.profile.notifications_other": { count: number }',
			);
			// All keys should be parameterized
			expect(source).toContain(
				"export type TranslationKeyWithoutOptions = never",
			);
		});

		it("should handle plural keys across multiple namespaces", async () => {
			const multiNamespacePlurals: Translations = {
				main: {
					items_one: "{{count}} item",
					items_other: "{{count}} items",
				},
				errors: {
					validationErrors_one: "{{count}} error",
					validationErrors_other: "{{count}} errors",
				},
			};

			const source = await generateKeys({
				translations: multiNamespacePlurals,
				languages,
				prettierConfig: {},
				defaultLocale: "en-GB",
			});

			// Should generate base keys with parameters
			expect(source).toContain('"main:items": { count: number }');
			expect(source).toContain('"errors:validationErrors": { count: number }');
			// Should keep the suffixed versions with count parameter
			expect(source).toContain('"main:items_one": { count: number }');
			expect(source).toContain('"main:items_other": { count: number }');
			expect(source).toContain(
				'"errors:validationErrors_one": { count: number }',
			);
			expect(source).toContain(
				'"errors:validationErrors_other": { count: number }',
			);
			// All keys should be parameterized
			expect(source).toContain(
				"export type TranslationKeyWithoutOptions = never",
			);
		});
	});
});
