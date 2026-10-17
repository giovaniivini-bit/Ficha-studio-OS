import { fieldValue, colorTitle, hasInformation } from './field-presentation';
import type { FichaRecord } from './storage';
import { normalizeRuleText } from '../../../lib/rules/catalog';

// Split only an explicitly labelled code; never guess from arbitrary numbers.
function descriptionCode(value: string) {
  if (!hasInformation(value)) return ['', ''];
  const match = value.match(/^(.*?)\s*\(?c[óo]d(?:igo)?[.:]?\s+([^\n)]+)\)?\s*$/i);
  return match ? [match[1]!.trim(), match[2]!.trim()] : [value, ''];
}
function DetailTable({ label, headers, rows }: { label: string; headers: string[]; rows: string[][] }) {
  const visible = rows.filter(row => row.some(hasInformation));
  const columns = headers.map((_, index) => visible.some(row => hasInformation(row[index] ?? '')));
  if (!visible.length) return null;
  return <div className="document-table-scroll"><table className="document-table" style={{ minWidth: columns.filter(Boolean).length * 90 }} aria-label={label}><thead><tr>{headers.map((header, i) => columns[i] && <th scope="col" key={header}>{header}</th>)}</tr></thead>
    <tbody>{visible.map((row, i) => <tr key={i}>{headers.map((header, j) => columns[j] && <td key={header}>{hasInformation(row[j] ?? '') ? row[j] : ''}</td>)}</tr>)}</tbody></table></div>;
}
function DetailSection({ title, children, visible }: { title: string; children: React.ReactNode; visible: boolean }) {
  return visible ? <section><h2>{title}</h2>{children}</section> : null;
}

function visibleColors(colors: FichaRecord['ficha']['colors']) {
  return colors.filter(color => [color.number, color.name, color.pantone, color.code].some(hasInformation));
}
function ColorTable({ colors }: { colors: FichaRecord['ficha']['colors'] }) {
  const rows = visibleColors(colors);
  if (!rows.length) return null;
  const title = rows.some(color => hasInformation(color.number) || hasInformation(color.name));
  const pantone = rows.some(color => hasInformation(color.pantone));
  const code = rows.some(color => hasInformation(color.code));
  return <div className="document-colors"><table aria-label="Cores">
    <thead><tr>{title && <th>Cor e nome</th>}{pantone && <th>Pantone</th>}{code && <th>Código</th>}</tr></thead>
    <tbody>{rows.map((color, index) => <tr key={index}>
      {title && <td>{hasInformation(color.number) ? colorTitle({ ...color, name: hasInformation(color.name) ? color.name : '' }) : hasInformation(color.name) ? color.name : ''}</td>}
      {pantone && <td>{hasInformation(color.pantone) ? color.pantone : ''}</td>}
      {code && <td>{hasInformation(color.code) ? color.code : ''}</td>}
    </tr>)}</tbody>
  </table></div>;
}

