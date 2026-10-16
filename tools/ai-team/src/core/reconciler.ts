import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { MONOREPO_ROOT } from './paths.ts';
import { loadConfig } from './config.ts';
import {
  branchExists,
  currentBranch,
  deleteBranch,
  listWorktrees,
  mergeNoFf,
  runGit,
  worktreeRemove,
} from './git.ts';
import { scanSlots, statusLabel } from './slot-scanner.ts';
import { scanWorkerBranches } from './branch-scanner.ts';
import { checkZoning, parseLineList, type ZoningCheck } from './zoning.ts';
import type { Slot } from '../types.ts';

const exec = promisify(execFile);

export interface SlotZoningReport {
  slot: string;          // "M1/slot-x"
  branch: string;
  check: ZoningCheck;
  filesTouched: number;
}

export interface ReconcileResult {
  mergedSlots: Array<{ id: string; milestone: string }>;
  conflicts: { slot: string; output: string }[];
  zoning: SlotZoningReport[];
  barrelsSynced: string[];
  smokeOk: boolean;
  smokeOutput: string;
  reportPath: string | null;
}

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function workerFromOwner(owner: string | null): string | null {
  return owner?.trim() || null;
}

async function findDoneSlotsWithBranches(): Promise<Array<{ slot: Slot; branch: string }>> {
  // Estado autoritativo vive nas branches de worker, não na main.
  const branches = await scanWorkerBranches();
  const slots = await scanSlots();
  const slotByKey = new Map(slots.map((s) => [`${s.milestone}/${s.id}`, s]));
  const out: Array<{ slot: Slot; branch: string }> = [];
  for (const b of branches) {
    if (typeof b.status !== 'object' || b.status.kind !== 'done') continue;
    if (!(await branchExists(b.branch))) continue;
    const baseSlot = slotByKey.get(`${b.milestone}/${b.slotId}`);
    const slot: Slot = baseSlot
      ? { ...baseSlot, status: b.status, owner: b.owner ?? baseSlot.owner }
      : {
          id: b.slotId,
          milestone: b.milestone,
          path: '',
          status: b.status,
          owner: b.owner,
          hasBrief: false,
          hasContract: false,
          hasArtifacts: false,
          territory: [],
          dependsOn: [],
        };
    out.push({ slot, branch: b.branch });
  }
  return out;
}

/**
 * Valida zoning de uma branch ANTES do merge (PARALLEL-PROTOCOL §3):
 * diff main...branch vs TERRITORY.txt do slot + zonas neutras do .ai-team.json.
 * Não bloqueia o merge — vira warning destacado + entrada no RECONCILE-REPORT.md
 * pro review estrutural (skill review-before-merge) decidir.
 */
async function checkBranchZoning(
  branch: string,
  milestone: string,
  slotId: string,
): Promise<SlotZoningReport> {
  const { neutralZones } = loadConfig();
  const slotDirRel = `specs/slots/${milestone}/${slotId}`;

  let territory: string[] = [];
  try {
    const { stdout } = await runGit(['show', `${branch}:${slotDirRel}/TERRITORY.txt`]);
    territory = parseLineList(stdout);
  } catch {
    /* slot sem território declarado — check reporta hasTerritory=false */
  }

  let files: string[] = [];
  try {
    const { stdout } = await runGit(['diff', '--name-only', `main...${branch}`]);
    files = stdout.trim().split('\n').filter(Boolean);
  } catch {
    /* diff falhou — segue com lista vazia */
  }

  return {
    slot: `${milestone}/${slotId}`,
    branch,
    check: checkZoning({ files, territory, neutralZones, slotDirRel }),
    filesTouched: files.length,
  };
}

/** Auto-resolve conflito conhecido: STATUS.txt — sempre prefere `done`. */
async function autoResolveStatusConflict(): Promise<boolean> {
  try {
    const { stdout } = await runGit(['diff', '--name-only', '--diff-filter=U']);
    const files = stdout.trim().split('\n').filter(Boolean);
    let resolved = 0;
    for (const f of files) {
      if (!f.endsWith('STATUS.txt')) continue;
      const abs = path.join(MONOREPO_ROOT, f);
      const content = await fs.readFile(abs, 'utf-8');
      // pega o lado "incoming" (>>>>>>>) — worker é a fonte da verdade
      const m = content.match(/=======\n([\s\S]*?)\n>>>>>>>/);
      if (m && m[1]) {
        await fs.writeFile(abs, m[1].trim() + '\n');
        await runGit(['add', f]);
        resolved++;
      }
    }
    return resolved > 0;
  } catch {
    return false;
  }
}

/**
 * Sincroniza barrels (index.ts) configurados em `.ai-team.json` → syncBarrels.
 * Pra cada barrel, adiciona `import './<arquivo>';` dos .ts irmãos que faltarem.
 * Opt-in: sem config, não faz nada.
 */
