import { describe, expect, it, vi } from 'vitest';
import { FIELD_GROUPS } from '@app/shared';
import { createGeminiProvider } from '../src/modules/fichas/gemini-provider.ts';

describe('Gemini API contract', () => {
  it('sends the strict JSON Schema through responseJsonSchema, not responseSchema', async () => {
    const ficha = { ...Object.fromEntries(FIELD_GROUPS.flatMap(g => g.fields.map(([key]) => [key, '']))), colors: [] };
    const fetcher = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.generationConfig.responseSchema).toBeUndefined();
      expect(body.generationConfig.responseJsonSchema.type).toBe('object');
      expect(body.generationConfig.responseJsonSchema.properties.ficha.additionalProperties).toBe(false);
      expect(body.generationConfig.responseJsonSchema.properties.ficha.properties.colors.items.additionalProperties).toBe(false);
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ ficha, warnings: [] }) }] } }] }));
    }) as unknown as typeof fetch;
    const result = await createGeminiProvider({ apiKey: 'test-key', model: 'gemini-2.5-flash', fetcher }).extract({ mimeType: 'image/png', base64: 'AA==' });
    expect(result.ficha.colors).toEqual([]);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('reports rejected requests without exposing the provider body or credentials', async () => {
    const fetcher = vi.fn(async () => new Response('secret-key and private provider details', { status: 400 })) as unknown as typeof fetch;
    await expect(createGeminiProvider({ apiKey: 'secret-key', fetcher }).extract({ mimeType: 'image/png', base64: 'AA==' }))
      .rejects.toThrow('formato da solicitação');
  });
});
