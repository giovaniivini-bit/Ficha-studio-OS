// Primitivo da fundação. Padrão: estende HTMLAttributes do elemento nativo —
// assim aceita className, style, onClick etc. sem fricção
// (lição projeto-origem / LEARNINGS 1.10: primitivo que não estende
// HTMLAttributes rejeita props básicas e força gambiarra nas telas).

import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost';
}

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-card px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50',
        variant === 'primary' && 'bg-primary text-primary-foreground hover:opacity-90',
        variant === 'ghost' && 'bg-transparent text-foreground hover:bg-muted',
        className,
      )}
      {...props}
    />
  );
}
