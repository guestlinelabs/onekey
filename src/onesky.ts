import { z } from 'zod';
import onesky from '@brainly/onesky-utils';

const mapValues = <A, B>(
  r: Record<string, A>,
  f: (value: A) => B
): Record<string, B> => {
  return Object.fromEntries(
    Object.entries(r).map(([key, value]) => [key, f(value)])
  );
};

const OneSkyLanguageInfo = z.object({
  is_ready_to_publish: z.boolean(),
  code: z.string(),
  english_name: z.string(),
  local_name: z.string(),
});
type OneSkyLanguageInfo = z.infer<typeof OneSkyLanguageInfo>;
const OneSkyLanguageResponse = z.object({
  data: z.array(OneSkyLanguageInfo),
});

const TranslationSchema = z.record(z.union([z.string(), z.record(z.string())]));
type TranslationSchema = z.infer<typeof TranslationSchema>;

const OneSkyMultilingualFileResponse = z.record(
  z.object({ translation: TranslationSchema })
);
type OneSkyMultilingualFileResponse = z.infer<
  typeof OneSkyMultilingualFileResponse
>;

interface TranslationFile {
  [languageCode: string]: TranslationSchema;
}

export interface ProjectTranslations {
  [fileName: string]: TranslationFile;
}

export interface OneSky {
  getLanguages: (opts: {
    apiKey: string;
    secret: string;
    projectId: number;
  }) => Promise<OneSkyLanguageInfo[]>;
  getFile: (opts: {
    apiKey: string;
    secret: string;
    projectId: number;
    fileName: string;
  }) => Promise<TranslationFile>;
}

export const getLanguages: OneSky['getLanguages'] = async ({
  apiKey,
  secret,
  projectId,
}) => {
  try {
    const response = await onesky.getLanguages({ secret, apiKey, projectId });
    const parsed = OneSkyLanguageResponse.parse(JSON.parse(response));

    return parsed.data;
  } catch (err) {
    throw Error('Error getting OneSky language info');
  }
};

export const getFile: OneSky['getFile'] = async ({
  apiKey,
  secret,
  projectId,
  fileName,
}) => {
  try {
    const response = await onesky.getMultilingualFile({
      secret,
      apiKey,
      projectId,
      fileName,
      language: 'en_EN',
      format: 'I18NEXT_MULTILINGUAL_JSON',
    });
    const parsed = OneSkyMultilingualFileResponse.parse(JSON.parse(response));

    return mapValues(parsed, (x) => x.translation);
  } catch (err) {
    throw Error(`Error getting OneSky translation: ${err}`);
  }
};
