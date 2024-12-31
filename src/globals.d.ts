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
