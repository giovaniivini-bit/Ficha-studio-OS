#!/usr/bin/env node
// TRAVA mecânica: campo formatado (telefone/CPF/CEP) NUNCA usa <Input> cru — tem que usar
// o input mascarado canônico (PhoneInput de @/components/ui). Falha o commit/gate se achar
// um <Input> ligado a um campo phone/telefone/cpf/cep. "Máscara não pode faltar" virou
// mecânico — não depende de o Dev (humano ou IA) lembrar. Mesma família do check-zoning.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Varre o filesystem (não `git ls-files`) — funciona COM ou SEM git (modo solo/sem-git).
const IGNORE = new Set(['node_modules', '.next', 'dist', 'build', '.git', 'coverage', '.turbo']);
function walkTsx(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc; // pasta inexistente (ex.: apps/web ainda não criado)
  }
  for (const e of entries) {
    if (IGNORE.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walkTsx(p, acc);
    else if (e.name.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

const files = walkTsx('apps/web');

const FIELD = '(phone|telefone|cpf|cep)';
const PATTERNS = [
  new RegExp(`register\\(\\s*['"\`]${FIELD}`, 'i'), // {...register('phone')}
  new RegExp(`\\b(id|name|htmlFor)\\s*=\\s*['"\`][^'"\`]*${FIELD}`, 'i'), // id="cf-phone"
  new RegExp(`\\bvalue\\s*=\\s*\\{\\s*${FIELD}\\b`, 'i'), // value={phone}
];

const offenders = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const tags = src.match(/<Input\b[^>]*>/g) ?? []; // cada tag de abertura de <Input>
  for (const tag of tags) {
    if (PATTERNS.some((re) => re.test(tag))) {
      offenders.push(`${f}: ${tag.replace(/\s+/g, ' ').trim().slice(0, 90)}`);
    }
  }
}

if (offenders.length > 0) {
  console.error('\n✖ TRAVA máscara — campo formatado usando <Input> cru (use PhoneInput de @/components/ui):');
  for (const o of offenders) console.error(`  ${o}`);
  console.error('  Máscara é obrigatória em telefone/CPF/CEP. Troque o <Input> pelo input mascarado.\n');
  process.exit(1);
}
console.log('ok check-masked-fields: telefone/CPF/CEP usam input mascarado');
