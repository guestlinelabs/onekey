#!/usr/bin/env node

import { apply, option, either, ioEither } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import * as t from 'io-ts';
import yargs from 'yargs/yargs';
import { saveKeys, saveTranslations } from './file';

const strictPartial = flow(t.partial, t.exact);

const readEnv = (key: string): ioEither.IOEither<Error, string> => () =>
  pipe(
    process.env[key],
    either.fromNullable(
      new Error(`Could not find key ${key} in the environment variables`)
    )
  );

const ValidCommand = t.union([t.literal('fetch'), t.literal('generate')]);
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

const GenerateArguments = t.intersection([
  t.strict({ input: t.string }),
  strictPartial({
    prettier: t.string,
    locale: t.string,
  }),
]);
type GenerateArguments = t.TypeOf<typeof GenerateArguments>;
type Operation =
  | { command: 'fetch'; args: FetchArguments }
  | { command: 'generate'; args: GenerateArguments };

function getFileNames(input: string): string[] {
  return input
    .split(',')
    .map((x) => x.trim())
    .map((x) => (x.endsWith('.json') ? x : `${x}.json`));
}

function getFetchArguments(
  yargsInput: unknown
): ioEither.IOEither<Error, FetchArguments> {
  return pipe(
    yargsInput,
    YargsFetchArguments.decode,
    either.mapLeft(() => new Error('Failure trying to retrieve the arguments')),
    ioEither.fromEither,
    ioEither.chain((args) =>
      apply.sequenceS(ioEither.ioEither)({
        files: ioEither.right(getFileNames(args.files)),
        out: ioEither.right(args.out),
        prettier: ioEither.right(args.prettier),
        project: ioEither.right(args.project),
        secret: pipe(
          args.secret,
          option.fromNullable,
          option.fold(
            () => readEnv('ONESKY_PRIVATE_KEY'),
            (x): ioEither.IOEither<Error, string> => () => either.right(x)
          )
        ),
        apiKey: pipe(
          args.apiKey,
          option.fromNullable,
          option.fold(
            () => readEnv('ONESKY_PUBLIC_KEY'),
            (x): ioEither.IOEither<Error, string> => () => either.right(x)
          )
        ),
      })
    )
  );
}

function getGenerateArguments(
  yargsInput: unknown
): either.Either<Error, GenerateArguments> {
  return pipe(
    yargsInput,
    GenerateArguments.decode,
    either.mapLeft(() => new Error('Failure trying to retrieve the arguments'))
  );
}

function getOperation(input: unknown): ioEither.IOEither<Error, Operation> {
  return pipe(
    ValidYargCommand.decode(input),
    either.mapLeft(() => new Error('Failure trying to retrieve the arguments')),
    either.map((x) => x._[0]),
    ioEither.fromEither,
    ioEither.chain((command) =>
      apply.sequenceS(ioEither.ioEither)(
        command === 'fetch'
          ? {
              command: ioEither.right('fetch' as const),
              args: getFetchArguments(input),
            }
          : {
              command: ioEither.right('generate' as const),
              args: pipe(getGenerateArguments(input), ioEither.fromEither),
            }
      )
    )
  );
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
  ioEither.fold(
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
            });
            break;
          case 'generate':
            await saveKeys({
              defaultLocale: operation.args.locale || 'en-GB',
              prettierConfigPath: operation.args.prettier,
              translationsPath: operation.args.input,
            });
            break;
        }
      } catch (err) {
        console.error('oopsie', err);
      }
    }
  )
);

program();
