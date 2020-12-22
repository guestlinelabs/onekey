import { either, taskEither } from 'fp-ts';
import { fetchTranslations as fetchTranslationsTask } from './fetch-translations';

type TaskFn<Args, Result> = (
  args: Args
) => taskEither.TaskEither<Error, Result>;

const promisify = <Args, Result>(fn: TaskFn<Args, Result>) => async (
  args: Args
) => {
  const x = await fn(args)();

  if (either.isLeft(x)) {
    throw x.left;
  }

  return x.right;
};

export const fetchTranslations = promisify(fetchTranslationsTask);

export { generateKeys } from './generate-translation-keys';
export { saveKeys, saveTranslations } from './file';
