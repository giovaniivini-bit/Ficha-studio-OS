// Triage automática de slot blocked (Fase 2 do modo autônomo).
// Quando um worker marca `blocked:<motivo>`, o scheduler spawna um ARQUITETO one-shot
// (claude -p, síncrono, na main) que decide em 2 níveis — espelhando a divisão de
// papéis do método: ambiguidade de SPEC ele mesmo corrige (é o território dele:
// specs/ + packages/shared); decisão de PRODUTO/escopo ele escala pro humano.

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { MONOREPO_ROOT, RUN_DIR } from './paths.ts';
import { loadConfig } from './config.ts';
import { runGit } from './git.ts';
import { parseLineList } from './zoning.ts';

const execAsync = promisify(execFile);

/** Front se o territorio mexe em apps/web; senao back (api/core/db/adapters/shared). */
export function classifySlotDomain(territory: string[]): 'front' | 'back' {
  return territory.some((g) => g.startsWith('apps/web/')) ? 'front' : 'back';
}

/** Persona do arquiteto especializado, injetada no prompt da triage. */
export function domainPersona(domain: 'front' | 'back'): string {
  if (domain === 'front') {
    return `ARQUITETO DE FRONTEND (Next.js): decomposicao page/client/components (ADR 006), ViewModels, ` +
      `data layer (lib/queries), tokens/px do DESIGN-OVERVIEW, 4 estados (loading/empty/error/ok), ` +
      `components/ui compartilhado`;
  }
  return `ARQUITETO DE BACKEND (Fastify): modulo-por-dominio (ADR 004, modules/<dominio>/{routes,service,schema}), ` +
    `Zod nas fronteiras, DTOs em packages/shared, fundacao de dados (packages/db, ADR 007), core (packages/core), ` +
    `adapters (ADR 002/008), authz e multi-tenancy no backend`;
}

