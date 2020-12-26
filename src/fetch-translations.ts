import { array as A, either as E, taskEither as TE, record as R } from 'fp-ts';
import { Do } from 'fp-ts-contrib';
import * as t from 'io-ts';
import { identity, pipe } from 'fp-ts/lib/function';
import * as onesky from './onesky';

import { toRecord } from './utils';

const mapKeys = <A>(f: (key: string) => string) => (
  r: Record<string, A>
): Record<string, A> => {
  return Object.fromEntries(
    Object.entries(r).map(([key, value]) => [f(key), value])
  );
};

const languageCodeMapping: { [key: string]: string } = {
  th: 'th-TH',
  nn: 'nn-NO',
  da: 'da-DK',
};

export const LanguageInfo = t.strict({
  code: t.string,
  englishName: t.string,
  localName: t.string,
});
export type LanguageInfo = t.TypeOf<typeof LanguageInfo>;

export const TranslationSchema = t.record(
  t.string,
  t.union([t.string, t.record(t.string, t.string)])
);
export type TranslationSchema = t.TypeOf<typeof TranslationSchema>;

interface TranslationFile {
  [languageCode: string]: TranslationSchema;
}

export interface ProjectTranslations {
  [fileName: string]: TranslationFile;
}

export interface TranslationOptions {
  languages: LanguageInfo[];
  translations: ProjectTranslations[];
}

function getLanguageCode(code: string): string {
  if (/[a-z]{2}-[A-Z]{2}/.test(code)) {
    return code;
  } else if (languageCodeMapping[code]) {
    return languageCodeMapping[code];
  } else {
    throw new Error(`Language not localized: ${code}`);
  }
}

function getLanguages({
  apiKey,
  secret,
  projectId,
}: {
  apiKey: string;
  secret: string;
  projectId: number;
}): TE.TaskEither<Error, LanguageInfo[]> {
  return pipe(
    onesky.getLanguages({ apiKey, projectId, secret }),
    TE.map(A.filter((language) => language.is_ready_to_publish)),
    TE.map(
      A.map((language) => ({
        code: getLanguageCode(language.code),
        englishName: language.english_name,
        localName: language.local_name,
      }))
    )
  );
}

function getFile({
  apiKey,
  secret,
  projectId,
  fileName,
}: {
  apiKey: string;
  secret: string;
  projectId: number;
  fileName: string;
}): TE.TaskEither<
  Error,
  {
    [languageCode: string]: TranslationSchema;
  }
> {
  return pipe(
    onesky.getFile({ apiKey, fileName, projectId, secret }),
    TE.map(mapKeys(getLanguageCode))
  );
}

function getProjectFiles({
  apiKey,
  secret,
  projectId,
  files,
}: {
  apiKey: string;
  secret: string;
  projectId: number;
  files: string[];
}): TE.TaskEither<Error, ProjectTranslations> {
  return pipe(
    files,
    A.map((fileName) =>
      pipe(
        getFile({ fileName, projectId, apiKey, secret }),
        TE.map((x) => [fileName, x] as const)
      )
    ),
    A.sequence(TE.taskEither),
    TE.map(toRecord)
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

export function fetchTranslations({
  apiKey,
  secret,
  projects,
}: FetchTranslationsConfiguration): TE.TaskEither<Error, TranslationOptions> {
  if (projects.length === 0) {
    return TE.left(Error('You have to at least pass one project to process'));
  }

  return Do.Do(TE.taskEither)
    .bind(
      'languages',
      getLanguages({
        projectId: projects[0].id,
        apiKey,
        secret,
      })
    )
    .bind(
      'translations',
      pipe(
        projects,
        A.map(({ files, id }) =>
          getProjectFiles({
            projectId: id,
            files,
            apiKey,
            secret,
          })
        ),
        A.sequence(TE.taskEither)
      )
    )
    .return(identity);
}
