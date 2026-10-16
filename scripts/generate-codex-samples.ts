// Materializa leituras visuais feitas pelo Codex nesta conversa; não executa IA.
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { LegacyFichaSchema, normalizeFicha, ExtractionResultSchema, type LegacyFicha } from '../packages/shared/src/dto/ficha.ts';
function emptyFicha(): LegacyFicha { return LegacyFichaSchema.parse(Object.fromEntries(Object.keys(LegacyFichaSchema.shape).map(key => [key, '']))); }

const samples: Array<{ id: string; fields: Partial<LegacyFicha>; warnings: string[] }> = [
  {
    id: 'camiseta-marvel',
    fields: {
      reference: '01.14.01.3221', secondaryCode: '2026-2-3547',
      product: 'Top MC D.100', client: 'C&A', collection: 'C&A — Baby Club — Summer I 2026 (CVA)',
      season: 'Summer I 2026', line: 'Baby Club', sizes: '1 ao 5', designer: 'Camila / Taly',
      mainMaterial: 'Malha Gorgurão PA', complementaryMaterials: 'Ribana 2x1.',
      colors: 'Cor 01 — 2026 Oatmeal 13-0401 (MC 408431)\nCor 02 — Winery 19-1537 (MC 4040267)\nCor 03 — Bright White 11-0601 (MC 791510)',
      construction: 'Recorte FRENTE / COSTAS na cor 02.',
      seams: 'Ribana 2x1 com pesponto 1 agulha; reforço na cor 01.',
      neckline: 'Gola pronta com 1,5 cm.', hems: 'Bainhas 2 agulhas.', measurements: 'Gola pronta: 1,5 cm.',
      artwork: 'Aplique em 1/2 malha na cor 03, estampado e rebordado na peça com linha na cor preta.',
      artworkReference: 'ASGARD-10458259266-SMAF_P_1117',
      changes: 'Cor 02 / Saiu etiqueta decorativa.',
      notes: 'Produto Disney; marca Marvel. Outros identificadores visíveis: 2; 800 100-14.',
    },
    warnings: ['Leitura visual pelo Codex nesta conversa; ainda não aprovada pela empresa.', 'Conferir o código da arte e os códigos MC no original. Composição, gramatura e tabela de medidas não estão informadas.'],
  },
  {
    id: 'camiseta-dino',
    fields: {
      reference: '01.14.00.7728', secondaryCode: '2026-1-12658', product: 'Top MC D.100',
      client: 'C&A', collection: 'C&A — Baby Club — Winter II 2026 (CYC)', season: 'Winter II 2026',
      line: 'Baby', sizes: '1 ao 5', designer: 'Camila / Taly', mainMaterial: 'Meia malha penteada',
      complementaryMaterials: 'Ribana 2x1 na cor 02.',
      colors: 'Cor 01 — Bright White 11-0601 (MC 791510)\nCor 02 — Infinity Navy 17-4015 (MC 7064035)',
      construction: 'Ombro tombado para frente com detalhe em trançador 3 agulhas na cor 02.',
      seams: 'Pesponto 1 agulha; reforço bico contrário na cor 01.',
      neckline: 'Ribana 2x1 na cor 02; gola 2 cm.', hems: 'Bainhas em trançador 3 agulhas na cor 02.',
      measurements: 'Gola: 2 cm.', artwork: 'Estampa.', labels: 'Tag BCI; código pouco legível no anexo.',
      changes: 'Alterou cor da malha. Saiu trançador do decote e incluiu reforço.',
      notes: 'Identificadores adicionais visíveis: 2; 800 355-25.',
    },
    warnings: ['Leitura visual pelo Codex nesta conversa; ainda não aprovada pela empresa.', 'A nota de alteração pode substituir parte das instruções desenhadas: conferir qual construção é vigente.', 'Código da tag BCI não transcrito por baixa legibilidade. Composição, gramatura e tabela de medidas não informadas.'],
  },
  {
    id: 'shorts',
    fields: {
      reference: '01.14.00.7267K', secondaryCode: '2025-2-3968', product: 'Shorts Bart', client: 'C&A',
      collection: 'C&A — Baby Club — Summer I 2025 (C9A)', season: 'Summer I 2025', line: 'Baby Club',
      sizes: '1 ao 5', designer: 'Kethlin / Taty', mainMaterial: 'Moletom PA', weight: '260 g s/felpa',
      complementaryMaterials: 'Gorgurão PA; ribana 2x1 no cós.',
      colors: 'Cor 01 — Skyway 14-4112 (MC 4060288)\nCor 02 — Skyway 14-4112 (MC 4060288) / Gorgurão PA',
      construction: 'Bolsos aplicados na cor 02 com bainha 2 agulhas. Desenhos de frente e costas presentes.',
      neckline: 'Cós em ribana 2x1 com 3,5 cm pronto, com canaleta para cadarço. Etiqueta interna costurada.',
      hems: 'Bainha 2 agulhas.', measurements: 'Cós pronto: 3,5 cm.',
      trims: 'Ilhós 45 com arruela (latão), banho Prata Velha. Cadarço com ponteira de plástico; códigos em vermelho precisam de conferência.',
      labels: 'Etiqueta costurada na reta; CÓD. A DESENVOLVER. Tag Caixa de Fósforo — CÓD. 12-9006.',
      notes: 'Campo Alteração sem preenchimento. Código da etiqueta superior e códigos de cadarço pouco legíveis; não transcritos.',
    },
    warnings: ['Leitura visual pelo Codex nesta conversa; ainda não aprovada pela empresa.', 'Material transcrito literalmente como "Moletom PA 260 g s/felpa". Não converter para g/m² sem confirmação da unidade.', 'Confirmar códigos de aviamentos e da etiqueta superior no arquivo em maior resolução. Composição e tabela de medidas não informadas.'],
  },
];

const output = fileURLToPath(new URL('../apps/web/public/codex-extractions/', import.meta.url));
await mkdir(output, { recursive: true });
for (const sample of samples) {
  const bytes = await readFile(new URL(`../apps/web/public/examples/${sample.id}.png`, import.meta.url));
  const legacyFicha = LegacyFichaSchema.parse({ ...emptyFicha(), ...sample.fields });
  const extraction = ExtractionResultSchema.parse({ ficha: normalizeFicha(legacyFicha), warnings: [...sample.warnings, 'Campos convertidos do formato anterior. Reextraia para conferir modelagem literal, aplicações e aviamentos.'] });
  const data = { version: 2, sourceFileName: `${sample.id}.png`, imageSha256: createHash('sha256').update(bytes).digest('hex'), extraction, legacyFicha };
  await writeFile(new URL(`${sample.id}.json`, `file:///${output.replaceAll('\\', '/')}`), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Leitura Codex preparada: ${sample.id} (aguardando revisão)`);
}
