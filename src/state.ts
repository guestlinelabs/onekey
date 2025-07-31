import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import languages from "./language-codes.json";
import type { LanguageInfo } from "./types";

export type NamespacedKey = string;

export const KeyMeta = z.object({
	current: z.string().optional(),
	lastModified: z.string(),
});
export type KeyMeta = z.infer<typeof KeyMeta>;

export const State = z.object({
	version: z.enum(["0"]),
	baseLocale: z.string(),
	translationsPath: z.string(),
	locales: z.array(
		z.object({
			code: z.string(),
			englishName: z.string(),
			localName: z.string(),
			keys: z.record(z.string(), KeyMeta),
		}),
	),
});
export type State = z.infer<typeof State>;

export function getLanguagesInfo(state: State): LanguageInfo[] {
	return state.locales.map((locale) => ({
		code: locale.code,
		englishName: locale.englishName,
		localName: locale.localName,
	}));
}

export async function loadState(statePath: string): Promise<State | undefined> {
	try {
		const content = await readFile(statePath, "utf-8");
		return State.parse(JSON.parse(content));
	} catch (err) {
		if (err instanceof Error && err.message.includes("ENOENT")) {
			return undefined;
		}
		throw err;
	}
}

export async function loadOrCreateState({
	statePath,
	baseLocale,
	translationsPath,
}: {
	statePath: string;
	baseLocale: string;
	translationsPath: string;
}): Promise<State> {
	const state = await loadState(statePath);
	if (state) return state;

	return {
		version: "0",
		baseLocale,
		translationsPath,
		locales: [],
	};
}

export async function saveState(
	statePath: string,
	state: State,
): Promise<void> {
	await writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
}

export function touch(
	state: State,
	locale: string,
	key: NamespacedKey,
	date = new Date(),
	current?: string,
): void {
	const localeEntry = state.locales.find((loc) => loc.code === locale);

	const newMeta: KeyMeta = {
		lastModified: date.toISOString(),
		...(current !== undefined ? { current } : {}),
	};

	if (!localeEntry) {
		state.locales.push({
			code: locale,
			englishName:
				languages.find((lang) => lang.code === locale)?.englishName ?? "",
			localName:
				languages.find((lang) => lang.code === locale)?.localName ?? "",
			keys: { [key]: newMeta },
		});
		return;
	}

	const existingMeta = localeEntry.keys[key];

	if (!existingMeta) {
		// Key does not exist yet for this locale
		localeEntry.keys[key] = newMeta;
		return;
	}

	if (current !== undefined && existingMeta.current !== current) {
		// Translation changed – update timestamp and stored translation
		localeEntry.keys[key] = {
			...existingMeta,
			current,
			lastModified: date.toISOString(),
		};
	} else if (current === undefined) {
		// No translation supplied – just bump the timestamp
		localeEntry.keys[key] = {
			...existingMeta,
			lastModified: date.toISOString(),
		};
	}
}

export function isStale(
	state: State,
	baseLocale: string,
	locale: string,
	key: NamespacedKey,
): boolean {
	const baseEntry = state.locales.find((loc) => loc.code === baseLocale)?.keys[
		key
	];
	const localeEntry = state.locales.find((loc) => loc.code === locale)?.keys[
		key
	];

	if (!baseEntry) return false;
	if (!localeEntry) return true;

	return new Date(baseEntry.lastModified) > new Date(localeEntry.lastModified);
}

export function diffState(state: State): Array<{
	locale: string;
	key: NamespacedKey;
	baseTs: string;
	localeTs: string | "missing";
}> {
	const diffs: Array<{
		locale: string;
		key: NamespacedKey;
		baseTs: string;
		localeTs: string | "missing";
	}> = [];

	const baseLocaleEntry = state.locales.find(
		(loc) => loc.code === state.baseLocale,
	);
	if (!baseLocaleEntry) return diffs;

	for (const localeEntry of state.locales) {
		if (localeEntry.code === state.baseLocale) continue;

		for (const [key, meta] of Object.entries(baseLocaleEntry.keys)) {
			if (isStale(state, state.baseLocale, localeEntry.code, key)) {
				const localeKeyEntry = localeEntry.keys[key];
				diffs.push({
					locale: localeEntry.code,
					key,
					baseTs: meta.lastModified,
					localeTs: localeKeyEntry ? localeKeyEntry.lastModified : "missing",
				});
			}
		}
	}

	return diffs;
}
