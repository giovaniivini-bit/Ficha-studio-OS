# M1.2 — Extração real Codex CLI

Problema corrigido: o botão dependia de Anthropic não configurado e não executava a leitura do Codex. Agora default EXTRACTION_PROVIDER=codex com readiness via login status, refresh de config15s e botão de reconexão sem perda de rascunho.

QA real: CLI direto primeiro retornou referência01.14.01.3221 e gola1,5cm. Depois clique real no navegador em Extrair com IA enviou a imagem atual ao backend; logs POST /api/fichas/extract200 em21326ms; browser exibiu Extração concluída com25 campos fixos e avisos novos. Essa foi inferência nova, não importação dos JSON preparados. Segundo pedido simultâneo de script recebeu429 CODEX_BUSY. Não repetimos a inferência após sucesso.

Revisão: agentes independentes, problemas de cache de configuração e timeout de subprocessos resolvidos. Windows usa binário nativo quando encontrado; shell:false; argumentos estáticos; sandbox read-only; onze recursos de ferramentas desabilitados; resultado validado por schema; diretórios temporários exclusivos e limpeza restrita. Encerramento Windows taskkill apenas PID próprio/árvore com5s e fallback. Endpoint exige loopback, Host local e Origin configurado se presente.

pnpm smoke passou:14 testes API e12 web, tipos de todos pacotes, lint71 arquivos, travas. Testes de provider usam executor fake e são separados da evidência real acima. Não há treino Python nem aprovação humana presumida. A integração local usa serviço OpenAI e limites da conta autenticada. VPS requer configuração futura própria.
