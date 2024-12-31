import nock from "nock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fetchTranslations } from "../src/fetch-translations";
import { nockProject } from "./oneSkyNock";

describe("fetching translations", () => {
  beforeEach(() => {
    nock.disableNetConnect();
    nock.enableNetConnect("127.0.0.1");
  });
  afterEach(() => {
    nock.enableNetConnect();
    nock.cleanAll();
  });

  it("will fetch translations and languages", async () => {
    const config = {
      apiKey: "apiKey",
      projects: [{ id: 123, files: ["main.json", "errors.json"] }],
      secret: "secret",
    };
    nockProject(config);

    const result = await fetchTranslations(config);

    expect(result).toEqual({
      languages: [
        {
          code: "en-GB",
          englishName: "English (United Kingdom)",
          localName: "English (United Kingdom)",
        },
        {
          code: "pt-PT",
          englishName: "Portuguese (Portugal)",
          localName: "Português (Europeu)",
        },
      ],
      translations: [
        {
          "main.json": {
            "en-GB": {
              hello: "Hello",
            },
            "pt-PT": {
              hello: "Olá",
            },
          },
          "errors.json": {
            "pt-PT": {
              failure: "falha falha",
            },
            "en-GB": {
              failure: "Failure",
            },
          },
        },
      ],
    });
  });
});
