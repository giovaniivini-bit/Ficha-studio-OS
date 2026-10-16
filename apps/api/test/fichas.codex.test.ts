import { access, readFile, writeFile } from 'node:fs/promises';
import { emptyFicha, EXTRACTION_RULES, FICHA_JSON_SCHEMA } from '@app/shared';
import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { createCodexProvider, probeCodex, type CodexExecutor } from '../src/modules/fichas/codex-provider.ts';
import { ExtractionProviderError } from '../src/modules/fichas/provider.ts';
import { fichaRoutes } from '../src/modules/fichas/ficha.routes.ts';

const input = { mimeType: 'image/png' as const, base64: 'iVBORw0KGgo=' };
const output = { ficha: { ...emptyFicha(), reference: '01.14.01.3221', modeling: 'Top MC D.200', colors: [{ number: '02', name: 'Infinity Navy', pantone: '17-4015', code: 'MC 7064035' }], labelCode: 'CFC' }, warnings: [] };

describe('Codex CLI provider with fake executor only', () => {
  it('probes login and reports actual readiness without assuming a configured key', async () => {
    const executor = vi.fn<CodexExecutor>().mockResolvedValue({ code: 0, stdout: '', stderr: 'Logged in using ChatGPT' });
    expect(await probeCodex({ executor })).toBe(true);
    expect(executor.mock.calls[0]?.[1]).toContain('status');
    executor.mockResolvedValue({ code: 1, stdout: '', stderr: 'not logged in' });
    expect(await probeCodex({ executor })).toBe(false);
  });

  it('uses no shell, read-only sandbox and disabled tools; validates output and cleans isolated directory', async () => {
    let directory = '';
    const executor: CodexExecutor = async (_command, args, options) => {
      directory = options.cwd;
      expect(options.shell).toBe(false);
      expect(options.timeoutMs).toBeLessThanOrEqual(120_000);
      expect(args).toEqual(expect.arrayContaining(['exec', '--image', '--output-schema', '--sandbox', 'read-only', '--ephemeral', '--ignore-user-config', '--skip-git-repo-check', '--disable', 'shell_tool', 'unified_exec', 'plugins', 'multi_agent']));
      const image = args[args.indexOf('--image') + 1]!;
      expect(await readFile(image)).toEqual(Buffer.from(input.base64, 'base64'));
      const schema = JSON.parse(await readFile(args[args.indexOf('--output-schema') + 1]!, 'utf8'));
      expect(schema.properties.ficha.required).toHaveLength(Object.keys(emptyFicha()).length);
      expect(schema.properties.ficha).toEqual(FICHA_JSON_SCHEMA);
      expect(schema.properties.ficha.properties.colors.type).toBe('array');
      expect(schema.properties.ficha.properties.colors.items.required).toEqual(['number', 'name', 'pantone', 'code']);
      expect(args.at(-1)).toContain(EXTRACTION_RULES);
      expect(schema.properties.ficha.additionalProperties).toBe(false);
      await writeFile(args[args.indexOf('-o') + 1]!, JSON.stringify(output));
      return { code: 0, stdout: '', stderr: '' };
    };
    expect(await createCodexProvider({ executor }).extract(input)).toEqual(output);
    await expect(access(directory)).rejects.toThrow();
  });

  it('rejects invalid JSON output, contains supplier failures and releases its lock', async () => {
    const executor: CodexExecutor = async (_command, args) => {
      await writeFile(args[args.indexOf('-o') + 1]!, '{}');
      return { code: 0, stdout: '', stderr: '' };
    };
    await expect(createCodexProvider({ executor }).extract(input)).rejects.toMatchObject({ code: 'INVALID_PROVIDER_RESPONSE' });
    const failed = createCodexProvider({ executor: async () => ({ code: 1, stdout: '', stderr: 'secret internal failure' }) });
    await expect(failed.extract(input)).rejects.toMatchObject({ code: 'CODEX_FAILED' });
  });

  it('rejects concurrent extraction and preserves safe timeout errors', async () => {
    let release!: () => void;
    let started!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const provider = createCodexProvider({ executor: async () => {
      started(); await gate;
      throw new ExtractionProviderError('CODEX_TIMEOUT', 'Tempo esgotado.');
    } });
    const pending = provider.extract(input);
    const assertion = expect(pending).rejects.toMatchObject({ code: 'CODEX_TIMEOUT' });
    await ready;
    await expect(provider.extract(input)).rejects.toMatchObject({ code: 'CODEX_BUSY' });
    release(); await assertion;
  });

  it('exposes Codex config and returns 429 for busy provider', async () => {
    const app = Fastify();
    await app.register(fichaRoutes, { prefix: '/api', provider: { configured: false, provider: 'codex', isConfigured: async () => true, extract: async () => { throw new ExtractionProviderError('CODEX_BUSY', 'Aguarde.'); } } });
    try {
      expect((await app.inject('/api/fichas/config')).json()).toEqual({ provider: 'codex', configured: true });
      const result = await app.inject({ method: 'POST', url: '/api/fichas/extract', payload: { image: `data:image/png;base64,${input.base64}`, fileName: 'ficha.png' } });
      expect(result.statusCode).toBe(429);
      expect(result.json().error.code).toBe('CODEX_BUSY');
    } finally { await app.close(); }
  });

  it('rejects foreign origins, hostile hosts and remote clients before invoking Codex', async () => {
    const extract = vi.fn();
    const ready = vi.fn().mockResolvedValue(true);
    const app = Fastify();
    await app.register(fichaRoutes, { prefix: '/api', provider: { configured: true, provider: 'codex', isConfigured: ready, extract } });
    try {
      for (const overrides of [{ headers: { origin: 'https://evil.example' } }, { headers: { host: 'evil.example:3001' } }, { remoteAddress: '192.168.1.4' }]) {
        const response = await app.inject({ method: 'POST', url: '/api/fichas/extract', payload: { image: `data:image/png;base64,${input.base64}`, fileName: 'ficha.png' }, ...overrides });
        expect(response.statusCode).toBe(403);
        expect(response.json().error.code).toBe('LOCAL_ACCESS_ONLY');
      }
      expect(extract).not.toHaveBeenCalled();
      expect(ready).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });
});
