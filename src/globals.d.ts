declare module "@guestlinelabs/onesky-utils" {
  export function getLanguages(opts: {
    secret: string;
    apiKey: string;
    projectId: number;
  }): Promise<string>;

  export function getMultilingualFile(opts: {
    language: string;
    secret: string;
    apiKey: string;
    projectId: number;
    fileName: string;
    format: string;
  }): Promise<string>;

  export function getFile(opts: {
    language: string;
    secret: string;
    apiKey: string;
    projectId: number;
    fileName: string;
  }): Promise<string>;
}

type Format =
  | "IOS_STRINGS"
  | "IOS_STRINGSDICT_XML"
  | "GNU_PO"
  | "ANDROID_XML"
  | "ANDROID_JSON"
  | "JAVA_PROPERTIES"
  | "RUBY_YML"
  | "RUBY_YAML"
  | "FLASH_XML"
  | "GNU_POT"
  | "RRC"
  | "RESX"
  | "HIERARCHICAL_JSON"
  | "PHP"
  | "PHP_SHORT_ARRAY"
  | "PHP_VARIABLES"
  | "HTML"
  | "RESW"
  | "YML"
  | "YAML"
  | "ADEMPIERE_XML"
  | "IDEMPIERE_XML"
  | "QT_TS_XML"
  | "XLIFF"
  | "RESJSON"
  | "TMX"
  | "L10N"
  | "INI"
  | "REQUIREJS";

export function postFile(opts: {
  projectId: number;
  format: Format;
  content: string;
  /**
   * For strings that cannot be found in newly uploaded file with same file name, keep those strings unchange if set to true.
   * Deprecate those strings if set to false. Notice that different files will not interfere each other in the same project.
   * For example, with setting is_keeping_all_strings to false, uploading en2.po will not deprecate strings of previously uploaded file, en.po.
   */
  keepStrings: boolean;
  secret: string;
  apiKey: string;
  language: string;
  fileName: string;
}): Promise<void>;
