import { readFile, readdir } from "node:fs/promises";
import { type State, diffState, loadState, saveState, touch } from "./state";
import type {
	AiResponse,
	LanguageInfo,
	ProjectTranslations,
	TranslationConfig,
	TranslationOutput,
	TranslationSchema,
} from "./types";

type GenericTranslations = Record<string, string>;

export async function translate(options: {
	path: string;
	context?: string;
	baseLocale?: string;
	tone?: string;
	apiUrl: string;
	apiKey?: string;
	updateAll?: boolean;
	stats?: boolean;
}): Promise<TranslationOutput> {
	const {
		path,
		context = "",
		tone = "formal",
		apiUrl,
		apiKey,
		updateAll = false,
		stats = false,
	} = options;

	if (!apiUrl || !apiKey) {
		throw new Error("Missing required parameters: apiUrl or apiKey");
	}

	const statePath = `${path}/state.json`;
	const languages = await loadJsonFile<LanguageInfo[]>(
		`${path}/languages.json`,
	);
	const defaultLanguage = findDefaultLanguage(languages, options.baseLocale);
	const state = await loadState(statePath, defaultLanguage.code);

	if (stats) {
		const diffs = diffState(state);
		const statsByLocale = diffs.reduce(
			(acc, diff) => {
				acc[diff.locale] = (acc[diff.locale] || 0) + 1;
				return acc;
			},
			{} as Record<string, number>,
		);

		console.log("Stale translations by locale:");
		for (const [locale, count] of Object.entries(statsByLocale)) {
			console.log(`  ${locale}: ${count} stale keys`);
		}
	}

	const translations = await translateViaAi({
		translationsFolder: path,
		defaultLanguage,
		apiUrl,
		apiKey,
		context,
		tone,
		updateAll,
		stats,
		state,
	});

	await saveState(statePath, state);

	return { languages, translations: [translations] };
}

function findDefaultLanguage(
	languages: LanguageInfo[],
	baseLocale?: string,
): LanguageInfo {
	const defaultLanguage = languages.find(
		(language) =>
			(baseLocale && language.code === baseLocale) || language.default === true,
	);

	if (!defaultLanguage) {
		throw new Error("No default language found");
	}

	return defaultLanguage;
}

async function translateViaAi({
	apiUrl,
	apiKey,
	translationsFolder,
	defaultLanguage,
	context,
	tone,
	updateAll,
	stats,
	state,
}: {
	translationsFolder: string;
	defaultLanguage: LanguageInfo;
	apiUrl: string;
	apiKey: string;
	context: string;
	tone: string;
	updateAll?: boolean;
	stats?: boolean;
	state: State;
}): Promise<ProjectTranslations> {
	const languages = await loadJsonFile<LanguageInfo[]>(
		`${translationsFolder}/languages.json`,
	);
	const otherLanguages = languages.filter(
		(lang) => lang.code !== defaultLanguage.code,
	);
	const defaultLanguageFiles = await readdir(
		`${translationsFolder}/${defaultLanguage.code}`,
	);

	const result: ProjectTranslations = {};

	for (const file of defaultLanguageFiles) {
		result[file] = await translateFile({
			file,
			translationsFolder,
			defaultLanguage,
			otherLanguages,
			apiUrl,
			apiKey,
			context,
			tone,
			updateAll,
			state,
		});
	}

	return result;
}

