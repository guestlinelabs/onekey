import { describe, expect, it } from "vitest";
import { type State, diffState, isStale, touch } from "../src/state";

describe("state management", () => {
	it("should track key modifications", () => {
		const state: State = {
			baseLocale: "en-GB",
			modified: {},
		};

		touch(state, "en-GB", "main.hello");
		expect(state.modified["en-GB"]["main.hello"]).toBeDefined();
		expect(state.modified["en-GB"]["main.hello"].lastModified).toMatch(
			/^\d{4}-\d{2}-\d{2}T/,
		);
	});

	it("should detect stale translations", () => {
		const state: State = {
			baseLocale: "en-GB",
			modified: {
				"en-GB": {
					"main.hello": { lastModified: "2025-07-30T14:05:00Z" },
				},
				"es-ES": {
					"main.hello": { lastModified: "2025-07-30T14:00:00Z" },
				},
			},
		};

		expect(isStale(state, "en-GB", "es-ES", "main.hello")).toBe(true);
	});

	it("should generate diff report", () => {
		const state: State = {
			baseLocale: "en-GB",
			modified: {
				"en-GB": {
					"main.hello": { lastModified: "2025-07-30T14:05:00Z" },
					"main.goodbye": { lastModified: "2025-07-30T14:03:00Z" },
				},
				"es-ES": {
					"main.hello": { lastModified: "2025-07-30T14:00:00Z" },
				},
			},
		};

		const diffs = diffState(state);
		expect(diffs).toHaveLength(2);
		expect(diffs[0].key).toBe("main.hello");
		expect(diffs[1].key).toBe("main.goodbye");
		expect(diffs[1].localeTs).toBe("missing");
	});
});