export function DocumentPreview({ record }: { record: FichaRecord }) {
  const ficha = record.ficha;
  const client = fieldValue(ficha, 'client', true);
  const primary = descriptionCode(ficha.mainMaterial);
  const secondary = descriptionCode(ficha.complementaryMaterials);
  const rule = record.workflow?.enrichment;
  const confirmedRule = rule && !rule.skipped && rule.after.mainMaterial === ficha.mainMaterial && rule.rule && (primary[1] === rule.rule.code || normalizeRuleText(primary[0] ?? '') === normalizeRuleText(rule.rule.name)) ? rule.rule : undefined;
  const secondaryRule = rule && !rule.skipped && rule.secondaryMaterial?.description === ficha.complementaryMaterials ? rule.secondaryMaterial.rule : undefined;
  const materialNotes = confirmedRule ? [
    confirmedRule.width && ficha.notes.includes(`Largura: ${confirmedRule.width}`) ? `Largura: ${confirmedRule.width}` : '',
    confirmedRule.notes && ficha.notes.includes(`Observações da malha: ${confirmedRule.notes}`) ? confirmedRule.notes : '',
  ].filter(Boolean).join('\n') : '';
  const trims = [ficha.trim1, ficha.trim2, ficha.trim3, ficha.trim4].flatMap((value, i) => hasInformation(value) ? [[`Aviamento ${i + 1}`, ...descriptionCode(value)]] : []);
  const seams = fieldValue(ficha, 'seams', true);
  return <article className="print-document" aria-label="Ficha técnica para impressão">
    <header className="document-header"><div><p>FICHA STUDIO / FICHA TÉCNICA</p><h1>{hasInformation(ficha.modeling) ? ficha.modeling : 'Ficha técnica'}</h1></div><div>{hasInformation(ficha.reference) && <strong>{ficha.reference}</strong>}{client && <p>{client}</p>}</div></header>
    {record.provenance && <p>Origem: {record.provenance.source === 'gemini' ? 'Gemini Flash' : 'Codex'} — {record.provenance.reviewed ? 'dados aprovados pelo usuário' : 'aguardando revisão'}.</p>}
    {record.example && <p>EXEMPLO DEMONSTRATIVO — transcrição de referência. Conferir antes de produção.</p>}
    {record.image && <img className="document-image" src={record.image} alt="Imagem original da peça" />}
    <div className="document-fields">
      <DetailSection title="Identificação" visible={[client, ficha.reference, ficha.secondaryCode, ficha.sizes, ficha.modeling, ficha.labelCode].some(hasInformation)}>
        {client && <div className="document-field"><strong>Cliente / marca / coleção / estação / ano</strong><p>{client}</p></div>}
        <DetailTable label="Identificação — referências" headers={['Referência', 'Código secundário', 'Grade de tamanhos']} rows={[[ficha.reference, ficha.secondaryCode, ficha.sizes]]} />
        <DetailTable label="Identificação — modelagem" headers={['MODELAGEM', 'ETIQUETA']} rows={[[ficha.modeling, ficha.labelCode]]} />
      </DetailSection>
      <DetailSection title="Materiais" visible={[ficha.mainMaterial, ficha.composition, ficha.weight, ficha.complementaryMaterials].some(hasInformation)}>
        <DetailTable label="Materiais" headers={['Material', 'Descrição', 'Composição', 'Gramatura', 'Código', 'Observação']} rows={[
          ...([ficha.mainMaterial, ficha.composition, ficha.weight].some(hasInformation) ? [['Material principal', primary[0]!, ficha.composition, ficha.weight, primary[1] || confirmedRule?.code || '', materialNotes]] : []),
          ...(hasInformation(ficha.complementaryMaterials) ? [['Material secundário', secondary[0]!, secondaryRule?.composition ?? '', secondaryRule?.weight ?? '', secondaryRule?.code ?? secondary[1]!, secondaryRule ? [secondaryRule.width && `Largura: ${secondaryRule.width}`, secondaryRule.notes].filter(Boolean).join('\n') : '']] : []),
        ]} />
      </DetailSection>
      {visibleColors(ficha.colors).length > 0 && <section><h2>Cores</h2><ColorTable colors={ficha.colors} /></section>}
      <DetailSection title="Construção e acabamentos" visible={[seams, ficha.neckline, ficha.construction, ficha.measurements].some(hasInformation)}>
        <DetailTable label="Construção e acabamentos" headers={['Costuras e bainhas', 'Golas e acabamentos', 'Construção / recortes', 'Medidas indicadas']} rows={[[seams, ficha.neckline, ficha.construction, ficha.measurements]]} />
      </DetailSection>
      <DetailSection title="Aviamentos" visible={trims.length > 0 || hasInformation(ficha.labels)}>
        <DetailTable label="Aviamentos" headers={['Aviamento', 'Descrição', 'Código']} rows={trims} />
        <DetailTable label="Outras informações de etiquetas" headers={['Outras informações de etiquetas']} rows={[[ficha.labels]]} />
      </DetailSection>
      <DetailSection title="Estampas" visible={[ficha.print, ficha.embroidery, ficha.applique, ficha.artworkReference].some(hasInformation)}>
        <DetailTable label="Estampas" headers={['Estampa e descrição', 'Bordado', 'Aplique', 'Referência de arte']} rows={[[ficha.print, ficha.embroidery, ficha.applique, ficha.artworkReference]]} />
      </DetailSection>
      <DetailSection title="Observações e revisão" visible={[ficha.changes, ficha.notes].some(hasInformation)}>
        <DetailTable label="Observações e revisão" headers={['Alterações solicitadas', 'Observações técnicas']} rows={[[ficha.changes, ficha.notes]]} />
      </DetailSection>
    </div>
    {record.warnings.length > 0 && <section><h2>Pontos de conferência</h2>{record.warnings.map((w, i) => <p key={i}>{w}</p>)}</section>}
    <footer>Gerado em {new Date(record.updatedAt).toLocaleDateString('pt-BR')} · Validar os dados antes da produção.</footer>
  </article>;
}
