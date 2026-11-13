// Readies `dist/` (from `expo export --platform web`) for Cloudflare Pages.
//
// Expo puts assets that come from packages under dist/assets/node_modules/, including expo-sqlite's wa-sqlite.wasm,
// which Bookie needs to open its library. `wrangler pages deploy` never uploads anything inside a folder called
// node_modules, so those requests would get the app's index.html instead and the library would fail to open.
// This moves the folder to assets/vendor/ and adds a rewrite so the paths in Expo's bundle still find the files.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2] ?? 'dist';
const from = join(dist, 'assets', 'node_modules');
const to = join(dist, 'assets', 'vendor');
const rule = '/assets/node_modules/* /assets/vendor/:splat 200';

if (!existsSync(join(dist, 'index.html'))) {
  console.error(`No ${dist}/index.html: run \`npx expo export --platform web\` first.`);
  process.exit(1);
}
if (existsSync(from)) {
  if (existsSync(to)) throw new Error(`${to} already exists`);
  renameSync(from, to);
}
const redirects = join(dist, '_redirects');
const current = existsSync(redirects) ? readFileSync(redirects, 'utf8') : '';
if (!current.includes(rule)) writeFileSync(redirects, `${current}${current && !current.endsWith('\n') ? '\n' : ''}${rule}\n`);
console.log(`Ready for Cloudflare Pages: package assets moved to ${to}, rewrite added to ${redirects}.`);
