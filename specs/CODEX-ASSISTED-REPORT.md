# M1.1 — Modo assistido

Agentes: web-fichas implementou UI/importação/provenance; api-fichas implementou ferramenta Python stdlib; principal leu visualmente os três anexos e gerou JSON vinculados por hash. Revisões cruzadas independentes de UI/Python e leituras visuais. Sem execução de CLI Codex ou chamada a API externa para os dados.

Smoke verde: 8 testes API, 10 web, tipos e lint de 69 arquivos, travas; Python 6 unittest verde. Testes Python só dados sintéticos. O script legado do motor ai-team não descobriu testes no Windows (0), não considerado teste do motor.

QA browser: leitura camiseta Marvel carregou imageSha256 correspondente e 25 campos fixos, dados originais e avisos. Botão Aprovar disponível, export dataset zero/desabilitado: nenhum exemplo foi declarado aprovado pelo agente.

Importação exige JSON válido e hash da imagem correspondente; backup preserva origem; edição invalida review. Export usa apenas versões salvas e aprovadas. Python valida hash e revisão, separa hashes sem leakage e prepara JSONL+imagens+métricas Codex versus revisão, sem treinamento.

Pendente: conferência real pelo usuário, export de aprovados e evolução de extrator Python com OCR/modelo. Não há processamento automático de novas imagens no app sem API. Novas leituras assistidas são solicitadas no chat e importadas em JSON. GitHub/VPS continuam posteriores ao teste.
