import path from 'node:path';
import { MONOREPO_ROOT } from './config.ts';

/** Raiz do monorepo-alvo (detectada via `git rev-parse --show-toplevel`). */
export { MONOREPO_ROOT };
export const SLOTS_DIR = path.join(MONOREPO_ROOT, 'specs', 'slots');
export const WORKTREES_DIR = path.join(MONOREPO_ROOT, '.worktrees');

/** Estado de runtime do modo autônomo (gitignored): pids, metas, settings, logs. */
export const RUNTIME_DIR = path.join(MONOREPO_ROOT, '.ai-team');
export const RUN_DIR = path.join(RUNTIME_DIR, 'run');
export const LOGS_DIR = path.join(RUNTIME_DIR, 'logs');
