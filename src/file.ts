import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import prettier from "prettier";
import allLanguages from "./language-codes.json";

import { generateKeys } from "./generate-translation-keys";
import {
	createState,
	diffState,
	getLanguagesInfo,
	loadState,
	saveState,
	touch,
} from "./state";
import { translate } from "./translate";
import { TranslationSchema } from "./types";
import { readJSON, writeJSON } from "./utils";

export async function initializeState({
	translationsPath,
	baseLocale,
	generateKeys = true,
}: {
	translationsPath: string;
	baseLocale: string;
	generateKeys?: boolean;
}): Promise<void> {
	const existingState = await loadState().catch((err) => {
		if (err instanceof Error && err.message.includes("ENOENT")) {
			return undefined;
		}
		throw err;
	});
	if (existingState) {
		console.log(
			chalk.yellow("Translation state already exists for this project"),
		);
		return;
	}

	const state = await createState({
		baseLocale,
		translationsPath,
		generateKeys,
	});
	const otherLocales = (
		await readdir(translationsPath, { withFileTypes: true })
			.then((files) => files.filter((f) => f.isDirectory()).map((f) => f.name))
			.catch(async () => {
				await mkdir(translationsPath, { recursive: true });
				return [];
			})
	).filter((locale) => locale !== baseLocale);

	const baseLocalePath = path.join(translationsPath, baseLocale);
	const now = new Date();

	try {
		const fileNames = await readdir(baseLocalePath).catch(async () => {
			await mkdir(baseLocalePath, { recursive: true });
			return [];
		});

		for (const fileName of fileNames.filter((f) => f.endsWith(".json"))) {
			const filePath = path.join(baseLocalePath, fileName);
			const content = await readJSON(TranslationSchema, filePath);
			const namespace = fileName.replace(".json", "");

			const flatEntries = flattenKeysWithValues(content, namespace);
			for (const { key, value } of flatEntries) {
				touch(state, baseLocale, key, now, value);
				for (const locale of otherLocales) {
					touch(state, locale, key, now);
				}
			}
		}

		await saveState(state);

		console.log(chalk.green(`✓ Initialized state tracking for ${baseLocale}`));
	} catch (error) {
		throw new Error(`Failed to initialize state: ${error}`);
	}
}

