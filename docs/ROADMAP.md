# ROADMAP — Ficha Studio

## M1.2 — Extração real pelo Codex local (verificado, aguardando teste do usuário)

Problema: modo assistido não atende clique Extrair com IA para imagem nova. Backend agora aciona Codex CLI autenticado local, imagem + JSON schema, sem chave API separada. Configured verifica login real, UI atualiza disponibilidade sem perder rascunho. Processamento segue usando serviço OpenAI/Codex remoto e limites da conta; não é OCR offline.

Territórios: api-fichas backend provider e rotas/tests; web-fichas interface/query/provenance; principal env, documentos e smoke real. Revisor independente verifica subprocess/guardas locais/timeout/saída. Exigir loopback + Host local + Origin permitido; backend permanece 127.0.0.1. Sem automação na VPS nesta fase.

Aceite: clicar Extrair com IA sobre imagem atual e receber campos novos, sem JSON manual nem fixtures; aprovação continua pendente para dataset. Não declarar sucesso com teste mock apenas. Lote real inicial usa imagem fornecida pelo usuário.

Evidência real: no navegador, botão habilitado com Codex local disponível; clique enviou POST e retornou HTTP200 em21326ms. UI exibiu Extração concluída e campos gerados na hora, incluindo avisos novos. Nenhuma aprovação para dataset foi marcada. Um segundo pedido de smoke durante processamento retornou429 como previsto, sem iniciar inferência duplicada. pnpm smoke verde:14 testes API+12 web, tipos/lint/travas. Revisor independente conferiu proteção local e timeout Windows após correção. Sem nova inferência após comprovar sucesso.

## M1.1 — Extração assistida Codex e base Python (implementado, aguardando revisão do usuário)

Pedido: testar leitura por Codex nesta conversa sem API de IA no app. Contrato: docs/CODEX-EXTRATOR.md. Wave 0: principal prepara JSON visuais com vínculo SHA256 às três imagens. Wave 1: agente web-fichas implementa importação, revisão explícita e export de aprovados (home-client + components/ficha); agente api-fichas implementa ferramenta Python stdlib somente em tools/extrator-python. Integração e revisão por principal e agente independente.

Aceite: carregar leitura preparada sem chamada de IA externa, conferir imagem+hash, editar e aprovar, salvar, exportar apenas aprovados, preparar pares para Python sem vazamento de imagem entre conjuntos. Não apresentar script de preparação como modelo treinado; não afirmar aprovação humana das amostras iniciais.

Evidências: pnpm smoke exit 0 (8 testes API + 10 web, tipos, lint e travas); 6 testes unittest Python aprovados. Browser carregou a leitura Marvel com campos reais e indicação Codex aguardando revisão; aprovação não foi realizada pelo agente. Revisão independente não encontrou bloqueantes. Amostras visuais também revisadas e vinculadas por hash. Nenhum dataset real foi preparado nem modelo treinado, pois as leituras aguardam conferência do usuário.

## M1 — implementado e verificado localmente, aguardando teste do usuário

Critérios: enviar imagem, manter original grande, editar campos fixos, extrair com IA configurada e indicar indisponibilidade sem credencial, salvar/reabrir localmente, exportar backup e imprimir documento completo. Aceitação final depende do teste do usuário.

Wave 0: contratos compartilhados e composição, agente principal. Wave 1: backend de extração; UI e fluxo; estilo e impressão, agentes independentes com territórios disjuntos. Wave 2: integração, tipos, testes e revisão independente.

Execução: agentes nativos Codex compartilhando árvore com territórios disjuntos. Não existe bloqueio mecânico de edição por território neste modo; revisão do diff e composição central. Nenhum ai-team run foi executado.

Verificação final: pnpm smoke verde, 14 testes do app; browser comprovou carregar exemplo, salvar na biblioteca e abrir prévia. Extração real depende de credencial ainda não configurada. Usuário definiu sequência: teste primeiro; GitHub e VPS após aprovação. M1 ainda não aceito.

Dívida consciente: armazenamento no navegador sem sincronização. Credencial IA e deploy são configuração posterior. M2: autenticação e persistência de equipe, integração Drive autorizada.
