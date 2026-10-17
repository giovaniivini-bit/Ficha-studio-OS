# Fluxo guiado local

1. Domínio: aprovar leitura separada do enriquecimento; snapshots validados em workflow opcional do registro; compatibilidade com fichas existentes. Consultar catálogo aprovado e nunca substituir conflitos silenciosamente. Testes de transições, conflitos e dataset sem contaminação.
2. Interface: trilha de seis etapas (Imagem, Extração, Revisão, Regras, Aprovação final, Ficha salva); conteúdo correspondente, voltar e revisitar sem perda; edição anterior invalida aprovações seguintes. Salvar rascunho separado de finalizar. Usar tema atual, não as cores da referência.
3. Regras: selecionar material do catálogo por nome/código, mostrar antes/depois/origem e decisões explícitas para conflitos. Permitir continuar sem complementos com aviso quando não houver correspondência. Primeira integração cobre malha principal; costuras e múltiplos complementos permanecem fora desta etapa.
4. Histórico: conservar extração original, leitura aprovada e enriquecimento aprovado. Exportação para Python usa leitura corrigida como alvo de extração, não dados inferidos do catálogo. Ficha salva não significa modelo treinado.
5. Gates: testes web/API, tipos, build isolado, revisão independente e verificação local. Não publicar nem alterar fichas salvas sem ação do usuário. Sem migração destrutiva.

## Implementação local
- Trilha conectada a imagem/extração/manual, aprovação de leitura, consulta de catálogo, conflitos, aprovação e salvamento final.
- Rascunho de regras persiste escolhas; voltar não modifica aprovações. Editar uma fonte invalida dependências posteriores.
- Ficha antiga abre para revisão, sem aprovação automática. Exclusão preserva o conteúdo como rascunho novo sem savedAt.
- Teste real manual TESTE-FLUXO-LOCAL: consulta ao catálogo aprovado, código/composição/gramatura/largura/observação complementados; salvamento e reabertura após reload confirmados. Não houve chamada de IA neste teste nem alteração da ficha existente.
- Apenas malha principal nesta integração. Costuras e materiais complementares terão regras próprias futuras. Nenhum modelo treinado; dataset de extração mantém alvo de leitura separado do contexto enriquecido.
