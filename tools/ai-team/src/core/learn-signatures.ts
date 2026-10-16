// Registry legível de assinaturas de erro (docs/learnings/signatures.md). Cada assinatura é
// uma linha `- `<slug>` — <descrição>`. O controlador conta recorrência por assinatura.
import fs from 'node:fs/promises';
import path from 'node:path';
import { MONOREPO_ROOT } from './paths.ts';

export const SIGNATURES_PATH = path.join(MONOREPO_ROOT, 'docs', 'learnings', 'signatures.md');

const HEADER = `# Assinaturas de erro — registry do Loop de Aprendizado

> Cada linha é a CLASSE de um erro (não a instância). O controlador conta recorrência por
> assinatura. Alinhe com os IDs do BLINDAGENS.md do plugin quando virar blindagem global.

`;

export interface Signature {
  slug: string;
  desc: string;
}

const LINE_RE = /^-\s+`([a-z0-9-]+)`\s+—\s+(.*)$/;

/** Extrai assinaturas das linhas no formato `- `slug` — desc`. */
export function parseSignatures(text: string): Signature[] {
  const out: Signature[] = [];
  for (const line of text.split('\n')) {
    const m = LINE_RE.exec(line.trim());
    if (m) out.push({ slug: m[1]!, desc: m[2]!.trim() });
  }
  return out;
}

export function hasSignature(sigs: Signature[], slug: string): boolean {
  return sigs.some((s) => s.slug === slug);
}

export function renderSignatureLine(slug: string, desc: string): string {
  return `- \`${slug}\` — ${desc}`;
}

/** Lê o registry (vazio se ausente). */
export async function readSignatures(sigPath: string): Promise<Signature[]> {
  try {
    return parseSignatures(await fs.readFile(sigPath, 'utf-8'));
  } catch {
    return [];
  }
}

/**
 * Adiciona a assinatura se ainda não existe. true = adicionou (nova); false = já existia.
 * Cria o arquivo com header se faltar.
 */
export async function addSignature(sigPath: string, slug: string, desc: string): Promise<boolean> {
  const sigs = await readSignatures(sigPath);
  if (hasSignature(sigs, slug)) return false;
  let base: string;
  try {
    base = await fs.readFile(sigPath, 'utf-8');
  } catch {
    base = HEADER;
  }
  await fs.mkdir(path.dirname(sigPath), { recursive: true });
  const sep = base.endsWith('\n') ? '' : '\n';
  await fs.writeFile(sigPath, base + sep + renderSignatureLine(slug, desc) + '\n', 'utf-8');
  return true;
}
