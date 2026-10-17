# Regras — primeira versão local

Escopo aprovado nesta etapa: usar a planilha fornecida como base para importação e conferência. Não publicar, não alterar o Excel e não treinar modelos.

1. Criar contrato de catálogo de malhas e funções determinísticas em apps/web/lib/rules. Preservar nome, composição literal, código, gramatura, largura, observação e origem (arquivo/aba/linha). Aceitação: testes para cabeçalhos acentuados, dados incompletos, zeros em texto e ambiguidade de nomes.
2. Importador XLSX local com ExcelJS, sem execução de fórmulas ou transmissão a IA. Prévia por aba; dados inválidos impedem ativação. Aceitação: arquivo real fornecido importa cinco linhas, com duas ribanas mantidas distintas.
3. Rota /regras com navegação, tabela de conferência, aprovação explícita e histórico local no IndexedDB separado das fichas. Só catálogos aprovados são consultáveis. A versão anterior fica preservada.
4. Consulta de teste por código/nome exato normalizado. Retornar todas as correspondências, nunca selecionar silenciosamente a primeira. Aliases explícitos e cruzamento com a ficha ficam para a próxima etapa.
5. Validar testes web/API, tipos, build isolado e revisão independente. Dados antigos de fichas não mudam; sem migração destrutiva. Rollback: nenhuma configuração externa alterada e catálogos anteriores preservados.

Próxima etapa, após validar o cadastro: aprovações separadas da extração e do enriquecimento, conflitos por campo, origem/versionamento na ficha e exemplos revisados para Python. Não considerar o cadastro atual como treinamento automático.

Correção confirmada pelo usuário: código 33335, gramatura 245 = ribana 1x1; código 1123343, gramatura 255 = ribana 2x1. Aplicada apenas no rascunho da tela local para conferência; a planilha original não foi modificada. Nome de origem preservado em sourceName no catálogo ao aprovar.
