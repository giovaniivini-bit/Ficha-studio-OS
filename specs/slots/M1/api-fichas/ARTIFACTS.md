# API fichas — entrega

Revisão de lint: concatenação do prompt convertida em template literal conforme useTemplate. `pnpm exec biome lint apps/api/src/modules/fichas/provider.ts` passou (1 arquivo), executado escalado após EPERM do sandbox. Sem mudança de comportamento.

Implementados `apps/api/src/modules/fichas/ficha.routes.ts`, `provider.ts` e `apps/api/test/fichas.test.ts`.

Export principal: `fichaRoutes: FastifyPluginAsync<{ provider?: ExtractionProvider }>`. Registrar com prefix `/api`. GET `/fichas/config` informa configured/provider. POST `/fichas/extract` retorna DTO JSON direto ou erro contratual.

Adapter exporta `ExtractionProvider`, `ExtractionInput`, `ExtractionProviderError`, `createAnthropicProvider({ apiKey, model, fetcher? })`. Default lê chave/modelo do env central. Fetcher e provider injetáveis possibilitam testes sem rede. Não foi feita chamada real de IA.

Validação de DTO, MIME/assinatura PNG/JPEG/WebP, base64 canônico, limite de 10 MiB e body de 16 MiB. Erros de fornecedor não expõem conteúdo bruto ou chave. Timeout 60s. Saída estruturada passa pelo schema compartilhado. Prompt trata documento como dado e preserva códigos/ausências.

Verificação concluída: `pnpm --filter @app/api typecheck` passou; `pnpm --filter @app/api test` passou, 8 testes totais (7 fichas, 1 health). Execução escalada devido EPERM de realpath do Vitest no sandbox. Typecheck inicial transitório resolvido após instalação completa.

Limitações: assinatura verifica formato declarado, não decodifica todos os pixels; aceitação integral e leitura da imagem cabem ao fornecedor. Extração real depende de chave/modelo configurados e não foi validada com serviço externo. Nenhuma dependência nova.
