# Aprendizados M1

- pnpm 11 registra placeholders allowBuilds ao bloquear scripts. Declarar uma única seção allowBuilds com permissões específicas esbuild, sharp e Biome; evitar chave duplicada. Instalação concluída com exit 0 após corrigir.
- No sandbox Windows desta sessão, pnpm verificações podem falhar EPERM realpath antes de executar. Executar com aprovação apropriada; não tratar como falha do código nem remover verificações.
- MIME e extensão não provam que um arquivo contém imagem. Validar decode antes de aceitar e antes de restaurar backups; proteger por timeout.
- CLI ai-team original usa argumentos/permissões Claude: mudar só nome do binário não o converte para Codex. A skill instalada explicita o modo nativo e os limites de isolamento.
