# onekey

A comprehensive utility for managing translations with [OneSky](https://www.oneskyapp.com/) and generating typed keys in TypeScript. This library provides both CLI commands and programmatic APIs for translation workflow automation, AI-powered translation, and type-safe internationalization.

## Installation

```bash
npm install @guestlinelabs/onekey
```

## Table of Contents

- [CLI Usage](#cli-usage)
- [Programmatic API](#programmatic-api)
- [Advanced Features](#advanced-features)
- [Configuration Options](#configuration-options)
- [TypeScript Integration](#typescript-integration)
- [Examples and Best Practices](#examples-and-best-practices)
- [Generated Output](#generated-output)

## CLI Usage

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

**Environment Variables:**
- `ONESKY_PRIVATE_KEY` - OneSky private key (fallback for --secret)
- `ONESKY_PUBLIC_KEY` - OneSky API key (fallback for --apiKey)

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

**Note:** If `--out` is not specified, the translation keys will be saved to `translation.ts` in the input directory.

### Upload translations

Pushes your local translation files to OneSky. This is typically used when you have new or updated base language translations that need to be translated into other languages.

```bash
Usage: onekey upload [options]

Options:
  -k, --apiKey     OneSky API key (it can be read from environment variable ONESKY_PUBLIC_KEY)
  -s, --secret     OneSky secret (it can be read from environment variable ONESKY_PRIVATE_KEY)
  -p, --project    OneSky project id
  -i, --input      Path for the translations
  -u, --untracked  [OPTIONAL] Upload only files with uncommitted changes (requires git repository)
  -r, --keepStrings [OPTIONAL] Keep strings that are not translated (defaults to false)
```

**Git Integration:**
- Use `--untracked` to upload only files that have been modified or are untracked in git
- Requires the project to be in a git repository
- Automatically detects modified and untracked JSON files

**Environment Variables:**
- `ONESKY_PRIVATE_KEY` - OneSky private key (fallback for --secret)
- `ONESKY_PUBLIC_KEY` - OneSky API key (fallback for --apiKey)

### Translate with AI

Uses OpenAI to automatically translate your content into different languages. This can be useful for getting initial translations or for less critical content that doesn't require professional human translation.

```bash
Usage: onekey translate [options]

Options:
  -p, --path       Path for the json translations
  -l, --baseLocale [OPTIONAL] Base locale (defaults to language marked as default in languages.json)
  -u, --apiUrl     OpenAI API URL (it can be read from environment variable OPENAI_API_URL)
  -k, --apiKey     OpenAI API key (it can be read from environment variable OPENAI_API_KEY)
  -c, --prettier   [OPTIONAL] Path for the prettier config
  -x, --context    [OPTIONAL] File with additional context for the translations
  -t, --tone       [OPTIONAL] Tone of the translation (formal/informal/neutral, defaults to neutral)
```

**Context File Support:**
- Provide a text file with additional context to improve translation quality
- Example: "These translations are used in a booking engine for hotel rooms"

**Translation Tones:**
- `formal` - Polite and professional language
- `informal` - Casual and friendly language  
- `neutral` - Balanced tone (default)

**Environment Variables:**
- `OPENAI_API_URL` - OpenAI API endpoint (fallback for --apiUrl)
- `OPENAI_API_KEY` - OpenAI API key (fallback for --apiKey)

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

**CI/CD Integration:**
- Use `--fail` to make the command exit with code 1 when issues are found
- Perfect for automated checks in build pipelines

**Environment Variables:**
- `ONESKY_PRIVATE_KEY` - OneSky private key (fallback for --secret)
- `ONESKY_PUBLIC_KEY` - OneSky API key (fallback for --apiKey)

## Programmatic API

The library exports several functions for programmatic use in your Node.js applications:

### fetchTranslations(config)

Fetches translations directly from OneSky API.

```typescript
import { fetchTranslations } from '@guestlinelabs/onekey';

const result = await fetchTranslations({
  apiKey: 'your-onesky-api-key',
  secret: 'your-onesky-secret',
  projects: [
    { id: 123, files: ['main.json', 'errors.json'] }
  ]
});

console.log(result.languages); // Available languages
console.log(result.translations); // Translation data
```

### generateKeys(options)

Generates TypeScript type definitions from translation files.

```typescript
import { generateKeys } from '@guestlinelabs/onekey';

const typeDefinitions = await generateKeys({
  languages: [
    { code: 'en-GB', englishName: 'English', localName: 'English' }
  ],
  translations: {
    'main.json': {
      hello: 'Hello',
      welcome: 'Welcome, {{name}}'
    }
  },
  defaultLocale: 'en-GB',
  prettierConfig: {}
});

console.log(typeDefinitions); // Generated TypeScript code
```

### translate(options)

Translates content using AI.

```typescript
import { translate } from '@guestlinelabs/onekey';

const result = await translate({
  path: './translations',
  apiUrl: 'https://api.openai.com/v1',
  apiKey: 'your-openai-key',
  baseLocale: 'en-GB',
  context: 'Hotel booking application',
  tone: 'formal'
});
```

### File Operations

#### saveKeys(options)

Saves generated TypeScript keys to a file.

```typescript
import { saveKeys } from '@guestlinelabs/onekey';

await saveKeys({
  translationsPath: './translations',
  translationKeysPath: './src/types',
  defaultLocale: 'en-GB',
  prettierConfigPath: './.prettierrc'
});
```

#### saveOneSkyTranslations(options)

Fetches and saves translations from OneSky.

```typescript
import { saveOneSkyTranslations } from '@guestlinelabs/onekey';

await saveOneSkyTranslations({
  oneSkyApiKey: 'your-api-key',
  oneSkySecret: 'your-secret',
  projects: [{ id: 123, files: ['main.json'] }],
  translationsPath: './translations',
  prettierConfigPath: './.prettierrc'
});
```

#### saveAiTranslations(options)

Translates and saves content using AI.

```typescript
import { saveAiTranslations } from '@guestlinelabs/onekey';

await saveAiTranslations({
  path: './translations',
  apiUrl: 'https://api.openai.com/v1',
  apiKey: 'your-openai-key',
  baseLocale: 'en-GB',
  context: 'E-commerce application',
  tone: 'friendly',
  prettierConfigPath: './.prettierrc'
});
```

#### upload(options)

Uploads translations to OneSky.

```typescript
import { upload } from '@guestlinelabs/onekey';

await upload({
  apiKey: 'your-api-key',
  secret: 'your-secret',
  projectId: 123,
  translationsPath: './translations',
  untrackedOnly: true, // Only upload git-modified files
  keepStrings: false   // Remove untranslated strings
});
```

### checkTranslations(config)

Validates local translations against OneSky.

```typescript
import { checkTranslations } from '@guestlinelabs/onekey';

const issues = await checkTranslations({
  apiKey: 'your-api-key',
  secret: 'your-secret',
  projects: [{ id: 123, files: ['main.json'] }],
  translationsPath: './translations'
});

console.log(issues); // Array of validation issues
```

## Advanced Features

### Git Integration

The library includes sophisticated git integration for tracking translation changes:

- **Untracked File Detection**: Automatically identifies modified and untracked JSON files
- **Repository Validation**: Ensures git is available and the project is a valid repository
- **Selective Uploads**: Upload only files that have been modified since the last commit

### Retry Logic and Error Handling

- **Exponential Backoff**: Automatic retry with increasing delays for failed API requests
- **Configurable Retries**: Up to 3 retry attempts with 5-second delays
- **Graceful Degradation**: Continues processing other files when individual files fail

### Language Code Normalization

The library automatically maps common language codes to their full locale identifiers:

```typescript
// Automatic mapping
'es' → 'es-ES'
'fr' → 'fr-FR'
'de' → 'de-DE'
'en' → 'en-GB'
// And more...
```

### Translation Chunking

For large translation files, the AI translation feature automatically:

- **Splits Large Files**: Breaks translations into chunks of 100 keys
- **Parallel Processing**: Processes multiple chunks concurrently
- **Memory Optimization**: Prevents API timeouts and memory issues

### Hierarchical JSON Support

Supports nested translation structures:

```json
{
  "user": {
    "profile": {
      "name": "Name",
      "email": "Email"
    }
  }
}
```

Generates keys like: `"user.profile.name"`, `"user.profile.email"`

## Configuration Options

### Prettier Integration

All file operations support Prettier formatting:

```typescript
// Automatic prettier config detection
await saveKeys({
  // ... other options
  prettierConfigPath: './.prettierrc.json'
});
```

### Environment Variables

The library supports these environment variables:

- `ONESKY_PRIVATE_KEY` - OneSky private key
- `ONESKY_PUBLIC_KEY` - OneSky API key  
- `OPENAI_API_URL` - OpenAI API endpoint
- `OPENAI_API_KEY` - OpenAI API key

### Project Structure

Expected directory structure:

```
translations/
├── languages.json          # Language definitions
├── en-GB/                 # Base language
│   ├── main.json
│   └── errors.json
├── es-ES/                 # Translated languages
│   ├── main.json
│   └── errors.json
└── translation.ts         # Generated types
```

## TypeScript Integration

### Generated Types

The library generates comprehensive TypeScript types:

```typescript
// Generated types include:
export type Locale = 'en-GB' | 'es-ES' | 'fr-FR';
export type Namespace = 'main' | 'errors';
export type TranslationKey = 'main:hello' | 'errors:unknown';
export type TranslationWithOptions = {
  'main:welcome': { name: string };
};
export type Translator = {
  (key: TranslationKeyWithoutOptions): string;
  <T extends TranslationKeyWithOptions>(
    key: T,
    options: TranslationWithOptions[T]
  ): string;
};
```

### Parameter Extraction

Automatically detects and types translation parameters:

```json
{
  "welcome": "Hello, {{name}}!",
  "items": "You have {{count}} items"
}
```

Generates:

```typescript
type TranslationWithOptions = {
  'main:welcome': { name: string };
  'main:items': { count: number }; // 'count' is typed as number
};
```

### Usage in Applications

```typescript
import type { TranslationKey, Translator } from './translations/translation';

const t: Translator = (key, options) => {
  // Your translation implementation
};

// Type-safe usage
t('main:hello'); // ✅ Valid
t('main:welcome', { name: 'John' }); // ✅ Valid with required params
t('main:welcome'); // ❌ TypeScript error - missing required params
t('invalid:key'); // ❌ TypeScript error - invalid key
```

## Examples and Best Practices

### CI/CD Pipeline Integration

```yaml
# .github/workflows/translations.yml
name: Check Translations
on: [push, pull_request]

jobs:
  check-translations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npx onekey check --out ./translations --project 123 --files main.json,errors.json --fail
        env:
          ONESKY_PRIVATE_KEY: ${{ secrets.ONESKY_PRIVATE_KEY }}
          ONESKY_PUBLIC_KEY: ${{ secrets.ONESKY_PUBLIC_KEY }}
```

### Build Script Integration

```json
{
  "scripts": {
    "translations:fetch": "onekey fetch -o ./translations -p 123 -f main.json,errors.json",
    "translations:generate": "onekey generate -i ./translations -l en-GB",
    "translations:upload": "onekey upload -p 123 -i ./translations --untracked",
    "translations:ai": "onekey translate -p ./translations --context ./translation-context.txt",
    "build": "npm run translations:generate && next build"
  }
}
```

### Programmatic Workflow

```typescript
import { 
  fetchTranslations, 
  generateKeys, 
  saveKeys,
  checkTranslations 
} from '@guestlinelabs/onekey';

async function updateTranslations() {
  // 1. Check for issues
  const issues = await checkTranslations({
    apiKey: process.env.ONESKY_PUBLIC_KEY!,
    secret: process.env.ONESKY_PRIVATE_KEY!,
    projects: [{ id: 123, files: ['main.json'] }],
    translationsPath: './translations'
  });

  if (issues.length > 0) {
    console.log('Translation issues found:', issues);
    return;
  }

  // 2. Fetch latest translations
  const result = await fetchTranslations({
    apiKey: process.env.ONESKY_PUBLIC_KEY!,
    secret: process.env.ONESKY_PRIVATE_KEY!,
    projects: [{ id: 123, files: ['main.json'] }]
  });

  // 3. Generate TypeScript types
  await saveKeys({
    translationsPath: './translations',
    translationKeysPath: './src/types',
    defaultLocale: 'en-GB'
  });

  console.log('Translations updated successfully!');
}
```

### Error Handling

```typescript
import { upload } from '@guestlinelabs/onekey';

try {
  await upload({
    apiKey: 'your-api-key',
    secret: 'your-secret',
    projectId: 123,
    translationsPath: './translations',
    untrackedOnly: true
  });
} catch (error) {
  if (error.message.includes('Git is not available')) {
    console.log('Git integration requires git to be installed');
  } else if (error.message.includes('Not a git repository')) {
    console.log('Untracked mode requires a git repository');
  } else {
    console.error('Upload failed:', error);
  }
}
```

## Generated Output

The `generate` command creates comprehensive TypeScript type definitions from your translation files.

### Input Structure

```json
// languages.json
[
  {
    "code": "en-GB",
    "englishName": "English (United Kingdom)",
    "localName": "English (United Kingdom)",
    "default": true
  },
  {
    "code": "es-ES", 
    "englishName": "Spanish (Spain)",
    "localName": "Español (España)"
  }
]

// en-GB/main.json
{
  "hello": "Hello, friend",
  "friendly_hello": "Hello, {{name}}",
  "goodbye": "See you soon!",
  "items_count": "You have {{count}} items"
}

// en-GB/errors.json
{
  "hello": "Hello, seems there is a problem here!",
  "unknown": "I don't know what happened, but looks bad!",
  "validation": {
    "required": "This field is required",
    "email": "Please enter a valid email"
  }
}
```

### Generated Output

```typescript
// This file was autogenerated on 2024-01-15T10:30:00.000Z.
// DO NOT EDIT THIS FILE.

export const locales = ['en-GB', 'es-ES'] as const;
export type Locale = typeof locales[number];
export const defaultLocale: Locale = 'en-GB';

export const iso1ToLocale: { [key: string]: Locale } = {
  en: 'en-GB',
  es: 'es-ES'
};

export const languages: Array<{ 
  code: Locale; 
  englishName: string; 
  localName: string 
}> = [
  {
    "code": "en-GB",
    "englishName": "English (United Kingdom)", 
    "localName": "English (United Kingdom)"
  },
  {
    "code": "es-ES",
    "englishName": "Spanish (Spain)",
    "localName": "Español (España)"
  }
];

export type Namespace = 'main' | 'errors';
export const namespaces: Namespace[] = ['main', 'errors'];

export type TranslationKeyWithoutOptions = 
  | 'main:hello'
  | 'main:goodbye'
  | 'errors:hello'
  | 'errors:unknown'
  | 'errors:validation.required'
  | 'errors:validation.email';

export type TranslationWithOptions = {
  'main:friendly_hello': { name: string };
  'main:items_count': { count: number };
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
```

### Key Features

- **Locale Management**: Complete locale definitions with ISO mappings
- **Namespace Support**: Organized by translation file names
- **Parameter Typing**: Automatic detection of `{{variable}}` patterns
- **Special Handling**: `count` parameters are typed as `number`
- **Nested Keys**: Support for hierarchical JSON structures with dot notation
- **Type Safety**: Full TypeScript integration with compile-time validation
