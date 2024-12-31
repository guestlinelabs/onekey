import { z } from "zod";
import * as onesky from "./onesky";

// From: https://stackoverflow.com/questions/38213668/promise-retry-design-patterns
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const retryOperation = (
	operation: () => Promise<TranslationFile>,
	delay: number,
	retries: number,
): Promise<TranslationFile> =>
	new Promise((resolve, reject) => {
		return operation()
			.then(resolve)
			.catch((reason) => {
				if (retries > 0) {
					console.log("Attempting to retry fetching translations");
					return wait(delay)
						.then(retryOperation.bind(null, operation, delay, retries - 1))
						.then(resolve)
						.catch(reject);
				}
				return reject(reason);
			});
	});

const mapKeys = <A>(
	f: (key: string) => string,
	r: Record<string, A>,
): Record<string, A> => {
	return Object.fromEntries(
		Object.entries(r).map(([key, value]) => [f(key), value]),
	);
};

const languageCodeMapping: { [key: string]: string } = {
	es: "es-ES",
	it: "it-IT",
	fr: "fr-FR",
	de: "de-DE",
	nl: "nl-NL",
	en: "en-GB",
	th: "th-TH",
	nn: "nn-NO",
	da: "da-DK",
};

export const LanguageInfo = z.object({
	code: z.string(),
	englishName: z.string(),
	localName: z.string(),
});
export type LanguageInfo = z.infer<typeof LanguageInfo>;

export const TranslationSchema = z.record(
	z.string(),
	z.union([z.string(), z.record(z.string(), z.string())]),
);
export type TranslationSchema = z.infer<typeof TranslationSchema>;

interface TranslationFile {
	[languageCode: string]: TranslationSchema;
}

export interface ProjectTranslations {
	[fileName: string]: TranslationFile;
}

export interface TranslationOptions {
	languages: LanguageInfo[];
	translations: ReadonlyArray<ProjectTranslations>;
}

function getLanguageCode(code: string): string {
	if (/[a-z]{2}-[A-Z]{2}/.test(code)) {
		return code;
	}
	if (languageCodeMapping[code]) {
		return languageCodeMapping[code];
	}
	throw new Error(`Language not localized: ${code}`);
}

async function getLanguages({
	apiKey,
	secret,
	projectId,
}: {
	apiKey: string;
	secret: string;
	projectId: number;
}): Promise<LanguageInfo[]> {
	const languages = await onesky.getLanguages({ apiKey, projectId, secret });

	return languages
		.filter((language) => language.is_ready_to_publish)
		.map((language) => {
			const localName = (() => {
				switch (language.local_name) {
					// For some reason this one in OneSky is left in english
					case "Simplified Chinese":
						return "中文";
					default:
						return language.local_name;
				}
			})();

			return {
				code: getLanguageCode(language.code),
				englishName: language.english_name,
				localName,
			};
		});
}

async function getFile({
	apiKey,
	secret,
	projectId,
	fileName,
	languages,
}: {
	apiKey: string;
	secret: string;
	projectId: number;
	fileName: string;
	languages: LanguageInfo[];
}): Promise<{
	[languageCode: string]: TranslationSchema;
}> {
	const file = await retryOperation(
		() =>
			onesky.getFile({
				apiKey,
				fileName,
				projectId,
				secret,
				languages,
			}),
		5000,
		3,
	);

	return mapKeys(getLanguageCode, file);
}

async function getProjectFiles({
	apiKey,
	secret,
	projectId,
	files,
	languages,
}: {
	apiKey: string;
	secret: string;
	projectId: number;
	files: string[];
	languages: LanguageInfo[];
}): Promise<ProjectTranslations> {
	return Object.fromEntries(
		await Promise.all(
			files.map((fileName) =>
				getFile({ fileName, projectId, apiKey, secret, languages }).then(
					(x) => [fileName, x] as const,
				),
			),
		),
	);
}

export interface Project {
	id: number;
	files: string[];
}

export interface FetchTranslationsConfiguration {
	apiKey: string;
	secret: string;
	projects: Project[];
}

export async function fetchTranslations({
	apiKey,
	secret,
	projects,
}: FetchTranslationsConfiguration): Promise<TranslationOptions> {
	if (projects.length === 0) {
		throw Error("You have to at least pass one project to process");
	}

	const languages = await getLanguages({
		projectId: projects[0].id,
		apiKey,
		secret,
	});
	const translations = await Promise.all(
		projects.map(({ files, id }) =>
			getProjectFiles({ projectId: id, files, apiKey, secret, languages }),
		),
	);

	return { languages, translations };
}
