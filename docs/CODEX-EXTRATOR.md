# Modo assistido pelo Codex — sem API do app

O modo assistido permite que o Codex leia anexos nesta conversa e prepare JSON estruturado para importação. Os botões de leituras prontas só carregam esses resultados. Além dessa alternativa, M1.2 implementa **extração automática pelo Codex CLI local** ao clicar Extrair com IA: o backend usa a sessão CLI existente, anexa a imagem e valida JSON. A inferência ocorre no serviço OpenAI, não offline; usa os limites da conta Codex. Credenciais não são copiadas ou expostas. Ver COMO-USAR.md.

Formato de importação: version 1, sourceFileName, imageSha256 dos bytes originais e extraction com ficha completa e warnings. Antes de associar campos a uma imagem, o app verifica o hash; não aplicar leitura de outra peça.

Usuário revisa e aprova explicitamente os dados para o extrator. O backup preserva a extração original e a correção. Somente registros aprovados entram na exportação do dataset. Exemplos demonstrativos e simples cliques em Salvar não são aprovação de rótulos.

Python inicialmente prepara e avalia o conjunto de exemplos. Não há modelo treinado nem OCR Python implantado nesta etapa. Imagens iguais são agrupadas por hash para impedir vazamento entre treino e validação. Métricas sobre a extração inicial medem o Codex no conjunto revisado, não a precisão de um extrator Python ainda inexistente. Três fichas são um lote inicial de revisão, não base suficiente para demonstrar generalização.

Futuro: coletar layouts variados, separar conjunto de teste intocado, construir OCR/regras ou modelo local e comparar campos críticos com o conjunto revisado. Introduzir API externa somente se escolhido posteriormente.
