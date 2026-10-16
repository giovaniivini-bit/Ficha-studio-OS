// Componente PRESENTACIONAL local da rota (ADR 006): recebe tudo por props,
// zero hooks de dados. Componente local que outra rota também precisar usar?
// NÃO copie: registre em ARTIFACTS.md como "candidato à fundação" — o Integrador
// promove pra components/ui (zona neutra).

import type { HealthDto } from '@app/shared';
import { Card, Tag } from '@/components/ui';

interface HealthCardProps {
  loading: boolean;
  error: string | null;
  data: HealthDto | null;
}

export function HealthCard({ loading, error, data }: HealthCardProps) {
  return (
    <Card className="w-full">
      <div className="flex items-center justify-between">
        <span className="font-medium">API</span>
        {loading && <Tag tone="neutral">verificando…</Tag>}
        {error && <Tag tone="danger">offline</Tag>}
        {data && <Tag tone="success">online</Tag>}
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {data && (
        <dl className="mt-3 grid grid-cols-2 gap-1 text-sm text-muted-foreground">
          <dt>uptime</dt>
          <dd className="text-right">{data.uptimeSeconds}s</dd>
          <dt>versão</dt>
          <dd className="text-right">{data.version}</dd>
        </dl>
      )}
    </Card>
  );
}