export async function syncState(): Promise<number> {
	try {
		const state = await loadState().catch((err) => {
			if (err instanceof Error && err.message.includes("ENOENT")) {
				return undefined;
			}
			throw err;
		});
		if (!state) {
			console.log(chalk.yellow("No translation state found for this project"));
			return 1;
		}

		// Check for new untracked keys in base language and initialize them
		const translationsPath = path.join(process.cwd(), state.translationsPath);
		const baseLocale = state.baseLocale;
		const baseLocalePath = path.join(translationsPath, baseLocale);
		const now = new Date();

		try {
			const prettierConfig = await getPrettierConfig();
			// Get base language files to know what files should exist in other languages
			const baseFileNames = await readdir(baseLocalePath)
				.then((files) => files.filter((f) => f.endsWith(".json")))
				.catch(async () => {
					await mkdir(baseLocalePath, { recursive: true });
					return [];
				});

			// Check for new keys in base language
			let hasNewKeys = false;
			let hasUpdatedKeys = false;
			const baseLocaleKeysFromFiles = new Set<string>();
			for (const fileName of baseFileNames) {
				const filePath = path.join(baseLocalePath, fileName);
				const content = await readJSON(TranslationSchema, filePath);
				const namespace = fileName.replace(".json", "");

				const flatEntries = flattenKeysWithValues(content, namespace);
				for (const { key, value } of flatEntries) {
					baseLocaleKeysFromFiles.add(key);
					// Check if this key exists in the state for the base locale
					const baseLocaleEntry = state.locales.find(
						(loc) => loc.code === baseLocale,
					);
					const existingKey = baseLocaleEntry?.keys[key];

					if (!existingKey) {
						// This is a new untracked key - initialize it
						touch(state, baseLocale, key, now, value);
						hasNewKeys = true;
					} else if (value && existingKey.current !== value) {
						// This is an existing key with a new value
						touch(state, baseLocale, key, now, value);
						hasUpdatedKeys = true;
					}
				}
			}

			// Remove keys that no longer exist in base locale files
			let hasRemovedKeys = false;
			const removedKeys = new Set<string>();
			const baseLocaleEntry = state.locales.find(
				(loc) => loc.code === baseLocale,
			);
			if (baseLocaleEntry) {
				for (const existingKey of Object.keys(baseLocaleEntry.keys)) {
					if (!baseLocaleKeysFromFiles.has(existingKey)) {
						delete baseLocaleEntry.keys[existingKey];
						// Remove from all other locales
						for (const localeEntry of state.locales) {
							if (localeEntry.code !== baseLocale && localeEntry.keys) {
								delete localeEntry.keys[existingKey];
							}
						}
						removedKeys.add(existingKey);
						hasRemovedKeys = true;
					}
				}
			}

			// Check for new languages and their keys
			const allLocales = await readdir(translationsPath, {
				withFileTypes: true,
			})
				.then((files) =>
					files
						.filter((f) => f.isDirectory())
						.map((f) => f.name)
						.filter((f) => f !== baseLocale),
				)
				.catch(async () => {
					await mkdir(translationsPath, { recursive: true });
					return [];
				});

			let hasNewLanguages = false;
			for (const locale of allLocales) {
				const localeEntry = state.locales.find((loc) => loc.code === locale);
				if (!localeEntry) {
					// This is a new language - initialize it
					const languageInfo = allLanguages.find((l) => l.code === locale);
					if (languageInfo) {
						state.locales.push({
							code: locale,
							englishName: languageInfo.englishName,
							localName: languageInfo.localName,
							keys: {},
						});
					}
					hasNewLanguages = true;
					console.log(chalk.blue(`Found new language: ${locale}`));
				}

				// Check if this language has the same files as base language
				const localePath = path.join(translationsPath, locale);
				// Attempt to read the files for this locale. If the directory does not
				// exist we treat it as having no files. In tests the mocked readdir can
				// return undefined, so we also coerce that case to an empty array so the
				// rest of the logic can continue safely.
				let localeFileNames = await readdir(localePath).catch(
					() => [] as string[],
				);
				if (!Array.isArray(localeFileNames)) {
					localeFileNames = [];
				}

				for (const fileName of baseFileNames.filter((f) =>
					f.endsWith(".json"),
				)) {
					const namespace = fileName.replace(".json", "");

					// Check if this file exists in the new language
					if (!localeFileNames.includes(fileName)) {
						console.log(
							chalk.yellow(
								`Missing file ${fileName} in language ${locale}, creating it...`,
							),
						);
						await writeJSON(prettierConfig, localePath, fileName, {});
						continue;
					}

					// Read the file and check for keys
					const filePath = path.join(localePath, fileName);
					const content = await readJSON(TranslationSchema, filePath);
					const flatEntries = flattenKeysWithValues(content, namespace);

					for (const { key, value } of flatEntries) {
						// Skip keys that were just removed from the base locale
						if (removedKeys.has(key)) {
							continue;
						}

						// Check if this key exists in the state for this locale
						const existingKey = localeEntry?.keys?.[key];

						if (!existingKey) {
							// This is a new key for this locale - initialize it
							touch(state, locale, key, now, value);
							hasNewKeys = true;
						}
					}
				}
			}

			// If we found new keys or languages, or removed obsolete ones, save the updated state
			if (hasNewKeys || hasNewLanguages || hasUpdatedKeys || hasRemovedKeys) {
				await saveState(state);
				if (hasNewKeys) {
					console.log(chalk.green("✓ Initialized new untracked keys"));
				}
				if (hasNewLanguages) {
					console.log(chalk.green("✓ Initialized new languages"));
				}
				if (hasUpdatedKeys) {
					console.log(chalk.green("✓ Updated keys in base locale"));
				}
				if (hasRemovedKeys) {
					console.log(chalk.green("✓ Removed obsolete keys"));
				}
			}
		} catch (error) {
			console.warn(
				chalk.yellow(
					`Warning: Could not check for new keys in base language: ${error}`,
				),
			);
		}

		// Generate translation keys if enabled
		if (state.generateKeys !== false) {
			try {
				await saveKeys({
					translationKeysPath: undefined,
					prettierConfigPath: undefined,
				});
				console.log(chalk.green("✓ Generated translation.ts"));
			} catch (error) {
				// Only warn if it's not an expected "no files" case
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				if (
					!errorMessage.includes("ENOENT") &&
					!errorMessage.includes("no such file")
				) {
					console.warn(
						chalk.yellow(
							`Warning: Could not generate translation keys: ${errorMessage}`,
						),
					);
				}
			}
		}

		const diffs = diffState(state) ?? [];

		if (diffs.length === 0) {
			console.log(chalk.green("✓ All translations are up to date."));
			return 0;
		}

		console.log(chalk.yellow("Found stale translations:"));
		for (const diff of diffs) {
			console.log(
				chalk.red(
					`  [${diff.locale}] ${diff.key}: base=${diff.baseTs}, locale=${diff.localeTs}`,
				),
			);
		}

		return 1;
	} catch (error) {
		console.error(chalk.red(`Error syncing state: ${error}`));
		return 1;
	}
}

