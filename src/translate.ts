import { readFile, readdir } from 'fs/promises';
import {
  ProjectTranslations,
  TranslationOutput,
  AiResponse,
  TranslationConfig,
} from './types';

type GenericTranslations = Record<string, string>;

interface LanguageInfo {
  code: string;
  englishName: string;
  localName: string;
  default?: boolean;
}

export async function translate(options: {
  path: string;
  context?: string;
  baseLocale?: string;
  tone?: string;
  apiUrl: string;
  apiKey?: string;
}): Promise<TranslationOutput> {
  const { path, context = '', tone = 'formal', apiUrl, apiKey } = options;

  if (!apiUrl || !apiKey) {
    throw new Error('Missing required parameters: apiUrl or apiKey');
  }

  const languages = await loadJsonFile<LanguageInfo[]>(
    `${path}/languages.json`
  );
  const defaultLanguage = findDefaultLanguage(languages, options.baseLocale);

  const translations = await translateViaAi({
    translationsFolder: path,
    defaultLanguage,
    apiUrl,
    apiKey,
    context,
    tone,
  });

  return { languages, translations: [translations] };
}

function findDefaultLanguage(
  languages: LanguageInfo[],
  baseLocale?: string
): LanguageInfo {
  const defaultLanguage = languages.find(
    (language) =>
      (baseLocale && language.code === baseLocale) || language.default === true
  );

  if (!defaultLanguage) {
    throw new Error('No default language found');
  }

  return defaultLanguage;
}

async function translateViaAi({
  apiUrl,
  apiKey,
  translationsFolder,
  defaultLanguage,
  context,
  tone,
}: {
  translationsFolder: string;
  defaultLanguage: LanguageInfo;
  apiUrl: string;
  apiKey: string;
  context: string;
  tone: string;
}): Promise<ProjectTranslations> {
  const languages = await loadJsonFile<LanguageInfo[]>(
    `${translationsFolder}/languages.json`
  );
  const otherLanguages = languages.filter(
    (lang) => lang.code !== defaultLanguage.code
  );
  const defaultLanguageFiles = await readdir(
    `${translationsFolder}/${defaultLanguage.code}`
  );

  const result: ProjectTranslations = {};

  for (const file of defaultLanguageFiles) {
    result[file] = await translateFile({
      file,
      translationsFolder,
      defaultLanguage,
      otherLanguages,
      apiUrl,
      apiKey,
      context,
      tone,
    });
  }

  return result;
}

async function translateFile({
  file,
  translationsFolder,
  defaultLanguage,
  otherLanguages,
  apiUrl,
  apiKey,
  context,
  tone,
}: {
  file: string;
  translationsFolder: string;
  defaultLanguage: LanguageInfo;
  otherLanguages: LanguageInfo[];
  apiUrl: string;
  apiKey: string;
  context: string;
  tone: string;
}): Promise<Record<string, GenericTranslations>> {
  const defaultLanguageContent = await loadJsonFile<GenericTranslations>(
    `${translationsFolder}/${defaultLanguage.code}/${file}`
  );
  const result: Record<string, GenericTranslations> = {
    [defaultLanguage.code]: defaultLanguageContent,
  };

  await Promise.all(
    otherLanguages.map(async (targetLanguage) => {
      result[targetLanguage.code] = await translateToLanguage({
        file,
        translationsFolder,
        targetLanguage,
        defaultLanguage,
        defaultContent: defaultLanguageContent,
        apiUrl,
        apiKey,
        context,
        tone,
      });
    })
  );

  return result;
}

async function translateToLanguage({
  file,
  translationsFolder,
  targetLanguage,
  defaultLanguage,
  defaultContent,
  apiUrl,
  apiKey,
  context,
  tone,
}: {
  file: string;
  translationsFolder: string;
  targetLanguage: LanguageInfo;
  defaultLanguage: LanguageInfo;
  defaultContent: GenericTranslations;
  apiUrl: string;
  apiKey: string;
  context: string;
  tone: string;
}): Promise<GenericTranslations> {
  console.log(`Translating ${file} to ${targetLanguage.code}`);

  const existingTranslations = await loadExistingTranslations(
    `${translationsFolder}/${targetLanguage.code}/${file}`
  );

  const missingTranslations = getMissingTranslations(
    defaultContent,
    existingTranslations
  );

  if (Object.keys(missingTranslations).length === 0) {
    return existingTranslations;
  }

  const translatedContent = await translateMissingContent({
    missingTranslations,
    targetLanguage,
    defaultLanguage,
    apiUrl,
    apiKey,
    context,
    tone,
  });

  const result = { ...existingTranslations, ...translatedContent };

  console.log(
    `Finished translating ${file} for ${targetLanguage.code}. ${
      Object.keys(missingTranslations).length
    } keys added`
  );

  return result;
}

