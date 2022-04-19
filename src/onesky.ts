import { z } from 'zod';
import onesky from '@brainly/onesky-utils';
import { LanguageInfo } from './fetch-translations';

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

const OneSkyFileResponse = z.object({ translation: TranslationSchema });

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
    languages: LanguageInfo[];
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
  languages,
}) => {
  try {
    const obj: Record<string, TranslationSchema> = {};
    for (const { code } of languages) {
      const response = await onesky.getFile({
        secret,
        apiKey,
        projectId,
        fileName,
        language: code,
      });

      const parsed = OneSkyFileResponse.parse(JSON.parse(response));
      obj[code] = parsed.translation;
    }

    return obj;
  } catch (err) {
    throw Error(`Error getting OneSky translation: ${err}`);
  }
};
