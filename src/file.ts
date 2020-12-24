import {
  Project,
  fetchTranslations,
  TranslationSchema,
  LanguageInfo,
} from './fetch-translations';
import { generateKeys } from './generate-translation-keys';
import prettier from 'prettier';
import { array as A, either as E, option as O, taskEither as TE } from 'fp-ts';
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
): TE.TaskEither<Error, void> =>
  TE.tryCatch(() => promisify(fs.writeFile)(path, content, 'utf-8'), E.toError);

const toRecord = <A>(
  values: ReadonlyArray<readonly [string, A]>
): Record<string, A> => {
  return Object.fromEntries(values);
};

const readdir = (path: string): TE.TaskEither<Error, string[]> => {
  return TE.tryCatch(() => promisify(fs.readdir)(path), E.toError);
};

async function toPromise<A>(x: TE.TaskEither<Error, A>): Promise<A> {
  const res = await x();

  if (E.isLeft(res)) {
    throw res.left;
  }

  return res.right;
}

const writeJSON = (prettierConfig: prettier.Options) => (folder: string) => (
  fileName: string
) => (
  content: Record<string, unknown> | unknown[]
): TE.TaskEither<Error, void> => {
  const pathToFile = path.resolve(folder, fileName);
  const fileContent = JSON.stringify(content, null, 2);
  const filePrettified = prettier.format(fileContent, {
    ...prettierConfig,
    parser: 'json',
  });

  return pipe(
    TE.tryCatch(() => mkdirp(folder), E.toError),
    () => writeText(pathToFile)(filePrettified)
  );
};

const parseJSON = <A>(type: t.Type<A, any, unknown>) => (
  input: string
): E.Either<Error, A> => {
  return pipe(
    E.tryCatch(() => JSON.parse(input), E.toError),
    E.chain(
      flow(
        type.decode,
        E.mapLeft(flow(failure, (x) => new Error(x.join('\n'))))
      )
    )
  );
};

const readJSON = <A>(type: t.Type<A, any, unknown>) => (
  path: string
): TE.TaskEither<Error, A> => {
  return pipe(
    TE.tryCatch(() => promisify(fs.readFile)(path, 'utf-8'), E.toError),
    TE.chain(flow(parseJSON(type), TE.fromEither))
  );
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
  const { languages, translations: projectTranslations } = await pipe(
    fetchTranslations({
      apiKey: oneSkyApiKey,
      projects: projects,
      secret: oneSkySecret,
    }),
    toPromise
  );

  const prettierConfig = await pipe(
    getPrettierConfig(prettierConfigPath),
    TE.chain(TE.fromOption(() => new Error())),
    TE.getOrElse(() => async () => ({} as prettier.Options))
  )();

  const writePrettifiedJSON = writeJSON(prettierConfig);

  await mkdirp(translationsPath);
  await toPromise(
    writePrettifiedJSON(translationsPath)('languages.json')(languages)
  );

  for (const translations of projectTranslations) {
    for (const [fileName, translation] of Object.entries(translations)) {
      for (const [languageCode, value] of Object.entries(translation)) {
        const translationsLanguagePath = path.join(
          translationsPath,
          languageCode
        );
        await mkdirp(translationsLanguagePath);
        await toPromise(
          writePrettifiedJSON(translationsLanguagePath)(fileName)(value)
        );
      }
    }
  }
}

function getPrettierConfig(
  configPath = process.cwd()
): TE.TaskEither<Error, O.Option<prettier.Options>> {
  return pipe(
    TE.tryCatch(() => prettier.resolveConfig(configPath), E.toError),
    TE.map(O.fromNullable)
  );
}

function readTranslations(config: {
  fileNames: string[];
  translationsLocalePath: string;
}): TE.TaskEither<Error, Record<string, TranslationSchema>> {
  return pipe(
    config.fileNames,
    A.map((fileName) =>
      pipe(
        path.join(config.translationsLocalePath, fileName),
        readJSON(TranslationSchema),
        TE.map((schema) => [fileName, schema] as const)
      )
    ),
    A.sequence(TE.taskEither),
    TE.map(toRecord)
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
}): TE.TaskEither<Error, void> {
  const languagesPath = path.resolve(translationsPath, 'languages.json');
  const translationsLocalePath = path.resolve(translationsPath, defaultLocale);
  const outPath = path.resolve(translationsPath, 'translation.tsx');

  const content = Do.Do(TE.taskEither)
    .bind('fileNames', readdir(translationsLocalePath))
    .bind(
      'prettierConfig',
      pipe(
        getPrettierConfig(prettierConfigPath),
        TE.map(O.getOrElse(() => ({})))
      )
    )
    .bind('languages', readJSON(t.array(LanguageInfo))(languagesPath))
    .bindL('translations', ({ fileNames }) =>
      readTranslations({ fileNames, translationsLocalePath })
    )
    .return(({ languages, prettierConfig, translations }) =>
      generateKeys({ languages, prettierConfig, translations, defaultLocale })
    );

  return pipe(content, TE.chain(writeText(outPath)));
}
