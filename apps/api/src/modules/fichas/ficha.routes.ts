import type { FastifyError, FastifyPluginAsync } from 'fastify';
import { ExtractionRequestSchema, ExtractionResultSchema } from '@app/shared';
import { env } from '../../config/env.ts';
import { createCodexProvider } from './codex-provider.ts';
import { createGeminiProvider } from './gemini-provider.ts';
import { createAnthropicProvider, ExtractionProviderError, type ExtractionInput, type ExtractionProvider } from './provider.ts';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function validateImage(image: string): ExtractionInput | undefined {
  const comma = image.indexOf(',');
  const base64 = image.slice(comma + 1);
  // Reject noncanonical padding/encodings before Buffer's permissive decoder.
  if (base64.length % 4 !== 0 || base64.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) return;
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== base64) return;
  const mimeType = image.slice(5, image.indexOf(';')) as ExtractionInput['mimeType'];
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if ((mimeType === 'image/png' && png) || (mimeType === 'image/jpeg' && jpeg) || (mimeType === 'image/webp' && webp)) return { mimeType, base64 };
}

export const fichaRoutes: FastifyPluginAsync<{ provider?: ExtractionProvider }> = async (app, options) => {
  const provider = options.provider ?? (
    env.EXTRACTION_PROVIDER === 'gemini'
      ? createGeminiProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL })
      : env.EXTRACTION_PROVIDER === 'codex'
        ? createCodexProvider({ cliPath: env.CODEX_CLI_PATH })
        : createAnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL })
  );
  const configured = () => provider.isConfigured ? provider.isConfigured() : Promise.resolve(provider.configured);
  app.setErrorHandler<FastifyError>((error, _request, reply) => {
    const status = error.statusCode === 413 ? 413 : error.statusCode === 400 ? 400 : error.statusCode === 429 ? 429 : 500;
    return reply.code(status).send({ error: {
      code: status === 413 ? 'IMAGE_TOO_LARGE' : status === 400 ? 'INVALID_REQUEST' : status === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR',
      message: status === 413 ? 'Envie uma imagem com até 10 MB.' : status === 400 ? 'A solicitação enviada é inválida.' : status === 429 ? 'Muitas solicitações. Aguarde e tente novamente.' : 'Não foi possível processar a solicitação.',
    } });
  });
  app.get('/fichas/config', async () => ({ configured: await configured(), provider: provider.provider ?? 'anthropic' }));
  app.post('/fichas/extract', { bodyLimit: 16 * 1024 * 1024 }, async (request, reply) => {
    if (provider.provider === 'codex' || (provider.provider === 'gemini' && !env.GEMINI_API_KEY.trim())) {
      let host = '';
      try { host = new URL(`http://${request.headers.host ?? ''}`).hostname; } catch { /* rejected below */ }
      const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.ip);
      const validHost = ['localhost', '127.0.0.1', '[::1]'].includes(host);
      const validOrigin = !request.headers.origin || request.headers.origin === env.WEB_ORIGIN;
      if (!local || !validHost || !validOrigin) return reply.code(403).send({ error: { code: 'LOCAL_ACCESS_ONLY', message: 'A extração local só pode ser iniciada pelo aplicativo local autorizado.' } });
    }
    const parsed = ExtractionRequestSchema.safeParse(request.body);
    const image = parsed.success ? validateImage(parsed.data.image) : undefined;
    if (!image) return reply.code(400).send({ error: { code: 'INVALID_IMAGE', message: 'Envie uma imagem PNG, JPEG ou WebP válida com até 10 MB.' } });
    if (!await configured()) return reply.code(503).send({ error: { code: 'AI_NOT_CONFIGURED', message: provider.provider === 'gemini' ? 'O Gemini Flash está indisponível. Verifique se o Antigravity está aberto ou configure GEMINI_API_KEY.' : provider.provider === 'codex' ? 'O Codex local está indisponível. Instale o CLI e faça login para extrair.' : 'A extração por IA não está configurada. Configure a chave no servidor.' } });
    try {
      const result = ExtractionResultSchema.safeParse(await provider.extract(image));
      if (!result.success) throw new ExtractionProviderError('INVALID_PROVIDER_RESPONSE', 'A IA retornou dados inválidos. Tente novamente ou preencha manualmente.');
      return result.data;
    } catch (error) {
      const known = error instanceof ExtractionProviderError;
      const isBusy = known && (error.code === 'CODEX_BUSY' || error.code === 'GEMINI_BUSY');
      const isTimeout = known && (error.code === 'CODEX_TIMEOUT' || error.code === 'GEMINI_TIMEOUT');
      return reply.code(isBusy ? 429 : isTimeout ? 504 : 502).send({ error: {
        code: known ? error.code : 'EXTRACTION_FAILED',
        message: known ? error.message : 'Não foi possível extrair a ficha. Tente novamente ou preencha manualmente.',
      } });
    }
  });
};
