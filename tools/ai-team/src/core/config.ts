import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Versão de schema do .ai-team.json que este CLI entende. */
export const CONFIG_VERSION = 4;

/** Configuração do modo autônomo (`ai-team run`) — workers headless via `claude -p`. */
export interface AutonomousConfig {
  /** Workers em paralelo. O teto real é o rate limit da conta — default conservador. */
  maxWorkers: number;
  /** Modelo dos workers (`--model`). null = herda o default da conta do usuário. */
  model: string | null;
  /** Binário que vira o worker. Default "claude". Trocável pra teste (script fake). */
  command: string;
  /** Teto de turnos por worker (`--max-turns`) — anti-loop. */
  maxTurns: number;
  /** Timeout absoluto de um slot (wall-clock). Estourou = slot mal decomposto. */
  slotTimeoutMin: number;
  /** Sem commit novo nem log novo por N min = worker estagnado → kill + retry. */
  stallTimeoutMin: number;
  /** Re-despachos por slot antes de escalar pro humano. */
  maxRetries: number;
  /** false (default) = nega WebFetch/WebSearch/curl/wget pros workers. */
  allowNetwork: boolean;
  /** Triage automática de blocked com Arquiteto one-shot (Fase 2). */
  triage: boolean;
}

/** Gates de verificacao (Fase 1: Gate 1 / verificador de contrato; Fase 2: Gate 2 / revisor limpo). */
export interface GatesConfig {
  contractGate: { enabled: boolean };
  cleanReviewer: { enabled: boolean; maxReviewLoops: number };
}

export const GATES_DEFAULTS: GatesConfig = {
  contractGate: { enabled: true },
  cleanReviewer: { enabled: true, maxReviewLoops: 2 },
};

export const AUTONOMOUS_DEFAULTS: AutonomousConfig = {
  // Squad padrão: 4 Devs (2 front + 2 back) além de CTO/Arquiteto. O backoff
  // automático reduz a concorrência se o rate limit da conta apertar.
  maxWorkers: 4,
  model: null,
  command: 'claude',
  maxTurns: 80,
  slotTimeoutMin: 45,
  stallTimeoutMin: 20,
  maxRetries: 2,
  allowNetwork: false,
  triage: true,
};

/**
 * Config opcional do projeto-alvo, lida de `.ai-team.json` na raiz do repo.
 * Tudo tem default sensato — o arquivo só existe quando o projeto quer customizar.
 */
export interface AiTeamConfig {
  /** Versão do schema deste arquivo. CLI avisa se for mais nova do que entende. */
  version: number;
  /** Comando de smoke rodado pelo reconciler após merge. Default: typecheck recursivo. */
  smoke: string[];
  /** Prefixo das branches de worker. Default: "worker". Branch vira `<prefix>/<milestone>/<slotId>`. */
  branchPrefix: string;
  /**
   * Barrels (index.ts) que o reconciler sincroniza automaticamente: pra cada path,
   * adiciona `import './<arquivo>';` dos .ts irmãos que faltarem. Opt-in — vazio = não mexe.
   */
  syncBarrels: string[];
  /**
   * Globs de ZONA NEUTRA (PARALLEL-PROTOCOL §3) — arquivos que só o Integrador toca.
   * Usados pelo reconciler (warning de zoning) e pelo pre-commit do projeto.
   */
  neutralZones: string[];
  /** Modo autônomo (`ai-team run`). Tudo tem default — o bloco é opcional. */
  autonomous: AutonomousConfig;
  /** Gates de verificação pré-fan-out. */
  gates: GatesConfig;
}

/** Parse defensivo do bloco gates (default: contractGate e cleanReviewer habilitados; respeita enabled:false). */
export function parseGates(parsed: Partial<AiTeamConfig> | undefined): GatesConfig {
  const g = parsed?.gates as Partial<GatesConfig> | undefined;
  const cr = g?.cleanReviewer as Partial<GatesConfig['cleanReviewer']> | undefined;
  return {
    contractGate: {
      enabled: g?.contractGate?.enabled !== false,
    },
    cleanReviewer: {
      enabled: cr?.enabled !== false,
      maxReviewLoops:
        typeof cr?.maxReviewLoops === 'number' && cr.maxReviewLoops >= 0
          ? cr.maxReviewLoops
          : GATES_DEFAULTS.cleanReviewer.maxReviewLoops,
    },
  };
}

