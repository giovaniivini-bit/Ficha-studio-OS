// Ponte de pesquisa (Fase 2): quando uma assinatura recorre, pesquisa a classe do erro em
// base pública e guarda o resultado canônico num store append-only (docs/learnings/research.jsonl),
// com dedup por assinatura. A pesquisa em si é um spawn de claude -p headless (como o triage),
// porém com REDE liberada (WebSearch/WebFetch no allow).
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { MONOREPO_ROOT, RUN_DIR } from './paths.ts';
import { loadConfig } from './config.ts';
import type { LearningRecord } from './learn-ledger.ts';

const execAsync = promisify(execFile);

export const RESEARCH_PATH = path.join(MONOREPO_ROOT, 'docs', 'learnings', 'research.jsonl');

export interface ResearchRecord {
  assinatura: string;
  data: string;
  fontes: string[];
  resumo: string;
  guardaRecomendada: string;
}

/** Parse defensivo: uma linha JSON por assinatura pesquisada; inválidas/vazias puladas. */
export function parseResearch(text: string): ResearchRecord[] {
  const out: ResearchRecord[] = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const r = JSON.parse(t) as ResearchRecord;
      if (r && typeof r.assinatura === 'string') out.push(r);
    } catch {
      /* linha corrompida — pula */
    }
  }
  return out;
}

/** Dedup: a assinatura já foi pesquisada? */
export function alreadyResearched(records: ResearchRecord[], assinatura: string): boolean {
  return records.some((r) => r.assinatura === assinatura);
}

/** Lê o store de pesquisa (vazio se ausente). */
export async function readResearch(researchPath: string): Promise<ResearchRecord[]> {
  try {
    return parseResearch(await fs.readFile(researchPath, 'utf-8'));
  } catch {
    return [];
  }
}

/** Anexa um resultado de pesquisa (cria o diretório se faltar). Append-only. */
export async function appendResearch(researchPath: string, rec: ResearchRecord): Promise<void> {
  await fs.mkdir(path.dirname(researchPath), { recursive: true });
  await fs.appendFile(researchPath, JSON.stringify(rec) + '\n', 'utf-8');
}

/** Prompt focado na CAUSA RAIZ (não no sintoma) pro pesquisador headless. */
export function buildResearchPrompt(assinatura: string, causaRaiz: string): string {
  return `Você é um pesquisador técnico. Pesquise em FONTES PÚBLICAS (web) a melhor prática
para PREVENIR esta classe de erro de software e como blindá-la mecanicamente.

Classe do erro (assinatura): ${assinatura}
Causa raiz observada: ${causaRaiz}

Use WebSearch/WebFetch. Priorize fontes confiáveis (docs oficiais, OWASP, papers, blogs de
referência). Ao final, responda EXATAMENTE neste formato, sem texto fora dos blocos:

FONTES:
- <url 1>
- <url 2>
RESUMO: <2-4 linhas: a prática canônica pra evitar esta classe>
GUARDA: <1-2 linhas: a trava/checagem mecânica recomendada pra reprovar este erro no build>`;
}

/** Parse defensivo da saída no formato FONTES/RESUMO/GUARDA (campo ausente => vazio). */
export function parseResearchOutput(stdout: string): {
  fontes: string[];
  resumo: string;
  guardaRecomendada: string;
} {
  // Order-independent: acha cada marcador onde estiver e fatia até o PRÓXIMO marcador na
  // ordem REAL do texto (não numa ordem assumida) — não corrompe se vier fora de ordem.
  const labels = { FONTES: 'FONTES:', RESUMO: 'RESUMO:', GUARDA: 'GUARDA:' } as const;
  const found = (Object.keys(labels) as Array<keyof typeof labels>)
    .map((key) => ({ key, label: labels[key], idx: stdout.indexOf(labels[key]) }))
    .filter((m) => m.idx !== -1)
    .sort((a, b) => a.idx - b.idx);
  const bodies: Record<string, string> = {};
  for (let i = 0; i < found.length; i++) {
    const cur = found[i]!;
    const start = cur.idx + cur.label.length;
    const end = i + 1 < found.length ? found[i + 1]!.idx : undefined;
    bodies[cur.key] = stdout.slice(start, end);
  }
  const fontes = (bodies['FONTES'] ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2).trim())
    .filter(Boolean);
  return {
    fontes,
    resumo: (bodies['RESUMO'] ?? '').trim(),
    guardaRecomendada: (bodies['GUARDA'] ?? '').trim(),
  };
}

