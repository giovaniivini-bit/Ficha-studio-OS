import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { emptyFicha, EXTRACTION_RULES } from '@app/shared';
import { fichaRoutes } from '../src/modules/fichas/ficha.routes.ts';
import { createGeminiProvider } from '../src/modules/fichas/gemini-provider.ts';
import { createAnthropicProvider, type ExtractionProvider } from '../src/modules/fichas/provider.ts';

const png = 'data:image/png;base64,iVBORw0KGgo=';
const payload = { image: png, fileName: 'ficha.png' };
const result = { ficha: { ...emptyFicha(), reference: '01.14.01.3221', modeling: 'Top MC D.200', colors: [{ number: '01', name: 'Skyway', pantone: '14-4112', code: 'MC 4060288' }], trim1: 'TAG BCI', print: 'Estampa.', embroidery: 'Bordado.', applique: 'Aplique.' }, warnings: ['Confira a composição.'] };

async function setup(provider: ExtractionProvider) {
  const app = Fastify();
  await app.register(fichaRoutes, { prefix: '/api', provider });
  return app;
}

describe('fichas API', () => {
  it('returns config without credential and raw validated extraction', async () => {
    const extract = vi.fn().mockResolvedValue(result);
    const app = await setup({ configured: true, extract });
    try {
      expect((await app.inject('/api/fichas/config')).json()).toEqual({ configured: true, provider: 'anthropic' });
      const response = await app.inject({ method: 'POST', url: '/api/fichas/extract', payload });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(result);
      expect(extract).toHaveBeenCalledWith({ mimeType: 'image/png', base64: 'iVBORw0KGgo=' });
    } finally { await app.close(); }
  });

  it('rejects invalid, mismatched, noncanonical and oversized images before the provider', async () => {
    const extract = vi.fn();
    const app = await setup({ configured: true, extract });
    try {
      for (const image of ['data:image/png;base64,aGVsbG8=', png.replace('png', 'jpeg'), 'data:image/png;base64,iVBORw0KGgo===', `data:image/png;base64,${Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64')}`]) {
        const response = await app.inject({ method: 'POST', url: '/api/fichas/extract', payload: { ...payload, image } });
        expect(response.statusCode).toBe(400);
        expect(response.json().error.code).toBe('INVALID_IMAGE');
      }
      expect(extract).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('returns 503 when unconfigured without executing extraction', async () => {
    const extract = vi.fn();
    const app = await setup({ configured: false, extract });
    try {
      const response = await app.inject({ method: 'POST', url: '/api/fichas/extract', payload });
      expect(response.statusCode).toBe(503);
      expect(extract).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('returns contract errors for malformed JSON and excessive body size', async () => {
    const extract = vi.fn();
    const app = await setup({ configured: true, extract });
    try {
      const malformed = await app.inject({ method: 'POST', url: '/api/fichas/extract', headers: { 'content-type': 'application/json' }, payload: '{' });
      expect(malformed.statusCode).toBe(400);
      expect(malformed.json().error.code).toBe('INVALID_REQUEST');
      const oversized = await app.inject({ method: 'POST', url: '/api/fichas/extract', payload: { image: 'a'.repeat(16 * 1024 * 1024), fileName: 'large.png' } });
      expect(oversized.statusCode).toBe(413);
      expect(oversized.json().error.code).toBe('IMAGE_TOO_LARGE');
      expect(extract).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('contains unexpected errors and validates provider output', async () => {
    const extract = vi.fn().mockRejectedValueOnce(new Error('secret-key-123')).mockResolvedValueOnce({ ficha: {} });
    const app = await setup({ configured: true, extract });
    try {
      const failure = await app.inject({ method: 'POST', url: '/api/fichas/extract', payload });
      expect(failure.statusCode).toBe(502);
      expect(failure.body).not.toContain('secret-key-123');
      const invalid = await app.inject({ method: 'POST', url: '/api/fichas/extract', payload });
      expect(invalid.json().error.code).toBe('INVALID_PROVIDER_RESPONSE');
    } finally { await app.close(); }
  });
});

describe('Anthropic adapter with fake fetch (no network)', () => {
  it('sends a server-only key and validates JSON response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(result) }] })));
    const provider = createAnthropicProvider({ apiKey: 'test-key', model: 'configured-model', fetcher });
    expect(await provider.extract({ mimeType: 'image/png', base64: 'iVBORw0KGgo=' })).toEqual(result);
    const init = fetcher.mock.calls[0]?.[1];
    expect(init?.headers).toHaveProperty('x-api-key', 'test-key');
    expect(JSON.parse(String(init?.body)).model).toBe('configured-model');
    expect(JSON.parse(String(init?.body)).system).toContain(EXTRACTION_RULES);
  });

  it('hides supplier errors and rejects incomplete JSON', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('private provider error', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: [{ type: 'text', text: '{}' }] })));
    const provider = createAnthropicProvider({ apiKey: 'test-key', model: 'model', fetcher });
    await expect(provider.extract({ mimeType: 'image/png', base64: '' })).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    await expect(provider.extract({ mimeType: 'image/png', base64: '' })).rejects.toMatchObject({ code: 'INVALID_PROVIDER_RESPONSE' });
  });
});

describe('Gemini Flash adapter with fake fetch (no network)', () => {
  it('extracts via local Antigravity server and cleans up cascade', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ cascadeId: 'cascade-1' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({})))
      .mockResolvedValueOnce(new Response(JSON.stringify({ steps: [{ plannerResponse: { response: JSON.stringify(result) } }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({})));
    const provider = createGeminiProvider({ fetcher, discoverServer: async () => ({ pid: 1, port: 55555, csrfToken: 'tok' }) });
    expect(await provider.isConfigured?.()).toBe(true);
    expect(await provider.extract({ mimeType: 'image/png', base64: 'iVBORw0KGgo=' })).toEqual(result);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('extracts via GEMINI_API_KEY when configured', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }] })));
    const provider = createGeminiProvider({ apiKey: 'gemini-key', model: 'gemini-2.5-flash', fetcher });
    expect(await provider.isConfigured?.()).toBe(true);
    expect(await provider.extract({ mimeType: 'image/png', base64: 'iVBORw0KGgo=' })).toEqual(result);
  });
});
