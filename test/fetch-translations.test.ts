import { fetchTranslations } from '../src/fetch-translations';
import { nockFile, nockLanguages } from './oneSkyNock';
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
      projects: [{ id: 123, files: ['main.json'] }],
      secret: 'secret',
    };
    nockLanguages({
      apiKey: config.apiKey,
      secret: config.secret,
      projectId: config.projects[0].id,
    });
    nockFile({
      apiKey: config.apiKey,
      projectId: config.projects[0].id,
      fileName: config.projects[0].files[0],
      secret: config.secret,
    });

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
        },
      ],
    });
  });
});
