// Geradores puros (Fase 3): o próximo B-id do BLINDAGENS, a entrada de blindagem em markdown,
// e uma TRAVA grep parametrizada (zero-dep, no estilo de check-duplicate-exports.mjs).
import type { ResearchRecord } from './learn-research.ts';

/** Próximo id de blindagem a partir do texto do BLINDAGENS.md (maior `## B<n>` + 1). */
export function nextBlindagemId(blindagensText: string): string {
  let max = 0;
  const re = /^##\s+B(\d+)\b/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(blindagensText)) !== null) {
    const n = parseInt(m[1]!, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `B${max + 1}`;
}

/** Entrada de blindagem (markdown) no formato do BLINDAGENS.md, a partir da pesquisa. */
export function renderBlindagemEntry(
  bId: string,
  assinatura: string,
  research: ResearchRecord,
): string {
  const fontes = research.fontes.length ? research.fontes.join(', ') : '(pesquisa sem fontes)';
  return (
    `## ${bId} - ${assinatura} (promovido pelo Loop de Aprendizado)\n\n` +
    `Falha (classe recorrente, pesquisada): ${research.resumo || '(sem resumo)'}\n\n` +
    `Blindagem:\n` +
    `- MECÂNICA/REGRA: ${research.guardaRecomendada || '(definir a trava)'}\n` +
    `- REVIEWER: conferir esta classe (\`${assinatura}\`) no review de contexto limpo.\n\n` +
    `Fontes: ${fontes}\n` +
    `Validado em: promovido do Loop de Aprendizado (recorrência >=2 + pesquisa).\n`
  );
}

/**
 * Trava grep parametrizada: reprova o build se o PADRÃO aparecer (fora da allowlist).
 * Valores interpolados (assinatura/message/pattern/pathFilter) entram via JSON.stringify —
 * seguro contra aspas/quebra de linha no .mjs gerado.
 */
export function renderGrepTrava(
  assinatura: string,
  pattern: string,
  pathFilter: string,
  message: string,
): string {
  const headerMsg = message.replace(/\s+/g, ' ').trim();
  return `#!/usr/bin/env node
// Trava gerada pelo Loop de Aprendizado para a classe de erro: ${assinatura}
// ${headerMsg}
// Reprova o build (exit 1) se o padrão aparecer. Allowlist: .travas-allow.txt (1 caminho/linha).
// Zero dependências.
import fs from 'node:fs';
import path from 'node:path';

const SIG = ${JSON.stringify(assinatura)};
const MESSAGE = ${JSON.stringify(message)};
const PATTERN = new RegExp(${JSON.stringify(pattern)});
const PATH_FILTER = ${JSON.stringify(pathFilter)}; // só arquivos cujo caminho relativo contém isto ('' = todos)
const IGNORE_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '.turbo', 'coverage', '.git', 'out', '.cache']);

function isCodeFile(f) {
  return /\\.(ts|tsx|mts|cts|js|jsx)$/.test(f) && !/\\.d\\.ts$/.test(f);
}
function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.isDirectory()) { if (!IGNORE_DIRS.has(e.name)) walk(path.join(dir, e.name), out); }
    else if (e.isFile() && isCodeFile(e.name)) out.push(path.join(dir, e.name));
  }
}
function loadAllowlist(root) {
  try {
    return new Set(
      fs.readFileSync(path.join(root, '.travas-allow.txt'), 'utf-8')
        .split('\\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')),
    );
  } catch { return new Set(); }
}

const cwd = process.cwd();
const allow = loadAllowlist(cwd);
const files = [];
walk(cwd, files);
const hits = [];
for (const file of files) {
  const rel = path.relative(cwd, file);
  if (PATH_FILTER && !rel.includes(PATH_FILTER)) continue;
  if (allow.has(rel)) continue;
  let text;
  try { text = fs.readFileSync(file, 'utf-8'); } catch { continue; }
  text.split('\\n').forEach((line, i) => { if (PATTERN.test(line)) hits.push(rel + ':' + (i + 1)); });
}
if (hits.length === 0) {
  console.log('travas: ok - ' + SIG + ' nao encontrado.');
  process.exit(0);
}
console.error('travas: REPROVADO - ' + SIG + ' (' + hits.length + ' ocorrencia(s)):');
for (const h of hits) console.error('  ' + h);
console.error('\\n' + MESSAGE);
console.error('Se a ocorrencia for legitima, liste o caminho em .travas-allow.txt.');
process.exit(1);
`;
}