async function translateOneSky(
  config: TranslationConfig,
  content: GenericTranslations
): Promise<GenericTranslations> {
  const completionsUrl = config.apiUrl.replace(/\/$/, '') + '/chat/completions';

  try {
    const response = await fetch(completionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey,
      },
      body: JSON.stringify({
        temperature: 1,
        max_tokens: 4096,
        user: `translation-automation-${config.originalLanguageCode}-${config.targetLanguageCode}`,
        response_format: { type: 'json_object' },
        messages: buildTranslationPrompt(config, content),
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const aiResponse = (await response.json()) as AiResponse;

    if (aiResponse.choices.length === 0) {
      throw new Error('AI was not able to analyse the text');
    }

    return JSON.parse(aiResponse.choices[0].message.content);
  } catch (error) {
    console.error('Translation failed:', error);
    return {};
  }
}

async function loadJsonFile<T>(path: string): Promise<T> {
  try {
    const fileStream = await readFile(path, 'utf-8');
    return JSON.parse(fileStream);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`File not found: ${path}`);
    }
    throw error;
  }
}

async function loadExistingTranslations(
  path: string
): Promise<GenericTranslations> {
  try {
    return await loadJsonFile(path);
  } catch (error) {
    return {};
  }
}

function getMissingTranslations(
  defaultContent: GenericTranslations,
  existingTranslations: GenericTranslations
): GenericTranslations {
  return Object.entries(defaultContent).reduce((acc, [key, value]) => {
    if (!(key in existingTranslations)) {
      acc[key] = value;
    }
    return acc;
  }, {} as GenericTranslations);
}

async function translateMissingContent({
  missingTranslations,
  targetLanguage,
  defaultLanguage,
  apiUrl,
  apiKey,
  context,
  tone,
}: {
  missingTranslations: GenericTranslations;
  targetLanguage: LanguageInfo;
  defaultLanguage: LanguageInfo;
  apiUrl: string;
  apiKey: string;
  context: string;
  tone: string;
}): Promise<GenericTranslations> {
  const chunks = splitIntoChunks(missingTranslations, 100);
  let result = {};

  for (const chunk of chunks) {
    const translation = await translateOneSky(
      {
        apiUrl,
        apiKey,
        targetLanguageCode: targetLanguage.code,
        originalLanguageCode: defaultLanguage.code,
        context,
        tone,
      },
      chunk
    );
    result = { ...result, ...translation };
  }

  return result;
}

function splitIntoChunks(
  obj: GenericTranslations,
  chunkSize: number
): GenericTranslations[] {
  return Object.keys(obj).reduce((chunks: GenericTranslations[], _, index) => {
    if (index % chunkSize === 0) {
      const chunkKeys = Object.keys(obj).slice(index, index + chunkSize);
      chunks.push(
        chunkKeys.reduce((acc, key) => {
          acc[key] = obj[key];
          return acc;
        }, {} as GenericTranslations)
      );
    }
    return chunks;
  }, []);
}

function buildTranslationPrompt(
  config: TranslationConfig,
  content: GenericTranslations
): Array<{ role: string; content: string }> {
  return [
    {
      role: 'system',
      content: `You are an expert in all languages, and you help translate texts from ${config.originalLanguageCode} to ${config.targetLanguageCode}. ${config.context}`,
    },
    {
      role: 'system',
      content: 'Translate only the value, never change the key',
    },
    {
      role: 'system',
      content: `Use ${config.tone} language, be polite and succinct`,
    },
    {
      role: 'system',
      content:
        'You reply only with a RFC8259 compliant JSON following this format without deviation: {"_key": "_value"} based on a JSON to translate. Do not include any other text or comments.',
    },
    {
      role: 'system',
      content: `Example of valid responses: Text to translate: { "link_text": "Link text", "invalid_email_error": "Invalid email format" } Original language: "en-GB" Target language: "fr-FR" Response: { "link_text": "Texte du lien", "invalid_email_error": "Format email invalide" }`,
    },
    { role: 'user', content: JSON.stringify(content) },
  ];
}
