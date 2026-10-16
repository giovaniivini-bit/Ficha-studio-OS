// Subcomando `ai-team learn <sub>`: `capture` (registra aprendizado + conta recorrência),
// `research` (pesquisa a classe do erro em base pública) e `sweep` (pesquisa em lote as recorrentes).
import { capture } from '../core/learn-controller.ts';
import { readLedger, LEDGER_PATH, type Gatilho } from '../core/learn-ledger.ts';
import { SIGNATURES_PATH } from '../core/learn-signatures.ts';
import {
  researchSignature,
  selectForSweep,
  readResearch,
  RESEARCH_PATH,
} from '../core/learn-research.ts';
import fs from 'node:fs/promises';
import pathmod from 'node:path';
import { MONOREPO_ROOT } from '../core/paths.ts';
import {
  selectForPromotion,
  renderPromotionDoc,
  readPromoted,
  appendPromoted,
  isPromoted,
  PROMOTED_PATH,
} from '../core/learn-promote.ts';
import { renderGrepTrava } from '../core/learn-trava.ts';

const GATILHOS: Gatilho[] = ['HTC', 'bug', 'smoke', 'blocked', 'reconcile', 'zoning', 'spec-ambiguity'];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Assinatura é uma chave de máquina estável: kebab-case minúsculo. */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug);
}

export interface LearnCaptureArgs {
  assinatura?: string | undefined;
  gatilho?: string | undefined;
  camada?: string | undefined;
  sintoma?: string | undefined;
  causa?: string | undefined;
  fix?: string | undefined;
  retry: boolean;
  budget?: number | undefined;
  pattern?: string | undefined;
  path?: string | undefined;
  message?: string | undefined;
  bid?: string | undefined;
}

export async function learnCapture(a: LearnCaptureArgs): Promise<void> {
  if (!a.assinatura || !a.gatilho || !a.sintoma || !a.causa || !a.fix) {
    console.error(
      'uso: ai-team learn capture --assinatura=<slug> --gatilho=<g> --sintoma="..." --causa="..." --fix="..." [--camada=back] [--retry]',
    );
    console.error(`gatilhos: ${GATILHOS.join(' | ')}`);
    process.exit(2);
  }
  if (!GATILHOS.includes(a.gatilho as Gatilho)) {
    console.error(`gatilho inválido: ${a.gatilho}. use: ${GATILHOS.join(' | ')}`);
    process.exit(2);
  }
  if (!isValidSlug(a.assinatura)) {
    console.error(
      `assinatura inválida: "${a.assinatura}". use kebab-case minúsculo (ex.: escrita-sem-authz) — ela é a chave de máquina da classe do erro.`,
    );
    process.exit(2);
  }
  const { decision, record } = await capture({
    ledgerPath: LEDGER_PATH,
    sigPath: SIGNATURES_PATH,
    today: today(),
    assinatura: a.assinatura,
    gatilho: a.gatilho as Gatilho,
    camada: a.camada ?? 'back',
    sintoma: a.sintoma,
    causaRaiz: a.causa,
    fix: a.fix,
    retry: a.retry,
  });
  console.log(
    `registrado ${record.id} (assinatura "${record.assinatura}", recorrência ${decision.recurrence}x).`,
  );
  console.log(decision.message);
}

export async function learnResearch(a: LearnCaptureArgs): Promise<void> {
  if (!a.assinatura || !a.causa) {
    console.error('uso: ai-team learn research --assinatura=<slug> --causa="<causa raiz>"');
    process.exit(2);
  }
  if (!isValidSlug(a.assinatura)) {
    console.error(`assinatura inválida: "${a.assinatura}". use kebab-case minúsculo.`);
    process.exit(2);
  }
  const res = await researchSignature({
    assinatura: a.assinatura,
    causaRaiz: a.causa,
    researchPath: RESEARCH_PATH,
    today: today(),
  });
  if (res.deduped) {
    console.log(`"${a.assinatura}" já foi pesquisada — reusando (dedup). Nada a fazer.`);
    return;
  }
  console.log(`pesquisado "${a.assinatura}": ${res.record?.fontes.length ?? 0} fonte(s).`);
  console.log(`guarda recomendada: ${res.record?.guardaRecomendada || '(vazio)'}`);
}