async function translateFile({
	file,
	translationsFolder,
	defaultLanguage,
	otherLanguages,
	apiUrl,
	apiKey,
	context,
	tone,
	updateAll,
	state,
}: {
	file: string;
	translationsFolder: string;
	defaultLanguage: LanguageInfo;
	otherLanguages: LanguageInfo[];
	apiUrl: string;
	apiKey: string;
	context: string;
	tone: string;
	updateAll?: boolean;
	state: State;
}): Promise<Record<string, GenericTranslations>> {
	const defaultLanguageContent = await loadJsonFile<GenericTranslations>(
		`${translationsFolder}/${defaultLanguage.code}/${file}`,
	);
	const result: Record<string, GenericTranslations> = {
		[defaultLanguage.code]: defaultLanguageContent,
	};

	const namespace = file.replace(".json", "");
	const flatKeys = flattenKeys(defaultLanguageContent, namespace);
	const now = new Date();

	for (const key of flatKeys) {
		touch(state, defaultLanguage.code, key, now);
	}

	await Promise.all(
		otherLanguages.map(async (targetLanguage) => {
			result[targetLanguage.code] = await translateToLanguage({
				file,
				translationsFolder,
				targetLanguage,
				defaultLanguage,
				defaultContent: defaultLanguageContent,
				apiUrl,
				apiKey,
				context,
				tone,
				updateAll,
				state,
				namespace,
			});
		}),
	);

	return result;
}

async function translateToLanguage({
	file,
	translationsFolder,
	targetLanguage,
	defaultLanguage,
	defaultContent,
	apiUrl,
	apiKey,
	context,
	tone,
	updateAll,
	state,
	namespace,
}: {
	file: string;
	translationsFolder: string;
	targetLanguage: LanguageInfo;
	defaultLanguage: LanguageInfo;
	defaultContent: GenericTranslations;
	apiUrl: string;
	apiKey: string;
	context: string;
	tone: string;
	updateAll?: boolean;
	state: State;
	namespace: string;
}): Promise<GenericTranslations> {
	const existingTranslations = await loadExistingTranslations(
		`${translationsFolder}/${targetLanguage.code}/${file}`,
	);

	let missingTranslations: GenericTranslations;
	if (updateAll) {
		missingTranslations = defaultContent;
	} else {
		missingTranslations = getMissingTranslations(
			defaultContent,
			existingTranslations,
		);
	}

	if (Object.keys(missingTranslations).length === 0) {
		return existingTranslations;
	}

	const translatedContent = await translateMissingContent({
		missingTranslations,
		targetLanguage,
		defaultLanguage,
		apiUrl,
		apiKey,
		context,
		tone,
	});

	const flatTranslatedKeys = flattenKeys(translatedContent, namespace);
	const now = new Date();
	for (const key of flatTranslatedKeys) {
		touch(state, targetLanguage.code, key, now);
	}

	const result = { ...existingTranslations, ...translatedContent };

	console.log(
		`Finished translating ${file} for ${targetLanguage.code}. ${
			Object.keys(missingTranslations).length
		} keys added`,
	);

	return result;
}

async function translateOneSky(
	config: TranslationConfig,
	content: GenericTranslations,
): Promise<GenericTranslations> {
	const completionsUrl = `${config.apiUrl.replace(/\/$/, "")}/chat/completions`;

	try {
		const response = await fetch(completionsUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"api-key": config.apiKey,
			},
			body: JSON.stringify({
				temperature: 1,
				max_tokens: 4096,
				user: `translation-automation-${config.originalLanguageCode}-${config.targetLanguageCode}`,
				response_format: { type: "json_object" },
				messages: buildTranslationPrompt(config, content),
			}),
		});

		if (!response.ok) {
			throw new Error(`API request failed: ${response.statusText}`);
		}

		const aiResponse = (await response.json()) as AiResponse;

		if (aiResponse.choices.length === 0) {
			throw new Error("AI was not able to analyse the text");
		}

		return JSON.parse(aiResponse.choices[0].message.content);
	} catch (error) {
		console.error("Translation failed:", error);
		return {};
	}
}

async function loadJsonFile<T>(path: string): Promise<T> {
	try {
		const fileStream = await readFile(path, "utf-8");
		return JSON.parse(fileStream);
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			throw new Error(`File not found: ${path}`);
		}
		throw error;
	}
}

async function loadExistingTranslations(
	path: string,
): Promise<GenericTranslations> {
	try {
		return await loadJsonFile(path);
	} catch (error) {
		return {};
	}
}

