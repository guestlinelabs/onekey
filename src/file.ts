import {
  Project,
  fetchTranslations,
  TranslationSchema,
  LanguageInfo,
} from './fetch-translations';
import { generateKeys } from './generate-translation-keys';
import prettier from 'prettier';
import { array, either, option, taskEither } from 'fp-ts';
import { flow, pipe } from 'fp-ts/function';
import { Do } from 'fp-ts-contrib';
import * as t from 'io-ts';
import { failure } from 'io-ts/PathReporter';

import mkdirp from 'mkdirp';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const writeText = (path: string) => (
  content: string
): taskEither.TaskEither<Error, void> =>
  taskEither.tryCatch(
    () => promisify(fs.writeFile)(path, content, 'utf-8'),
    either.toError
  );

const toRecord = <A>(
  values: ReadonlyArray<readonly [string, A]>
): Record<string, A> => {
  return Object.fromEntries(values);
};

const readdir = (path: string): taskEither.TaskEither<Error, string[]> => {
  return taskEither.tryCatch(() => promisify(fs.readdir)(path), either.toError);
};

async function toPromise<A>(x: taskEither.TaskEither<Error, A>): Promise<A> {
  const res = await x();

  if (either.isLeft(res)) {
    throw res.left;
  }

  return res.right;
}

const writeJSON = (folder: string) => (fileName: string) => (
  content: Record<string, unknown> | unknown[]
): taskEither.TaskEither<Error, void> => {
  const pathToFile = path.resolve(folder, fileName);
  const fileContent = JSON.stringify(content, null, 2);

  return pipe(
    taskEither.tryCatch(() => mkdirp(folder), either.toError),
    () => writeText(pathToFile)(fileContent)
  );
};

const parseJSON = <A>(type: t.Type<A, any, unknown>) => (
  input: string
): either.Either<Error, A> => {
  return pipe(
    either.tryCatch(() => JSON.parse(input), either.toError),
    either.chain(
      flow(
        type.decode,
        either.mapLeft(flow(failure, (x) => new Error(x.join('\n'))))
      )
    )
  );
};

const readJSON = <A>(type: t.Type<A, any, unknown>) => (
  path: string
): taskEither.TaskEither<Error, A> => {
  return pipe(
    taskEither.tryCatch(
      () => promisify(fs.readFile)(path, 'utf-8'),
      either.toError
    ),
    taskEither.chain(flow(parseJSON(type), taskEither.fromEither))
  );
};

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

  await mkdirp(translationsPath);
  await toPromise(writeJSON(translationsPath)('languages.json')(languages));

  for (const translations of projectTranslations) {
    for (const [fileName, translation] of Object.entries(translations)) {
      for (const [languageCode, value] of Object.entries(translation)) {
        await toPromise(
          writeJSON(`${translationsPath}/${languageCode}`)(fileName)(value)
        );
      }
    }
  }
}

function getPrettierConfig(
  configPath = process.cwd()
): taskEither.TaskEither<Error, option.Option<prettier.Options>> {
  return pipe(
    taskEither.tryCatch(
      () => prettier.resolveConfig(configPath),
      either.toError
    ),
    taskEither.map(option.fromNullable)
  );
}

function readTranslations(config: {
  fileNames: string[];
  translationsLocalePath: string;
}): taskEither.TaskEither<Error, Record<string, TranslationSchema>> {
  return pipe(
    config.fileNames,
    array.map((fileName) =>
      pipe(
        fileName,
        readJSON(TranslationSchema),
        taskEither.map((schema) => [fileName, schema] as const)
      )
    ),
    array.sequence(taskEither.taskEither),
    taskEither.map(toRecord)
  );
}

export function saveKeys({
  translationsPath,
  defaultLocale = 'en-GB',
  prettierConfigPath,
}: {
  translationsPath: string;
  defaultLocale: string;
  prettierConfigPath?: string;
}): taskEither.TaskEither<Error, void> {
  const languagesPath = path.resolve(translationsPath, 'languages.json');
  const translationsLocalePath = path.resolve(translationsPath, defaultLocale);
  const outPath = path.resolve(translationsPath, 'translation.tsx');

  const content = Do.Do(taskEither.taskEither)
    .bind('fileNames', readdir(translationsLocalePath))
    .bind(
      'prettierConfig',
      pipe(
        getPrettierConfig(prettierConfigPath),
        taskEither.map(option.getOrElse(() => ({})))
      )
    )
    .bind('languages', readJSON(t.array(LanguageInfo))(languagesPath))
    .bindL('translations', ({ fileNames }) =>
      readTranslations({ fileNames, translationsLocalePath })
    )
    .return(({ languages, prettierConfig, translations }) =>
      generateKeys({ languages, prettierConfig, translations, defaultLocale })
    );

  return pipe(content, taskEither.chain(writeText(outPath)));
}
