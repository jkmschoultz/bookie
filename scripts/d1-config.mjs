// Checks whether wrangler.toml has a real D1 database id for a Pages environment ("production" or "preview").
//
// Until the ids are pasted in (see "Accounts and sync" in the README), any database still marked REPLACE_WITH_... is
// taken out of wrangler.toml for this run, so the deploy still works: the API then answers "not set up" and the app
// stays device-only. Prints configured=true|false, and adds it to $GITHUB_OUTPUT in GitHub Actions.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

const env = process.argv[2];
if (env !== 'production' && env !== 'preview') {
  console.error('Usage: node scripts/d1-config.mjs production|preview');
  process.exit(1);
}
const file = 'wrangler.toml';
const lines = readFileSync(file, 'utf8').split('\n');

// Each [[...d1_databases]] table runs until the next table or a blank line.
const blocks = [];
lines.forEach((line, i) => {
  if (/^\[\[(env\.\w+\.)?d1_databases\]\]/.test(line)) {
    let end = i + 1;
    while (end < lines.length && lines[end].trim() && !lines[end].startsWith('[')) end++;
    blocks.push({ start: i, end, header: line, placeholder: lines.slice(i, end).some((l) => /database_id\s*=\s*"REPLACE_WITH_/.test(l)) });
  }
});

const target = blocks.find((b) => b.header.includes(`env.${env}.`));
const configured = !!target && !target.placeholder;
const drop = new Set(blocks.filter((b) => b.placeholder).flatMap((b) => Array.from({ length: b.end - b.start }, (_, k) => b.start + k)));
if (drop.size) writeFileSync(file, lines.filter((_, i) => !drop.has(i)).join('\n'));

if (!configured)
  console.log(
    `::warning title=No database for ${env}::wrangler.toml has no D1 database id for ${env} yet, so migrations are skipped and accounts stay off there. See "Accounts and sync" in the README.`,
  );
console.log(`configured=${configured}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `configured=${configured}\n`);
