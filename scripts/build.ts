import { mkdir } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const entry of ['backend', 'frontend']) {
  const result = await Bun.build({ entrypoints: [`src/${entry}.ts`], outdir: 'dist', naming: `${entry}.js`, target: entry === 'backend' ? 'bun' : 'browser', format: 'esm', minify: false, sourcemap: 'none', plugins: [{ name: 'inline-art', setup(build) { build.onLoad({ filter: /\.png$/ }, async args => ({ contents: `export default ${JSON.stringify(`data:image/png;base64,${Buffer.from(await Bun.file(args.path).arrayBuffer()).toString('base64')}`)}`, loader: 'js' })); } }] });
  if (!result.success) { for (const log of result.logs) console.error(log); process.exit(1); }
  console.log(`Built ${entry}: ${result.outputs[0].size.toLocaleString()} bytes`);
}
