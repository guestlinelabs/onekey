import { either as E, taskEither as TE, record as R } from 'fp-ts';
import * as t from 'io-ts';
import { flow, pipe, constant } from 'fp-ts/lib/function';
import onesky from '@brainly/onesky-utils';

function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  if (
    typeof e === 'object' &&
    typeof (e as Record<string, unknown>)['message'] === 'string'
  )
    return new Error((e as Record<'message', string>).message);
  return new Error(String(e));
}

function parseJSON(e: string): E.Either<Error, unknown> {
  return E.tryCatch(() => JSON.parse(e), toError);
}

const OneSkyLanguageInfo = t.strict({
  is_ready_to_publish: t.boolean,
  code: t.string,
  english_name: t.string,
  local_name: t.string,
});
type OneSkyLanguageInfo = t.TypeOf<typeof OneSkyLanguageInfo>;
const OneSkyLanguageResponse = t.strict({
  data: t.array(OneSkyLanguageInfo),
});

const TranslationSchema = t.record(
  t.string,
  t.union([t.string, t.record(t.string, t.string)])
);
type TranslationSchema = t.TypeOf<typeof TranslationSchema>;

const OneSkyMultilingualFileResponse = t.record(
  t.string,
  t.record(t.literal('translation'), TranslationSchema)
);
type OneSkyMultilingualFileResponse = t.TypeOf<
  typeof OneSkyMultilingualFileResponse
>;

interface TranslationFile {
  [languageCode: string]: TranslationSchema;
}

export interface ProjectTranslations {
  [fileName: string]: TranslationFile;
}

export interface OneSky {
  getLanguages: (opts: {
    apiKey: string;
    secret: string;
    projectId: number;
  }) => TE.TaskEither<Error, OneSkyLanguageInfo[]>;
  getFile: (opts: {
    apiKey: string;
    secret: string;
    projectId: number;
    fileName: string;
  }) => TE.TaskEither<Error, TranslationFile>;
}

export const getLanguages: OneSky['getLanguages'] = ({
  apiKey,
  secret,
  projectId,
}) => {
  return pipe(
    TE.tryCatch(
      () => onesky.getLanguages({ secret, apiKey, projectId }),
      toError
    ),
    TE.chainEitherK(
      flow(
        parseJSON,
        E.chain((json) =>
          pipe(
            json,
            OneSkyLanguageResponse.decode,
            E.bimap(
              constant(new Error('Error getting OneSky language info')),
              (x) => x.data
            )
          )
        )
      )
    )
  );
};

export const getFile: OneSky['getFile'] = ({
  apiKey,
  secret,
  projectId,
  fileName,
}) => {
  return pipe(
    TE.tryCatch(
      () =>
        onesky.getMultilingualFile({
          secret,
          apiKey,
          projectId,
          fileName,
          language: 'en_EN',
          format: 'I18NEXT_MULTILINGUAL_JSON',
        }),
      toError
    ),
    TE.chainEitherK(
      flow(
        parseJSON,
        E.chain(
          flow(
            OneSkyMultilingualFileResponse.decode,
            E.bimap(
              constant(new Error('Error getting OneSky translation')),
              R.map((x) => x.translation)
            )
          )
        )
      )
    )
  );
};
