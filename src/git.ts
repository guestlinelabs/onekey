import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function isAvailable(): Promise<boolean> {
	try {
		await execAsync("git --version");
		return true;
	} catch {
		return false;
	}
}

export async function isRepository(dir: string): Promise<boolean> {
	try {
		await execAsync("git rev-parse --is-inside-work-tree", { cwd: dir });
		return true;
	} catch {
		return false;
	}
}

export async function getRootPath(dir?: string): Promise<string> {
	const { stdout } = await execAsync("git rev-parse --show-toplevel", {
		cwd: dir ?? process.cwd(),
	});
	return stdout.trim();
}

export async function getUntrackedJsonFiles(dir: string): Promise<string[]> {
	try {
		// Get both unstaged modified files and untracked files
		const { stdout: modified } = await execAsync("git diff --name-only", {
			cwd: dir,
		});
		const { stdout: untracked } = await execAsync(
			"git ls-files --others --exclude-standard",
			{ cwd: dir },
		);
		const gitRootPath = await getRootPath(dir);

		const allFiles = [...modified.split("\n"), ...untracked.split("\n")]
			.filter((file) => file.endsWith(".json"))
			.map((file) => path.resolve(gitRootPath, file));

		return [...new Set(allFiles)];
	} catch (error) {
		throw new Error(`Failed to get untracked files: ${error}`);
	}
}
