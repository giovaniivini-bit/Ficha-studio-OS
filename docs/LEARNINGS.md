# Aprendizados M1

## 2026-10-16 — Etapas reais e aprovações independentes
- **Gatilho:** expectativa de enriquecimento no salvar e falhas encontradas pela revisão independente.
- **O que aconteceu:** catálogo estava separado da ficha; decisões parciais se perdiam ao desmontar painel; reabrir ficha sem complementos poderia apagar aprovação; prévia fora do wrapper de tela ficava invisível.
- **Causa raiz:** etapas implícitas e estado transitório separado do registro; inicialização confundia ausência de regra com ausência de enriquecimento; CSS de impressão exigia preview-surface.
- **Correção:** trilha explícita, snapshots de leitura/enriquecimento, ruleDraft persistido, estados finais vinculados ao salvamento real, preservação de skip e wrapper visível da prévia.
- **Regra pra não repetir:** FichaWorkflow.ui.test.tsx cobre avanço/retorno, invalidação, falha de persistência, decisões desfeitas e reabertura de ficha sem regras; dataset não usa enriquecimento como alvo de extração. Teste real registrado no PLAN-FLUXO. CLI ai-team indisponível, registro documental mantido.

## 2026-10-16 — Importação de regras e limites reais de ZIP
- **Gatilho:** revisão independente detectou duas falhas importantes.
- **O que aconteceu:** consulta priorizava código e ocultava colisão com nome; limite de XLSX usava somente tamanho declarado no ZIP.
- **Causa raiz:** atalhos de primeira correspondência e confiança em metadados de entrada externa.
- **Correção:** união das correspondências por código/nome e contagem de bytes reais na descompactação em fluxo antes do ExcelJS.
- **Regra pra não repetir:** testes catalog.test.ts e import-xlsx.test.ts para colisão e tamanho ZIP adulterado; catálogo só fica ativo após conferência explícita. CLI ai-team indisponível; registro documental mantido.

## 2026-10-16 — Campos agrupados e edição de cor
- **Gatilho:** mudança de formulário e bug detectado em revisão independente.
- **O que aconteceu:** formatar número/nome a cada tecla impediria digitar o separador e apagar o texto.
- **Causa raiz:** representação canônica usada como estado transitório de edição.
- **Correção:** rascunho textual durante o foco, formatação ao sair, agrupamentos atômicos e apresentação compartilhada entre formulário e impressão; contrato de armazenamento mantido.
- **Regra pra não repetir:** testes home-draft.ui.test.tsx e grouped-fields.ui.test.tsx cobrem digitação sequencial, valores antigos e impressão. CLI ai-team indisponível; registro documental mantido.

## 2026-10-16 — Isolar build da sessão de desenvolvimento
- **Gatilho:** build falhou por chunk ausente mesmo após compilação e tipos válidos.
- **O que aconteceu:** next dev ativo no mesmo diretório de next build, com saída .next compartilhada.
- **Causa raiz:** produtores concorrentes de arquivos gerados.
- **Correção:** FICHA_VERIFY_BUILD=1 seleciona .next-verify, ignorada pelo Git, sem mudar a saída padrão de deploy.
- **Regra pra não repetir:** usar build isolado quando o servidor de desenvolvimento estiver ativo.

## 2026-10-16 — JSON Schema no Gemini
- **Gatilho:** bug de extração em produção.
- **O que aconteceu:** Gemini rejeitou a solicitação com HTTP 400 antes de ler a imagem.
- **Causa raiz:** JSON Schema com additionalProperties enviado em responseSchema, que usa outro contrato.
- **Correção:** enviar responseJsonSchema com tipos JSON Schema e mensagens seguras por status HTTP.
- **Regra pra não repetir:** teste apps/api/test/fichas.gemini.test.ts exige responseJsonSchema e preserva as restrições dos campos e cores. O CLI ai-team não está disponível nesta sessão; registro mantido neste documento.

- pnpm 11 registra placeholders allowBuilds ao bloquear scripts. Declarar uma única seção allowBuilds com permissões específicas esbuild, sharp e Biome; evitar chave duplicada. Instalação concluída com exit 0 após corrigir.
- No sandbox Windows desta sessão, pnpm verificações podem falhar EPERM realpath antes de executar. Executar com aprovação apropriada; não tratar como falha do código nem remover verificações.
- MIME e extensão não provam que um arquivo contém imagem. Validar decode antes de aceitar e antes de restaurar backups; proteger por timeout.
- CLI ai-team original usa argumentos/permissões Claude: mudar só nome do binário não o converte para Codex. A skill instalada explicita o modo nativo e os limites de isolamento.
