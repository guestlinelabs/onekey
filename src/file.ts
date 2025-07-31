import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import prettier from "prettier";
import type { z } from "zod";

import { generateKeys } from "./generate-translation-keys";
import {
  diffState,
  getLanguagesInfo,
  loadOrCreateState,
  loadState,
  saveState,
  touch,
} from "./state";
import { translate } from "./translate";
import { TranslationSchema } from "./types";

const writeJSON = async (
  prettierConfig: prettier.Options,
  folder: string,
  fileName: string,
  content: Record<string, unknown> | unknown[]
): Promise<void> => {
  const pathToFile = path.resolve(folder, fileName);
  const fileContent = JSON.stringify(content, null, 2);
  const filePrettified = await prettier.format(fileContent, {
    ...prettierConfig,
    parser: "json",
  });

  await mkdir(folder, { recursive: true });
  await writeFile(pathToFile, filePrettified, "utf-8");
};

const parseJSON = <T extends z.ZodTypeAny>(
  type: T,
  input: string
): z.output<T> => {
  return type.parse(JSON.parse(input));
};

export const readJSON = async <T extends z.ZodTypeAny>(
  type: T,
  path: string
): Promise<z.output<T>> => {
  const content = await readFile(path, "utf-8");

  return parseJSON(type, content);
};

export async function initializeState({
  translationsPath,
  baseLocale,
}: {
  translationsPath: string;
  baseLocale: string;
}): Promise<void> {
  const statePath = path.join(process.cwd(), "oneKeyState.json");

  if (await loadState(statePath)) {
    console.log("State already exists for this project");
    return;
  }

  const state = await loadOrCreateState({
    statePath,
    baseLocale,
    translationsPath,
  });
  const otherLocales = (
    await readdir(translationsPath).catch(async () => {
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

    await saveState(statePath, state);

    console.log(`Initialized state tracking for ${baseLocale}`);
  } catch (error) {
    throw new Error(`Failed to initialize state: ${error}`);
  }
}

export async function checkStatus(): Promise<number> {
  const statePath = path.join(process.cwd(), "oneKeyState.json");

  try {
    const state = await loadState(statePath);
    if (!state) {
      console.log(
        "No state found for this project. Try running `onekey init` first."
      );
      return 0;
    }

    const diffs = diffState(state);

    if (diffs.length === 0) {
      console.log("All translations are up to date.");
      return 0;
    }

    console.log("Found stale translations:");
    for (const diff of diffs) {
      console.log(
        `[${diff.locale}] ${diff.key}: base=${diff.baseTs}, locale=${diff.localeTs}`
      );
    }

    return 1;
  } catch (error) {
    console.error(`Error checking status: ${error}`);
    return 1;
  }
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

function flattenKeysWithValues(
  obj: any,
  namespace: string,
  prefix = ""
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
  configPath = process.cwd()
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
          path.join(config.translationsLocalePath, fileName)
        );
        return [fileName, schema] as const;
      })
    )
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
  const translationsLocalePath = path.resolve(translationsPath, defaultLocale);
  const outPath = path.resolve(translationKeysPath, "translation.ts");

  const fileNames = await readdir(translationsLocalePath);
  const prettierConfig = await getPrettierConfig(prettierConfigPath);
  // const languages = await readJSON(z.array(LanguageInfo), languagesPath);
  const translations = await readTranslations({
    fileNames,
    translationsLocalePath,
  });
  const state = await loadState(translationsPath);
  if (!state) {
    throw new Error("No state found for this project");
  }
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
  path: translationsPath,
  prettierConfigPath,
  context,
  tone,
  apiUrl,
  apiKey,
  baseLocale,
  updateAll,
  stats,
}: {
  path: string;
  prettierConfigPath?: string;
  context?: string;
  tone?: string;
  apiUrl: string;
  apiKey: string;
  baseLocale?: string;
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

  const { languages, translations: projectTranslations } = await translate({
    path: translationsPath,
    context: contextContent,
    tone,
    apiUrl,
    apiKey,
    baseLocale,
    updateAll,
    stats,
  });

  const prettierConfig = await getPrettierConfig(prettierConfigPath);

  await mkdir(translationsPath, { recursive: true });

  for (const translations of projectTranslations) {
    for (const [fileName, translation] of Object.entries(translations)) {
      for (const [languageCode, value] of Object.entries(translation)) {
        const translationsLanguagePath = path.join(
          translationsPath,
          languageCode
        );
        await mkdir(translationsLanguagePath, { recursive: true });
        await writeJSON(
          prettierConfig,
          translationsLanguagePath,
          fileName,
          value
        );
      }
    }
  }
}