async function syncBarrels(): Promise<string[]> {
  const synced: string[] = [];
  const { syncBarrels: barrels } = loadConfig();
  for (const rel of barrels) {
    const indexPath = path.join(MONOREPO_ROOT, rel);
    let content: string;
    try {
      content = await fs.readFile(indexPath, 'utf-8');
    } catch {
      continue;
    }
    const libDir = path.dirname(indexPath);
    const files = (await fs.readdir(libDir)).filter(
      (f) => f.endsWith('.ts') && !f.endsWith('.test-smoke.ts') && f !== 'index.ts',
    );
    let changed = false;
    for (const f of files) {
      const line = `import './${f}';`;
      if (!content.includes(line)) {
        content = content.trimEnd() + '\n' + line + '\n';
        changed = true;
      }
    }
    if (changed) {
      await fs.writeFile(indexPath, content);
      await runGit(['add', rel]);
      synced.push(rel);
      console.log(`${C.green}✓${C.reset} barrel ${rel} sincronizado (${files.length} imports)`);
    }
  }
  return synced;
}

/** Relatório de reconcile (markdown) — evidência pro review estrutural + HTC. */
function buildReport(result: ReconcileResult): string {
  const lines: string[] = [];
  lines.push('# Reconcile Report');
  lines.push('');
  lines.push(`> Gerado por \`ai-team reconcile\` em ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Slots integrados');
  lines.push('');
  if (result.mergedSlots.length === 0) {
    lines.push('_nenhum_');
  } else {
    for (const s of result.mergedSlots) lines.push(`- ✅ ${s.milestone}/${s.id}`);
  }
  if (result.conflicts.length > 0) {
    lines.push('');
    lines.push('## Conflitos (merge abortado — resolver manualmente)');
    lines.push('');
    for (const c of result.conflicts) lines.push(`- ✗ ${c.slot}`);
  }
  lines.push('');
  lines.push('## Zoning');
  lines.push('');
  for (const z of result.zoning) {
    const v = z.check.violations;
    if (!z.check.hasTerritory) {
      lines.push(`- ⚠️ ${z.slot}: sem TERRITORY.txt — zoning não verificável (${z.filesTouched} arquivos tocados)`);
    } else if (v.length === 0) {
      lines.push(`- ✅ ${z.slot}: ${z.filesTouched} arquivos, todos no território`);
    } else {
      lines.push(`- 🚨 ${z.slot}: ${v.length} violação(ões) — REVISAR no review estrutural:`);
      for (const viol of v) {
        lines.push(`  - \`${viol.file}\` → ${viol.kind === 'neutral-zone' ? 'ZONA NEUTRA' : 'fora do território'}`);
      }
    }
  }
  lines.push('');
  lines.push('## Barrels sincronizados');
  lines.push('');
  lines.push(result.barrelsSynced.length === 0 ? '_nenhum_' : result.barrelsSynced.map((b) => `- ${b}`).join('\n'));
  lines.push('');
  lines.push('## Smoke');
  lines.push('');
  lines.push(result.smokeOk ? '✅ verde' : '❌ FALHOU');
  if (!result.smokeOk) {
    lines.push('');
    lines.push('```');
    lines.push(result.smokeOutput.slice(-2000));
    lines.push('```');
  }
  lines.push('');
  lines.push('## Próximos passos do Integrador');
  lines.push('');
  lines.push('1. Review estrutural (skill `review-before-merge`) — Tier 1: fidelidade à DESIGN-SPEC.');
  lines.push('2. Ler ARTIFACTS.md dos slots: pendências + candidatos à fundação.');
  lines.push('3. HTC: subir o app e a pessoa testar/aprovar antes de fechar o milestone.');
  lines.push('');
  return lines.join('\n');
}

