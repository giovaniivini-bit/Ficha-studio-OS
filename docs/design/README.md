# Design system — onde colocar o export do OpenDesign

Esta pasta é a **fonte de verdade visual** do produto. O time de IA lê daqui pra
construir as telas fielmente.

## O que fazer (você, fundador)

1. Abra o seu projeto no **OpenDesign**.
2. **Exporte** o design system / as telas. Qualquer formato serve:
   - HTML/CSS exportado
   - PDF do design
   - PNGs das telas (uma imagem por tela)
   - tokens (JSON de cores/tipografia), se tiver
3. **Coloque todos os arquivos dentro de `raw/`** (a subpasta aqui ao lado).
   - Dica: nomeie por tela — `login.png`, `painel.png`, `clientes.png`...
4. Volte ao Claude Code e rode **`/a360:vamos`**.

O time vai ler tudo, te mostrar o que entendeu ("vi 4 telas: ..."), e começar a construir.

## Estrutura

```
docs/design/
├── README.md            # este arquivo
├── raw/                 # <- VOCÊ coloca o export do OpenDesign aqui
└── DESIGN-OVERVIEW.md   # (gerado pelo time ao ler o raw/) mapa de telas + tokens
```

> Quanto mais fiel o export (telas claras, estados, cores), melhor o resultado.
