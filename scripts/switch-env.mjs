#!/usr/bin/env node
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const choice = process.argv[2];
if (!choice || !['local', 'production'].includes(choice)) {
  console.error('Usage: node scripts/switch-env.mjs <local|production>');
  process.exit(1);
}

const repoRoot = resolve(process.cwd());
const source = resolve(repoRoot, `.env.${choice}`);
const target = resolve(repoRoot, '.env');

if (!existsSync(source)) {
  console.error(`Source file not found: ${source}`);
  process.exit(1);
}

copyFileSync(source, target);
console.log(`✓ Switched environment: ${choice}\n→ ${source} → ${target}`);

