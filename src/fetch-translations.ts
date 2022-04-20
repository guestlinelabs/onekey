import { z } from 'zod';
import * as onesky from './onesky';

const mapKeys = <A>(
  f: (key: string) => string,
  r: Record<string, A>
): Record<string, A> => {
  return Object.fromEntries(
    Object.entries(r).map(([key, value]) => [f(key), value])
  );
};

const languageCodeMapping: { [key: string]: string } = {
  es: 'es-ES',
  it: 'it-IT',
  fr: 'fr-FR',
  de: 'de-DE',
  nl: 'nl-NL',
  en: 'en-GB',
  th: 'th-TH',
  nn: 'nn-NO',
  da: 'da-DK',
};

export const LanguageInfo = z.object({
  code: z.string(),
  englishName: z.string(),
  localName: z.string(),
});
export type LanguageInfo = z.infer<typeof LanguageInfo>;

export const TranslationSchema = z.record(
  z.string(),
  z.union([z.string(), z.record(z.string(), z.string())])
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
  } else if (languageCodeMapping[code]) {
    return languageCodeMapping[code];
  } else {
    throw new Error(`Language not localized: ${code}`);
  }
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
    .map((language) => ({
      code: getLanguageCode(language.code),
      englishName: language.english_name,
      localName: language.local_name,
    }));
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
  const file = await onesky.getFile({
    apiKey,
    fileName,
    projectId,
    secret,
    languages,
  });

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
          (x) => [fileName, x] as const
        )
      )
    )
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
    throw Error('You have to at least pass one project to process');
  }

  const languages = await getLanguages({
    projectId: projects[0].id,
    apiKey,
    secret,
  });
  const translations = await Promise.all(
    projects.map(({ files, id }) =>
      getProjectFiles({ projectId: id, files, apiKey, secret, languages })
    )
  );

  return { languages, translations };
}
