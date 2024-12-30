import { readFile, readdir } from 'fs/promises';
import { ProjectTranslations, TranslationOutput } from './types';

type AiChoiceMessage = {
  content: string;
};
type AiChoice = {
  message: AiChoiceMessage;
};
export type AiResponse = {
  id: string;
  object: string;
  choices: AiChoice[];
};
type GenericTranslations = {
  [key: string]: string;
};

export async function translate(options: {
  out: string;
  context?: string;
  tone?: string;
  apiUrl: string;
  apiKey?: string;
}): Promise<TranslationOutput> {
  const { out, context, tone, apiUrl, apiKey } = options;
  const finalApiUrl = apiUrl || process.env.AI_API_URL;
  const finalApiKey = apiKey || process.env.AI_API_KEY;
  const finalTranslationsFolder = out || './translations';
  const finalContext = context || '';
  const finalTone = tone || 'formal';

  if (!finalApiUrl || !finalApiKey) {
    throw new Error('Missing required parameters: apiUrl or apiKey');
  }

  const languages = await getFile(`${finalTranslationsFolder}/languages.json`);
  const defaultLanguage = languages.find(
    (language: { default: boolean }) => language.default === true
  );

  if (!defaultLanguage) {
    throw new Error('No default language found');
  }

  const translations = await translateViaAi(
    finalApiUrl,
    finalApiKey,
    finalTranslationsFolder,
    finalContext,
    finalTone
  );

  return {
    languages,
    translations: [translations],
  };
}

export const translateViaAi = async (
  aiUrl: string,
  openAiApiKey: string,
  translationsFolder: string,
  context: string,
  tone: string
): Promise<ProjectTranslations> => {
  const languages = await getFile(`${translationsFolder}/languages.json`);
  const defaultLanguage = languages.find(
    (language: { default: boolean }) => language.default === true
  );
  const otherLanguages = languages.filter(
    (language: { default: boolean }) => language.default !== true
  );

  const defaultLanguageFiles = await readdir(
    `${translationsFolder}/${defaultLanguage.code}`
  );

  const result: ProjectTranslations = {};

  for (const file of defaultLanguageFiles) {
    const defaultLanguageFile = await getFile(
      `${translationsFolder}/${defaultLanguage.code}/${file}`
    );

    result[file] = {};
    result[file][defaultLanguage.code] = defaultLanguageFile;

    await Promise.all(
      otherLanguages.map(async (targetLanguage: { code: string }) => {
        console.log(`Translating ${file} to ${targetLanguage.code}`);

        let targetLanguageFile = {};
        try {
          targetLanguageFile = await getFile(
            `${translationsFolder}/${targetLanguage.code}/${file}`
          );
        } catch (e) {
          // File doesn't exist yet, which is fine
        }

        const missingKeys = Object.keys(defaultLanguageFile).filter(
          (key) => !(key in targetLanguageFile)
        );
        const objectWithOnlyMissingKeys =
          missingKeys.reduce<GenericTranslations>((obj, key) => {
            obj[key] = defaultLanguageFile[key];
            return obj;
          }, {});

        const chunks = splitIntoChunks(objectWithOnlyMissingKeys, 100);
        let translatedContent = {};

        for (const chunk of chunks) {
          const chunkTranslation = await translateOneSky(
            aiUrl,
            openAiApiKey,
            targetLanguage.code,
            defaultLanguage.code,
            chunk,
            context,
            tone
          );
          translatedContent = { ...translatedContent, ...chunkTranslation };
        }

        result[file][targetLanguage.code] = {
          ...targetLanguageFile,
          ...translatedContent,
        };

        console.log(
          `Finished translating ${file} for ${targetLanguage.code}. ${missingKeys.length} keys added`
        );
      })
    );
  }

  return result;
};

export const translateOneSky = async (
  aiUrl: string,
  aiApiKey: string,
  targetLanguageCode: string,
  originalLanguageCode: string,
  translationRequest: GenericTranslations,
  context: string,
  tone: string
): Promise<GenericTranslations> => {
  try {
    const response = await fetch(aiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': `${aiApiKey}`,
      },
      body: JSON.stringify({
        temperature: 1,
        max_tokens: 4096,
        user: `translation-automation-${originalLanguageCode}-${targetLanguageCode}`,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are an expert in all languages, and you help translate texts from ${originalLanguageCode} to ${targetLanguageCode}. ${context}`,
          },
          {
            role: 'system',
            content: `Translate only the value, never change the key`,
          },
          {
            role: 'system',
            content: `Use ${tone} language, be polite and succinct`,
          },
          {
            role: 'system',
            content: `You reply only with a RFC8259 compliant JSON following this format without deviation: {"_key": "_value"} based on a JSON to translate. Do not include any other text or comments.`,
          },
          {
            role: 'system',
            content: `Example of valid responses: Text to translate: { "link_text": "Link text", "invalid_email_error": "Invalid email format" } Original language: "en-GB" Target language: "fr-FR" Response: { "link_text": "Texte du lien", "invalid_email_error": "Format email invalide" }`,
          },
          { role: 'user', content: JSON.stringify(translationRequest) },
        ],
      }),
    });
    if (!response.ok) {
      console.error(response.statusText);
      return {};
    }
    const aiResponse = (await response.json()) as AiResponse;
    if (aiResponse.choices.length === 0) {
      return returnAnLogError('AI was not able to analyse the text');
    }
    const translatedResponse = JSON.parse(
      aiResponse.choices[0].message.content
    ) as GenericTranslations;
    // cache.set(serializedInput, translatedResponse);

    return translatedResponse;
  } catch (error) {
    console.error('error', error);
    return {};
  }
};

const returnAnLogError = (error: unknown) => {
  console.error('Failed to translate', error);
  return {};
};

function splitIntoChunks(
  objectWithOnlyMissingKeys: GenericTranslations,
  chunkSize: number
) {
  const chunks: GenericTranslations[] = [];
  for (
    let i = 0;
    i < Object.keys(objectWithOnlyMissingKeys).length;
    i += chunkSize
  ) {
    const chunkKeys = Object.keys(objectWithOnlyMissingKeys).slice(
      i,
      i + chunkSize
    );
    const chunk = chunkKeys.reduce((acc, key) => {
      acc[key] = objectWithOnlyMissingKeys[key];
      return acc;
    }, {} as GenericTranslations);
    chunks.push(chunk);
  }
  return chunks;
}

async function getFile(path: string) {
  const fileStream = await readFile(path, 'utf-8');
  return JSON.parse(fileStream);
}
