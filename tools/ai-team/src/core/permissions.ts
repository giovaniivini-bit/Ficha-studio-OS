// Gerador de permissões do worker headless (modo autônomo).
// Traduz o zoning DECLARADO (TERRITORY.txt + neutralZones do .ai-team.json) em
// permissões EXECUTÁVEIS do Claude Code (--settings): Edit/Write só dentro do
// território; zona neutra e operações perigosas negadas por mecanismo, não por prompt.
//
// Defesa em 3 camadas: (1) estas permissões, (2) pre-commit de zoning do projeto,
// (3) validação do reconcile (RECONCILE-REPORT.md).

export interface WorkerPermissionOpts {
  /** Globs do TERRITORY.txt do slot. */
  territory: string[];
  /** Globs de zona neutra (.ai-team.json → neutralZones). */
  neutralZones: string[];
  /** Pasta do slot relativa à raiz (ex: specs/slots/M1/api-x) — sempre editável. */
  slotDirRel: string;
  /** false = nega WebFetch/WebSearch/curl/wget. */
  allowNetwork: boolean;
}

/** Comandos que o worker PRECISA pra cumprir o protocolo (instalar, smoke, commitar). */
const BASH_ALLOW = [
  'Bash(pwd)',
  'Bash(ls:*)',
  'Bash(cat:*)',
  'Bash(node:*)',
  'Bash(npx tsc:*)',
  'Bash(npx vitest:*)',
  'Bash(pnpm install)',
  'Bash(pnpm install:*)',
  'Bash(pnpm typecheck:*)',
  'Bash(pnpm -r:*)',
  'Bash(pnpm --filter:*)',
  'Bash(pnpm test:*)',
  'Bash(pnpm exec:*)',
  'Bash(pnpm run:*)',
  'Bash(git status)',
  'Bash(git status:*)',
  'Bash(git add:*)',
  'Bash(git commit:*)',
  'Bash(git diff:*)',
  'Bash(git log:*)',
  'Bash(git show:*)',
  'Bash(git stash)',
  'Bash(git stash:*)',
  'Bash(git branch --show-current)',
];

/** Operações que tiram o worker do trilho — negadas SEMPRE (deny vence allow). */
const BASH_DENY = [
  'Bash(git push:*)',
  'Bash(git checkout:*)',
  'Bash(git switch:*)',
  'Bash(git merge:*)',
  'Bash(git rebase:*)',
  'Bash(git reset:*)',
  'Bash(git worktree:*)',
  'Bash(rm -rf:*)',
  'Bash(sudo:*)',
];

const NETWORK_DENY = ['WebFetch', 'WebSearch', 'Bash(curl:*)', 'Bash(wget:*)'];

export interface ClaudeSettings {
  permissions: {
    allow: string[];
    deny: string[];
  };
}

export function buildWorkerSettings(opts: WorkerPermissionOpts): ClaudeSettings {
  const allow: string[] = [];
  const deny: string[] = [];

  // Escrita: só território + a pasta do próprio slot (STATUS/ARTIFACTS).
  const writable = [...opts.territory, `${opts.slotDirRel}/**`];
  for (const glob of writable) {
    allow.push(`Edit(${glob})`, `Write(${glob})`);
  }

  allow.push(...BASH_ALLOW);

  // Zona neutra: negada por mecanismo (deny vence o allow do território,
  // caso o Arquiteto tenha declarado um território largo demais por engano).
  for (const glob of opts.neutralZones) {
    deny.push(`Edit(${glob})`, `Write(${glob})`);
  }

  deny.push(...BASH_DENY);
  if (!opts.allowNetwork) deny.push(...NETWORK_DENY);

  return { permissions: { allow, deny } };
}
