#!/usr/bin/env node

import yargs from "yargs/yargs";
import { checkTranslations } from "./check-translations";
import {
	saveAiTranslations,
	saveKeys,
	saveOneSkyTranslations,
	upload,
} from "./file";

const readEnv = (key: string): string => {
	const env = process.env[key];

	if (!env)
		throw Error(`Could not find key ${key} in the environment variables`);

	return env;
};

function getFileNames(input: string): string[] {
	return input
		.split(",")
		.map((x) => x.trim())
		.map((x) => (x.endsWith(".json") ? x : `${x}.json`));
}

async function check(args: {
	apiKey: string;
	secret: string;
	out: string;
	project: number;
	files: string[];
	fail: boolean;
}) {
	const checks = await checkTranslations({
		apiKey: args.apiKey,
		secret: args.secret,
		translationsPath: args.out,
		projects: [{ id: args.project, files: args.files }],
	});

	if (!checks.length) {
		console.log("All looks up-to-date.");
		process.exit(0);
	} else {
		const logLevel = args.fail ? "error" : "log";
		const print = console[logLevel];

		print("Found the following problems:");
		print("");
		for (const problem of checks) {
			print(problem);
		}

		process.exit(args.fail ? 1 : 0);
	}
}

yargs(process.argv.slice(2))
	.scriptName("onekey")
	.command(
		"upload",
		"Upload translations to OneSky",
		(yargs) =>
			yargs.options({
				apiKey: {
					type: "string",
					alias: "k",
					describe: "OneSky API key",
				},
				secret: {
					type: "string",
					alias: "s",
					describe: "OneSky secret",
				},
				project: {
					type: "number",
					demandOption: true,
					alias: "p",
					describe: "OneSky project id",
				},
				input: {
					type: "string",
					demandOption: true,
					alias: "i",
					describe: "Path for the translations",
				},
				untracked: {
					type: "boolean",
					alias: "u",
					default: false,
					describe: "Upload only files with uncommitted changes",
				},
			}),
		async (args) => {
			await upload({
				apiKey: args.apiKey ?? readEnv("ONESKY_PUBLIC_KEY"),
				secret: args.secret ?? readEnv("ONESKY_PRIVATE_KEY"),
				projectId: args.project,
				translationsPath: args.input,
				untrackedOnly: args.untracked,
			});
		},
	)
	.command(
		"translate",
		"Translate files with OpenAI and save them in a folder",
		(yargs) =>
			yargs.options({
				path: {
					type: "string",
					demandOption: true,
					alias: "p",
					describe: "Path for the json translations",
				},
				baseLocale: {
					type: "string",
					alias: "l",
					describe: "Base locale",
				},
				apiUrl: {
					type: "string",
					alias: "u",
					describe:
						"OpenAI API URL (it can be read from the environment variable OPENAI_API_URL)",
				},
				apiKey: {
					type: "string",
					alias: "k",
					describe:
						"OpenAI API key (it can be read from the environment variable OPENAI_API_KEY)",
				},
				prettier: {
					type: "string",
					alias: "c",
					describe: "Path for the prettier config",
				},
				context: {
					alias: "x",
					type: "string",
					description:
						'File with additional context for the translations, for example: "These translations are used in a booking engine for hotel rooms"',
				},
				tone: {
					alias: "t",
					type: "string",
					default: "neutral",
					description:
						'Tone of the translation, for example: "formal" or "informal"',
				},
			}),
		async (args) => {
			await saveAiTranslations({
				apiKey: args.apiKey ?? readEnv("OPENAI_API_KEY"),
				apiUrl: args.apiUrl ?? readEnv("OPENAI_API_URL"),
				path: args.path,
				prettierConfigPath: args.prettier,
				baseLocale: args.baseLocale,
				context: args.context,
				tone: args.tone,
			});
		},
	)
	.command(
		"fetch",
		"Fetch onesky json files and save them in a folder",
		(yargs) =>
			yargs
				.options({
					out: {
						type: "string",
						demandOption: true,
						alias: "o",
						describe: "Where to save the translations",
					},
					project: {
						type: "number",
						demandOption: true,
						alias: "p",
						describe: "Id of the OneSky project",
					},
					files: {
						type: "string",
						demandOption: true,
						alias: "f",
						describe: "Files to download",
					},
					secret: {
						type: "string",
						alias: "s",
						describe:
							"OneSky private key (it can be read from the environment variable ONESKY_PRIVATE_KEY)",
					},
					apiKey: {
						type: "string",
						alias: "k",
						describe:
							"OneSky API key (it can be read from the environment variable ONESKY_PUBLIC_KEY)",
					},
					prettier: {
						type: "string",
						alias: "c",
						describe: "Path for the prettier config",
					},
				})
				.help(),
		async (args) => {
			await saveOneSkyTranslations({
				oneSkyApiKey: args.apiKey ?? readEnv("ONESKY_PUBLIC_KEY"),
				oneSkySecret: args.secret ?? readEnv("ONESKY_PRIVATE_KEY"),
				translationsPath: args.out,
				projects: [{ id: args.project, files: getFileNames(args.files) }],
				prettierConfigPath: args.prettier,
			});
		},
	)
	.command(
		"check",
		"Fetch onesky json files and check them against a folder",
		(yargs) =>
			yargs
				.options({
					out: {
						type: "string",
						demandOption: true,
						alias: "o",
						describe: "Where to load the translations",
					},
					project: {
						type: "number",
						demandOption: true,
						alias: "p",
						describe: "Id of the OneSky project",
					},
					files: {
						type: "string",
						demandOption: true,
						alias: "f",
						describe: "Files to check",
					},
					secret: {
						type: "string",
						alias: "s",
						describe:
							"OneSky private key (it can be read from the environment variable ONESKY_PRIVATE_KEY)",
					},
					apiKey: {
						type: "string",
						alias: "k",
						describe:
							"OneSky API key (it can be read from the environment variable ONESKY_PUBLIC_KEY)",
					},
					fail: {
						type: "boolean",
						default: false,
						alias: "l",
						describe: "Fail when there are missing files/keys",
					},
				})
				.help(),
		async (args) => {
			await check({
				apiKey: args.apiKey ?? readEnv("ONESKY_PUBLIC_KEY"),
				secret: args.secret ?? readEnv("ONESKY_PRIVATE_KEY"),
				out: args.out,
				project: args.project,
				files: getFileNames(args.files),
				fail: args.fail,
			});
		},
	)
	.command(
		"generate",
		"Generate typescript keys for the translations",
		(yargs) =>
			yargs.options({
				input: {
					type: "string",
					demandOption: true,
					alias: "i",
					describe: "Path for the json translations",
				},
				out: {
					type: "string",
					alias: "o",
					describe: "Where to save the translation keys",
				},
				prettier: {
					type: "string",
					alias: "c",
					describe: "Path for the prettier config",
				},
				locale: {
					type: "string",
					alias: "l",
					describe: "Default locale to use",
				},
			}),
		async (args) => {
			await saveKeys({
				defaultLocale: args.locale || "en-GB",
				prettierConfigPath: args.prettier,
				translationsPath: args.input,
				translationKeysPath: args.out || args.input,
			});
		},
	)
	.help().argv;
