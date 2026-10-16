#!/usr/bin/env node
// Aponta o git pros hooks versionados em .githooks/ (roda no "pnpm install" via prepare).
// Worktrees herdam a config do repo principal — o hook de zoning vale pra todo worker.

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

try {
  if (existsSync('.git') || existsSync('../../.git')) {
    execSync('git config core.hooksPath .githooks', { stdio: 'ignore' });
  }
} catch {
  // sem git (ex.: CI com checkout raso) — segue sem hooks
}
