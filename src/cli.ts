#!/usr/bin/env node

import { z } from 'zod';
import yargs from 'yargs/yargs';
import { saveKeys, saveTranslations } from './file';
import { checkTranslations } from './check-translations';

const readEnv = (key: string): string => {
  const env = process.env[key];

  if (!env)
    throw Error(`Could not find key ${key} in the environment variables`);

  return env;
};

const ValidCommand = z.enum(['fetch', 'generate', 'check']);
type ValidCommand = z.infer<typeof ValidCommand>;
const ValidYargCommand = z.object({
  _: z.tuple([ValidCommand]),
});

const YargsFetchArguments = z.object({
  out: z.string(),
  project: z.number(),
  files: z.string(),
  prettier: z.string().optional(),
  secret: z.string().optional(),
  apiKey: z.string().optional(),
});
type YargsFetchArguments = z.infer<typeof YargsFetchArguments>;
interface FetchArguments extends Omit<YargsFetchArguments, 'files'> {
  files: string[];
  secret: string;
  apiKey: string;
}

const YargsCheckArguments = z.object({
  out: z.string(),
  project: z.number(),
  files: z.string(),
  fail: z.boolean(),
  secret: z.string().optional(),
  apiKey: z.string().optional(),
});
type YargsCheckArguments = z.infer<typeof YargsCheckArguments>;
interface CheckArguments extends Omit<YargsCheckArguments, 'files'> {
  files: string[];
  secret: string;
  apiKey: string;
}

const GenerateArguments = z.object({
  input: z.string(),
  prettier: z.string().optional(),
  locale: z.string().optional(),
  out: z.string().optional(),
});
type GenerateArguments = z.infer<typeof GenerateArguments>;

type Operation =
  | { command: 'fetch'; args: FetchArguments }
  | { command: 'generate'; args: GenerateArguments }
  | { command: 'check'; args: CheckArguments };

function getFileNames(input: string): string[] {
  return input
    .split(',')
    .map((x) => x.trim())
    .map((x) => (x.endsWith('.json') ? x : `${x}.json`));
}

function getFetchArguments(yargsInput: unknown): FetchArguments {
  try {
    const args = YargsFetchArguments.parse(yargsInput);

    return {
      files: getFileNames(args.files),
      out: args.out,
      prettier: args.prettier,
      project: args.project,
      secret: args.secret ?? readEnv('ONESKY_PRIVATE_KEY'),
      apiKey: args.apiKey ?? readEnv('ONESKY_PUBLIC_KEY'),
    };
  } catch (err) {
    throw Error('Failure trying to retrieve the arguments');
  }
}

function getCheckArguments(yargsInput: unknown): CheckArguments {
  try {
    const args = YargsCheckArguments.parse(yargsInput);

    return {
      files: getFileNames(args.files),
      out: args.out,
      fail: args.fail,
      project: args.project,
      secret: args.secret ?? readEnv('ONESKY_PRIVATE_KEY'),
      apiKey: args.apiKey ?? readEnv('ONESKY_PUBLIC_KEY'),
    };
  } catch (err) {
    throw Error('Failure trying to retrieve the arguments');
  }
}

function getGenerateArguments(yargsInput: unknown): GenerateArguments {
  try {
    const args = GenerateArguments.parse(yargsInput);

    return args;
  } catch (err) {
    throw Error('Failure trying to retrieve the arguments');
  }
}

function getOperation(yargsInput: unknown): Operation {
  try {
    const [command] = ValidYargCommand.parse(yargsInput)._;

    switch (command) {
      case 'fetch':
        return {
          command: 'fetch',
          args: getFetchArguments(yargsInput),
        };
      case 'generate':
        return {
          command: 'generate',
          args: getGenerateArguments(yargsInput),
        };
      case 'check':
        return {
          command: 'check',
          args: getCheckArguments(yargsInput),
        };
    }
  } catch (err) {
    throw Error('Failure trying to retrieve the arguments');
  }
}

