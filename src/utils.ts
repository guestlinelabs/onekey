import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import prettier from "prettier";
import type { z } from "zod";

export function unique<T>(x: T[]): T[] {
	return [...new Set(x)];
}

export const writeJSON = async (
	prettierConfig: prettier.Options,
	folder: string,
	fileName: string,
	content: Record<string, unknown> | unknown[],
): Promise<void> => {
	const pathToFile = path.resolve(folder, fileName);
	const fileContent = JSON.stringify(content, null, 2);
	const filePrettified = await prettier.format(fileContent, {
		...prettierConfig,
		parser: "json",
	});

	await mkdir(folder, { recursive: true });
	await writeFile(pathToFile, filePrettified, "utf-8");
};

const parseJSON = <T extends z.ZodTypeAny>(
	type: T,
	input: string,
): z.output<T> => {
	return type.parse(JSON.parse(input));
};

export const readJSON = async <T extends z.ZodTypeAny>(
	type: T,
	path: string,
): Promise<z.output<T>> => {
	const content = await readFile(path, "utf-8");

	return parseJSON(type, content);
};