export async function checkStatus(): Promise<number> {
	try {
		const state = await loadState().catch((err) => {
			if (err instanceof Error && err.message.includes("ENOENT")) {
				return undefined;
			}
			throw err;
		});
		if (!state) {
			console.log(chalk.yellow("No translation state found for this project"));
			return 1;
		}

		const diffs = diffState(state) ?? [];

		if (diffs.length === 0) {
			console.log(chalk.green("✓ All translations are up to date."));
			return 0;
		}

		console.log(chalk.yellow("Found stale translations:"));
		for (const diff of diffs) {
			console.log(
				chalk.red(
					`  [${diff.locale}] ${diff.key}: base=${diff.baseTs}, locale=${diff.localeTs}`,
				),
			);
		}

		return 1;
	} catch (error) {
		console.error(chalk.red(`Error checking status: ${error}`));
		return 1;
	}
}

function flattenKeysWithValues(
	obj: any,
	namespace: string,
	prefix = "",
): Array<{ key: string; value: string }> {
	const entries: Array<{ key: string; value: string }> = [];

	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		const namespacedKey = `${namespace}.${fullKey}`;

		if (typeof value === "string") {
			entries.push({ key: namespacedKey, value });
		} else if (typeof value === "object" && value !== null) {
			entries.push(...flattenKeysWithValues(value, namespace, fullKey));
		}
	}

	return entries;
}

async function getPrettierConfig(
	configPath = process.cwd(),
): Promise<prettier.Options> {
	return (await prettier.resolveConfig(configPath)) ?? ({} as prettier.Options);
}

async function readTranslations(config: {
	fileNames: string[];
	translationsLocalePath: string;
}): Promise<Record<string, TranslationSchema>> {
	return Object.fromEntries(
		await Promise.all(
			config.fileNames.map(async (fileName) => {
				const schema = await readJSON(
					TranslationSchema,
					path.join(config.translationsLocalePath, fileName),
				);
				return [fileName, schema] as const;
			}),
		),
	);
}

export async function saveKeys({
	translationKeysPath,
	prettierConfigPath,
}: {
	translationKeysPath?: string;
	prettierConfigPath?: string;
}): Promise<void> {
	const state = await loadState();
	const translationsPath = path.join(process.cwd(), state.translationsPath);
	const defaultLocale = state.baseLocale;

	const translationsLocalePath = path.resolve(translationsPath, defaultLocale);
	const outPath = path.resolve(
		translationKeysPath ?? translationsPath,
		"translation.ts",
	);

	const fileNames = await readdir(translationsLocalePath);
	const prettierConfig = await getPrettierConfig(prettierConfigPath);
	// const languages = await readJSON(z.array(LanguageInfo), languagesPath);
	const translations = await readTranslations({
		fileNames,
		translationsLocalePath,
	});
	const languages = getLanguagesInfo(state);

	const content = await generateKeys({
		languages,
		prettierConfig,
		translations,
		defaultLocale,
	});

	await writeFile(outPath, content, "utf-8");
}

export async function saveAiTranslations({
	prettierConfigPath,
	context,
	tone,
	apiUrl,
	apiKey,
	apiModel,
	updateAll,
	stats,
	onProgress,
}: {
	prettierConfigPath?: string;
	context?: string;
	tone?: string;
	apiUrl: string;
	apiKey: string;
	onProgress?: (progress: { done: number; total: number }) => void;
	apiModel?: string;
	updateAll?: boolean;
	stats?: boolean;
}): Promise<void> {
	let contextContent: string | undefined = undefined;
	if (context) {
		try {
			contextContent = await readFile(context, "utf-8");
		} catch (err) {
			throw Error(`Error reading context file: ${context}`);
		}
	}
	const state = await loadState();
	const translationsPath = path.join(process.cwd(), state.translationsPath);
	const baseLocale = state.baseLocale;

	const { languages, translations: projectTranslations } = await translate({
		path: translationsPath,
		context: contextContent,
		tone,
		apiUrl,
		apiKey,
		model: apiModel,
		baseLocale,
		updateAll,
		stats,
		onProgress,
	});

	const prettierConfig = await getPrettierConfig(prettierConfigPath);

	await mkdir(translationsPath, { recursive: true });

	for (const translations of projectTranslations) {
		for (const [fileName, translation] of Object.entries(translations)) {
			for (const [languageCode, value] of Object.entries(translation)) {
				const translationsLanguagePath = path.join(
					translationsPath,
					languageCode,
				);
				await mkdir(translationsLanguagePath, { recursive: true });
				await writeJSON(
					prettierConfig,
					translationsLanguagePath,
					fileName,
					value,
				);
			}
		}
	}
}
