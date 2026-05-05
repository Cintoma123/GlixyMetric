const esbuild = require("esbuild");
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

/**
 * @type {import('esbuild').Plugin}
 */
const copySqlWasmPlugin = {
	name: 'copy-sql-wasm',
	setup(build) {
		build.onEnd((result) => {
			if (result.errors.length > 0) {
				return;
			}

			const source = path.resolve(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
			const destination = path.resolve(__dirname, 'dist', 'sql-wasm.wasm');

			try {
				fs.mkdirSync(path.dirname(destination), { recursive: true });
				fs.copyFileSync(source, destination);
				console.log('[watch] copied sql-wasm.wasm');
			} catch (error) {
				console.error('✘ [ERROR] Failed to copy sql-wasm.wasm');
				console.error(error);
			}
		});
	},
};

async function main() {
	// Build extension
	const ctx = await esbuild.context({
		entryPoints: [
			'src/extension.ts'
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [
			/* add to the end of plugins array */
			esbuildProblemMatcherPlugin,
			copySqlWasmPlugin,
		],
	});

	// Build React dashboard
	const dashboardCtx = await esbuild.context({
		entryPoints: [
			'src/ui/webview/index.tsx'
		],
		bundle: true,
		format: 'esm',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'browser',
		outfile: 'dist/dashboard.js',
		logLevel: 'silent',
		plugins: [
			{
				name: 'dashboard-build',
				setup(build) {
					build.onStart(() => {
						console.log('[watch] building dashboard...');
					});
					build.onEnd((result) => {
						if (result.errors.length === 0) {
							console.log('[watch] dashboard built successfully');
						}
					});
				},
			},
		],
	});

	if (watch) {
		await ctx.watch();
		await dashboardCtx.watch();
	} else {
		await ctx.rebuild();
		await dashboardCtx.rebuild();
		await ctx.dispose();
		await dashboardCtx.dispose();
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
