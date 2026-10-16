import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('rounded-card border border-border bg-background p-4 shadow-sm', className)}
      {...props}
    />
  );
}
