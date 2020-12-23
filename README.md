# onekey

Utility to download translations from [OneSky](https://www.oneskyapp.com/) and generate typed keys in Typescript for having typed translations.

## Installation
`onekey` can be installed using npm:
`npm i -g`

## Usage

There are two main commands to use: Fetch translations and Generate translation keys

### Fetch translations

```bash
Usage: onekey fetch [options]

Options:

  -o, --out      Path where translations will be saved
  -p, --project  Numeric id of the OneSky project
  -f, --files    Names of the files to download from the OneSky project separated by commas
  -s, --secret   OneSky private key (it can be read from environment variable ONESKY_SECRET)
  -k, --apiKey   OneSky API key (it can be read from environment variable ONESKY_API_KEY)
  -c, --prettier [OPTIONAL] Path for the prettier config
```

### Generate translation keys

```bash
Usage: onekey generate [options]

Options:

  -i, --input    Path for the json translations to read from
  -l, --locale   [OPTIONAL] Default locale to use (en-GB by default)
  -c, --prettier [OPTIONAL] Path for the prettier config
```

## Generated output

This will generate a TypeScript type union with all the possible translation keys for your jsons (appended with the namespace that comes from the name of the file).

So if your translation files look like this

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
  | 'main:hello'
  | 'main:goodbye'
  | 'errors:hello'
  | 'errors:unknown';
type TranslationWithOptions = {
  'main:friendly_hello': { name: string };
};
type TranslationKeyWithOptions = keyof TranslationWithOptions;

export type TranslationKey =
  | TranslationKeyWithoutOptions
  | TranslationKeyWithOptions;
```
