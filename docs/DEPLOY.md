# Publicação do Ficha Studio

- Repositório: `giovaniivini-bit/Ficha-studio-OS`, branch `main`.
- Endereço: https://fichastudio.136-248-111-213.sslip.io/
- Checkout: `/home/ubuntu/apps/Ficha-studio-OS`.
- Processos PM2: `ficha-studio-web` (3045) e `ficha-studio-api` (3046).
- Web: `API_URL=http://127.0.0.1:3046`, `NODE_ENV=production`.
- API: `EXTRACTION_PROVIDER=gemini`, `GEMINI_MODEL=gemini-2.5-flash`, `NODE_ENV=production`.
- Credenciais permanecem exclusivamente no ambiente do servidor; nunca no Git.

## Atualização

Antes de publicar, verificar mudanças locais na VPS, criar backup do código e preservar a configuração dos processos. Instalar dependências com `pnpm install --frozen-lockfile`. Gerar o build web com `API_URL=http://127.0.0.1:3046 NODE_ENV=production pnpm --filter @app/web build`. Reiniciar somente os dois processos do Ficha Studio após sucesso e verificar `/`, `/regras`, `/api/health` e `/api/fichas/config` por HTTPS. Não modificar os demais aplicativos do servidor.

## Dados do usuário

Fichas, rascunhos e catálogos de regras ainda são armazenados no navegador (IndexedDB), por origem. Os dados de `localhost:3000` não são transportados pelo deploy. Exportar os backups das fichas no ambiente local e importá-los no endereço publicado; importar e aprovar também a planilha de regras nesse endereço. Não limpar os dados do navegador antes de guardar backups.

O modo Codex é somente uma opção de desenvolvimento local. A VPS usa a API Gemini configurada no servidor. As consultas ao catálogo de malhas são executadas por código, sem nova chamada generativa.
