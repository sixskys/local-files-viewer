import type { Stats } from 'fs';

import { readdir as fsReaddir, stat as fsStat, readFile as fsReadFile } from 'fs/promises';

const cached = {
	readdir: new Map<string, string[]>(),
	readFile: new Map<string, string>(),
	stats: new Map<string, Stats>()
};

export async function readdir(dir: string): Promise<string[]> {
	if (!cached.readdir.has(dir)) {
		cached.readdir.set(
			dir,
			(await fsReaddir(dir)).filter((e) => e !== '.git')
		);
	}

	return cached.readdir.get(dir)!;
}

export async function readFile(filePath: string): Promise<string> {
	if (!cached.readFile.has(filePath)) {
		cached.readFile.set(filePath, await fsReadFile(filePath, 'utf-8'));
	}

	return cached.readFile.get(filePath)!;
}

export async function stat(filePath: string): Promise<Stats> {
	if (!cached.stats.has(filePath)) {
		cached.stats.set(filePath, await fsStat(filePath));
	}

	return cached.stats.get(filePath)!;
}