export interface TriageResult {
  verdict: 'resolved' | 'escalate';
  summary: string;
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

/** Permissões do Arquiteto de triage: specs + shared (o território DELE), nada além. */
const TRIAGE_SETTINGS = {
  permissions: {
    allow: [
      'Edit(specs/slots/**)',
      'Write(specs/slots/**)',
      'Edit(packages/shared/**)',
      'Write(packages/shared/**)',
      'Bash(git status)',
      'Bash(git status:*)',
      'Bash(git add:*)',
      'Bash(git commit:*)',
      'Bash(git diff:*)',
      'Bash(git log:*)',
      'Bash(git show:*)',
      'Bash(pnpm typecheck:*)',
      'Bash(pnpm -r:*)',
      'Bash(pnpm --filter:*)',
      'Bash(ls:*)',
      'Bash(cat:*)',
    ],
    deny: [
      'Bash(git push:*)',
      'Bash(git checkout:*)',
      'Bash(git switch:*)',
      'Bash(git merge:*)',
      'Bash(git rebase:*)',
      'Bash(git reset:*)',
      'Bash(rm -rf:*)',
      'WebFetch',
      'WebSearch',
      'Bash(curl:*)',
      'Bash(wget:*)',
    ],
  },
};

function buildTriagePrompt(opts: {
  milestone: string;
  slotId: string;
  reason: string;
  brief: string;
  designSpec: string;
  contract: string;
  sharedContract: string;
  artifacts: string;
  domain: 'front' | 'back';
}): string {
  return `Você é o ${domainPersona(opts.domain)} do time multi-agente (ver specs/PARALLEL-PROTOCOL.md), rodando
em modo de TRIAGE AUTOMÁTICA, sem humano. Um worker autônomo travou no slot
**${opts.milestone}/${opts.slotId}** com o motivo: \`blocked:${opts.reason}\`.

Sua decisão tem DOIS níveis:

A) **É ambiguidade/erro de SPEC** (DESIGN-SPEC incompleta, nome errado, DTO faltando em
   packages/shared, contrato da fundação citado errado)? Então CORRIJA você mesmo —
   specs/slots/** e packages/shared/** são o SEU território:
   1. Edite a DESIGN-SPEC (e/ou o DTO em packages/shared) eliminando a ambiguidade EXATA
      que o worker descreveu. Schemas Zod completos, nomes determinísticos.
   2. Rode \`pnpm -r --if-present typecheck\` se tocou em shared.
   3. Commite: \`git add -A && git commit -m "fix(spec): ${opts.slotId} — <o que corrigiu>"\`.
   4. Termine sua resposta com a palavra exata: RESOLVIDO

B) **É decisão de PRODUTO/escopo** (o BRIEF não cobre, precisa de escolha de negócio,
   dependência externa ausente, infraestrutura quebrada)? NÃO invente. Termine sua
   resposta com a palavra exata: ESCALAR — seguida de 1-3 linhas explicando o que o
   humano precisa decidir.

NUNCA: edite código de feature (território dos Devs), toque em app/api fora de specs e
shared, ou responda sem terminar com RESOLVIDO ou ESCALAR.

---
## BRIEF do slot
${opts.brief}
---
## DESIGN-SPEC atual
${opts.designSpec}
---
## CONTRACT
${opts.contract}
---
## SHARED-CONTRACT do milestone
${opts.sharedContract}
---
## ARTIFACTS.md do worker (o relato do travamento — leia com atenção)
${opts.artifacts}
---

Analise e aja agora.`;
}

/**
 * Roda a triage SÍNCRONA (bloqueia o loop do scheduler — de propósito: o Arquiteto
 * commita na main e não queremos reconcile concorrente).
 */
export async function triageBlockedSlot(opts: {
  branch: string;
  milestone: string;
  slotId: string;
  reason: string;
}): Promise<TriageResult> {
  const { autonomous: auto } = loadConfig();
  const slotRel = path.join('specs', 'slots', opts.milestone, opts.slotId);
  const slotAbs = path.join(MONOREPO_ROOT, slotRel);

  const terrRaw = await readIfExists(path.join(slotAbs, 'TERRITORY.txt'));
  const territory = terrRaw === '(arquivo ausente)' ? [] : parseLineList(terrRaw);
  const domain = classifySlotDomain(territory);

  const prompt = buildTriagePrompt({
    milestone: opts.milestone,
    slotId: opts.slotId,
    reason: opts.reason,
    brief: await readIfExists(path.join(slotAbs, 'BRIEF.md')),
    designSpec: await readIfExists(path.join(slotAbs, 'DESIGN-SPEC.md')),
    contract: await readIfExists(path.join(slotAbs, 'CONTRACT.md')),
    sharedContract: await readIfExists(
      path.join(MONOREPO_ROOT, 'specs', 'slots', opts.milestone, 'SHARED-CONTRACT.md'),
    ),
    artifacts: await showFromBranch(opts.branch, `${slotRel}/ARTIFACTS.md`),
    domain,
  });

  await fs.mkdir(RUN_DIR, { recursive: true });
  const settingsPath = path.join(RUN_DIR, '_triage.settings.json');
  await fs.writeFile(settingsPath, JSON.stringify(TRIAGE_SETTINGS, null, 2));

  try {
    const { stdout } = await execAsync(
      auto.command,
      ['-p', prompt, '--settings', settingsPath, '--max-turns', '40'],
      { cwd: MONOREPO_ROOT, timeout: 12 * 60_000, maxBuffer: 32 * 1024 * 1024 },
    );
    const tail = stdout.trim().slice(-2000);
    if (/\bRESOLVIDO\b/.test(tail)) {
      return { verdict: 'resolved', summary: tail.slice(-300) };
    }
    return { verdict: 'escalate', summary: tail.slice(-300) || 'triage não concluiu' };
  } catch (err) {
    const e = err as { stdout?: string; message?: string };
    return {
      verdict: 'escalate',
      summary: `triage falhou: ${(e.message ?? '').slice(0, 200)}`,
    };
  }
}
