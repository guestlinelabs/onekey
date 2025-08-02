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
	.usage(
		"\nOneKey — AI-assisted, local-only translation workflow for TypeScript projects\n" +
			"\nUsage: $0 <command> [options]\n" +
			"\nTypical workflow:\n" +
			"  1. init      Scan base locale and create oneKeyState.json\n" +
			"  2. status    Report missing or stale translations (CI-friendly)\n" +
			"  3. translate Use OpenAI to update stale keys only\n" +
			"  4. generate  Generate type-safe translation keys (translation.ts)\n",
	)
	.recommendCommands()
	.demandCommand(
		1,
		"Please specify a command. Use --help to see available commands.",
	)
	.command(
		"init",
		"Initialize translation state tracking",
		(yargs) =>
			yargs
				.options({
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
				})
				.example(
					"$0 init -p ./translations -l en-GB",
					"Initialize state tracking",
				),
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
			yargs
				.options({
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
				})
				.example(
					"$0 translate --stats",
					"Translate stale or missing keys and print statistics",
				),
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
				prettierConfigPath: args.prettier,
				context: args.context,
				tone: args.tone,
				updateAll: args.updateAll,
				stats: args.stats,
			});
		},
	)
	.command(
		"check",
		false,
		(yargs) => null,
		async () => {
			console.warn(
				"The 'check' command is deprecated. Please use 'status' instead.",
			);
			await checkStatus();
		},
		[],
		true,
	)
	.command(
		"status",
		"Check translation status and report stale translations",
		(yargs) => yargs.example("$0 status", "Report translation status"),
		async () => {
			const exitCode = await checkStatus();
			process.exit(exitCode);
		},
	)
	.command(
		"generate",
		"Generate typescript keys for the translations",
		(yargs) =>
			yargs
				.options({
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
				})
				.example("$0 generate", "Generate TypeScript key types"),
		async (args) => {
			await saveKeys({
				prettierConfigPath: args.prettier,
				translationKeysPath: args.out,
			});
		},
	)
	.epilog("Docs: https://github.com/guestlinelabs/onekey#readme")
	.help().argv;
