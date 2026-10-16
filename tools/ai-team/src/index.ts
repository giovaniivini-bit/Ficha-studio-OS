#!/usr/bin/env node
import { plan } from './cli/plan.ts';
import { start } from './cli/start.ts';
import { status } from './cli/status.ts';
import { reconcile } from './cli/reconcile.ts';
import { auto } from './cli/auto.ts';
import { run } from './cli/run.ts';
import { verifyContractCmd } from './cli/verify-contract.ts';
import { reviewCmd } from './cli/review.ts';
import { learn } from './cli/learn.ts';
import { handoffCmd } from './cli/handoff.ts';

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq !== -1) {
      out[a.slice(2, eq)] = a.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[a.slice(2)] = next;
        i++;
      } else {
        out[a.slice(2)] = true;
      }
    }
  }
  return out;
}

function getStr(args: Record<string, string | boolean>, k: string): string | undefined {
  const v = args[k];
  return typeof v === 'string' ? v : undefined;
}

function help(): never {
  console.log(`ai-team — Architect CLI (desenvolvimento multi-agente local)

  ai-team plan [--milestone=M1]
      Lista slots available.

  ai-team start --slot=<id> --worker=<name> [--milestone=M1] [--force] [--spawn]
      Cria worktree em .worktrees/<worker>/, faz claim do slot, imprime prompt
      pra colar no Claude. Com --spawn: sobe um claude -p headless (autônomo).

  ai-team run [--milestone=M1] [--workers=2] [--poll-seconds=15] [--dry-run] [--plain] [--skip-contract-gate]
      MODO AUTÔNOMO: despacha workers headless por slot (waves via DEPENDS-ON),
      vigia (watchdog: morto/estagnado/timeout → retry), reconcilia quando done,
      faz triage de blocked com Arquiteto one-shot, e re-despacha — até o
      milestone fechar. Dashboard live; Ctrl+C pra parar (estado fica no git).

  ai-team status [--milestone=M1]
      Dashboard ASCII (slots por status + worktrees ativas).

  ai-team verify-contract [--milestone=M1]
      GATE 1: valida os contratos da wave 0 (sem z.any, territorios disjuntos,
      waves resolvidas, manifesto de componentizacao presente) ANTES do fan-out.
      Exit 1 se houver achado critical.

  ai-team review [--milestone=M1]
      GATE 2: revisa (read-only, contexto limpo) os slots 'done' contra a DESIGN-SPEC e
      o contrato de estrutura/componentizacao. Escreve REVIEW.md nos reprovados. Exit 1
      se algum reprovar.

  ai-team reconcile [--cleanup=false] [--dry-run]
      Merge branches de worker 'done' na main, valida zoning, sincroniza barrels,
      roda smoke, grava specs/RECONCILE-REPORT.md, remove worktrees + branches.

  ai-team auto [--milestone=M1] [--poll-seconds=15]
      Monitor passivo (legado): dashboard + reconcile automático quando slots
      'done' aparecem. Não cria workers — pro despacho autônomo use 'run'.

  ai-team learn capture --assinatura=<slug> --gatilho=<bug|HTC|smoke|blocked|reconcile|zoning|spec-ambiguity> --sintoma="..." --causa="..." --fix="..." [--camada=back] [--retry]
      LOOP DE APRENDIZADO: registra um erro corrigido no ledger (docs/learnings/ledger.jsonl),
      conta recorrência por assinatura e decide enforce DURO (recorrência>=2 ou --retry) vs propor.

  ai-team learn research --assinatura=<slug> --causa="<causa raiz>"
      Pesquisa a CLASSE do erro em base pública (claude -p headless, rede liberada) e guarda
      fontes + guarda recomendada em docs/learnings/research.jsonl (dedup por assinatura).

  ai-team learn sweep [--budget=5]
      Varre o ledger, pega as assinaturas recorrentes (>=2) ainda não pesquisadas (top-N pelo
      budget) e pesquisa em lote. Loga as adiadas (sem corte silencioso).

  ai-team learn promote
      Lista as assinaturas prontas pra virar blindagem GLOBAL (recorrente + pesquisada +
      não-promovida) e escreve docs/learnings/PROMOTION.md. Promover é human-gated: /promover-blindagem.

  ai-team learn gen-trava --assinatura=<slug> --pattern="<regex>" [--path="routes.ts"] [--message="..."]
      Gera uma trava grep zero-dep em scripts/check-<slug>.mjs (reprova o build se o padrão
      aparecer) — deixa ESTE projeto imune. Marca a assinatura como promovida.

  ai-team handoff [--milestone=M1]
      Snapshot read-only do estado do time (slots/worktrees/escalações) — usado pelo
      handoff de pausa (skill /a360:handoff) pra montar docs/HANDOFF.md.
`);
  process.exit(0);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  switch (cmd) {
    case 'plan':
      return plan(getStr(args, 'milestone'));
    case 'start': {
      const slot = getStr(args, 'slot');
      const worker = getStr(args, 'worker');
      if (!slot || !worker) {
        console.error('uso: ai-team start --slot=<id> --worker=<name> [--milestone=M1]');
        process.exit(2);
      }
      const ms = getStr(args, 'milestone');
      return start({
        slot,
        worker,
        ...(ms ? { milestone: ms } : {}),
        force: args.force === true,
        spawn: args.spawn === true,
      });
    }
    case 'run': {
      const ms = getStr(args, 'milestone');
      const w = getStr(args, 'workers');
      const ps = getStr(args, 'poll-seconds');
      return run({
        ...(ms ? { milestone: ms } : {}),
        ...(w ? { workers: parseInt(w, 10) } : {}),
        ...(ps ? { pollSeconds: parseInt(ps, 10) } : {}),
        dryRun: args['dry-run'] === true,
        plain: args.plain === true,
        skipContractGate: args['skip-contract-gate'] === true,
      });
    }
    case 'verify-contract':
      return verifyContractCmd(getStr(args, 'milestone'));
    case 'review':
      return reviewCmd(getStr(args, 'milestone'));
    case 'status':
      return status(getStr(args, 'milestone'));
    case 'reconcile':
      return reconcile({
        cleanup: args.cleanup !== 'false',
        dryRun: args['dry-run'] === true,
      });
    case 'auto': {
      const ms = getStr(args, 'milestone');
      const ps = getStr(args, 'poll-seconds');
      return auto({
        ...(ms ? { milestone: ms } : {}),
        ...(ps ? { pollSeconds: parseInt(ps, 10) } : {}),
      });
    }
    case 'learn': {
      const sub = rest[0] && !rest[0].startsWith('--') ? rest[0] : undefined;
      return learn(sub, {
        assinatura: getStr(args, 'assinatura'),
        gatilho: getStr(args, 'gatilho'),
        camada: getStr(args, 'camada'),
        sintoma: getStr(args, 'sintoma'),
        causa: getStr(args, 'causa'),
        fix: getStr(args, 'fix'),
        retry: args.retry === true,
        ...(getStr(args, 'budget') ? { budget: parseInt(getStr(args, 'budget')!, 10) } : {}),
        ...(getStr(args, 'pattern') ? { pattern: getStr(args, 'pattern') } : {}),
        ...(getStr(args, 'path') ? { path: getStr(args, 'path') } : {}),
        ...(getStr(args, 'message') ? { message: getStr(args, 'message') } : {}),
        ...(getStr(args, 'bid') ? { bid: getStr(args, 'bid') } : {}),
      });
    }
    case 'handoff':
      return handoffCmd(getStr(args, 'milestone'));
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      help();
    default:
      console.error(`comando desconhecido: ${cmd}`);
      help();
  }
}

main().catch((err) => {
  console.error('erro fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
