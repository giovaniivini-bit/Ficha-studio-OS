# Preparação de dados revisados

Este utilitário usa apenas a biblioteca padrão do Python 3.9+. Prepara dados para desenvolver e avaliar um futuro extrator Python. **Não extrai imagens, não treina e não fornece modelo treinado.** Não lê credenciais nem faz chamadas de rede.

No app, importe a extração inicial do Codex chat, confira todos os campos contra a imagem, marque como revisada e salve. Exporte o dataset de exemplos aprovados. Exemplos demonstrativos ou extrações sem revisão não devem ser tratados como verdade. A aprovação continua sendo responsabilidade da pessoa revisora.

Na raiz do projeto:

```powershell
python tools/extrator-python/dataset.py --input caminho/dataset.json --output caminho/dataset-preparado-novo
python -m unittest discover -s tools/extrator-python -p "test_*.py" -v
```

O diretório de saída **não pode existir**, mesmo vazio. Todos os dados são validados antes de criá-lo; falha de escrita pode deixar uma saída parcial nova, que nunca será reutilizada ou sobrescrita. Corrija a causa e escolha outro diretório. Nenhum arquivo existente é sobrescrito.

Contrato de entrada atual: `{ "version": 2, "schemaVersion": 2, "examples": [...] }`. Cada exemplo contém `reviewed: true` boolean explícito, `imageSha256` SHA-256 hexadecimal dos bytes, `image` dataURI PNG/JPEG/WebP base64, `initialExtraction: { "ficha": {...}, "warnings": [] }` e `ficha` revisada. Metadados adicionais exportados pelo app são aceitos. Ambas as fichas precisam conter exatamente os 30 campos declarados em `FIELDS`, sincronizados com `packages/shared/src/dto/ficha.ts`: 29 strings e `colors`, lista de até 50 objetos com `number`, `name`, `pantone`, `code` strings. Número da cor tem 1–20 caracteres; demais valores têm até 8000. Campos textuais ausentes são strings vazias e cores ausentes são lista vazia. MODELAGEM (`modeling`) preserva código literal do rodapé, ETIQUETA (`labelCode`) separa sigla do cabeçalho, aplicações têm `print`/`embroidery`/`applique` e aviamentos quatro campos fixos. Limite de imagem: 10 MiB. MIME, assinatura, base64 canônico e hash são conferidos; esta checagem não decodifica os pixels.

Datasets v1 são reconhecidos e **rejeitados antes de criar a saída**, com orientação: importar backup no app, conferir os novos campos, aprovar novamente e exportar dataset v2. A aprovação do formato antigo não comprova a revisão das cores estruturadas, modelagem ou aplicações separadas. A migração e preservação dos originais acontece no app; Python não fabrica novos rótulos a partir de aprovação antiga. Quando o dataset v2 contém `legacyFicha` e `legacyInitialExtraction`, esses originais são preservados nos pares JSONL sem reinterpretá-los como rótulos atuais.

A saída contém `images/`, `train.jsonl`, `validation.jsonl` e `metrics.json`. Cada par tem caminho da imagem, hash, origem (arquivo de entrada e índice), extração inicial, revisão e diferenças por campo. As imagens são gravadas uma vez por hash. Pares de variantes são preservados, mas nunca distribuídos entre treino e validação: a divisão usa apenas os hashes únicos e uma ordenação determinística com semente fixa, reservando cerca de 20% para validação. Com uma imagem única não existe validação. Ao acrescentar dados, recongele a divisão antes de comparar experimentos, pois a composição do conjunto pode mudar.

As métricas são **a linha de base da extração inicial do Codex comparada às correções humanas**, não acurácia de Python. Para cada campo há contagem total, correspondências exatas, taxa exata e correções. Igualdade é literal, incluindo espaços, acentos e campos vazios. `colors` compara a lista estruturada inteira, incluindo ordem, números e códigos; uma diferença conta como correção do campo de cores. Contagens não vazias também são fornecidas para explicitar a inflação por ausências. `correctedFields` soma campos alterados, não imagens corrigidas. Variantes contam como pares nas métricas e não como observações independentes. Menos de 20 imagens únicas gera aviso de poucos dados; nenhuma quantidade constitui garantia de generalização.

Próximo passo técnico: coletar revisões representativas, congelar um conjunto de validação independente e então escolher/implementar o extrator. Sem comparação em imagens não usadas no desenvolvimento, não declarar melhora ou treinamento concluído.
