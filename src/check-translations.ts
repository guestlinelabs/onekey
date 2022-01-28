import path from 'path';
import * as t from 'io-ts';
import { either as E, taskEither as TE } from 'fp-ts';
import { pipe } from 'fp-ts/function';
import {
  fetchTranslations,
  LanguageInfo,
  Project,
  TranslationSchema,
} from './fetch-translations';
import { readJSON } from './file';

export interface CheckTranslationsConfiguration {
  apiKey: string;
  secret: string;
  projects: Project[];
  translationsPath: string;
}

async function toPromise<A>(x: TE.TaskEither<Error, A>): Promise<A> {
  const res = await x();

  if (E.isLeft(res)) {
    throw res.left;
  }

  return res.right;
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
      checks.push('Missing key: ${aKey}');
    } else if (typeof aValue === 'string') {
      if (aValue !== compared[aKey]) {
        checks.push('Value of key ${aKey} is different.');
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
  const { languages, translations: projectTranslations } = await pipe(
    fetchTranslations(config),
    toPromise
  );
  const languagesFilePath = path.join(
    config.translationsPath,
    'languages.json'
  );
  const localLanguages = await pipe(
    languagesFilePath,
    readJSON(t.array(LanguageInfo)),
    toPromise
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
          const localValue = await pipe(
            translationsFilePath,
            readJSON(TranslationSchema),
            toPromise
          );
          errors.push(...diffSchemas(value, localValue));
        } catch (err) {
          errors.push(`Missing file ${fileName} on language: ${languageCode}`);
        }
      }
    }
  }

  return errors;
}