const DEFAULTS: AiTeamConfig = {
  version: CONFIG_VERSION,
  smoke: ['pnpm', '-r', '--if-present', 'typecheck'],
  branchPrefix: 'worker',
  syncBarrels: [],
  neutralZones: [],
  autonomous: { ...AUTONOMOUS_DEFAULTS },
  gates: { contractGate: { ...GATES_DEFAULTS.contractGate }, cleanReviewer: { ...GATES_DEFAULTS.cleanReviewer } },
};

function detectRoot(): string {
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf-8',
    }).trim();
    if (top) return top;
  } catch {
    /* não é repo git ou git ausente — cai no fallback abaixo */
  }
  // Fallback: assume layout tools/ai-team/src/core/config.ts → 4 níveis acima.
  const dir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(dir, '../../../..');
}

export const MONOREPO_ROOT = detectRoot();

let cached: AiTeamConfig | null = null;

export function loadConfig(): AiTeamConfig {
  if (cached) return cached;
  const cfgPath = path.join(MONOREPO_ROOT, '.ai-team.json');
  try {
    const raw = fs.readFileSync(cfgPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AiTeamConfig>;
    const version = typeof parsed.version === 'number' ? parsed.version : 1;
    if (version > CONFIG_VERSION) {
      console.error(
        `⚠️  .ai-team.json declara version=${version}, mas este CLI entende até ${CONFIG_VERSION}. ` +
          `Atualize o ai-team (tools/ai-team) ou campos novos serão ignorados.`,
      );
    }
    const auto = (parsed.autonomous ?? {}) as Partial<AutonomousConfig>;
    cached = {
      version,
      smoke: Array.isArray(parsed.smoke) && parsed.smoke.length > 0 ? parsed.smoke : DEFAULTS.smoke,
      branchPrefix: typeof parsed.branchPrefix === 'string' && parsed.branchPrefix ? parsed.branchPrefix : DEFAULTS.branchPrefix,
      syncBarrels: Array.isArray(parsed.syncBarrels) ? parsed.syncBarrels : DEFAULTS.syncBarrels,
      neutralZones: Array.isArray(parsed.neutralZones) ? parsed.neutralZones : DEFAULTS.neutralZones,
      autonomous: {
        maxWorkers: typeof auto.maxWorkers === 'number' && auto.maxWorkers > 0 ? auto.maxWorkers : AUTONOMOUS_DEFAULTS.maxWorkers,
        model: typeof auto.model === 'string' && auto.model ? auto.model : AUTONOMOUS_DEFAULTS.model,
        command: typeof auto.command === 'string' && auto.command ? auto.command : AUTONOMOUS_DEFAULTS.command,
        maxTurns: typeof auto.maxTurns === 'number' && auto.maxTurns > 0 ? auto.maxTurns : AUTONOMOUS_DEFAULTS.maxTurns,
        slotTimeoutMin: typeof auto.slotTimeoutMin === 'number' && auto.slotTimeoutMin > 0 ? auto.slotTimeoutMin : AUTONOMOUS_DEFAULTS.slotTimeoutMin,
        stallTimeoutMin: typeof auto.stallTimeoutMin === 'number' && auto.stallTimeoutMin > 0 ? auto.stallTimeoutMin : AUTONOMOUS_DEFAULTS.stallTimeoutMin,
        maxRetries: typeof auto.maxRetries === 'number' && auto.maxRetries >= 0 ? auto.maxRetries : AUTONOMOUS_DEFAULTS.maxRetries,
        allowNetwork: auto.allowNetwork === true,
        triage: auto.triage !== false,
      },
      gates: parseGates(parsed),
    };
  } catch {
    cached = { ...DEFAULTS };
  }
  return cached;
}
