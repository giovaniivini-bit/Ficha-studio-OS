# Especificação — web-fichas

Fontes: docs/PRODUCT-MAP.md, docs/design/DESIGN-OVERVIEW.md e specs/slots/M1/SHARED-CONTRACT.md.

Implementar jornada completa do PRODUCT-MAP, consultar DTO @app/shared e DESIGN-OVERVIEW. HomeClient default. Compor ImagePanel, FichaForm, DocumentPreview, Library. Upload até 10MB PNG JPEG WebP. Form editável com campos fixos FIELD_GROUPS, revisão e avisos. API status e extraction via lib/queries/fichas.ts (raw responses, NÃO apiFetch envelope health). Persistir múltiplas fichas e imagem em IndexedDB preferido (localStorage com limite explícito aceitável); indicar erros e evitar perda de edits. Backup JSON import/export com schema validado. Exemplos transcritos honestos em examples.ts (usuário forneceu 3 imagens em public/examples) sem chamar extração fake; leitura dos dados de exemplo pode usar brief e imagens fonte. Config IA false → aviso, manual continua. Preview documento com original grande, todos campos e print via window.print. Classes para CSS: app-shell, topbar, brand, workspace, image-panel, form-panel, section-heading, field-grid, field, toolbar, button, button-primary, button-secondary, card, badge, notice, library, library-item, image-stage, empty-state, print-document, no-print. Mandar classes adicionais ao agente visual. Não editar globals.css/layout/page.tsx/contratos. Teste UI básico se viável.

Não alterar arquivos fora do território. Relatar pendências ao integrador.

