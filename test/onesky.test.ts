import * as onesky from '../src/onesky';
import { either as E } from 'fp-ts';
import nock from 'nock';
import { nockFile, nockLanguages } from './oneSkyNock';

function assertEither<A>(
  value: E.Either<unknown, A>
): asserts value is E.Right<A> {
  expect(E.isRight(value)).toBe(true);
}

describe('onesky', () => {
  beforeEach(() => {
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
  });
  afterEach(() => {
    nock.enableNetConnect();
    nock.cleanAll();
  });

  it('gets languages', async () => {
    const oneSkyConfig = {
      apiKey: 'fakeApiKey',
      secret: 'fakeSecret',
      projectId: 123,
    };

    nockLanguages(oneSkyConfig);
    const result = await onesky.getLanguages(oneSkyConfig)();
    assertEither(result);
    expect(result.right).toEqual([
      {
        code: 'en-GB',
        english_name: 'English (United Kingdom)',
        is_ready_to_publish: true,
        local_name: 'English (United Kingdom)',
      },
      {
        code: 'pt-PT',
        english_name: 'Portuguese (Portugal)',
        is_ready_to_publish: true,
        local_name: 'Português (Europeu)',
      },
    ]);
  });

  it('gets multilingual files', async () => {
    const oneSkyConfig = {
      apiKey: 'fakeApiKey',
      secret: 'fakeSecret',
      fileName: 'main.json',
      projectId: 123,
    };

    nockFile(oneSkyConfig);
    const result = await onesky.getFile(oneSkyConfig)();
    assertEither(result);
    expect(result.right).toEqual({
      'en-GB': { hello: 'Hello' },
      'pt-PT': { hello: 'Olá' },
    });
  });
});
