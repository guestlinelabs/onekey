import { either as E, taskEither as TE } from 'fp-ts';

export const toRecord = <A>(
  values: ReadonlyArray<readonly [string, A]>
): Record<string, A> => {
  return Object.fromEntries(values);
};

type TaskFn<Args, Result> = (args: Args) => TE.TaskEither<Error, Result>;

export const promisifyTaskEither = <Args, Result>(
  fn: TaskFn<Args, Result>
) => async (args: Args): Promise<Result> => {
  const x = await fn(args)();

  if (E.isLeft(x)) {
    throw x.left;
  }

  return x.right;
};
