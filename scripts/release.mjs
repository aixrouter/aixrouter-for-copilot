#!/usr/bin/env node
/**
 * Release helper — orchestrates the release workflow.
 *
 * Usage:
 *   node scripts/release.mjs              dry-run (compile + test + package only)
 *   node scripts/release.mjs --publish    full release cycle
 *
 * What this script does:
 *   1. Compile (pnpm run compile)
 *   2. Test   (pnpm test)
 *   3. Package VSIX (pnpm run package)
 *   4. (--publish only) Print manual steps for git tag / GitHub release /
 *      Marketplace publish.
 *
 * Environment variables for Marketplace publish:
 *   VSCE_PAT — Personal Access Token for VS Code Marketplace
 *   GH_TOKEN — GitHub token for creating releases (or use gh CLI auth)
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PUBLISH = process.argv.includes('--publish');
const DRY = !PUBLISH;

function run(cmd, opts = {}) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
}

function fail(msg) {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

// ── Version ──────────────────────────────────────────────────────────
const pkgPath = resolve(ROOT, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const version = pkg.version;
console.log(`📦 ${pkg.name} v${version}`);
console.log(`   Mode: ${DRY ? 'DRY RUN' : 'PUBLISH'}`);

// ── Step 1: Compile ──────────────────────────────────────────────────
console.log('\n═══ Step 1/3: Compile ═══');
try {
  run('pnpm run compile');
} catch {
  fail('Compile failed. Fix errors and retry.');
}

// ── Step 2: Test ─────────────────────────────────────────────────────
console.log('\n═══ Step 2/3: Test ═══');
try {
  run('pnpm test');
} catch {
  fail('Tests failed. Fix errors and retry.');
}

// ── Step 3: Package ──────────────────────────────────────────────────
console.log('\n═══ Step 3/3: Package ═══');
const vsixName = `${pkg.name}-${version}.vsix`;
const vsixPath = resolve(ROOT, vsixName);

// Remove old VSIX if present
if (existsSync(vsixPath)) {
  console.log(`   Removing old ${vsixName}...`);
  execSync(`rm -f "${vsixPath}"`, { cwd: ROOT });
}

try {
  run('pnpm run package');
} catch {
  fail('Package failed.');
}

if (!existsSync(vsixPath)) {
  fail(`VSIX not found at ${vsixPath}. Check vsce output.`);
}

console.log(`\n✅ VSIX ready: ${vsixName}`);

// ── Dry run stops here ───────────────────────────────────────────────
if (DRY) {
  console.log('\n🏁 Dry run complete. All checks passed.');
  console.log('   To publish, run: node scripts/release.mjs --publish');
  process.exit(0);
}

// ── Publish: manual steps ────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════');
console.log('  PUBLISH — manual steps');
console.log('═══════════════════════════════════════════════════════════');
console.log(`
The following steps require human confirmation or credentials.
Run them one at a time:

1. COMMIT & TAG
   git add -A
   git commit -m "Release v${version}"
   git tag v${version}
   git push origin main --tags

2. GITHUB RELEASE (CLI)
   gh release create v${version} \\
     --title "v${version}" \\
     --notes "See CHANGELOG.md for details." \\
     "${vsixName}"

   Or create manually at:
   https://github.com/${pkg.repository ? 'huangonce/aixrouter-for-copilot' : 'OWNER/REPO'}/releases/new

3. MARKETPLACE PUBLISH
   pnpm exec vsce publish --packagePath "${vsixName}"

   Requires VSCE_PAT environment variable or prior vsce login.
   Get a PAT at: https://dev.azure.com/ (Marketplace > Personal Access Tokens)

4. POST-RELEASE
   - Bump version in package.json for next dev cycle
   - Add new "Unreleased" section to CHANGELOG.md
`);

console.log('═══════════════════════════════════════════════════════════');
