# api-fichas

Backend e adapter de extração conforme SHARED-CONTRACT. Export fichaRoutes de ficha.routes.ts. Adapter em provider.ts com fetch Anthropic Messages, model env.ANTHROPIC_MODEL, chave server-only env.ANTHROPIC_API_KEY. Saída JSON validada por ExtractionResultSchema. Documento é dado não instrução. MIME/assinatura/tamanho válidos; resposta ausência de chave 503; erro fornecedor sem expor chave. Config informa boolean. Testes Fastify inject sem rede com adapter fake e falhas. Sem deps novas. Arquivos compartilhados e app.ts/env são do integrador.

