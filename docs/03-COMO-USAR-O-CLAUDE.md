# 3. Como usar o Claude pra evoluir o projeto

> Você não escreve código. Você **conversa** com o Claude. Este guia mostra como falar com
> ele pra ter resultado consistente.

## Setup (uma vez)

1. Instale o **Claude Code** ([claude.com/code](https://claude.com/code)).
2. Abra o terminal **na raiz do projeto** (a pasta com `apps/`, `packages/`, `docs/`, `specs/`).
3. Digite `claude` e Enter. (O plugin `a360` traz os comandos abaixo.)

## Os 3 comandos do time

| Comando | Quando usar |
|---|---|
| `/a360:iniciar` | Projeto novo: monta o monorepo, conecta o GitHub, prepara a pasta do design. |
| `/a360:vamos` | Já tem o design em `docs/design/raw/`: o time lê e **constrói** o milestone. |
| `/a360:deploy` | Pronto pra publicar: sobe no ar (Docker + servidor). |

## Fluxo padrão (95% do tempo)

Depois de colocar o design em `docs/design/raw/`, diga:

```
/a360:vamos
```

O time vai:
1. **Ler o design** e te dizer o que entendeu ("vi N telas: ..."). Você confirma.
2. **Planejar** — escreve o `docs/ROADMAP.md` (milestone + critérios) e os slots. Te mostra.
3. **Construir** os slots (em paralelo nas worktrees, ou um a um).
4. **Integrar + revisar** (junta tudo, roda os testes).
5. **HTC** — sobe o app e te dá um checklist pra testar. **Espera seu OK.**
6. Aprovado → fecha o milestone e atualiza a documentação.

## Frases úteis (copie e cole)

### Começar/continuar a construção
```
/a360:vamos
```

### Quero que comece pelo X primeiro
```
/a360:vamos  priorize a tela de <X> no M1.
```

### Algo deu errado
```
Isto falhou: <cole o erro inteiro, sem resumir>.
Antes de tentar consertar, diagnostique a causa raiz e me mostre.
E registre o aprendizado em docs/LEARNINGS.md.
```

### No HTC, algo não ficou bom
```
No teste, <o que falhou>. Reprovo o HTC. Abra os slots de correção e me mostre o plano.
```

### Publicar
```
/a360:deploy
```

## O que esperar de bom comportamento do Claude

- **Pede seu OK** antes de coisas que mexem na sua máquina/servidor.
- **Mostra o que mudou** e roda os testes (smoke) antes de dizer "pronto".
- **Não fecha milestone sem o seu HTC.**
- **Registra aprendizado** quando algo quebra (em `docs/LEARNINGS.md`).

Se ele propuser algo agressivo (apagar arquivo, reset do git), diga:
*"vamos discutir antes de tomar qualquer decisão."*
