// Gate 2 - reviewer de contexto limpo. Espelha o one-shot do triage.ts, mas READ-ONLY:
// recebe DESIGN-SPEC + diff + contrato de estrutura, e emite veredito (nao corrige).

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { MONOREPO_ROOT, RUN_DIR } from './paths.ts';
import { loadConfig } from './config.ts';
import { runGit } from './git.ts';

const execAsync = promisify(execFile);

export interface ReviewResult {
  verdict: 'approved' | 'rejected';
  reason: string; // '' quando approved; motivo curto quando rejected
  report: string; // saida completa do reviewer (vira REVIEW.md como feedback)
}

/** Permissoes do reviewer: READ-ONLY total. Nega qualquer escrita/mutacao/rede. */
export const REVIEW_SETTINGS = {
  permissions: {
    allow: [
      'Read', 'Glob', 'Grep',
      'Bash(git status)', 'Bash(git status:*)',
      'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)',
      'Bash(pnpm typecheck:*)', 'Bash(pnpm -r:*)', 'Bash(pnpm --filter:*)',
      'Bash(ls:*)', 'Bash(cat:*)', 'Bash(grep:*)', 'Bash(rg:*)',
    ],
    deny: [
      'Edit', 'Write', 'NotebookEdit',
      'Bash(git add:*)', 'Bash(git commit:*)', 'Bash(git push:*)',
      'Bash(git checkout:*)', 'Bash(git switch:*)', 'Bash(git merge:*)',
      'Bash(git rebase:*)', 'Bash(git reset:*)', 'Bash(rm:*)',
      'WebFetch', 'WebSearch', 'Bash(curl:*)', 'Bash(wget:*)',
    ],
  },
} satisfies { permissions: { allow: string[]; deny: string[] } };

export function buildReviewPrompt(opts: {
  milestone: string;
  slotId: string;
  designSpec: string;
  contract: string;
  sharedContract: string;
  diff: string;
  artifacts: string;
}): string {
  return `Voce e o REVIEWER do time multi-agente (ver specs/PARALLEL-PROTOCOL.md), rodando
em REVIEW DE CONTEXTO LIMPO, sem humano. Voce NAO conhece o transcript de quem implementou:
julgue SO pelo que esta abaixo (DESIGN-SPEC + diff + contrato). Voce e READ-ONLY: NAO edite
nada, NAO conserte. Seu unico produto e um veredito.

Revise o slot **${opts.milestone}/${opts.slotId}** aplicando os tiers, NESTA prioridade:

TIER 0 - ESTRUTURA & COMPONENTIZACAO (o que mais erramos - confira nas DUAS camadas):
  - Backend: o codigo segue modulo-por-dominio (ADR 004: modules/<dominio>/{routes,service,schema})?
    O que e compartilhado esta em packages/core|packages/shared|lib central, e o que e local
    ficou local? Nada de logica de dominio vazando pro lugar errado.
  - Frontend: decomposicao page/client/components (ADR 006)? Componente que mais de um lugar
    usa esta em components/ui (e nao duplicado), conforme o Manifesto de Componentizacao do
    SHARED-CONTRACT? Componentes presentacionais sao props-only?
  - Ambas: adapter pattern onde a spec pede (ADR 002/008), sem SDK de vendor importado direto.
  - Duplicacao: dois pedacos quase iguais que deveriam ser UM compartilhado = REPROVADO.
TIER 1 - Fidelidade a DESIGN-SPEC: nomes, schemas Zod, signatures, props batem EXATO com a spec?
TIER 2 - Seguranca baseline: secrets fora do codigo, input validado, sem injection, authz no back.
TIER 3 - Correcao & edge cases: null/empty/erro tratados; erros tipados, nao engolidos.
TIER 4 - Nits (nome/comentario/format): ANOTA, nao reprova.

Critical/Important em qualquer tier 0-3 = REPROVADO. So Nits = APROVADO.

Termine sua resposta com UMA das duas, exata:
- \`APROVADO\` (se nada critical/important)
- \`REPROVADO: <motivo curto e acionavel>\` (o Dev vai reler este motivo no re-despacho - seja especifico:
  o que esta errado, em que arquivo, e o que era pra ser)

---
## DESIGN-SPEC do slot
${opts.designSpec}
---
## CONTRACT
${opts.contract}
---
## SHARED-CONTRACT do milestone (inclui o Manifesto/Contrato de Estrutura)
${opts.sharedContract}
---
## ARTIFACTS.md do worker (divergencias declaradas - leia)
${opts.artifacts}
---
## DIFF do slot (git diff main...<branch> - o trabalho a revisar)
${opts.diff}
---

Analise e termine com APROVADO ou REPROVADO: <motivo>.`;
}

