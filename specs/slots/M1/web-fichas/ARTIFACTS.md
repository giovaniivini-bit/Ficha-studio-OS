# web-fichas — entregue

HomeClient default compõe ImagePanel, FichaForm, DocumentPreview e Library. React Query usa endpoints raw /api/fichas; status do servidor, pending, erros e avisos visíveis. IA só é chamada por clique explícito, com nota de envio ao provedor.

Persistência IndexedDB conserva imagem e ficha. Backup JSON validado via Zod, versão 1, no máximo 100 fichas e 100 MB. Importação transacional com confirmação para sobrescrita. Exclusão e substituição de edição confirmadas. Navegação externa dispara beforeunload com alterações não salvas; formulário e navegação bloqueados durante extração e leitura.

Exemplos demonstrativos dos três originais são transcrições manuais; campos incertos pedem conferência. Nenhuma extração simulada.

Verificação: pnpm --filter @app/web typecheck passou; pnpm --filter @app/web test passou, 4 testes em 2 arquivos (3 novos: edição, limites de arquivo, contrato de backup). Não houve chamada real com credencial Anthropic nem inspeção visual neste slot.

Arquivos: apps/web/app/home-client.tsx; apps/web/lib/queries/fichas.ts; apps/web/app/components/ficha/{ImagePanel,FichaForm,DocumentPreview,Library}.tsx; examples.ts; storage.ts; ficha.ui.test.tsx.

CSS coordenado com agente visual. Sem nova dependência ou commit.

Campos v2: MODELAGEM e ETIQUETA escalares; cores estruturadas editáveis com número/nome/Pantone/código, adicionar e remover sem renumerar; estampa/bordado/aplique separados e quatro aviamentos. Impressão inclui tabela de cores, biblioteca usa modeling. RecordSchema preprocess migra legados estritamente, guarda legacyFicha e provenance.legacyInitialExtraction, revoga revisão e é idempotente. Backups v1 continuam aceitos; importação Codex v1/v2 preserva legados. Dataset version2/schemaVersion2 somente após nova revisão explícita. Rascunho HMR protegido por render guard e inicialização que não substitui registro existente. Originais visíveis em details. Testes 19/19 passaram, typecheck/lint passaram. Sem reextração de IA nesta etapa.

Integração real Codex: config aceita codex|anthropic; botão principal executa POST da imagem atual, snapshot do registro e bloqueio durante chamada/hash. Timeout cliente 150s; mensagem de timeout/rede explícita e mensagens de erro API preservadas. Resultado Codex gera provenance com hash da imagem, initialExtraction e reviewed:false. Anthropic limpa provenance anterior. Textos informam envio remoto Codex/OpenAI usando conta local e configuração própria para VPS; alternativa assistida recolhida em details. Verificação desta etapa: typecheck passou, lint raiz passou, 12 testes web passaram. Sem chamada real do provedor realizada pelo slot.

Modo assistido Codex adicionado: importação JSON estrita v1 com SHA256 dos bytes originais da imagem; referência cruzada obrigatória antes aplicar. Componente CodexImport bloqueia outros controles durante leitura e confirma substituição. Provenance opcional mantém backups antigos compatíveis. Aprovação explícita para dataset, invalidada a cada edição. Exportação somente registros salvos/aprovados com reviewed:true, imagem, hash, initialExtraction e ficha revisada. Sem treinamento automático ou chamada CLI/API Codex. Três botões carregam leituras feitas nesta conversa por arquivos public/codex-extractions (conteúdo gerado pelo integrador). Testes web finais: 10/10; typecheck passou.

Revisão adicional: upload e imagens do backup agora passam por decodificação real via Image, com dimensões positivas, falha e timeout de 15s. Data URL original preservada; sem object URL que exija revoke. Exclusão da ficha aberta conserva conteúdo em novo rascunho e comunica que salvar cria nova ficha. Testes web atualizados: 6/6 passaram, incluindo rejeição corrompida e preservação do original.
