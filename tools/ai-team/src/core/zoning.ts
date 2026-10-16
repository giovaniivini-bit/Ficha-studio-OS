// Zoning (PARALLEL-PROTOCOL §3) — matching de globs sem dependências.
// Usado pelo reconciler (validação pós-merge) e espelhado no
// templates/monorepo/scripts/check-zoning.mjs (pre-commit do Dev).

export function globToRegExp(glob: string): RegExp {
  // Suporta ** (qualquer profundidade) e * (um segmento).
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, ' ')
    .replace(/\*/g, '[^/]*')
    .replace(/ /g, '.*');
  return new RegExp(`^${escaped}$`);
}

export function matchesAny(file: string, globs: string[]): boolean {
  return globs.some((g) => globToRegExp(g).test(file));
}

/** Parse de TERRITORY.txt / DEPENDS-ON.txt: 1 entrada por linha, # comenta. */
export function parseLineList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
}

export interface ZoningViolation {
  file: string;
  kind: 'neutral-zone' | 'outside-territory';
}

export interface ZoningCheck {
  /** Slot declarou território? Sem TERRITORY.txt o zoning não é verificável. */
  hasTerritory: boolean;
  violations: ZoningViolation[];
}

/**
 * Valida os arquivos tocados por um slot contra o território declarado + zonas neutras.
 * Arquivos dentro da própria pasta do slot (STATUS/ARTIFACTS/etc.) são sempre permitidos.
 */
export function checkZoning(opts: {
  files: string[];
  territory: string[];
  neutralZones: string[];
  slotDirRel: string; // ex: "specs/slots/M1/slot-x"
}): ZoningCheck {
  const violations: ZoningViolation[] = [];
  for (const file of opts.files) {
    if (file.startsWith(`${opts.slotDirRel}/`)) continue;
    if (matchesAny(file, opts.neutralZones)) {
      violations.push({ file, kind: 'neutral-zone' });
      continue;
    }
    if (opts.territory.length > 0 && !matchesAny(file, opts.territory)) {
      violations.push({ file, kind: 'outside-territory' });
    }
  }
  return { hasTerritory: opts.territory.length > 0, violations };
}
