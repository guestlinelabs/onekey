# onekey

Utility to download translations from [OneSky](https://www.oneskyapp.com/) and generate typed keys in Typescript for having typed translations.

## Installation

```bash
npm install @guestlinelabs/onekey
```

## Usage

The tool provides several commands to help manage your translation workflow:

### Fetch translations

Downloads translation files from OneSky to your local system. This is useful when you want to get the latest translations from OneSky or when setting up a new project.

```bash
Usage: onekey fetch [options]

Options:
  -o, --out      Path where translations will be saved
  -p, --project  Numeric id of the OneSky project
  -f, --files    Names of the files to download from the OneSky project separated by commas
  -s, --secret   OneSky private key (it can be read from environment variable ONESKY_PRIVATE_KEY)
  -k, --apiKey   OneSky API key (it can be read from environment variable ONESKY_PUBLIC_KEY)
  -c, --prettier [OPTIONAL] Path for the prettier config
```

### Generate translation keys

Creates TypeScript type definitions from your translation files. This ensures type safety when using translation keys in your code, helping catch errors at compile time rather than runtime.

```bash
Usage: onekey generate [options]

Options:
  -i, --input    Path for the json translations to read from
  -o, --out      [OPTIONAL] Where to save the translation keys (defaults to input path)
  -l, --locale   [OPTIONAL] Default locale to use (en-GB by default)
  -c, --prettier [OPTIONAL] Path for the prettier config
```

### Upload translations

Pushes your local translation files to OneSky. This is typically used when you have new or updated base language translations that need to be translated into other languages.

```bash
Usage: onekey upload [options]

Options:
  -k, --apiKey   OneSky API key (it can be read from environment variable ONESKY_PUBLIC_KEY)
  -s, --secret   OneSky secret (it can be read from environment variable ONESKY_PRIVATE_KEY)
  -p, --project  OneSky project id
  -i, --input    Path for the translations
```

### Translate with AI

Uses OpenAI to automatically translate your content into different languages. This can be useful for getting initial translations or for less critical content that doesn't require professional human translation.

```bash
Usage: onekey translate [options]

Options:
  -p, --path       Path for the json translations
  -l, --baseLocale [OPTIONAL] Base locale
  -u, --apiUrl     OpenAI API URL (it can be read from environment variable OPENAI_API_URL)
  -k, --apiKey     OpenAI API key (it can be read from environment variable OPENAI_API_KEY)
  -c, --prettier   [OPTIONAL] Path for the prettier config
  -x, --context    [OPTIONAL] File with additional context for the translations
  -t, --tone       [OPTIONAL] Tone of the translation (formal/informal, defaults to neutral)
```

### Check translations

Compares your local translations against OneSky to identify any missing or outdated translations. This is helpful for maintaining consistency between your local files and OneSky, especially in CI/CD pipelines.

```bash
Usage: onekey check [options]

Options:
  -o, --out      Where to load the translations
  -p, --project  Id of the OneSky project
  -f, --files    Files to check
  -s, --secret   OneSky private key (it can be read from environment variable ONESKY_PRIVATE_KEY)
  -k, --apiKey   OneSky API key (it can be read from environment variable ONESKY_PUBLIC_KEY)
  -l, --fail     [OPTIONAL] Fail when there are missing files/keys (defaults to false)
```

## Generated output

This will generate a TypeScript type union with all the possible translation keys for your jsons (appended with the namespace that comes from the name of the file).

So if your translation files look like this:

```json
// main.json
{
  "hello": "Hello, friend",
  "friendly_hello": "Hello, {{name}}",
  "goodbye": "See you soon!",
}
// errors.json
{
  "hello": "Hello, seems there is a problem here!",
  "unknown": "I don't know what happened, but looks bad!",
}
```

Generate will give you something closer to this:

```typescript
type TranslationKeyWithoutOptions =
  | "main:hello"
  | "main:goodbye"
  | "errors:hello"
  | "errors:unknown";
type TranslationWithOptions = {
  "main:friendly_hello": { name: string };
};
type TranslationKeyWithOptions = keyof TranslationWithOptions;

export type TranslationKey =
  | TranslationKeyWithoutOptions
  | TranslationKeyWithOptions;
```
