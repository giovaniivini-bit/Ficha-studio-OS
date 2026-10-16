'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ExtractionResultSchema } from '@app/shared';
import { z } from 'zod';

const base = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
export const FichaConfigSchema = z.object({ configured: z.boolean(), provider: z.enum(['gemini', 'codex', 'anthropic']) });
async function request(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try { response = await fetch(`${base}/api/fichas${path}`, { ...init, signal: AbortSignal.timeout(150_000) }); }
  catch (error) { if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw new Error('A extração ultrapassou o tempo limite. Tente novamente.'); throw new Error('Servidor de extração indisponível. Inicie a API e tente novamente.'); }
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ error: z.object({ message: z.string() }) }).safeParse(data);
    throw new Error(error.success ? error.data.error.message : 'Não foi possível acessar a API de extração.');
  }
  return data;
}
export function useFichaConfig() {
  return useQuery({ queryKey: ['fichas', 'config'], queryFn: async () => FichaConfigSchema.parse(await request('/config')), retry: false, refetchInterval: 15_000, refetchOnWindowFocus: true });
}
export function useExtractFicha() {
  return useMutation({ mutationFn: async (body: { image: string; fileName: string }) => ExtractionResultSchema.parse(await request('/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })) });
}
