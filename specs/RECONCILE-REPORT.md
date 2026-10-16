# Integração M1 — Codex nativo

Agentes api-fichas, web-fichas e visual-fichas trabalharam em territórios disjuntos numa árvore compartilhada. O principal escreveu DTO e composição; não houve worktrees nem execução ai-team run/reconcile. CLI original está incluído e --help foi executado, mas continua específico do Claude.

Validação final: pnpm smoke exit 0 — tipos de todos os pacotes, 8 testes API, 6 testes web, lint de 63 arquivos e travas estruturais. O script legado de testes do CLI original não encontrou testes no Windows (0 executados); não é evidência de teste do motor.

HTTP: web / 200; API /api/fichas/config 200, configured false. Browser: exemplo Marvel abriu com imagem e campos; salvar criou registro em Biblioteca (1); prévia exibiu original grande e todos os grupos. Registro demonstrativo mantido para o teste do usuário.

Revisão independente: backend pelo agente visual, frontend pelo agente API. Identificado e corrigido upload corrompido: agora decode real antes de aceitar; testes de rejeição incluídos. Exclusão da ficha aberta preserva rascunho novo com aviso. CSS da prévia/impressão e hero compactados na integração.

Limitações: extração real não testada com provedor, pois não há chave configurada. PDF pelo diálogo do navegador ainda requer teste do usuário. Sem build de produção, deploy ou criação de repositório remoto nesta etapa. Armazenamento de fichas e imagens no IndexedDB deste navegador, exportável como JSON.

Status: implementado e verificado localmente, aguardando teste e aprovação (HTC). Usuário determinou testar primeiro, depois salvar código GitHub e hospedar VPS; próximas etapas condicionadas a esse teste.
