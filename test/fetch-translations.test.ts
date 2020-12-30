import { fetchTranslations } from '../src/fetch-translations';
import { nockFile, nockLanguages, nockProject } from './oneSkyNock';
import { either as E } from 'fp-ts';
import nock from 'nock';

function assertEither<A>(
  value: E.Either<unknown, A>
): asserts value is E.Right<A> {
  expect(E.isRight(value)).toBe(true);
}

describe('fetching translations', () => {
  beforeEach(() => {
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
  });
  afterEach(() => {
    nock.enableNetConnect();
    nock.cleanAll();
  });

  it('will fetch translations and languages', async () => {
    const config = {
      apiKey: 'apiKey',
      projects: [{ id: 123, files: ['main.json', 'errors.json'] }],
      secret: 'secret',
    };
    nockProject(config);

    const result = await fetchTranslations(config)();
    assertEither(result);

    expect(result.right).toEqual({
      languages: [
        {
          code: 'en-GB',
          englishName: 'English (United Kingdom)',
          localName: 'English (United Kingdom)',
        },
        {
          code: 'pt-PT',
          englishName: 'Portuguese (Portugal)',
          localName: 'Português (Europeu)',
        },
      ],
      translations: [
        {
          'main.json': {
            'en-GB': {
              hello: 'Hello',
            },
            'pt-PT': {
              hello: 'Olá',
            },
          },
          'errors.json': {
            'pt-PT': {
              failure: 'falha falha',
            },
            'en-GB': {
              failure: 'Failure',
            },
          },
        },
      ],
    });
  });
});
