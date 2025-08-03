#!/usr/bin/env node

import chalk from "chalk";
import cliProgress from "cli-progress";
import prompts from "prompts";
import yargs from "yargs/yargs";
import {
	checkStatus,
	initializeState,
	saveAiTranslations,
	syncState,
} from "./file";
import codes from "./language-codes.json";

// Global error handler for unhandled rejections
process.on("unhandledRejection", (reason) => {
	console.error(chalk.red("Error:"), reason);
	process.exit(1);
});

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
	.options({
		quiet: {
			type: "boolean",
			alias: "q",
			describe: "Suppress all output except errors",
		},
	})
	.command(
		"init",
		"Initialize translation state tracking",
		(yargs) =>
			yargs
				.options({
					path: {
						type: "string",
						alias: "p",
						describe:
							"Path to translations directory (default: ./translations)",
						default: "translations",
					},
					"base-locale": {
						type: "string",
						alias: "l",
						describe: "Base locale for translations (default: en)",
						default: "en",
					},
					"no-generate-keys": {
						type: "boolean",
						default: false,
						describe: "Disable automatic generation of translation.ts",
					},
					yes: {
						type: "boolean",
						alias: "y",
						describe: "Skip interactive prompts and use defaults",
					},
				})
				.example("$0 init -p ./translations -l en", "Initialize state tracking")
				.example(
					"$0 init -p ./translations --no-generate-keys",
					"Initialize without translation.ts generation",
				)
				.example("$0 init --yes", "Initialize with defaults, skipping prompts"),
		async (args) => {
			let translationsPath = args.path;
			let baseLocale = args["base-locale"];

			// Only show prompts if not using --yes and not all params provided
			if (!args.yes && (!translationsPath || !baseLocale)) {
				const answers = await prompts([
					{
						type: translationsPath ? null : "text",
						name: "translationsPath",
						message: "Path to translations directory",
						initial: "translations",
					},
					{
						type: baseLocale ? null : "autocomplete",
						name: "baseLocale",
						message: "Base locale for translations",
						choices: codes.map((code) => ({
							title: `${code.code} (${code.englishName})`,
							value: code.code,
						})),
						initial: "en",
					},
				]);
				translationsPath = translationsPath ?? answers.translationsPath;
				baseLocale = baseLocale ?? answers.baseLocale;
			}

			if (!translationsPath || !baseLocale) {
				console.error(
					chalk.red("Please provide a valid translations path and base locale"),
				);
				process.exit(1);
			}

			try {
				await initializeState({
					translationsPath,
					baseLocale,
					generateKeys: !args["no-generate-keys"],
				});
				if (!args.quiet) {
					console.log(chalk.green("✓ Initialized translation state tracking"));
				}
			} catch (error) {
				console.error(
					chalk.red("Failed to initialize:"),
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		},
	)
	.command(
		"translate",
		"Translate files with OpenAI and save them in a folder",
		(yargs) =>
			yargs
				.options({
					"api-url": {
						type: "string",
						alias: "u",
						describe:
							"OpenAI API URL (can be read from OPENAI_API_URL env var)",
					},
					"api-key": {
						type: "string",
						alias: "k",
						describe:
							"OpenAI API key (can be read from OPENAI_API_KEY env var)",
					},
					"api-model": {
						type: "string",
						alias: "m",
						describe:
							"OpenAI API model (can be read from OPENAI_API_MODEL env var)",
					},
					"prettier-config": {
						type: "string",
						alias: "c",
						describe: "Path to prettier config file",
					},
					"context-file": {
						alias: "C",
						type: "string",
						description:
							'File with additional context for translations (e.g., "These translations are used in a booking engine")',
					},
					tone: {
						alias: "t",
						type: "string",
						default: "neutral",
						description:
							'Tone of the translation (e.g., "formal" or "informal")',
					},
					"update-all": {
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
				if (!env && !optional) {
					throw new Error(`Missing required environment variable: ${key}`);
				}
				return env;
			}

			try {
				process.loadEnvFile();
			} catch {}

			try {
				// Sync state first to ensure we have the latest state and translation.ts
				await syncState();

				let progressBar: any;
				if (!args.quiet) {
					progressBar = new cliProgress.SingleBar(
						{
							format: "Translating |{bar}| {percentage}% {value}/{total} tasks",
							hideCursor: true,
						},
						cliProgress.Presets.shades_classic,
					);
				}

				await saveAiTranslations({
					apiKey: args["api-key"] ?? readEnv("OPENAI_API_KEY"),
					apiUrl: args["api-url"] ?? readEnv("OPENAI_API_URL"),
					apiModel: args["api-model"] ?? readEnv("OPENAI_API_MODEL", true),
					prettierConfigPath: args["prettier-config"],
					context: args["context-file"],
					tone: args.tone,
					updateAll: args["update-all"],
					stats: args.stats,
					onProgress: (progress) => {
						if (!progressBar) return;
						if (!progressBar.isActive) {
							progressBar.start(progress.total, progress.done);
						} else {
							progressBar.update(progress.done);
						}
						if (progress.done >= progress.total && progressBar.isActive) {
							progressBar.stop();
						}
					},
				});
				if (!args.quiet) {
					console.log(chalk.green("✓ Translation completed successfully"));
				}
			} catch (error) {
				console.error(
					chalk.red("Translation failed:"),
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		},
	)
	.command(
		"check",
		false,
		(yargs) => null,
		async () => {
			console.warn(
				chalk.yellow(
					"The 'check' command is deprecated. Please use 'status' instead.",
				),
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
			try {
				const exitCode = await syncState();
				process.exit(exitCode);
			} catch (error) {
				console.error(
					chalk.red("Sync failed:"),
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		},
	)
	.command(
		"status",
		"Read-only check for stale or missing translations (CI-friendly)",
		(yargs) => yargs.example("$0 status", "Report translation status"),
		async () => {
			try {
				const exitCode = await checkStatus();
				process.exit(exitCode);
			} catch (error) {
				console.error(
					chalk.red("Status check failed:"),
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		},
	)
	.wrap(120)
	.epilog("Docs: https://github.com/guestlinelabs/onekey#readme")
	.help().argv;
