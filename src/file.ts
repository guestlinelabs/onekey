import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import mkdirp from "mkdirp";
import prettier from "prettier";
import { z } from "zod";

import {
	LanguageInfo,
	type Project,
	TranslationSchema,
	fetchTranslations,
} from "./fetch-translations";
import { generateKeys } from "./generate-translation-keys";

const writeJSON = async (
	prettierConfig: prettier.Options,
	folder: string,
	fileName: string,
	content: Record<string, unknown> | unknown[],
): Promise<void> => {
	const pathToFile = path.resolve(folder, fileName);
	const fileContent = JSON.stringify(content, null, 2);
	const filePrettified = await prettier.format(fileContent, {
		...prettierConfig,
		parser: "json",
	});

	await mkdirp(folder);
	await writeFile(pathToFile, filePrettified, "utf-8");
};

const parseJSON = <T extends z.ZodTypeAny>(
	type: T,
	input: string,
): z.output<T> => {
	return type.parse(JSON.parse(input));
};

export const readJSON = async <T extends z.ZodTypeAny>(
	type: T,
	path: string,
): Promise<z.output<T>> => {
	const content = await readFile(path, "utf-8");

	return parseJSON(type, content);
};

export async function saveTranslations({
	oneSkyApiKey,
	oneSkySecret,
	projects,
	translationsPath,
	prettierConfigPath,
}: {
	projects: Project[];
	prettierConfigPath?: string;
	translationsPath: string;
	oneSkySecret: string;
	oneSkyApiKey: string;
}): Promise<void> {
	const { languages, translations: projectTranslations } =
		await fetchTranslations({
			apiKey: oneSkyApiKey,
			projects: projects,
			secret: oneSkySecret,
		});

	const prettierConfig = await getPrettierConfig(prettierConfigPath);

	await mkdirp(translationsPath);
	await writeJSON(
		prettierConfig,
		translationsPath,
		"languages.json",
		languages,
	);

	for (const translations of projectTranslations) {
		for (const [fileName, translation] of Object.entries(translations)) {
			for (const [languageCode, value] of Object.entries(translation)) {
				const translationsLanguagePath = path.join(
					translationsPath,
					languageCode,
				);
				await mkdirp(translationsLanguagePath);
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
	translationsPath,
	translationKeysPath,
	defaultLocale = "en-GB",
	prettierConfigPath,
}: {
	translationsPath: string;
	translationKeysPath: string;
	defaultLocale: string;
	prettierConfigPath?: string;
}): Promise<void> {
	const languagesPath = path.resolve(translationsPath, "languages.json");
	const translationsLocalePath = path.resolve(translationsPath, defaultLocale);
	const outPath = path.resolve(translationKeysPath, "translation.ts");

	const fileNames = await readdir(translationsLocalePath);
	const prettierConfig = await getPrettierConfig(prettierConfigPath);
	const languages = await readJSON(z.array(LanguageInfo), languagesPath);
	const translations = await readTranslations({
		fileNames,
		translationsLocalePath,
	});
	const content = await generateKeys({
		languages,
		prettierConfig,
		translations,
		defaultLocale,
	});

	await writeFile(outPath, content, "utf-8");
}
