#!/usr/bin/env node

import yargs from "yargs/yargs";
import {
	checkStatus,
	initializeState,
	saveAiTranslations,
	saveKeys,
} from "./file";

yargs(process.argv.slice(2))
	.scriptName("onekey")
	.command(
		"init",
		"Initialize translation state tracking",
		(yargs) =>
			yargs.options({
				path: {
					type: "string",
					demandOption: true,
					alias: "p",
					describe: "Path to translations directory",
				},
				baseLocale: {
					type: "string",
					alias: "l",
					default: "en-GB",
					describe: "Base locale for translations",
				},
			}),
		async (args) => {
			await initializeState({
				translationsPath: args.path,
				baseLocale: args.baseLocale,
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
				updateAll: {
					type: "boolean",
					default: false,
					describe: "Re-translate even if not stale",
				},
				stats: {
					type: "boolean",
					default: false,
					describe: "Print stale key statistics per locale",
				},
			}),
		async (args) => {
			const readEnv = (key: string): string => {
				const env = process.env[key];
				if (!env)
					throw Error(`Could not find key ${key} in the environment variables`);
				return env;
			};

			await saveAiTranslations({
				apiKey: args.apiKey ?? readEnv("OPENAI_API_KEY"),
				apiUrl: args.apiUrl ?? readEnv("OPENAI_API_URL"),
				path: args.path,
				prettierConfigPath: args.prettier,
				baseLocale: args.baseLocale,
				context: args.context,
				tone: args.tone,
				updateAll: args.updateAll,
				stats: args.stats,
			});
		},
	)
	.command(
		"status",
		"Check translation status and report stale translations",
		(yargs) =>
			yargs.options({
				path: {
					type: "string",
					demandOption: true,
					alias: "p",
					describe: "Path to translations directory",
				},
			}),
		async (args) => {
			const exitCode = await checkStatus({
				translationsPath: args.path,
			});
			process.exit(exitCode);
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
