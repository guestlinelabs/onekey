import nock from "nock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as onesky from "../src/onesky";
import { nockFile, nockLanguages } from "./oneSkyNock";

describe("onesky", () => {
  beforeEach(() => {
    nock.disableNetConnect();
    nock.enableNetConnect("127.0.0.1");
  });
  afterEach(() => {
    nock.enableNetConnect();
    nock.cleanAll();
  });

  it("gets languages", async () => {
    const oneSkyConfig = {
      apiKey: "fakeApiKey",
      secret: "fakeSecret",
      projectId: 123,
    };

    nockLanguages(oneSkyConfig);
    const result = await onesky.getLanguages(oneSkyConfig);
    expect(result).toEqual([
      {
        code: "en-GB",
        english_name: "English (United Kingdom)",
        is_ready_to_publish: true,
        local_name: "English (United Kingdom)",
      },
      {
        code: "pt-PT",
        english_name: "Portuguese (Portugal)",
        is_ready_to_publish: true,
        local_name: "Português (Europeu)",
      },
    ]);
  });

  it("gets multilingual files", async () => {
    const oneSkyConfig = {
      apiKey: "fakeApiKey",
      secret: "fakeSecret",
      fileName: "main.json",
      projectId: 123,
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
    };

    nockFile(oneSkyConfig);
    const result = await onesky.getFile(oneSkyConfig);
    expect(result).toEqual({
      "en-GB": { hello: "Hello" },
      "pt-PT": { hello: "Olá" },
    });
  });
});
