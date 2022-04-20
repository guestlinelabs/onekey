import { LanguageInfo } from '../src/fetch-translations';
import { generateKeys, Translations } from '../src/generate-translation-keys';
import { isValidTypescript } from './tsCompiler';

const translations: Translations = {
  main: {
    hello: 'Hello there',
  },
  errors: {
    unknown: 'Unknown error',
  },
};
const languages: LanguageInfo[] = [
  {
    code: 'en-GB',
    englishName: 'English (United Kingdom)',
    localName: 'English (United Kingdom)',
  },
  {
    code: 'pt-PT',
    englishName: 'Portuguese (Portugal)',
    localName: 'Português (Europeu)',
  },
];

it.skip('will generate valid typescript code', () => {
  const source = generateKeys({
    translations,
    languages,
    prettierConfig: {},
    defaultLocale: 'en-GB',
  });

  const { isValid } = isValidTypescript(source);

  expect(isValid).toBe(true);
});
