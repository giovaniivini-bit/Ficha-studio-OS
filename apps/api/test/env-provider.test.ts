import { describe, it, expect } from 'vitest';
import { loadEnv } from '../src/config/env.ts';
describe('Escolha de IA por ambiente', () => {
  it('usa Codex local no desenvolvimento sem chave Gemini', () => {
    expect(loadEnv({ NODE_ENV: 'development' }).EXTRACTION_PROVIDER).toBe('codex');
  });
  it('mantém Gemini na produção e com chave configurada', () => {
    expect(loadEnv({ NODE_ENV: 'production' }).EXTRACTION_PROVIDER).toBe('gemini');
    expect(loadEnv({ NODE_ENV: 'development', GEMINI_API_KEY: 'test-key' }).EXTRACTION_PROVIDER).toBe('gemini');
  });
  it('respeita a escolha explícita e mantém testes sem chamadas ao Codex real', () => {
    expect(loadEnv({ NODE_ENV: 'development', EXTRACTION_PROVIDER: 'gemini' }).EXTRACTION_PROVIDER).toBe('gemini');
    expect(loadEnv({ NODE_ENV: 'test' }).EXTRACTION_PROVIDER).toBe('gemini');
  });
});
