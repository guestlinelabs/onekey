import path from "node:path";
import { z } from "zod";
import { type Project, fetchTranslations } from "./fetch-translations";
import { readJSON } from "./file";
import { LanguageInfo, TranslationSchema } from "./types";

export interface CheckTranslationsConfiguration {
  apiKey: string;
  secret: string;
  projects: Project[];
  translationsPath: string;
}

function diffSchemas(
  base: TranslationSchema,
  compared: TranslationSchema
): string[] {
  const checks: string[] = [];
  const comparedKeys = Object.keys(compared);
  for (const [aKey, aValue] of Object.entries(base)) {
    if (
      !comparedKeys.includes(aKey) ||
      typeof aValue !== typeof compared[aKey]
    ) {
      checks.push(`Missing key: ${aKey}`);
    } else if (typeof aValue === "string") {
      if (aValue !== compared[aKey]) {
        checks.push(`Value of key ${aKey} is different.`);
      }
    } else {
      checks.push(...diffSchemas(aValue, compared[aKey] as TranslationSchema));
    }
  }

  return checks;
}

export async function checkTranslations(
  config: CheckTranslationsConfiguration
): Promise<string[]> {
  const errors: string[] = [];
  const { languages, translations: projectTranslations } =
    await fetchTranslations(config);
  const languagesFilePath = path.join(
    config.translationsPath,
    "languages.json"
  );
  const localLanguages = await readJSON(
    z.array(LanguageInfo),
    languagesFilePath
  );

  for (const language of languages) {
    const localLanguage = localLanguages.find((l) => l.code === language.code);
    if (!localLanguage) {
      errors.push(
        `Missing language: ${language.englishName} [${language.code}]`
      );
    }
  }

  for (const translations of projectTranslations) {
    for (const [fileName, translation] of Object.entries(translations)) {
      for (const [languageCode, value] of Object.entries(translation)) {
        const translationsFilePath = path.join(
          config.translationsPath,
          languageCode,
          fileName
        );
        try {
          const localValue = await readJSON(
            TranslationSchema,
            translationsFilePath
          );
          errors.push(
            ...diffSchemas(value, localValue).map(
              (error) => `[${languageCode}/${fileName}]: ${error}`
            )
          );
        } catch (err) {
          errors.push(`Missing file ${fileName} on language: ${languageCode}`);
        }
      }
    }
  }

  return errors;
}
