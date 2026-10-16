# Contrato M1

DTO único: packages/shared/src/dto/ficha.ts, exportado por @app/shared. Ficha com strings fixas, ausência representada por string vazia. FIELD_GROUPS determina ordem e rótulos.

GET /api/fichas/config → { configured: boolean, provider: 'anthropic' }. POST /api/fichas/extract, body ExtractionRequestSchema → ExtractionResultSchema (sem envelope). Erro → HTTP apropriado + { error: { code: string, message: string } }. Limite imagem 10 MB, body máximo 16 MB. Cliente chama http://localhost:3001 por padrão, configurável NEXT_PUBLIC_API_URL. Provedor nunca recebe documentos sem clique em Extrair com IA.

Composição: app Fastify e env pelo principal; módulo exporta fichaRoutes. Backend usa env.ANTHROPIC_API_KEY e env.ANTHROPIC_MODEL. UI exporta HomeClient default de app/home-client.tsx; page.tsx importa esse default. CSS global é território exclusivo visual. UI emprega classes documentadas ao agente visual. DTO, config e layout raiz são zonas neutras.

Manifesto: FIELD_GROUPS/FichaSchema/emptyFicha compartilhados; adapter ExtractionProvider mora em modules/fichas/provider.ts; UI divide ImagePanel, FichaForm, DocumentPreview e Library em app/components/ficha/. Constantes de exemplo em app/components/ficha/examples.ts. Sem tipos Ficha duplicados. Impressão usa .print-document e body.is-printing; toolbar/editor com .no-print.
