import {
  Project,
  fetchTranslations,
  TranslationSchema,
  LanguageInfo,
} from './fetch-translations';
import { generateKeys } from './generate-translation-keys';
import prettier from 'prettier';
import { either, taskEither } from 'fp-ts';
import { pipe } from 'fp-ts/function';

import mkdirp from 'mkdirp';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);

async function toPromise<A>(x: taskEither.TaskEither<Error, A>): Promise<A> {
  const res = await x();

  if (either.isLeft(res)) {
    throw res.left;
  }

  return res.right;
}

async function writeJSON(
  folder: string,
  fileName: string,
  value: unknown
): Promise<void> {
  await mkdirp(folder);

  const pathToFile = path.resolve(folder, fileName);
  const fileContent = JSON.stringify(value, null, 2);

  return writeFile(pathToFile, fileContent, 'utf-8');
}
const readJSON = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, 'utf-8'));

export async function saveTranslations({
  oneSkyApiKey,
  oneSkySecret,
  projects,
  translationsPath,
}: {
  projects: Project[];
  translationsPath: string;
  oneSkySecret: string;
  oneSkyApiKey: string;
}): Promise<void> {
  const { languages, translations: projectTranslations } = await pipe(
    fetchTranslations({
      apiKey: oneSkyApiKey,
      projects: projects,
      secret: oneSkySecret,
    }),
    toPromise
  );

  await writeJSON(translationsPath, 'languages.json', languages);

  for (const translations of projectTranslations) {
    for (const [fileName, translation] of Object.entries(translations)) {
      for (const [languageCode, value] of Object.entries(translation)) {
        await writeJSON(`${translationsPath}/${languageCode}`, fileName, value);
      }
    }
  }
}

async function getPrettierConfig(
  configPath = process.cwd()
): Promise<prettier.Options> {
  const maybeConfig = await prettier.resolveConfig(configPath);

  return maybeConfig || {};
}

export async function saveKeys({
  translationsPath,
  defaultLocale = 'en-GB',
  prettierConfigPath,
}: {
  translationsPath: string;
  defaultLocale: string;
  prettierConfigPath?: string;
}): Promise<void> {
  const languagesPath = path.resolve(translationsPath, 'languages.json');
  const translationsLocalePath = path.resolve(translationsPath, defaultLocale);
  const fileNames = await readdir(translationsLocalePath);
  const prettierConfig = await getPrettierConfig(prettierConfigPath);

  const languages = await readJSON<LanguageInfo[]>(languagesPath);
  const translations = Object.fromEntries(
    await Promise.all(
      fileNames.map(
        async (fileName) =>
          [
            fileName,
            await readJSON<TranslationSchema>(
              path.join(translationsLocalePath, fileName)
            ),
          ] as const
      )
    )
  );
  const outPath = path.resolve(translationsPath, 'translation.tsx');

  const content = generateKeys({
    defaultLocale,
    languages,
    prettierConfig,
    translations,
  });

  await writeFile(outPath, content, 'utf8');
}
