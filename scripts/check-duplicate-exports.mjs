#!/usr/bin/env node
// Trava anti-duplicacao de TIPO TRANSVERSAL (o caso WorkspaceRef): encontra o MESMO
// simbolo exportado (interface/type/class/enum) definido em 2+ arquivos. Os detectores
// de copy-paste (jscpd) erram esse caso - tipo pequeno e' menor que o min-tokens deles.
//
// Tripwire com allowlist: nem todo nome repetido e' bug (ex.: um Row do banco e um DTO
// podem coincidir de nome). Liste os pares legitimos em .travas-allow.txt (1 nome/linha)
// e o resto reprova o build.
//
// Uso:   node check-duplicate-exports.mjs [dir...]      (default: cwd)
// Saida: lista os duplicados nao-allowlistados; exit 1 se houver algum, 0 senao.
// Zero dependencias.

import fs from 'node:fs';
import path from 'node:path';

const IGNORE_DIRS = new Set([
  'node_modules', '.next', 'dist', 'build', '.turbo', 'coverage', '.git', 'out', '.cache',
]);
// ESCOPO: so TIPO NOMEADO exportado (interface/type/class/enum com nome) - o caso de
// duplicacao de conceito transversal. NAO cobre default-export nem god-class (sao outras
// travas: ESLint complexity/max-lines); funcao/const ficam de fora por serem ruidosos.
const EXPORT_RE = /^\s*export\s+(?:declare\s+)?(?:abstract\s+)?(interface|type|class|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/;

function isCodeFile(f) {
  return /\.(ts|tsx|mts|cts)$/.test(f) && !/\.d\.ts$/.test(f);
}

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!IGNORE_DIRS.has(e.name)) walk(path.join(dir, e.name), out);
    } else if (e.isFile() && isCodeFile(e.name)) {
      out.push(path.join(dir, e.name));
    }
  }
}

function loadAllowlist(root) {
  const p = path.join(root, '.travas-allow.txt');
  try {
    return new Set(
      fs.readFileSync(p, 'utf-8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#')),
    );
  } catch {
    return new Set();
  }
}

const targets = process.argv.slice(2);
const roots = targets.length ? targets : ['.'];
const cwd = process.cwd();
const allow = loadAllowlist(cwd);

const files = [];
for (const r of roots) walk(path.resolve(cwd, r), files);

// nome -> Set de arquivos (relativos) que o definem
const defs = new Map();
for (const file of files) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf-8');
  } catch {
    continue;
  }
  const rel = path.relative(cwd, file);
  for (const line of text.split('\n')) {
    const m = EXPORT_RE.exec(line);
    if (m) {
      const name = m[2];
      if (!defs.has(name)) defs.set(name, new Set());
      defs.get(name).add(rel);
    }
  }
}

const dups = [];
for (const [name, fileSet] of defs) {
  if (fileSet.size > 1 && !allow.has(name)) {
    dups.push({ name, files: [...fileSet].sort() });
  }
}
dups.sort((a, b) => b.files.length - a.files.length || a.name.localeCompare(b.name));

if (dups.length === 0) {
  console.log('travas: ok - nenhum tipo exportado duplicado em 2+ arquivos (fora a allowlist).');
  process.exit(0);
}

console.error(`travas: REPROVADO - ${dups.length} tipo(s) exportado(s) definido(s) em 2+ arquivos:\n`);
for (const d of dups) {
  console.error(`  [DUP] ${d.name}  (${d.files.length} arquivos)`);
  for (const f of d.files) console.error(`        ${f}`);
}
console.error(
  `\nConserto: mova o tipo transversal pra UM lugar compartilhado (ex.: packages/shared ou auth/) e importe de la.\n` +
    `Se a coincidencia for legitima (ex.: Row do banco vs DTO de mesmo nome), liste o nome em .travas-allow.txt.`,
);
process.exit(1);