async function check(args: CheckArguments) {
  const checks = await checkTranslations({
    apiKey: args.apiKey,
    secret: args.secret,
    translationsPath: args.out,
    projects: [{ id: args.project, files: args.files }],
  });

  if (!checks.length) {
    console.log('All looks up-to-date.');
    process.exit(0);
  } else {
    const logLevel = args.fail ? 'error' : 'log';
    const print = console[logLevel];

    print('Found the following problems:');
    print('');
    for (const problem of checks) {
      print(problem);
    }

    process.exit(args.fail ? 1 : 0);
  }
}

const yarg = yargs(process.argv.slice(2))
  .scriptName('onekey')
  .command(
    'fetch',
    'Fetch onesky json files and save them in a folder',
    (yargs) =>
      yargs
        .options({
          out: {
            type: 'string',
            demandOption: true,
            alias: 'o',
            describe: 'Where to save the translations',
          },
          project: {
            type: 'number',
            demandOption: true,
            alias: 'p',
            describe: 'Id of the OneSky project',
          },
          files: {
            type: 'string',
            demandOption: true,
            alias: 'f',
            describe: 'Files to download',
          },
          secret: {
            type: 'string',
            alias: 's',
            describe:
              'OneSky private key (it can be read from the environment variable ONESKY_PRIVATE_KEY)',
          },
          apiKey: {
            type: 'string',
            alias: 'k',
            describe:
              'OneSky API key (it can be read from the environment variable ONESKY_PUBLIC_KEY)',
          },
          prettier: {
            type: 'string',
            alias: 'c',
            describe: 'Path for the prettier config',
          },
        })
        .help()
  )
  .command(
    'check',
    'Fetch onesky json files and check them against a folder',
    (yargs) =>
      yargs
        .options({
          out: {
            type: 'string',
            demandOption: true,
            alias: 'o',
            describe: 'Where to load the translations',
          },
          project: {
            type: 'number',
            demandOption: true,
            alias: 'p',
            describe: 'Id of the OneSky project',
          },
          files: {
            type: 'string',
            demandOption: true,
            alias: 'f',
            describe: 'Files to check',
          },
          secret: {
            type: 'string',
            alias: 's',
            describe:
              'OneSky private key (it can be read from the environment variable ONESKY_PRIVATE_KEY)',
          },
          apiKey: {
            type: 'string',
            alias: 'k',
            describe:
              'OneSky API key (it can be read from the environment variable ONESKY_PUBLIC_KEY)',
          },
          fail: {
            type: 'boolean',
            default: false,
            alias: 'l',
            describe: 'Fail when there are missing files/keys',
          },
        })
        .help()
  )
  .command(
    'generate',
    'Generate typescript keys for the translations',
    (yargs) =>
      yargs.options({
        input: {
          type: 'string',
          demandOption: true,
          alias: 'i',
          describe: 'Path for the json translations',
        },
        out: {
          type: 'string',
          alias: 'o',
          describe: 'Where to save the translation keys',
        },
        prettier: {
          type: 'string',
          alias: 'c',
          describe: 'Path for the prettier config',
        },
        locale: {
          type: 'string',
          alias: 'l',
          describe: 'Default locale to use',
        },
      })
  )
  .help();

const program = async () => {
  try {
    const operation = getOperation(yarg.argv);

    try {
      switch (operation.command) {
        case 'fetch':
          await saveTranslations({
            oneSkyApiKey: operation.args.apiKey,
            oneSkySecret: operation.args.secret,
            translationsPath: operation.args.out,
            projects: [
              { id: operation.args.project, files: operation.args.files },
            ],
            prettierConfigPath: operation.args.prettier,
          });
          break;
        case 'check':
          await check(operation.args);
          break;
        case 'generate':
          await saveKeys({
            defaultLocale: operation.args.locale || 'en-GB',
            prettierConfigPath: operation.args.prettier,
            translationsPath: operation.args.input,
            translationKeysPath: operation.args.out || operation.args.input,
          });
          break;
      }
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  } catch (err) {
    console.error((err as Error).message);
    yarg.showHelp();
  }
};

program();