/**
 * Seleciona assinaturas recorrentes (>=2 no ledger) ainda NÃO pesquisadas, ordenadas por
 * recorrência desc (desempate alfabético, determinístico), cortadas no budget. `deferred`
 * é o que sobrou — pra logar (nunca corte silencioso).
 */
export function selectForSweep(
  records: LearningRecord[],
  researched: ResearchRecord[],
  budget: number,
): { selected: string[]; deferred: string[] } {
  const counts = new Map<string, number>();
  for (const rec of records) counts.set(rec.assinatura, (counts.get(rec.assinatura) ?? 0) + 1);
  const candidates = [...counts.entries()]
    .filter(([sig, count]) => count >= 2 && !alreadyResearched(researched, sig))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([sig]) => sig);
  return { selected: candidates.slice(0, budget), deferred: candidates.slice(budget) };
}

/** Permissões do pesquisador headless: REDE liberada (ao contrário do triage), read-only. */
const RESEARCH_SETTINGS = {
  permissions: {
    allow: ['WebSearch', 'WebFetch', 'Read(**)', 'Bash(ls:*)', 'Bash(cat:*)'],
    deny: [
      'Edit(**)',
      'Write(**)',
      'Bash(git add:*)',
      'Bash(git commit:*)',
      'Bash(git push:*)',
      'Bash(git checkout:*)',
      'Bash(git switch:*)',
      'Bash(git merge:*)',
      'Bash(git rebase:*)',
      'Bash(git reset:*)',
      'Bash(rm -rf:*)',
      'Bash(curl:*)',
      'Bash(wget:*)',
    ],
  },
};

export interface ResearchOpts {
  assinatura: string;
  causaRaiz: string;
  researchPath: string;
  today: string;
  /** Binário do pesquisador (default config.autonomous.command='claude'); fake em teste. */
  command?: string | undefined;
  timeoutMs?: number | undefined;
}

/**
 * Pesquisa a assinatura (se ainda não foi). Spawna `claude -p` headless com rede liberada,
 * parseia FONTES/RESUMO/GUARDA e anexa em research.jsonl. Dedup duro: já pesquisada => no-op.
 */
export async function researchSignature(
  opts: ResearchOpts,
): Promise<{ deduped: boolean; record?: ResearchRecord }> {
  const researched = await readResearch(opts.researchPath);
  if (alreadyResearched(researched, opts.assinatura)) return { deduped: true };

  const command = opts.command ?? loadConfig().autonomous.command;
  await fs.mkdir(RUN_DIR, { recursive: true });
  const settingsPath = path.join(RUN_DIR, '_research.settings.json');
  await fs.writeFile(settingsPath, JSON.stringify(RESEARCH_SETTINGS, null, 2));

  const prompt = buildResearchPrompt(opts.assinatura, opts.causaRaiz);
  const { stdout } = await execAsync(
    command,
    ['-p', prompt, '--settings', settingsPath, '--max-turns', '30'],
    { cwd: MONOREPO_ROOT, timeout: opts.timeoutMs ?? 10 * 60_000, maxBuffer: 32 * 1024 * 1024 },
  );

  const parsed = parseResearchOutput(stdout);
  const record: ResearchRecord = {
    assinatura: opts.assinatura,
    data: opts.today,
    fontes: parsed.fontes,
    resumo: parsed.resumo,
    guardaRecomendada: parsed.guardaRecomendada,
  };
  await appendResearch(opts.researchPath, record);
  return { deduped: false, record };
}
