import nock from 'nock';
import md5 from 'md5';

const languageData = {
  meta: { status: 200, record_count: 2 },
  data: [
    {
      code: 'en-GB',
      english_name: 'English (United Kingdom)',
      local_name: 'English (United Kingdom)',
      custom_locale: null,
      locale: 'en',
      region: 'GB',
      is_base_language: true,
      is_ready_to_publish: true,
      translation_progress: '100.0%',
      last_updated_at: '2020-12-09T16:13:01+0000',
      last_updated_at_timestamp: 1607530381,
    },
    {
      code: 'pt-PT',
      english_name: 'Portuguese (Portugal)',
      local_name: 'Português (Europeu)',
      custom_locale: null,
      locale: 'pt',
      region: 'PT',
      is_base_language: false,
      is_ready_to_publish: true,
      translation_progress: '91.7%',
      last_updated_at: '2020-12-09T16:41:50+0000',
      last_updated_at_timestamp: 1607532110,
    },
  ],
};

const translationData = {
  'pt-PT': {
    translation: {
      hello: 'Olá',
    },
  },
  'en-GB': {
    translation: {
      hello: 'Hello',
    },
  },
};

const getDevHash = (secret: string, timestamp: number): string =>
  md5(String(timestamp) + secret);

const nockOneSky = () => nock('https://platform.api.onesky.io/');

export const nockLanguages = (cfg: {
  secret: string;
  projectId: number;
  apiKey: string;
}): nock.Scope =>
  nockOneSky()
    .get(`//1/projects/${cfg.projectId}/languages`)
    .query((obj) => {
      return (
        obj.api_key === cfg.apiKey &&
        !!Number(obj.timestamp) &&
        obj.dev_hash === getDevHash(cfg.secret, Number(obj.timestamp))
      );
    })
    .reply(200, languageData);

export const nockFile = (cfg: {
  projectId: number;
  secret: string;
  fileName: string;
  apiKey: string;
}): nock.Scope =>
  nockOneSky()
    .get(`//1/projects/${cfg.projectId}/translations/multilingual`)
    .query(
      (obj) =>
        obj.source_file_name === cfg.fileName &&
        obj.file_format === 'I18NEXT_MULTILINGUAL_JSON' &&
        obj.api_key === cfg.apiKey &&
        !!Number(obj.timestamp) &&
        obj.dev_hash === getDevHash(cfg.secret, Number(obj.timestamp))
    )
    .reply(200, translationData);
