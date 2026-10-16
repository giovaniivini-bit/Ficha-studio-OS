// O cérebro (Fase 1, determinístico): decide a força do enforcement por recorrência e
// orquestra a captura (assinatura + ledger). A pesquisa (Fase 2) consome `needsResearch`.
import {
  readLedger,
  appendRecord,
  countBySignature,
  nextId,
  type LearningRecord,
  type Gatilho,
} from './learn-ledger.ts';
import { addSignature } from './learn-signatures.ts';

export interface CaptureDecision {
  recurrence: number; // ocorrências INCLUINDO esta
  newSignature: boolean;
  needsResearch: boolean; // recurrence >= 2 || retry — Fase 2 age nisto
  enforcement: 'hard' | 'propose'; // hard = TEM que virar trava
  message: string;
}

/** Decisão pura: dada a contagem ANTERIOR e o flag retry, define recorrência e força. */
export function decideCapture(
  priorCount: number,
  retry: boolean,
): Pick<CaptureDecision, 'recurrence' | 'needsResearch' | 'enforcement'> {
  const recurrence = priorCount + 1;
  const needsResearch = recurrence >= 2 || retry;
  return { recurrence, needsResearch, enforcement: needsResearch ? 'hard' : 'propose' };
}

export interface CaptureInput {
  ledgerPath: string;
  sigPath: string;
  today: string;
  assinatura: string;
  gatilho: Gatilho;
  camada: string;
  sintoma: string;
  causaRaiz: string;
  fix: string;
  retry: boolean;
}

export interface CaptureOutput {
  decision: CaptureDecision;
  record: LearningRecord;
}

/** Orquestra: registra assinatura, conta recorrência, decide, anexa a ficha. */
export async function capture(input: CaptureInput): Promise<CaptureOutput> {
  const records = await readLedger(input.ledgerPath);
  const newSignature = await addSignature(input.sigPath, input.assinatura, input.causaRaiz);
  const priorCount = countBySignature(records, input.assinatura);
  const base = decideCapture(priorCount, input.retry);

  const record: LearningRecord = {
    id: nextId(records, input.today),
    data: input.today,
    assinatura: input.assinatura,
    gatilho: input.gatilho,
    camada: input.camada,
    sintoma: input.sintoma,
    causaRaiz: input.causaRaiz,
    fix: input.fix,
    enforcement: null,
    pesquisado: null,
    status: 'captured',
  };
  await appendRecord(input.ledgerPath, record);

  let message: string;
  if (base.needsResearch) {
    const motivo = base.recurrence >= 2 ? `recorrência ${base.recurrence}x` : 'retry (1º fix falhou)';
    message =
      `${motivo} da assinatura "${input.assinatura}". ` +
      `Enforce DURO: gere uma trava mecânica pra esta classe (a pesquisa entra na Fase 2).`;
  } else {
    message = `1ª ocorrência de "${input.assinatura}". Proponha o enforcement (trava > regra > rubrica) e registre o ref.`;
  }

  return { decision: { ...base, newSignature, message }, record };
}
