import { z } from 'zod';

export const LanguageInfo = z.object({
  code: z.string(),
  englishName: z.string(),
  localName: z.string(),
});
export type LanguageInfo = z.infer<typeof LanguageInfo>;

export const TranslationSchema = z.record(
  z.string(),
  z.union([z.string(), z.record(z.string(), z.string())])
);
export type TranslationSchema = z.infer<typeof TranslationSchema>;

export interface TranslationFile {
  [languageCode: string]: TranslationSchema;
}

export interface ProjectTranslations {
  [fileName: string]: TranslationFile;
}

export interface TranslationOutput {
  languages: LanguageInfo[];
  translations: ReadonlyArray<ProjectTranslations>;
}
