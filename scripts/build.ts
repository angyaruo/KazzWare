import { mkdir } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const entry of ['backend', 'frontend']) {
  const result = await Bun.build({ entrypoints: [`src/${entry}.ts`], outdir: 'dist', naming: `${entry}.js`, target: entry === 'backend' ? 'bun' : 'browser', format: 'esm', minify: false, sourcemap: 'none', plugins: [{ name: 'inline-assets', setup(build) { build.onLoad({ filter: /\.(png|ttf)$/ }, async args => ({ contents: `export default ${JSON.stringify(`data:${args.path.endsWith('.ttf') ? 'font/ttf' : 'image/png'};base64,${Buffer.from(await Bun.file(args.path).arrayBuffer()).toString('base64')}`)}`, loader: 'js' })); } }] });
  if (!result.success) { for (const log of result.logs) console.error(log); process.exit(1); }
  console.log(`Built ${entry}: ${result.outputs[0].size.toLocaleString()} bytes`);
}
