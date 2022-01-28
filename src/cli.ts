#!/usr/bin/env node

import { apply as AP, option as O, either as E, ioEither as IOE } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import * as t from 'io-ts';
import yargs from 'yargs/yargs';
import { saveKeys, saveTranslations } from './file';
import { checkTranslations } from './check-translations';
import { promisifyTaskEither } from './utils';

const strictPartial = flow(t.partial, t.exact);

const readEnv =
  (key: string): IOE.IOEither<Error, string> =>
  () =>
    pipe(
      process.env[key],
      E.fromNullable(
        new Error(`Could not find key ${key} in the environment variables`)
      )
    );

const ValidCommand = t.union([
  t.literal('fetch'),
  t.literal('generate'),
  t.literal('check'),
]);
type ValidCommand = t.TypeOf<typeof ValidCommand>;
const ValidYargCommand = t.strict({
  _: t.tuple([ValidCommand]),
});

const YargsFetchArguments = t.intersection([
  t.strict({ out: t.string, project: t.number, files: t.string }),
  strictPartial({
    prettier: t.string,
    secret: t.string,
    apiKey: t.string,
  }),
]);
type YargsFetchArguments = t.TypeOf<typeof YargsFetchArguments>;
interface FetchArguments extends Omit<YargsFetchArguments, 'files'> {
  files: string[];
  secret: string;
  apiKey: string;
}

const YargsCheckArguments = t.intersection([
  t.strict({
    out: t.string,
    project: t.number,
    files: t.string,
    fail: t.boolean,
  }),
  strictPartial({
    secret: t.string,
    apiKey: t.string,
  }),
]);
type YargsCheckArguments = t.TypeOf<typeof YargsCheckArguments>;
interface CheckArguments extends Omit<YargsCheckArguments, 'files'> {
  files: string[];
  secret: string;
  apiKey: string;
}

const GenerateArguments = t.intersection([
  t.strict({ input: t.string }),
  strictPartial({
    prettier: t.string,
    locale: t.string,
    out: t.string,
  }),
]);
type GenerateArguments = t.TypeOf<typeof GenerateArguments>;

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

function getFetchArguments(
  yargsInput: unknown
): IOE.IOEither<Error, FetchArguments> {
  return pipe(
    yargsInput,
    YargsFetchArguments.decode,
    E.mapLeft(() => new Error('Failure trying to retrieve the arguments')),
    IOE.fromEither,
    IOE.chain((args) =>
      AP.sequenceS(IOE.ioEither)({
        files: IOE.right(getFileNames(args.files)),
        out: IOE.right(args.out),
        prettier: IOE.right(args.prettier),
        project: IOE.right(args.project),
        secret: pipe(
          args.secret,
          O.fromNullable,
          O.fold(
            () => readEnv('ONESKY_PRIVATE_KEY'),
            (x): IOE.IOEither<Error, string> =>
              () =>
                E.right(x)
          )
        ),
        apiKey: pipe(
          args.apiKey,
          O.fromNullable,
          O.fold(
            () => readEnv('ONESKY_PUBLIC_KEY'),
            (x): IOE.IOEither<Error, string> =>
              () =>
                E.right(x)
          )
        ),
      })
    )
  );
}

function getCheckArguments(
  yargsInput: unknown
): IOE.IOEither<Error, CheckArguments> {
  return pipe(
    yargsInput,
    YargsCheckArguments.decode,
    E.mapLeft(() => new Error('Failure trying to retrieve the arguments')),
    IOE.fromEither,
    IOE.chain((args) =>
      AP.sequenceS(IOE.ioEither)({
        files: IOE.right(getFileNames(args.files)),
        out: IOE.right(args.out),
        fail: IOE.right(args.fail),
        project: IOE.right(args.project),
        secret: pipe(
          args.secret,
          O.fromNullable,
          O.fold(
            () => readEnv('ONESKY_PRIVATE_KEY'),
            (x): IOE.IOEither<Error, string> =>
              () =>
                E.right(x)
          )
        ),
        apiKey: pipe(
          args.apiKey,
          O.fromNullable,
          O.fold(
            () => readEnv('ONESKY_PUBLIC_KEY'),
            (x): IOE.IOEither<Error, string> =>
              () =>
                E.right(x)
          )
        ),
      })
    )
  );
}

function getGenerateArguments(
  yargsInput: unknown
): E.Either<Error, GenerateArguments> {
  return pipe(
    yargsInput,
    GenerateArguments.decode,
    E.mapLeft(() => new Error('Failure trying to retrieve the arguments'))
  );
}

function getOperation(yargsInput: unknown): IOE.IOEither<Error, Operation> {
  return pipe(
    ValidYargCommand.decode(yargsInput),
    E.mapLeft(() => new Error('Failure trying to retrieve the arguments')),
    E.map((x) => x._[0]),
    IOE.fromEither,
    IOE.chain((command) =>
      AP.sequenceS(IOE.ioEither)(
        command === 'fetch'
          ? {
              command: IOE.right('fetch' as const),
              args: getFetchArguments(yargsInput),
            }
          : command === 'generate'
          ? {
              command: IOE.right('generate' as const),
              args: pipe(getGenerateArguments(yargsInput), IOE.fromEither),
            }
          : {
              command: IOE.right('check' as const),
              args: getCheckArguments(yargsInput),
            }
      )
    )
  );
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
            alias: 'f',
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

const program = pipe(
  yarg.argv,
  getOperation,
  IOE.fold(
    (error) => () => {
      console.error(error.message);
      yarg.showHelp();
    },
    (operation) => async () => {
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
            await promisifyTaskEither(saveKeys)({
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
    }
  )
);

program();