export async function learnSweep(a: LearnCaptureArgs): Promise<void> {
  const budget = typeof a.budget === 'number' && a.budget > 0 ? a.budget : 5;
  const [ledger, researched] = await Promise.all([
    readLedger(LEDGER_PATH),
    readResearch(RESEARCH_PATH),
  ]);
  const { selected, deferred } = selectForSweep(ledger, researched, budget);
  if (selected.length === 0) {
    console.log('sweep: nenhuma assinatura recorrente pendente de pesquisa.');
    return;
  }
  console.log(
    `sweep: pesquisando ${selected.length} assinatura(s) (budget ${budget}): ${selected.join(', ')}`,
  );
  if (deferred.length > 0) console.log(`sweep: ADIADAS (acima do budget): ${deferred.join(', ')}`);
  for (const sig of selected) {
    const causa = ledger.find((rec) => rec.assinatura === sig)?.causaRaiz ?? sig;
    try {
      const res = await researchSignature({
        assinatura: sig,
        causaRaiz: causa,
        researchPath: RESEARCH_PATH,
        today: today(),
      });
      console.log(`  - ${sig}: ${res.deduped ? 'já pesquisada' : `${res.record?.fontes.length ?? 0} fonte(s)`}`);
    } catch (err) {
      // Um spawn falho não pode abortar o lote — loga e segue (como o triage isola erros).
      console.log(`  - ${sig}: FALHOU (${err instanceof Error ? err.message.slice(0, 120) : String(err)})`);
    }
  }
}

export async function learnPromote(): Promise<void> {
  const [ledger, research, promoted] = await Promise.all([
    readLedger(LEDGER_PATH),
    readResearch(RESEARCH_PATH),
    readPromoted(PROMOTED_PATH),
  ]);
  const candidates = selectForPromotion(ledger, research, promoted);
  const doc = renderPromotionDoc(candidates);
  const docPath = pathmod.join(MONOREPO_ROOT, 'docs', 'learnings', 'PROMOTION.md');
  await fs.mkdir(pathmod.dirname(docPath), { recursive: true });
  await fs.writeFile(docPath, doc, 'utf-8');
  if (candidates.length === 0) {
    console.log('promote: nenhuma candidata (recorrente + pesquisada + não-promovida).');
    return;
  }
  console.log(`promote: ${candidates.length} candidata(s) → ${docPath}`);
  for (const c of candidates) console.log(`  - ${c.assinatura} (recorrência ${c.recurrence}x)`);
  console.log('Use a skill /promover-blindagem pra revisar e promover ao global (gate humano).');
}

export async function learnGenTrava(a: LearnCaptureArgs): Promise<void> {
  if (!a.assinatura || !a.pattern) {
    console.error(
      'uso: ai-team learn gen-trava --assinatura=<slug> --pattern="<regex>" [--path="routes.ts"] [--message="..."]',
    );
    process.exit(2);
  }
  if (!isValidSlug(a.assinatura)) {
    console.error(`assinatura inválida: "${a.assinatura}". use kebab-case minúsculo.`);
    process.exit(2);
  }
  const content = renderGrepTrava(
    a.assinatura,
    a.pattern,
    a.path ?? '',
    a.message ?? `classe de erro: ${a.assinatura}`,
  );
  const dir = pathmod.join(MONOREPO_ROOT, 'scripts');
  await fs.mkdir(dir, { recursive: true });
  const file = pathmod.join(dir, `check-${a.assinatura}.mjs`);
  await fs.writeFile(file, content, 'utf-8');
  // Regerar a trava é ok (pattern pode mudar), mas não duplica a marca de promoção.
  const already = isPromoted(await readPromoted(PROMOTED_PATH), a.assinatura);
  if (!already) await appendPromoted(PROMOTED_PATH, { assinatura: a.assinatura, data: today() });
  console.log(`trava gerada: ${file}`);
  if (already) console.log('(assinatura já estava marcada como promovida — não dupliquei)');
  console.log(`adicione ao script "travas" do projeto: node scripts/check-${a.assinatura}.mjs`);
}

export async function learnMarkPromoted(a: LearnCaptureArgs): Promise<void> {
  if (!a.assinatura) {
    console.error('uso: ai-team learn mark-promoted --assinatura=<slug> [--bid=B13]');
    process.exit(2);
  }
  await appendPromoted(PROMOTED_PATH, {
    assinatura: a.assinatura,
    data: today(),
    ...(a.bid ? { bId: a.bid } : {}),
  });
  console.log(`marcado como promovido: ${a.assinatura}${a.bid ? ` (${a.bid})` : ''}`);
}

export async function learn(sub: string | undefined, args: LearnCaptureArgs): Promise<void> {
  switch (sub) {
    case 'capture':
      return learnCapture(args);
    case 'research':
      return learnResearch(args);
    case 'sweep':
      return learnSweep(args);
    case 'promote':
      return learnPromote();
    case 'gen-trava':
      return learnGenTrava(args);
    case 'mark-promoted':
      return learnMarkPromoted(args);
    default:
      console.error('uso: ai-team learn <capture|research|sweep|promote|gen-trava|mark-promoted> [...]');
      process.exit(2);
  }
}
