// Junta classes condicionalmente. Quando o projeto adotar shadcn/ui, troque por
// clsx + tailwind-merge (o contrato é o mesmo).

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
