# ADR 009 — Execução local Codex

Pedido do usuário: adaptar skill ao Codex e construir sistema interno de fichas. Usar subagentes nativos e territórios disjuntos, sem emular flags Claude. Template Acelera preservado. Sem banco/auth no M1 local; storage do navegador com backup JSON, não adequado ainda a uso compartilhado. Provedor de extração por adapter Anthropic com saída Zod; sem credencial, manual/exemplos funcionam e extração retorna indisponibilidade explícita. Não há substituição por dados fictícios na extração.
