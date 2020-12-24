import { fetchTranslations as fetchTranslationsTask } from './fetch-translations';
import { promisifyTaskEither } from './utils';

export const fetchTranslations = promisifyTaskEither(fetchTranslationsTask);

export { generateKeys } from './generate-translation-keys';
export { saveKeys, saveTranslations } from './file';
