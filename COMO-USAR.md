# Ficha Studio

Transforme imagens de fichas de vestuário em fichas técnicas padronizadas. Imagem original em destaque, campos fixos editáveis, revisão antes de imprimir, biblioteca local e backup JSON.

## Abrir

Requisitos: Node 20+ e pnpm 9+. Nesta pasta, execute `pnpm install` na primeira vez. No PowerShell, `./INICIAR.ps1` inicia API e web. Acesse http://localhost:3000. Para parar, Ctrl+C.

Com Codex CLI autenticado nesta máquina, a extração automática funciona sem chave de API separada. Sem sessão Codex, é possível preencher manualmente ou usar importação assistida.

## Ativar extração de imagens novas

### Codex local — extração automática pelo botão

O padrão é `EXTRACTION_PROVIDER=codex`. O servidor detecta o Codex CLI autenticado (`codex login status`). Carregue uma imagem e clique em **Extrair com IA**. O app anexa a imagem a uma execução Codex somente leitura e recebe os 25 campos em JSON validado. Uma extração por vez, com prazo de até 120 segundos.

Este modo usa a conta Codex autenticada e seus limites, sem chave de API separada. A imagem é processada pelo serviço OpenAI/Codex, não offline. O app não copia arquivos de credencial. Esta configuração é local e não funciona automaticamente na futura VPS. Se necessário, informe `CODEX_CLI_PATH` no `.env.local` com o caminho do executável ou launcher JS.

Se aparecer indisponível, confira `codex login` e clique em **Verificar conexão**. O status também atualiza a cada 15 segundos sem apagar o rascunho. Após extrair, revise os dados; o resultado nunca é aprovado automaticamente para o dataset.

### Teste assistido pelo Codex, sem chave de API

Na seção **Leituras do Codex para revisar**, abra uma das três leituras preparadas nesta conversa. Confira os campos e a imagem. Corrija o necessário, clique em **Aprovar dados para o extrator** somente depois da conferência e clique em **Salvar ficha**. Edições posteriores invalidam a aprovação e exigem nova conferência.

O botão **Exportar dataset revisado** inclui somente as versões salvas e aprovadas. Novas imagens podem ser enviadas no chat do Codex; o JSON preparado é importado com **Importar extração do Codex**, após carregar a mesma imagem no app. Há uma verificação SHA256 para impedir associação à peça errada.

Os atalhos das três leituras carregam resultados existentes; não executam uma nova leitura de IA ao clicar. O botão **Extrair com IA** usa Codex local por padrão ou Anthropic quando selecionado explicitamente. A importação é uma alternativa, não a implementação desse botão.

Após exportar o dataset, `python tools/extrator-python/dataset.py --input <arquivo-exportado.json> --output data/experimento-01` prepara pares de imagens/campos e métricas. Escolha um diretório de saída ainda inexistente. A ferramenta ainda **não executa OCR nem treina modelo**; forma a base revisada para desenvolver e avaliar o futuro extrator. Detalhes em tools/extrator-python/README.md.

### Extração automática com API (opcional)

Para escolher Anthropic, crie `.env.local` nesta pasta com `EXTRACTION_PROVIDER=anthropic`, `ANTHROPIC_API_KEY=<sua chave>` e opcionalmente `ANTHROPIC_MODEL=claude-sonnet-4-6`. Execute novamente `./INICIAR.ps1`. Não compartilhe nem versione esse arquivo. A chave fica no backend.

Quando o provedor selecionado for Anthropic, a imagem é enviada à API da Anthropic. Confira os dados; campos ilegíveis/ausentes exigem revisão em qualquer provedor. O app não calcula consumo, composição ou medidas ausentes. Aceita PNG/JPEG/WebP até 10 MB.

## Salvar e gerar PDF

Salve na biblioteca deste navegador e exporte backup JSON para preservar os dados. O armazenamento local não sincroniza com outros computadores e pode ser apagado pelo navegador. Imprimir abre o diálogo do navegador; escolha Salvar como PDF e A4. A imagem aparece grande no topo e os campos seguem nas páginas necessárias.

## Projeto e método

Template do Acelera: Next.js + Fastify + TypeScript + Zod. Contratos e planejamento em docs/ e specs/slots/M1/. Agentes nativos do Codex em territórios separados; o CLI original em tools/ai-team continua específico do Claude e não foi executado para o desenvolvimento deste app. Sem deploy ou gravação no Drive.

Verificações: `pnpm typecheck:all`, `pnpm test:all`, `pnpm lint`, `pnpm travas`. A aceitação do M1 depende do teste do usuário.
