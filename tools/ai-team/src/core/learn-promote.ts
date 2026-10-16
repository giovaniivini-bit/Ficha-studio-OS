// Seleção lado-projeto da promoção (Fase 3): quais assinaturas estão prontas pra virar
// blindagem GLOBAL — recorrentes (>=2 no ledger), já pesquisadas (research.jsonl) e ainda
// não promovidas (promoted.jsonl). O cross-repo (escrever no plugin) é da skill promover-blindagem.
import fs from 'node:fs/promises';
import path from 'node:path';
import { MONOREPO_ROOT } from './paths.ts';
import { countBySignature, type LearningRecord } from './learn-ledger.ts';
import { alreadyResearched, type ResearchRecord } from './learn-research.ts';

export const PROMOTED_PATH = path.join(MONOREPO_ROOT, 'docs', 'learnings', 'promoted.jsonl');

export interface PromotedRecord {
  assinatura: string;
  data: string;
  bId?: string | undefined;
}

export interface PromotionCandidate {
  assinatura: string;
  recurrence: number;
  research: ResearchRecord;
}

export function parsePromoted(text: string): PromotedRecord[] {
  const out: PromotedRecord[] = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const r = JSON.parse(t) as PromotedRecord;
      if (r && typeof r.assinatura === 'string') out.push(r);
    } catch {
      /* pula linha corrompida */
    }
  }
  return out;
}

export function isPromoted(records: PromotedRecord[], assinatura: string): boolean {
  return records.some((r) => r.assinatura === assinatura);
}

export async function readPromoted(promotedPath: string): Promise<PromotedRecord[]> {
  try {
    return parsePromoted(await fs.readFile(promotedPath, 'utf-8'));
  } catch {
    return [];
  }
}

export async function appendPromoted(promotedPath: string, rec: PromotedRecord): Promise<void> {
  await fs.mkdir(path.dirname(promotedPath), { recursive: true });
  await fs.appendFile(promotedPath, JSON.stringify(rec) + '\n', 'utf-8');
}

/** Candidatos: recorrentes (>=2 no ledger) E pesquisados E não-promovidos. Ordena por recorrência. */
export function selectForPromotion(
  ledger: LearningRecord[],
  research: ResearchRecord[],
  promoted: PromotedRecord[],
): PromotionCandidate[] {
  const sigs = new Set(ledger.map((r) => r.assinatura));
  const out: PromotionCandidate[] = [];
  for (const sig of sigs) {
    const recurrence = countBySignature(ledger, sig);
    if (recurrence < 2) continue;
    if (!alreadyResearched(research, sig)) continue;
    if (isPromoted(promoted, sig)) continue;
    const res = research.find((r) => r.assinatura === sig)!;
    out.push({ assinatura: sig, recurrence, research: res });
  }
  return out.sort((a, b) => b.recurrence - a.recurrence || a.assinatura.localeCompare(b.assinatura));
}

/** Doc de proposta de promoção (docs/learnings/PROMOTION.md). */
export function renderPromotionDoc(candidates: PromotionCandidate[]): string {
  const head =
    `# Proposta de promoção pro cérebro global\n\n` +
    `> Gerado por \`ai-team learn promote\`. Cada candidata é recorrente + pesquisada + ainda não\n` +
    `> promovida. Promover ao global afeta TODOS os projetos futuros — use a skill \`promover-blindagem\`\n` +
    `> (gate humano) pra revisar e aceitar.\n\n`;
  if (candidates.length === 0) return head + '_Nenhuma candidata no momento._\n';
  const blocks = candidates.map(
    (c) =>
      `## ${c.assinatura} (recorrência ${c.recurrence}x)\n\n` +
      `- Resumo da pesquisa: ${c.research.resumo || '(vazio)'}\n` +
      `- Guarda recomendada: ${c.research.guardaRecomendada || '(vazio)'}\n` +
      `- Fontes: ${c.research.fontes.join(', ') || '(nenhuma)'}\n`,
  );
  return head + blocks.join('\n');
}
