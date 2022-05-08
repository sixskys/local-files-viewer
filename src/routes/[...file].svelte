<script lang="ts">
	import type { File, Post } from './[...file]';

	import Icon from '$lib/Icon.svelte';
	import { page } from '$app/stores';

	export let files: File[];
	export let post: Post;
	export let stats: (string | number)[][];
	export let error: any;

	if (error) {
		console.error(error);
	}

	$: filePaths = $page.params.file.split('/').filter((e) => e);
</script>

{#if error}
	<div class="alert alert-error absolute bottom-0 rounded-none">
		<div>
			<Icon name="alert-octagon" />
			<span>{error?.message || 'Check console log'}</span>
		</div>
	</div>
{/if}

<main>
	<div class="m-8 mb-4">
		<form action="" method="get">
			<input type="search" name="query" id="query" class="input input-bordered w-full border-2" />
		</form>
		<div class="text-sm breadcrumbs mt-4 bg-base-200 rounded-lg py-4 px-5">
			<ul>
				<li>
					<a href="/">
						<Icon name="hard-drive" />
						Home
					</a>
				</li>
				{#each filePaths as param, i}
					<li>
						<a href={'/' + filePaths.slice(0, i + 1).join('/')}>
							<Icon name={i === filePaths.length - 1 && post ? 'file' : 'folder'} />
							{param}
						</a>
					</li>
				{/each}
			</ul>
		</div>
	</div>

	<section class="grid p-8 pt-0 gap-4">
		{#if files}
			<div class="flex content-start flex-wrap gap-3">
				{#each files as post (post.id)}
					<a class="btn " href={post.href} sveltekit:prefetch>
						<Icon name={post.isDirectory ? 'folder' : 'file'} />
						{post.name}</a
					>
				{/each}
			</div>
		{/if}

		{#if post}
			<pre class="bg-base-200 p-10">{post.content}</pre>
		{/if}

		{#if stats}
			<div>
				<div class="bg-base-200 p-3">
					{#each stats as [key, value]}
						<p><span class="text-accent">{key}</span>: {value}</p>
					{/each}
				</div>
				{#if post && (post.prev || post.next)}
					<!-- todo: maybe add disabling effects when empty -->
					<div class="file-change mt-2">
						<a href={post.prev} class="bg-base-200 btn h-auto rounded-lg p-3 mr-1">
							<Icon name="chevron-left" hasMarginRight={false} width={'2em'} height={'2em'} />
						</a>
						<a href={post.next} class="bg-base-200 btn h-auto rounded-lg p-3">
							<Icon name="chevron-right" hasMarginRight={false} width={'2em'} height={'2em'} />
						</a>
					</div>
				{/if}
			</div>
		{/if}
	</section>
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	section {
		display: grid;
		grid-template-columns: 3fr 1fr;
		overflow: auto;
	}

	pre {
		display: block;
		overflow: auto;
		white-space: pre-line;
		word-wrap: break-word;
		height: 100%;
	}
</style>
