#!/usr/bin/env node

import prompts from "prompts";
import yargs from "yargs/yargs";
import {
	checkStatus,
	initializeState,
	saveAiTranslations,
	syncState,
} from "./file";
import codes from "./language-codes.json";

yargs(process.argv.slice(2))
	.scriptName("onekey")
	.usage(
		"\nOneKey — AI-assisted, local-only translation workflow for TypeScript projects\n" +
			"\nUsage: $0 <command> [options]\n" +
			"\nTypical workflow:\n" +
			"  1. init      Scan base locale and create oneKeyState.json\n" +
			"  2. sync      Sync state, generate translation.ts, and report stale translations\n" +
			"  3. status    Read-only check for stale or missing translations (CI-friendly)\n" +
			"  4. translate Use OpenAI to update stale keys only\n",
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
						alias: "p",
						describe: "Path to translations directory",
					},
					baseLocale: {
						type: "string",
						alias: "l",
						describe: "Base locale for translations",
					},
					"no-generate-keys": {
						type: "boolean",
						default: false,
						describe: "Disable automatic generation of translation.ts",
					},
				})
				.example("$0 init -p ./translations -l en", "Initialize state tracking")
				.example(
					"$0 init -p ./translations --no-generate-keys",
					"Initialize without translation.ts generation",
				),
		async (args) => {
			const answers = await prompts([
				{
					type: args.path ? null : "text",
					name: "translationsPath",
					message: "Path to translations directory",
					initial: "translations",
				},
				{
					type: args.baseLocale ? null : "autocomplete",
					name: "baseLocale",
					message: "Base locale for translations",
					choices: codes.map((code) => ({
						title: `${code.code} (${code.englishName})`,
						value: code.code,
					})),
					initial: "en",
				},
			]);
			const translationsPath = args.path ?? answers.translationsPath;
			const baseLocale = args.baseLocale ?? answers.baseLocale;

			if (!translationsPath || !baseLocale) {
				console.error(
					"Please provide a valid translations path and base locale",
				);
				process.exit(1);
			}

			await initializeState({
				translationsPath,
				baseLocale,
				generateKeys: !args["no-generate-keys"],
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
					apiModel: {
						type: "string",
						alias: "m",
						describe:
							"OpenAI API model (it can be read from the environment variable OPENAI_API_MODEL)",
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
			function readEnv(key: string): string;
			function readEnv(key: string, optional: true): string | undefined;
			function readEnv(key: string, optional = false) {
				const env = process.env[key];
				if (!env && !optional)
					throw Error(`Could not find key ${key} in the environment variables`);
				return env;
			}

			try {
				process.loadEnvFile();
			} catch {}

			// Sync state first to ensure we have the latest state and translation.ts
			await syncState();

			await saveAiTranslations({
				apiKey: args.apiKey ?? readEnv("OPENAI_API_KEY"),
				apiUrl: args.apiUrl ?? readEnv("OPENAI_API_URL"),
				apiModel: args.apiModel ?? readEnv("OPENAI_API_MODEL", true),
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
		"sync",
		"Sync state, generate translation.ts, and report stale translations",
		(yargs) =>
			yargs.example("$0 sync", "Sync state and generate translation.ts"),
		async () => {
			const exitCode = await syncState();
			process.exit(exitCode);
		},
	)
	.command(
		"status",
		"Read-only check for stale or missing translations (CI-friendly)",
		(yargs) => yargs.example("$0 status", "Report translation status"),
		async () => {
			const exitCode = await checkStatus();
			process.exit(exitCode);
		},
	)
	.epilog("Docs: https://github.com/guestlinelabs/onekey#readme")
	.help().argv;
