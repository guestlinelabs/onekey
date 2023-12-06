import { LanguageInfo, TranslationSchema } from './fetch-translations';
import prettier from 'prettier';

function unique<T>(x: T[]): T[] {
  return [...new Set(x)];
}

export interface Translations {
  [fileName: string]: TranslationSchema;
}

function extractTranslationParameters(translation: string): string[] {
  const match = translation.match(/{{\w+}}/g) || [];

  return match.map((x) => x.replace(/[{}]/g, ''));
}

function transformKeys<T extends Record<string, unknown>>(
  obj: T,
  transform: (key: string) => string
): T {
  const transformed = Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [transform(key), value])
  );

  return transformed as T;
}

function getFileKeys(
  translations: TranslationSchema
): Record<string, string[]> {
  return Object.entries(translations).reduce(
    (acc, [key, value]) => {
      return typeof value === 'string'
        ? { ...acc, [key]: extractTranslationParameters(value) }
        : {
            ...acc,
            ...transformKeys(
              getFileKeys(value),
              (nestedKey) => `${key}.${nestedKey}`
            ),
          };
    },
    {} as Record<string, string[]>
  );
}

function getKeys(
  namespace: string,
  file: TranslationSchema
): Record<string, string[]> {
  return transformKeys(getFileKeys(file), (key) => `${namespace}:${key}`);
}

const removeJsonExtension = (file: string): string =>
  file.replace(/\.json$/, '');

export async function generateKeys({
  languages,
  translations,
  prettierConfig,
  defaultLocale,
}: {
  languages: LanguageInfo[];
  translations: Translations;
  defaultLocale: string;
  prettierConfig: prettier.Options;
}): Promise<string> {
  const namespaces = Object.keys(translations).map(removeJsonExtension);
  const allKeys = Object.entries(translations)
    .map(([namespace, file]) => getKeys(removeJsonExtension(namespace), file))
    .reduce((acc, cur) => {
      return {
        ...acc,
        ...cur,
      };
    }, {});
  const { parameterized, simple } = Object.entries(allKeys).reduce(
    (acc, [key, parameters]) => {
      if (parameters.length > 0) {
        return {
          ...acc,
          parameterized: { ...acc.parameterized, [key]: unique(parameters) },
        };
      }
      return { ...acc, simple: [...acc.simple, key] };
    },
    { parameterized: {}, simple: [] } as {
      parameterized: Record<string, string[]>;
      simple: string[];
    }
  );

  const content = await prettier.format(
    `// This file was autogenerated on ${new Date().toISOString()}.
  // DO NOT EDIT THIS FILE.

  export const locales = [${languages
    .map((lng) => `'${lng.code}'`)
    .join(', ')}] as const;
  export type Locale = typeof locales[number];
  export const defaultLocale: Locale = '${defaultLocale}';

  export const iso1ToLocale: { [key: string]: Locale } = {${languages
    .map(({ code }) => `${code.split('-')[0]}: '${code}'`)
    .join(', ')}}

  export const languages: Array<{ code: Locale; englishName: string; localName: string }> = ${JSON.stringify(
    languages
  )};

  export type Namespace = ${namespaces
    .map((namespace) => `'${namespace}'`)
    .join(' | ')};
  export const namespaces: Namespace[] = [${namespaces
    .map((namespace) => `'${namespace}'`)
    .join(' , ')}];
  
  export type TranslationKeyWithoutOptions = ${simple
    .map((key) => `'${key}'`)
    .join(' | ')};
  export type TranslationWithOptions = {
    ${Object.entries(parameterized).map(
      ([key, parameters]) =>
        `'${key}': { ${parameters
          .map(
            (parameter) =>
              `'${parameter}': ${parameter === 'count' ? 'number' : 'string'}`
          )
          .join(',')} }`
    )}
    };
    type TranslationKeyWithOptions = keyof TranslationWithOptions;

  export type TranslationKey =
    | TranslationKeyWithoutOptions
    | TranslationKeyWithOptions;
  export type Translator = {
    (key: TranslationKeyWithoutOptions, options?: { count: number }): string;
    <T extends TranslationKeyWithOptions>(
      key: T,
      options: TranslationWithOptions[T] & { count?: number }
    ): string;
  };
  `,
    { ...prettierConfig, parser: 'typescript' }
  );

  return content;
}