function getMissingTranslations(
	defaultContent: GenericTranslations,
	existingTranslations: GenericTranslations,
): GenericTranslations {
	return Object.entries(defaultContent).reduce((acc, [key, value]) => {
		if (!(key in existingTranslations)) {
			acc[key] = value;
		}
		return acc;
	}, {} as GenericTranslations);
}

async function translateMissingContent({
	missingTranslations,
	targetLanguage,
	defaultLanguage,
	apiUrl,
	apiKey,
	context,
	tone,
}: {
	missingTranslations: GenericTranslations;
	targetLanguage: LanguageInfo;
	defaultLanguage: LanguageInfo;
	apiUrl: string;
	apiKey: string;
	context: string;
	tone: string;
}): Promise<GenericTranslations> {
	const chunks = splitIntoChunks(missingTranslations, 100);
	let result = {};

	for (const chunk of chunks) {
		const translation = await translateOneSky(
			{
				apiUrl,
				apiKey,
				targetLanguageCode: targetLanguage.code,
				originalLanguageCode: defaultLanguage.code,
				context,
				tone,
			},
			chunk,
		);
		result = { ...result, ...translation };
	}

	return result;
}

function splitIntoChunks(
	obj: GenericTranslations,
	chunkSize: number,
): GenericTranslations[] {
	return Object.keys(obj).reduce((chunks: GenericTranslations[], _, index) => {
		if (index % chunkSize === 0) {
			const chunkKeys = Object.keys(obj).slice(index, index + chunkSize);
			chunks.push(
				chunkKeys.reduce((acc, key) => {
					acc[key] = obj[key];
					return acc;
				}, {} as GenericTranslations),
			);
		}
		return chunks;
	}, []);
}

function flattenKeys(obj: any, namespace: string, prefix = ""): string[] {
	const keys: string[] = [];

	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		const namespacedKey = `${namespace}.${fullKey}`;

		if (typeof value === "string") {
			keys.push(namespacedKey);
		} else if (typeof value === "object" && value !== null) {
			keys.push(...flattenKeys(value, namespace, fullKey));
		}
	}

	return keys;
}

function buildTranslationPrompt(
	config: TranslationConfig,
	content: GenericTranslations,
): Array<{ role: string; content: string }> {
	const tonePrompt = (() => {
		switch (config.tone) {
			case "formal":
				return `Use ${config.tone} language, be polite and succinct`;
			case "informal":
				return `Use ${config.tone} language, be informal and succinct`;
			default:
				return `Use ${config.tone} language, be polite and succinct`;
		}
	})();

	return [
		{
			role: "system",
			content: `You are a highly skilled translator with expertise in many languages. Your task is to accurately translate from ${config.originalLanguageCode} to ${config.targetLanguageCode} while preserving the meaning, tone, and nuance of the original text. Please maintain proper grammar, spelling, and punctuation in the translated version.`,
		},
		{
			role: "system",
			content:
				"Translate only the value, never change the key. Words wrapped between {{}} are variables and should not be translated.",
		},
		{
			role: "system",
			content: `${tonePrompt}. Try to keep the length of the translation as close as possible to the original text.`,
		},
		{
			role: "system",
			content:
				'You reply only with a RFC8259 compliant JSON following this format without deviation: {"_key": "_value"} based on a JSON to translate. Do not include any other text or comments.',
		},
		{
			role: "system",
			content: `Example of valid responses: Text to translate: { "link_text": "Link text", "invalid_email_error": "Invalid email format" } Original language: "en-GB" Target language: "fr-FR" Response: { "link_text": "Texte du lien", "invalid_email_error": "Format email invalide" }`,
		},
		config.context
			? {
					role: "system",
					content: `Here is some additional context for the translations: ${config.context}`,
				}
			: undefined,
		{ role: "user", content: JSON.stringify(content) },
	].filter((item) => item !== undefined);
}