async function runSmoke(): Promise<{ ok: boolean; output: string }> {
  const { smoke } = loadConfig();
  const [cmd, ...args] = smoke;
  if (!cmd) return { ok: true, output: '(smoke vazio — pulado)' };
  try {
    const { stdout, stderr } = await exec(cmd, args, {
      cwd: MONOREPO_ROOT,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { ok: true, output: stdout + stderr };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, output: `${e.stdout ?? ''}\n${e.stderr ?? ''}\n${e.message ?? ''}` };
  }
}

export interface ReconcileOptions {
  cleanup?: boolean;  // remover worktrees + branches mergeadas (default true)
  dryRun?: boolean;
}

export async function reconcile(opts: ReconcileOptions = {}): Promise<ReconcileResult> {
  const { cleanup = true, dryRun = false } = opts;
  const result: ReconcileResult = {
    mergedSlots: [],
    conflicts: [],
    zoning: [],
    barrelsSynced: [],
    smokeOk: false,
    smokeOutput: '',
    reportPath: null,
  };

  async function persistReport(): Promise<void> {
    const rel = path.join('specs', 'RECONCILE-REPORT.md');
    const abs = path.join(MONOREPO_ROOT, rel);
    await fs.writeFile(abs, buildReport(result));
    result.reportPath = abs;
    try {
      await runGit(['add', rel]);
      await runGit(['diff', '--cached', '--quiet']);
    } catch {
      try {
        await runGit(['commit', '-m', 'reconcile: report']);
      } catch {
        /* nada staged ou commit falhou — relatório fica no working tree */
      }
    }
    console.log(`${C.dim}relatório: ${rel}${C.reset}`);
  }

  const cur = await currentBranch();
  if (cur !== 'main') {
    throw new Error(`Reconciler exige estar na main; está em '${cur}'.`);
  }

  const candidates = await findDoneSlotsWithBranches();
  if (candidates.length === 0) {
    console.log(`${C.dim}nenhum slot 'done' com branch — nada a reconciliar.${C.reset}`);
    return result;
  }

  console.log(`${C.dim}Reconciliando ${candidates.length} slot(s) 'done':${C.reset}`);
  for (const { slot, branch } of candidates) {
    console.log(`  ${branch} (${statusLabel(slot)} / owner=${slot.owner ?? '—'})`);
  }
  console.log();

  // Zoning (PARALLEL-PROTOCOL §3): valida cada branch ANTES do merge.
  for (const { slot, branch } of candidates) {
    const report = await checkBranchZoning(branch, slot.milestone, slot.id);
    result.zoning.push(report);
    if (!report.check.hasTerritory) {
      console.log(`${C.yellow}⚠ ${report.slot}: sem TERRITORY.txt — zoning não verificável${C.reset}`);
    } else if (report.check.violations.length > 0) {
      console.log(`${C.red}🚨 ${report.slot}: zoning violado:${C.reset}`);
      for (const v of report.check.violations) {
        console.log(
          `   ${v.file} ${C.red}→ ${v.kind === 'neutral-zone' ? 'ZONA NEUTRA' : 'fora do território'}${C.reset}`,
        );
      }
      console.log(`${C.dim}   (merge segue; revisar no review estrutural antes de fechar o milestone)${C.reset}`);
    }
  }
  console.log();

  if (dryRun) {
    console.log(`${C.yellow}dry-run: parando aqui.${C.reset}`);
    return result;
  }

  for (const { slot, branch } of candidates) {
    const owner = workerFromOwner(slot.owner) ?? 'unknown';
    const msg = `reconcile: merge ${slot.id} (${owner})`;
    process.stdout.write(`merge ${branch}... `);
    const r = await mergeNoFf(branch, msg);
    if (r.ok) {
      console.log(`${C.green}✓${C.reset}`);
      result.mergedSlots.push({ id: slot.id, milestone: slot.milestone });
      continue;
    }
    const resolved = await autoResolveStatusConflict();
    if (resolved) {
      try {
        await runGit(['commit', '-m', msg]);
        console.log(`${C.green}✓ (status conflict auto-resolved)${C.reset}`);
        result.mergedSlots.push({ id: slot.id, milestone: slot.milestone });
        continue;
      } catch {
        /* fallthrough */
      }
    }
    console.log(`${C.red}✗ conflito${C.reset}`);
    result.conflicts.push({ slot: slot.id, output: r.output });
    try {
      await runGit(['merge', '--abort']);
    } catch {
      /* ignore */
    }
  }

  if (result.mergedSlots.length > 0) {
    result.barrelsSynced = await syncBarrels();
    try {
      await runGit(['diff', '--cached', '--quiet']);
    } catch {
      await runGit(['commit', '-m', `reconcile: sync barrels (+${result.mergedSlots.length})`]);
    }
  }

  console.log(`\n${C.dim}smoke...${C.reset}`);
  const smoke = await runSmoke();
  result.smokeOk = smoke.ok;
  result.smokeOutput = smoke.output;
  if (smoke.ok) {
    console.log(`${C.green}✓ smoke ok${C.reset}`);
  } else {
    console.log(`${C.red}✗ smoke falhou — abrindo gap pra correção${C.reset}`);
    console.log(smoke.output.slice(-1000));
    await persistReport();
    return result;
  }

  if (cleanup) {
    console.log();
    const wts = await listWorktrees();
    const { branchPrefix } = loadConfig();
    for (const { id, milestone } of result.mergedSlots) {
      const branch = `${branchPrefix}/${milestone}/${id}`;
      const wt = wts.find((w) => w.branch === branch);
      if (wt) {
        try {
          await worktreeRemove(wt.name);
          console.log(`${C.dim}rm worktree ${wt.name}${C.reset}`);
        } catch (e) {
          console.log(`${C.yellow}aviso: worktree ${wt.name} não removido: ${(e as Error).message}${C.reset}`);
        }
      }
      try {
        await deleteBranch(branch);
        console.log(`${C.dim}rm branch ${branch}${C.reset}`);
      } catch (e) {
        console.log(`${C.yellow}aviso: branch ${branch} não removida: ${(e as Error).message}${C.reset}`);
      }
    }
  }

  await persistReport();
  return result;
}