/**
 * Veredito por regex no tail. Fail-safe: sem APROVADO/REPROVADO claro = rejected
 * (nao mergeia sem aprovacao explicita). Se ambos aparecem, vence o que vier por ultimo.
 */
export function parseReviewVerdict(stdout: string): { verdict: 'approved' | 'rejected'; reason: string } {
  const tail = stdout.trim().slice(-3000);
  const approvedAt = tail.lastIndexOf('APROVADO');
  const rejected = [...tail.matchAll(/REPROVADO:?\s*([^\n]*)/g)].pop();
  const rejectedAt = rejected ? (rejected.index ?? -1) : -1;
  if (approvedAt >= 0 && approvedAt > rejectedAt) {
    return { verdict: 'approved', reason: '' };
  }
  if (rejectedAt >= 0) {
    return { verdict: 'rejected', reason: (rejected![1] || 'review reprovou').trim().slice(0, 200) };
  }
  return { verdict: 'rejected', reason: 'review nao concluiu com veredito' };
}

async function readIfExists(p: string): Promise<string> {
  try {
    return await fs.readFile(p, 'utf-8');
  } catch {
    return '(arquivo ausente)';
  }
}

async function showFromBranch(branch: string, rel: string): Promise<string> {
  try {
    const { stdout } = await runGit(['show', `${branch}:${rel}`]);
    return stdout;
  } catch {
    return '(arquivo ausente na branch)';
  }
}

async function diffSlot(branch: string): Promise<string | null> {
  try {
    const { stdout } = await runGit(['diff', `main...${branch}`]);
    return stdout;
  } catch {
    return null;
  }
}

/** Revisa um slot `done` (contexto limpo, sincrono). Espelha triageBlockedSlot, mas read-only. */
export async function reviewDoneSlot(opts: {
  branch: string;
  milestone: string;
  slotId: string;
}): Promise<ReviewResult> {
  const { autonomous: auto } = loadConfig();
  const slotRel = path.join('specs', 'slots', opts.milestone, opts.slotId);
  const slotAbs = path.join(MONOREPO_ROOT, slotRel);

  const diff = await diffSlot(opts.branch);
  if (diff === null || diff.trim() === '') {
    return {
      verdict: 'rejected',
      reason: 'diff indisponivel ou vazio - slot done sem mudancas revisaveis',
      report: '',
    };
  }

  const prompt = buildReviewPrompt({
    milestone: opts.milestone,
    slotId: opts.slotId,
    designSpec: await readIfExists(path.join(slotAbs, 'DESIGN-SPEC.md')),
    contract: await readIfExists(path.join(slotAbs, 'CONTRACT.md')),
    sharedContract: await readIfExists(
      path.join(MONOREPO_ROOT, 'specs', 'slots', opts.milestone, 'SHARED-CONTRACT.md'),
    ),
    diff,
    artifacts: await showFromBranch(opts.branch, `${slotRel}/ARTIFACTS.md`),
  });

  await fs.mkdir(RUN_DIR, { recursive: true });
  const settingsPath = path.join(RUN_DIR, '_review.settings.json');
  await fs.writeFile(settingsPath, JSON.stringify(REVIEW_SETTINGS, null, 2));

  try {
    const { stdout } = await execAsync(
      auto.command,
      ['-p', prompt, '--settings', settingsPath, '--max-turns', '30'],
      { cwd: MONOREPO_ROOT, timeout: 12 * 60_000, maxBuffer: 32 * 1024 * 1024 },
    );
    const parsed = parseReviewVerdict(stdout);
    return { ...parsed, report: stdout.trim().slice(-8000) };
  } catch (err) {
    const e = err as { message?: string };
    // Falha de spawn/timeout = fail-safe rejeitado (nao mergeia sem review concluido).
    return { verdict: 'rejected', reason: `review falhou: ${(e.message ?? '').slice(0, 150)}`, report: '' };
  }
}
