# OneKey

A local translation management utility with AI translation support and TypeScript key generation. OneKey provides a complete local-only workflow for managing translations with state tracking, AI-powered translation, and type-safe internationalization.

## Installation

```bash
npm install @guestlinelabs/onekey
```

## Table of Contents

- [CLI Usage](#cli-usage)
- [Local State Tracking](#local-state-tracking)
- [Programmatic API](#programmatic-api)
- [Advanced Features](#advanced-features)
- [Configuration Options](#configuration-options)
- [TypeScript Integration](#typescript-integration)
- [Examples and Best Practices](#examples-and-best-practices)
- [Migration from v1](#migration-from-v1)
- [Generated Output](#generated-output)

## CLI Usage

OneKey provides a local-only translation workflow with state tracking:

### Initialize translation state

Sets up local state tracking for translation freshness management. This is the first command you should run when setting up a new translation project.

```bash
Usage: onekey init [options]

Options:
  -p, --path              Path to translations directory (required)
  -l, --baseLocale        Base locale for translations (defaults to en-GB)
  --no-generate-keys      Disable automatic generation of translation.ts
```

**What it does:**

- Scans your base locale translation files
- Creates `oneKeyState.json` with timestamp tracking for all translation keys
- Sets up the foundation for translation freshness tracking
- Configures automatic generation of `translation.ts` (can be disabled with `--no-generate-keys`)

**Example:**

```bash
onekey init -p ./translations -l en-GB
onekey init -p ./translations --no-generate-keys
```

### Sync translation state

Synchronizes the translation state, generates TypeScript keys, and reports stale translations.

```bash
Usage: onekey sync [options]
```

**What it does:**

- Initializes new untracked keys and languages
- Generates `translation.ts` (unless disabled in init)
- Reports keys where translations are stale (base locale newer than translated locale)
- Reports missing translations
- Exits with code 1 if issues are found

**Example:**

```bash
onekey sync
```

### Check translation status

Read-only check for stale or missing translations (perfect for CI/CD).

```bash
Usage: onekey status [options]
```

**What it does:**

- Loads `oneKeyState.json` and compares timestamps across locales
- Reports keys where translations are stale (base locale newer than translated locale)
- Reports missing translations
- Never modifies state or generates files
- Exits with code 1 if issues are found (perfect for CI/CD)

**Example:**

```bash
onekey status
```



### Translate with AI

Uses AI to automatically translate your content into different languages with intelligent state tracking. Only translates stale or missing translations by default.

```bash
Usage: onekey translate [options]

Options:
  -p, --path       Path for the json translations (required)
  -l, --baseLocale [OPTIONAL] Base locale (defaults to language marked as default in languages.json)
  -u, --apiUrl     OpenAI API URL (it can be read from environment variable OPENAI_API_URL)
  -k, --apiKey     OpenAI API key (it can be read from environment variable OPENAI_API_KEY)
  -c, --prettier   [OPTIONAL] Path for the prettier config
  -x, --context    [OPTIONAL] File with additional context for the translations
  -t, --tone       [OPTIONAL] Tone of the translation (formal/informal/neutral, defaults to neutral)
  --updateAll      [OPTIONAL] Re-translate all keys even if not stale (defaults to false)
  --stats          [OPTIONAL] Print stale key statistics per locale (defaults to false)
```

**State-Aware Translation:**

- Only translates keys that are stale (base locale newer than target locale)
- Automatically updates state timestamps after successful translations
- Use `--updateAll` to force re-translation of all keys
- Use `--stats` to see how many stale keys exist per locale

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

## Local State Tracking

OneKey uses a local `oneKeyState.json` file to track translation freshness and manage the translation workflow without external dependencies.

### State File Structure

The `oneKeyState.json` file is created in your translations directory and tracks when each translation key was last modified:

```json
{
  "baseLocale": "en-GB",
  "modified": {
    "en-GB": {
      "main.hello": { "lastModified": "2025-07-30T14:00:00Z" },
      "main.goodbye": { "lastModified": "2025-07-30T14:05:00Z" },
      "errors.validation.required": { "lastModified": "2025-07-30T14:03:00Z" }
    },
    "es-ES": {
      "main.hello": { "lastModified": "2025-07-30T14:02:00Z" },
      "main.goodbye": { "lastModified": "2025-07-30T14:01:00Z" }
    }
  }
}
```

### Key Features

- **Namespaced Keys**: Keys are flattened with namespace prefixes (e.g., `main.hello`, `errors.validation.required`)
- **Timestamp Tracking**: ISO-8601 timestamps for precise modification tracking
- **Stale Detection**: Automatically identifies when base locale is newer than translations
- **Missing Translation Detection**: Reports keys that exist in base locale but not in target locales

### Workflow

1. **Initialize**: `onekey init` scans base locale and creates initial state
2. **Translate**: `onekey translate` updates only stale translations and updates timestamps
3. **Check**: `onekey status` reports current translation health
4. **Generate**: `onekey generate` creates TypeScript types from current translations

## Programmatic API

The library exports several functions for programmatic use in your Node.js applications:

### State Management Functions

#### loadState(statePath, baseLocale)

Loads the translation state from a JSON file.

```typescript
import { loadState } from "@guestlinelabs/onekey";

const state = await loadState("./translations/oneKeyState.json", "en-GB");
console.log(state.baseLocale); // 'en-GB'
console.log(state.modified); // Timestamp data
```

#### saveState(statePath, state)

Saves the translation state to a JSON file.

```typescript
import { saveState } from "@guestlinelabs/onekey";

await saveState("./translations/oneKeyState.json", state);
```

#### touch(state, locale, key, date?)

Updates the timestamp for a specific translation key.

```typescript
import { touch } from "@guestlinelabs/onekey";

touch(state, "en-GB", "main.hello", new Date());
```

#### isStale(state, baseLocale, locale, key)

Checks if a translation is stale (base locale newer than target locale).

```typescript
import { isStale } from "@guestlinelabs/onekey";

const stale = isStale(state, "en-GB", "es-ES", "main.hello");
console.log(stale); // true if es-ES translation is older than en-GB
```

#### diffState(state)

Generates a report of all stale translations.

```typescript
import { diffState } from "@guestlinelabs/onekey";

const diffs = diffState(state);
// Returns array of { locale, key, baseTs, localeTs }
```

### Core Functions

#### generateKeys(options)

Generates TypeScript type definitions from translation files.

```typescript
import { generateKeys } from "@guestlinelabs/onekey";

const typeDefinitions = await generateKeys({
  languages: [
    {
      code: "en-GB",
      englishName: "English",
      localName: "English",
      default: true,
    },
  ],
  translations: {
    "main.json": {
      hello: "Hello",
      welcome: "Welcome, {{name}}",
    },
  },
  defaultLocale: "en-GB",
  prettierConfig: {},
});

console.log(typeDefinitions); // Generated TypeScript code
```

#### translate(options)

Translates content using AI with state tracking.

```typescript
import { translate } from "@guestlinelabs/onekey";

const result = await translate({
  path: "./translations",
  apiUrl: "https://api.openai.com/v1",
  apiKey: "your-openai-key",
  baseLocale: "en-GB",
  context: "Hotel booking application",
  tone: "formal",
  updateAll: false, // Only translate stale keys
  stats: true, // Print statistics
});
```

### File Operations

#### saveKeys(options)

Saves generated TypeScript keys to a file.

```typescript
import { saveKeys } from "@guestlinelabs/onekey";

await saveKeys({
  translationsPath: "./translations",
  translationKeysPath: "./src/types",
  defaultLocale: "en-GB",
  prettierConfigPath: "./.prettierrc",
});
```

#### saveAiTranslations(options)

Translates and saves content using AI with state tracking.

```typescript
import { saveAiTranslations } from "@guestlinelabs/onekey";

await saveAiTranslations({
  path: "./translations",
  apiUrl: "https://api.openai.com/v1",
  apiKey: "your-openai-key",
  baseLocale: "en-GB",
  context: "E-commerce application",
  tone: "friendly",
  prettierConfigPath: "./.prettierrc",
  updateAll: false, // Only translate stale keys
  stats: true, // Print statistics
});
```

#### initializeState(options)

Initializes state tracking for a translation project.

```typescript
import { initializeState } from "@guestlinelabs/onekey";

await initializeState({
  translationsPath: "./translations",
  baseLocale: "en-GB",
});
```

#### checkStatus(options)

Checks translation status and returns exit code.

```typescript
import { checkStatus } from "@guestlinelabs/onekey";

const exitCode = await checkStatus({
  translationsPath: "./translations",
});

console.log(exitCode); // 0 if all good, 1 if issues found
```

## Advanced Features

### Local State Management

OneKey provides sophisticated local state tracking:

- **Timestamp Precision**: ISO-8601 timestamps for accurate freshness tracking
- **Namespaced Keys**: Flattened key structure with namespace prefixes
- **Stale Detection**: Intelligent comparison of modification times across locales
- **Missing Translation Detection**: Identifies keys that exist in base but not target locales

### Translation Chunking

For large translation files, the AI translation feature automatically:

- **Splits Large Files**: Breaks translations into chunks of 100 keys
- **Parallel Processing**: Processes multiple chunks concurrently
- **Memory Optimization**: Prevents API timeouts and memory issues
- **State Updates**: Updates timestamps only after successful translations

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

Generates flattened keys like: `"main.user.profile.name"`, `"main.user.profile.email"`

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

### Retry Logic and Error Handling

- **Exponential Backoff**: Automatic retry with increasing delays for failed API requests
- **Configurable Retries**: Up to 3 retry attempts with 5-second delays
- **Graceful Degradation**: Continues processing other files when individual files fail
- **State Consistency**: Only updates state after successful operations

## Configuration Options

### Prettier Integration

All file operations support Prettier formatting:

```typescript
// Automatic prettier config detection
await saveKeys({
  // ... other options
  prettierConfigPath: "./.prettierrc.json",
});
```

### Environment Variables

The library supports these environment variables:

- `OPENAI_API_URL` - OpenAI API endpoint
- `OPENAI_API_KEY` - OpenAI API key

### Project Structure

Expected directory structure:

```
translations/
├── oneKeyState.json             # Translation state tracking
├── languages.json         # Language definitions
├── en-GB/                # Base language
│   ├── main.json
│   └── errors.json
├── es-ES/                # Translated languages
│   ├── main.json
│   └── errors.json
└── translation.ts        # Generated types
```

### State File Format

The `oneKeyState.json` file structure:

```json
{
  "baseLocale": "en-GB",
  "modified": {
    "en-GB": {
      "main.hello": { "lastModified": "2025-07-30T14:00:00Z" },
      "errors.validation.required": { "lastModified": "2025-07-30T14:05:00Z" }
    },
    "es-ES": {
      "main.hello": { "lastModified": "2025-07-30T14:02:00Z" }
    }
  }
}
```

## TypeScript Integration

### Generated Types

The library generates comprehensive TypeScript types:

```typescript
// Generated types include:
export type Locale = "en-GB" | "es-ES" | "fr-FR";
export type Namespace = "main" | "errors";
export type TranslationKey = "main:hello" | "errors:unknown";
export type TranslationWithOptions = {
  "main:welcome": { name: string };
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
  "main:welcome": { name: string };
  "main:items": { count: number }; // 'count' is typed as number
};
```

### Usage in Applications

```typescript
import type { TranslationKey, Translator } from "./translations/translation";

const t: Translator = (key, options) => {
  // Your translation implementation
};

// Type-safe usage
t("main:hello"); // ✅ Valid
t("main:welcome", { name: "John" }); // ✅ Valid with required params
t("main:welcome"); // ❌ TypeScript error - missing required params
t("invalid:key"); // ❌ TypeScript error - invalid key
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
          node-version: "18"
      - run: npm install
      - run: npx onekey status -p ./translations
```

### Build Script Integration

```json
{
  "scripts": {
    "translations:init": "onekey init -p ./translations -l en-GB",
    "translations:sync": "onekey sync",
    "translations:status": "onekey status",
    "translations:ai": "onekey translate --context ./translation-context.txt",
    "translations:ai-all": "onekey translate --updateAll",
    "translations:stats": "onekey translate --stats",
    "build": "npm run translations:sync && next build"
  }
}
```

### Complete Local Workflow

```typescript
import {
	initializeState,
	checkStatus,
	syncState,
	translate,
	loadState,
	diffState,
} from "@guestlinelabs/onekey";

async function setupTranslations() {
	// 1. Initialize state tracking
	await initializeState({
		translationsPath: "./translations",
		baseLocale: "en-GB",
	});

	// 2. Sync state and generate translation.ts
	const exitCode = await syncState();

	if (exitCode === 0) {
		console.log("All translations up to date!");
		return;
	}

	// 3. Show stale translation statistics
	const state = await loadState();
	const diffs = diffState(state);
	console.log(`Found ${diffs.length} stale translations`);

	// 4. Translate stale keys only (syncState is called internally)
	await translate({
		path: "./translations",
		apiUrl: process.env.OPENAI_API_URL!,
		apiKey: process.env.OPENAI_API_KEY!,
		context: "Hotel booking application",
		tone: "formal",
		stats: true,
	});

	console.log("Translations updated successfully!");
}
```

### Error Handling

```typescript
import { translate, checkStatus } from "@guestlinelabs/onekey";

try {
  await translate({
    path: "./translations",
    apiUrl: process.env.OPENAI_API_URL!,
    apiKey: process.env.OPENAI_API_KEY!,
    updateAll: false,
  });
} catch (error) {
  if (error.message.includes("Missing required parameters")) {
    console.log("OpenAI API configuration required");
  } else if (error.message.includes("Failed to initialize state")) {
    console.log('Run "onekey init" first to set up state tracking');
  } else {
    console.error("Translation failed:", error);
  }
}

// Check status with proper error handling
try {
  const exitCode = await checkStatus({
    translationsPath: "./translations",
  });

  if (exitCode === 1) {
    console.log('Stale translations found - run "onekey translate" to update');
  }
} catch (error) {
  console.error("Status check failed:", error);
}
```

## Migration from v1

OneKey v2 introduces breaking changes by removing OneSky integration in favor of local-only translation management.

### Breaking Changes

- **Removed Commands**: `fetch`, `upload`, `check`, `generate` commands no longer exist
- **Removed Dependencies**: OneSky integration completely removed
- **New State System**: Requires `oneKeyState.json` for translation tracking
- **Updated API**: Programmatic APIs changed to support local state
- **New Commands**: `sync` command replaces `generate` functionality

### Migration Steps

1. **Initialize State Tracking**:

   ```bash
   onekey init -p ./translations -l en-GB
   ```

2. **Update Build Scripts**:

   ```json
   {
     "scripts": {
       "translations:sync": "onekey sync",
       "translations:status": "onekey status",
       "translations:translate": "onekey translate"
     }
   }
   ```

3. **Update Programmatic Usage**:

   ```typescript
   // v1 (removed)
   import {
     fetchTranslations,
     upload,
     checkTranslations,
     generateKeys,
   } from "@guestlinelabs/onekey";

   // v2 (new)
   import {
     initializeState,
     checkStatus,
     syncState,
     translate,
     loadState,
     saveState,
   } from "@guestlinelabs/onekey";
   ```

4. **Environment Variables**:
   - Remove: `ONESKY_PRIVATE_KEY`, `ONESKY_PUBLIC_KEY`
   - Keep: `OPENAI_API_URL`, `OPENAI_API_KEY`

5. **Replace generate command**:
   - Replace any `onekey generate` invocations with `onekey sync`
   - Use `onekey status` for read-only CI checks

### Benefits of v2

- **No External Dependencies**: Fully local translation management
- **State Tracking**: Intelligent freshness detection
- **Faster Workflows**: Only translate what's needed
- **Better CI/CD**: Simple status checks without API dependencies

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

export const locales = ["en-GB", "es-ES"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en-GB";

export const iso1ToLocale: { [key: string]: Locale } = {
  en: "en-GB",
  es: "es-ES",
};

export const languages: Array<{
  code: Locale;
  englishName: string;
  localName: string;
}> = [
  {
    code: "en-GB",
    englishName: "English (United Kingdom)",
    localName: "English (United Kingdom)",
  },
  {
    code: "es-ES",
    englishName: "Spanish (Spain)",
    localName: "Español (España)",
  },
];

export type Namespace = "main" | "errors";
export const namespaces: Namespace[] = ["main", "errors"];

export type TranslationKeyWithoutOptions =
  | "main:hello"
  | "main:goodbye"
  | "errors:hello"
  | "errors:unknown"
  | "errors:validation.required"
  | "errors:validation.email";

export type TranslationWithOptions = {
  "main:friendly_hello": { name: string };
  "main:items_count": { count: number };
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
