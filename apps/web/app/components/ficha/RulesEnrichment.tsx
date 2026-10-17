import { useEffect, useState } from 'react';
import { type Ficha } from '@app/shared';
import { matchRules, type FabricCatalog } from '@/lib/rules/catalog';
import { listCatalogs } from '@/lib/rules/storage';
import { applyMaterialChanges, buildMaterialChanges, matchSecondaryRules, type Workflow } from '@/lib/workflow/flow';

export function RulesEnrichment({ workflow, disabled, onContinue, onDraftChange }: { workflow: Workflow; disabled: boolean; onDraftChange: (draft: NonNullable<Workflow['ruleDraft']>) => void; onContinue: (ficha: Ficha, metadata: { catalog?: FabricCatalog; rule?: FabricCatalog['rules'][number]; secondaryRule?: FabricCatalog['rules'][number]; decisions: Record<string, 'keep' | 'rule'>; skipped: boolean }) => void }) {
  const [catalogs, setCatalogs] = useState<FabricCatalog[]>([]);
  const [catalogId, setCatalogId] = useState('');
  const [query, setQuery] = useState(workflow.ruleDraft?.query ?? workflow.readApproved?.ficha.mainMaterial ?? '');
  const [selectedCode, setSelectedCode] = useState(workflow.ruleDraft?.selectedCode ?? workflow.enrichment?.rule?.code ?? '');
  const [secondaryCode, setSecondaryCode] = useState(workflow.ruleDraft?.secondaryCode ?? workflow.enrichment?.secondaryMaterial?.rule.code ?? '');
  const [decisions, setDecisions] = useState<Record<string, 'keep' | 'rule'>>(workflow.ruleDraft?.decisions ?? workflow.enrichment?.decisions ?? {});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [skipConfirmed, setSkipConfirmed] = useState(false);
  const ficha = workflow.readApproved!.ficha;
  useEffect(() => {
    let alive = true;
    void listCatalogs().then(values => {
      if (!alive) return;
      setCatalogs(values);
      const catalog = values.find(value => value.id === (workflow.ruleDraft?.catalogId ?? workflow.enrichment?.catalogId)) ?? values[0];
      setCatalogId(catalog?.id ?? '');
      if (!workflow.ruleDraft && !workflow.enrichment && catalog) {
        const exact = matchRules(ficha.mainMaterial, catalog.rules);
        const code = exact.length === 1 ? exact[0]!.code : '';
        setSelectedCode(code);
        const secondaryMatches = matchSecondaryRules(ficha.complementaryMaterials, catalog.rules);
        const secondary = secondaryMatches.length === 1 ? secondaryMatches[0]!.code : '';
        setSecondaryCode(secondary);
        onDraftChange({ catalogId: catalog.id, query: ficha.mainMaterial, selectedCode: code, secondaryCode: secondary, decisions: {} });
      }
    }).catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Falha ao consultar regras.'); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  const catalog = catalogs.find(value => value.id === catalogId);
  const matches = catalog ? matchRules(query, catalog.rules) : [];
  const rule = catalog?.rules.find(value => value.code === selectedCode);
  const secondaryRule = catalog?.rules.find(value => value.code === secondaryCode);
  const changes = rule ? buildMaterialChanges(ficha, rule) : [];
  const unresolved = changes.some(change => change.conflict && !decisions[change.key]);
  function persist(nextCatalog: string, nextQuery: string, nextCode: string, nextDecisions: Record<string, 'keep' | 'rule'>) {
    onDraftChange({ catalogId: nextCatalog, query: nextQuery, selectedCode: nextCode, secondaryCode: nextCatalog === catalogId ? secondaryCode : '', decisions: nextDecisions });
  }
  function apply() {
    if ((!rule && !secondaryRule) || !catalog || unresolved) return;
    try { onContinue(rule ? applyMaterialChanges(ficha, rule, decisions) : ficha, { catalog, ...(rule ? { rule } : {}), ...(secondaryRule ? { secondaryRule } : {}), decisions, skipped: false }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Revise as decisões.'); }
  }
  return <section className="form-panel workflow-panel" aria-label="Complementação por regras">
    <h2>4. Completar com regras</h2><p>A leitura já foi aprovada. Os complementos da malha principal e do material secundário vêm do catálogo, não da imagem.</p>
    {loading && <p role="status">Consultando catálogo aprovado…</p>}{error && <p role="alert">{error}</p>}
    {!loading && !catalog && <p>Nenhum catálogo aprovado foi encontrado neste navegador. Abra <a href="/regras" target="_blank" rel="noopener noreferrer">Regras</a> para importar e aprovar a planilha; depois volte à etapa de revisão e consulte novamente.</p>}
    {catalog && <>
      <label className="field"><span>Versão do catálogo</span><select value={catalogId} disabled={disabled} onChange={event => { setCatalogId(event.target.value); setSelectedCode(''); setSecondaryCode(''); setDecisions({}); setSkipConfirmed(false); persist(event.target.value, query, '', {}); }}>{catalogs.map(value => <option key={value.id} value={value.id}>{value.rules[0]?.source.file} — {new Date(value.approvedAt).toLocaleString('pt-BR')}</option>)}</select></label>
      <label className="field"><span>Consultar malha por nome completo ou código</span><input value={query} maxLength={4000} disabled={disabled} onChange={event => { const text = event.target.value; setQuery(text); setDecisions({}); setSkipConfirmed(false); const exact = matchRules(text, catalog.rules); const code = exact.length === 1 ? exact[0]!.code : ''; setSelectedCode(code); persist(catalogId, text, code, {}); }} /></label>
      <p>{matches.length === 0 ? 'Nenhuma correspondência exata. Escolha uma malha do catálogo ou continue sem complementos.' : matches.length === 1 ? 'Correspondência exata encontrada. Confira o código e as sugestões.' : `${matches.length} correspondências. Escolha explicitamente o código correto.`}</p>
      <label className="field"><span>Malha selecionada no catálogo</span><select disabled={disabled} value={selectedCode} onChange={event => { setSelectedCode(event.target.value); setDecisions({}); setSkipConfirmed(false); persist(catalogId, query, event.target.value, {}); }}><option value="">Escolha uma malha</option>{catalog.rules.map(value => <option key={value.code} value={value.code}>{value.name} — código {value.code} — gramatura {value.weight || 'ausente'}</option>)}</select></label>
      {rule && <><p>Origem: {rule.source.file} · {rule.source.sheet}, linha {rule.source.row}. Gramatura e composição são preservadas como cadastradas, sem inferir unidades.</p>
        {changes.length === 0 ? <p>Os campos já coincidem com os dados cadastrados.</p> : <div className="rules-table-scroll"><table className="rules-table"><thead><tr><th>Campo</th><th>Leitura aprovada</th><th>Cadastro de regras</th><th>Decisão</th></tr></thead><tbody>{changes.map(change => <tr key={change.key}><th scope="row">{change.label}</th><td className="field-value">{change.before || 'Vazio'}</td><td className="field-value">{change.suggested}</td><td>{change.conflict ? <select aria-label={`Decisão — ${change.label}`} disabled={disabled} value={decisions[change.key] ?? ''} onChange={event => { const next = { ...decisions }; if (event.target.value === 'keep' || event.target.value === 'rule') next[change.key] = event.target.value; else delete next[change.key]; setDecisions(next); persist(catalogId, query, selectedCode, next); }}><option value="">Escolha uma opção</option><option value="keep">Manter leitura aprovada</option><option value="rule">Usar cadastro de regras</option></select> : 'Completar campo vazio'}</td></tr>)}</tbody></table></div>}
      </>}
      {ficha.complementaryMaterials.trim() && <fieldset className="field-group"><legend>Material secundário — ribana e outras malhas</legend><p>Leitura aprovada: {ficha.complementaryMaterials}</p>
        <label className="field"><span>Material secundário selecionado no catálogo</span><select disabled={disabled} value={secondaryCode} onChange={event => { const code = event.target.value; setSecondaryCode(code); setSkipConfirmed(false); onDraftChange({ catalogId, query, selectedCode, secondaryCode: code, decisions }); }}><option value="">Sem complementação do material secundário</option>{catalog.rules.map(value => <option key={value.code} value={value.code}>{value.name} — código {value.code} — gramatura {value.weight || 'ausente'}</option>)}</select></label>
        {secondaryRule ? <><p>Confira os complementos antes de avançar. A descrição original e a indicação de cor serão preservadas.</p><div className="rules-table-scroll"><table className="rules-table"><thead><tr><th>Malha</th><th>Composição</th><th>Gramatura</th><th>Código</th><th>Observação</th></tr></thead><tbody><tr><td>{secondaryRule.name}</td><td>{secondaryRule.composition}</td><td>{secondaryRule.weight}</td><td>{secondaryRule.code}</td><td>{[secondaryRule.width && `Largura: ${secondaryRule.width}`, secondaryRule.notes].filter(Boolean).join('\n')}</td></tr></tbody></table></div><p>Origem: {secondaryRule.source.file} · {secondaryRule.source.sheet}, linha {secondaryRule.source.row}.</p></> : <p>Escolha a malha correspondente ou mantenha o material secundário sem complementos. Nenhuma composição ou gramatura será inferida.</p>}
      </fieldset>}
      {(rule || secondaryRule) && <button type="button" className="primary" disabled={disabled || unresolved} onClick={apply}>Aplicar decisões e avançar</button>}
    </>}
    {!loading && <details className="workflow-skip"><summary>Continuar sem complementos do catálogo</summary><p>Os valores da leitura serão mantidos. A ausência de complementação ficará registrada na ficha.</p><label><input type="checkbox" checked={skipConfirmed} disabled={disabled} onChange={event => setSkipConfirmed(event.target.checked)} /> Desejo continuar sem aplicar regras de malhas.</label><button type="button" disabled={disabled || !skipConfirmed} onClick={() => onContinue(ficha, { decisions: {}, skipped: true })}>Continuar sem complementos</button></details>}
  </section>;
}
