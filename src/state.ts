import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";

export type NamespacedKey = string;

export interface KeyMeta {
	lastModified: string;
}

export interface State {
	baseLocale: string;
	modified: Record<string, Record<NamespacedKey, KeyMeta>>;
}

const StateSchema = z.object({
	baseLocale: z.string(),
	modified: z.record(
		z.string(),
		z.record(
			z.string(),
			z.object({
				lastModified: z.string(),
			}),
		),
	),
});

export async function loadState(
	statePath: string,
	baseLocale: string,
): Promise<State> {
	try {
		const content = await readFile(statePath, "utf-8");
		return StateSchema.parse(JSON.parse(content));
	} catch {
		return {
			baseLocale,
			modified: {},
		};
	}
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
): void {
	if (!state.modified[locale]) {
		state.modified[locale] = {};
	}
	state.modified[locale][key] = { lastModified: date.toISOString() };
}

export function isStale(
	state: State,
	baseLocale: string,
	locale: string,
	key: NamespacedKey,
): boolean {
	const baseEntry = state.modified[baseLocale]?.[key];
	const localeEntry = state.modified[locale]?.[key];

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

	for (const [locale, keys] of Object.entries(state.modified)) {
		if (locale === state.baseLocale) continue;

		for (const [key, meta] of Object.entries(
			state.modified[state.baseLocale] || {},
		)) {
			if (isStale(state, state.baseLocale, locale, key)) {
				const localeEntry = state.modified[locale]?.[key];
				diffs.push({
					locale,
					key,
					baseTs: meta.lastModified,
					localeTs: localeEntry ? localeEntry.lastModified : "missing",
				});
			}
		}
	}

	return diffs;
}
