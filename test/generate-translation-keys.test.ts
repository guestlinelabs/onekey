import { expect, it } from "vitest";
import type { LanguageInfo } from "../src/fetch-translations";
import {
  type Translations,
  generateKeys,
} from "../src/generate-translation-keys";
import { isValidTypescript } from "./tsCompiler";

const translations: Translations = {
  main: {
    hello: "Hello there",
  },
  errors: {
    unknown: "Unknown error",
  },
};
const languages: LanguageInfo[] = [
  {
    code: "en-GB",
    englishName: "English (United Kingdom)",
    localName: "English (United Kingdom)",
  },
  {
    code: "pt-PT",
    englishName: "Portuguese (Portugal)",
    localName: "Português (Europeu)",
  },
];

it.skip("will generate valid typescript code", async () => {
  const source = await generateKeys({
    translations,
    languages,
    prettierConfig: {},
    defaultLocale: "en-GB",
  });

  const { isValid } = isValidTypescript(source);

  expect(isValid).toBe(true);
});
