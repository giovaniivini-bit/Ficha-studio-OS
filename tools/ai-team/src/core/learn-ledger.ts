// Camada de dados do Loop de Aprendizado: o ledger append-only (docs/learnings/ledger.jsonl).
// Uma linha JSON por aprendizado. Funções puras (parse/serialize/count/nextId) + IO.
import fs from 'node:fs/promises';
import path from 'node:path';
import { MONOREPO_ROOT } from './paths.ts';

export type Gatilho =
  | 'HTC'
  | 'bug'
  | 'smoke'
  | 'blocked'
  | 'reconcile'
  | 'zoning'
  | 'spec-ambiguity';

export type LearningStatus = 'captured' | 'researched' | 'enforced' | 'promoted';

export interface Enforcement {
  tipo: 'trava' | 'regra' | 'rubrica';
  ref: string;
}

export interface LearningRecord {
  id: string;
  data: string;
  assinatura: string;
  gatilho: Gatilho;
  camada: string;
  sintoma: string;
  causaRaiz: string;
  fix: string;
  enforcement: Enforcement | null;
  pesquisado: { fontes: string[]; resumo: string } | null;
  status: LearningStatus;
}

/** Caminho do ledger no projeto-alvo. */
export const LEDGER_PATH = path.join(MONOREPO_ROOT, 'docs', 'learnings', 'ledger.jsonl');

/** Parse defensivo: uma linha JSON por registro; linhas inválidas/vazias são puladas. */
export function parseLedger(text: string): LearningRecord[] {
  const out: LearningRecord[] = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const r = JSON.parse(t) as LearningRecord;
      if (r && typeof r.id === 'string' && typeof r.assinatura === 'string') out.push(r);
    } catch {
      /* linha corrompida — pula (append-only protege o resto) */
    }
  }
  return out;
}

/** Serializa um registro como uma linha JSON. */
export function serializeRecord(rec: LearningRecord): string {
  return JSON.stringify(rec);
}

/** Conta registros com a assinatura dada. */
export function countBySignature(records: LearningRecord[], assinatura: string): number {
  return records.filter((r) => r.assinatura === assinatura).length;
}

/** Próximo id do dia: `<data>-NNN`, NNN = (máximo do dia) + 1, 3 dígitos. */
export function nextId(records: LearningRecord[], data: string): string {
  let max = 0;
  for (const r of records) {
    if (r.id.startsWith(`${data}-`)) {
      const n = parseInt(r.id.slice(data.length + 1), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `${data}-${String(max + 1).padStart(3, '0')}`;
}

/** Lê o ledger (vazio se ausente). */
export async function readLedger(ledgerPath: string): Promise<LearningRecord[]> {
  try {
    return parseLedger(await fs.readFile(ledgerPath, 'utf-8'));
  } catch {
    return [];
  }
}

/** Anexa um registro (cria o diretório se faltar). Append-only. */
export async function appendRecord(ledgerPath: string, rec: LearningRecord): Promise<void> {
  await fs.mkdir(path.dirname(ledgerPath), { recursive: true });
  await fs.appendFile(ledgerPath, serializeRecord(rec) + '\n', 'utf-8');
}
