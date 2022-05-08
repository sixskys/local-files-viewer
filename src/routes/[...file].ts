import type { RequestHandler } from '@sveltejs/kit';
import type { Stats } from 'fs';

import { readFile, readdir, stat } from './mem-fs';

import os from 'os';
import path from 'path';
import mem from 'mem';
import { nanoid } from 'nanoid';

// file is metadata about a file
// post has the actual content of the file

export type File = {
	href: string;
	name: string;
	id: string;
	isDirectory: boolean;
};

export type Post = {
	content: string;
	next?: string;
	prev?: string;
};

function generateErrorResponse(error: any) {
	return {
		body: {
			error: Object.assign({}, error, { message: error.message })
		}
	};
}

function getSizeInString(bytes: number): string {
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

	if (bytes === 0) {
		return 'n/a';
	}

	const i = Math.floor(Math.log(bytes) / Math.log(1024));

	if (i == 0) {
		return bytes + ' ' + sizes[i];
	}

	return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}

function getRelevantStats(
	stats: Stats,
	{ childFiles, content }: { childFiles?: string[]; content?: string }
): (string | number)[][] {
	const resolvedStats: (string | number)[][] = [
		['atime', stats.atime.toLocaleString()],
		['mtime', stats.mtime.toLocaleString()],
		['ctime', stats.ctime.toLocaleString()],
		['size', getSizeInString(stats.size)]
	];

	if (childFiles) {
		resolvedStats.splice(0, 0, ['files', childFiles.length]);
	}

	if (content) {
		const emptyLineRegex = /^\s*$/;
		const lines = content.split(os.EOL);
		const nonEmptyLines = lines.filter((line) => !emptyLineRegex.test(line));
		resolvedStats.push(['lines', lines.length], ['non empty lines', nonEmptyLines.length]);
	}

	return resolvedStats;
}

async function getAllFiles(dir: string): Promise<string[]> {
	let files = (await readdir(dir)).map((file) => path.join(dir, file));

	for (const file of files) {
		if ((await stat(file)).isDirectory()) {
			files = files.concat(await getAllFiles(file));
		}
	}

	return files;
}

async function getRelevantFilesFromQuery(dir: string, query: string) {
	const files = await getAllFiles(dir);

	for (let i = files.length - 1; i >= 0; i--) {
		if ((await stat(files[i])).isDirectory()) {
			files.splice(i, 1);
		}
	}

	const filesContent = await Promise.all(files.map((f) => readFile(f)));
	const queryLC = query.toLowerCase();

	return files
		.filter((file, i) => {
			return (
				file.toLowerCase().includes(queryLC) || filesContent[i].toLowerCase().includes(queryLC)
			);
		})
		.map((f) => f.replace(dir, '').substring(1));
}

const getSiblingFiles = mem(async function (filePath: string, query?: string) {
	const parentDirectory = path.dirname(filePath);
	const siblingFiles = (await readdir(parentDirectory)).slice();
	const siblingFilesStats = await Promise.all(
		siblingFiles.map((f) => stat(path.join(parentDirectory, f)))
	);

	for (let i = siblingFiles.length - 1; i >= 0; i--) {
		if (siblingFilesStats[i].isDirectory()) {
			siblingFiles.splice(i, 1);
		}
	}

	return siblingFiles;
});

const getPost = mem(async function (
	filePath: string,
	{ file, query, queryDirectory }: { file: string; query?: string; queryDirectory?: string }
) {
	const siblingFiles = await (query && typeof queryDirectory !== 'undefined'
		? getRelevantFilesFromQuery(path.join(baseDirectory, queryDirectory), query)
		: getSiblingFiles(filePath));

	// getRelevantFilesFromQuery returns relative absolute files, which leads
	// to some of conditionals further down
	const indexSearchElement = query ? file : path.parse(file).base;
	const indexOfCurrent = siblingFiles.indexOf(indexSearchElement);

	const post: Post = {
		content: await readFile(filePath),
		prev: '',
		next: ''
	};

	if (indexOfCurrent !== -1) {
		const trimmedParentDirectory = query ? '' : path.dirname(file);

		if (siblingFiles[indexOfCurrent - 1]) {
			post.prev = '/' + path.join(trimmedParentDirectory, siblingFiles[indexOfCurrent - 1]);
		}

		if (siblingFiles[indexOfCurrent + 1]) {
			post.next = '/' + path.join(trimmedParentDirectory, siblingFiles[indexOfCurrent + 1]);
		}
	}

	if (post.prev && query) {
		post.prev += `?query=${query}&query_dir=${queryDirectory}`;
	}

	if (post.next && query) {
		post.next += `?query=${query}&query_dir=${queryDirectory}`;
	}

	return post;
});

let baseDirectory: string = '';

if (process.argv[3]) {
	baseDirectory = path.resolve(process.argv[3]);
} else if (process.env.LFV_DEFAULT_FOLDER) {
	baseDirectory = process.env.LFV_DEFAULT_FOLDER;
}

export const get: RequestHandler<{ file: string }, {}> = async ({ params, url, request }) => {
	const filePath = path.join(baseDirectory, params.file);

	let stats: Stats;

	try {
		stats = await stat(filePath);
	} catch (err: any) {
		return generateErrorResponse(err);
	}

	const query = url.searchParams.get('query') || undefined;
	const queryDirectory = url.searchParams.get('query_dir') || '';
	// const queryDirectory = path.join(baseDirectory, url.searchParams.get('query_dir') || '');

	try {
		if (stats.isDirectory()) {
			const childFiles = await (query
				? getRelevantFilesFromQuery(filePath, query)
				: readdir(filePath));

			const childFilesStats = await Promise.all(
				childFiles.map((f) => stat(path.join(filePath, f)))
			);

			const files: File[] = childFiles.map((e, i) => ({
				href:
					'/' +
					path.join(params.file, e) +
					(query ? `?query=${query}&query_dir=${params.file}` : ''),
				id: nanoid(),
				name: e,
				isDirectory: childFilesStats[i].isDirectory()
			}));

			return {
				body: {
					files,
					stats: getRelevantStats(stats, { childFiles })
				}
			};
		}

		const post = await getPost(filePath, { file: params.file, query, queryDirectory });

		return {
			body: {
				post,
				stats: getRelevantStats(stats, { content: post.content })
			}
		};
	} catch (err: any) {
		return generateErrorResponse(err);
	}
};
