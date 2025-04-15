import { uploadFile } from "./onesky";
import type { TranslationSchema } from "./types";

interface UploadTranslationsConfiguration {
	apiKey: string;
	secret: string;
	projectId: number;
	translations: Record<string, Record<string, TranslationSchema>>;
	keepStrings: boolean;
}

export async function uploadTranslations({
	apiKey,
	secret,
	projectId,
	translations: fileTranslations,
	keepStrings,
}: UploadTranslationsConfiguration): Promise<void> {
	for (const [language, translations] of Object.entries(fileTranslations)) {
		for (const [fileName, translation] of Object.entries(translations)) {
			await uploadFile(
				apiKey,
				secret,
				projectId,
				language,
				fileName,
				translation,
				keepStrings,
			);
		}
	}
}
