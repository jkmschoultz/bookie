// Deploys dist/ to Cloudflare Pages by hand (npm run deploy:prod / deploy:staging), the way CI does: brings the
// environment's D1 database up to date first, and while wrangler.toml still has REPLACE_WITH_... ids, leaves the
// database out (scripts/d1-config.mjs) on a temporary copy of wrangler.toml, so the placeholders never reach Cloudflare.
import { execFileSync } from 'node:child_process';
import { copyFileSync, renameSync } from 'node:fs';

const branch = process.argv[2];
if (!branch) {
  console.error('Usage: node scripts/pages-deploy.mjs <branch>   (master is production, anything else a preview)');
  process.exit(1);
}
const env = branch === 'master' ? 'production' : 'preview';
const database = env === 'production' ? 'bookie-prod' : 'bookie-staging';
const wrangler = ['--yes', 'wrangler@4.161.0'];
const run = (args) => execFileSync('npx', [...wrangler, ...args], { stdio: 'inherit' });

copyFileSync('wrangler.toml', 'wrangler.toml.bak');
try {
  const out = execFileSync('node', ['scripts/d1-config.mjs', env], { encoding: 'utf8' });
  process.stdout.write(out);
  if (out.includes('configured=true')) run(['d1', 'migrations', 'apply', database, '--remote', '--env', env]);
  run(['pages', 'deploy', 'dist', '--project-name', 'mybookie', '--branch', branch]);
} finally {
  renameSync('wrangler.toml.bak', 'wrangler.toml');
}
