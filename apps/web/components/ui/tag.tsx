// Tag/badge da fundação. Tons semânticos vêm dos design tokens (globals.css).
// Precisa de um tom que não existe aqui? Implemente LOCAL na tela com var(--token)
// e registre como candidato à fundação no ARTIFACTS.md (lição os-v2 / LEARNINGS 1.9).

import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}

export function Tag({ tone = 'neutral', className, ...props }: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tone === 'neutral' && 'bg-muted text-muted-foreground',
        tone === 'success' && 'bg-success/15 text-success',
        tone === 'warning' && 'bg-warning/15 text-warning',
        tone === 'danger' && 'bg-danger/15 text-danger',
        className,
      )}
      {...props}
    />
  );
}
