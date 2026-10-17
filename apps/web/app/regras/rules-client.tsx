'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { matchRules, normalizeRuleText, type FabricCatalog, type FabricRule } from '@/lib/rules/catalog';
import { readRuleWorkbook, previewRuleSheet, type RuleSheet } from '@/lib/rules/import-xlsx';
import { approveCatalog, listCatalogs } from '@/lib/rules/storage';
import { downloadJson } from '../components/ficha/codex';

function RuleTable({ rules, onNameChange }: { rules: FabricRule[]; onNameChange?: (row: number, value: string) => void }) {
  return <div className="rules-table-scroll"><table className="rules-table"><thead><tr>{['Malha', 'Composição', 'Código', 'Gramatura (como na fonte)', 'Largura', 'Observação', 'Origem'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{rules.map(rule => <tr key={`${rule.source.row}-${rule.code}`}><td>{onNameChange ? <input aria-label={`Nome da malha — código ${rule.code}`} value={rule.name} maxLength={4000} onChange={event => onNameChange(rule.source.row, event.target.value)} /> : rule.name}{rule.sourceName && rule.sourceName !== rule.name && <small> Original: {rule.sourceName}</small>}</td><td>{rule.composition}</td><td>{rule.code}</td><td>{rule.weight}</td><td>{rule.width}</td><td>{rule.notes}</td><td>{rule.source.sheet}, linha {rule.source.row}</td></tr>)}</tbody></table></div>;
}
function message(error: unknown) { return error instanceof Error ? error.message : 'Não foi possível concluir a operação.'; }
export default function RulesClient() {
  const [catalogs, setCatalogs] = useState<FabricCatalog[]>([]);
  const [workbook, setWorkbook] = useState<{ sheets: RuleSheet[]; sha256: string } | null>(null);
  const [fileName, setFileName] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [query, setQuery] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [names, setNames] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { void listCatalogs().then(setCatalogs).catch(e => setError(message(e))).finally(() => setLoading(false)); }, []);
  const active = catalogs[0];
  const selected = workbook?.sheets.find(sheet => sheet.name === sheetName);
  const preview = selected ? previewRuleSheet(selected, fileName) : null;
  const previewRules = preview?.rules.map(rule => names[rule.source.row] !== undefined ? { ...rule, sourceName: rule.name, name: names[rule.source.row]! } : rule) ?? [];
  const previewErrors = [...(preview?.errors ?? []), ...previewRules.filter(rule => !rule.name.trim()).map(rule => `Linha ${rule.source.row}: informe o nome da malha.`)];
  const repeatedNames = previewRules.filter((rule, index, rules) => rules.findIndex(other => normalizeRuleText(other.name) === normalizeRuleText(rule.name)) !== index);
  const matches = active ? matchRules(query, active.rules) : [];
  async function upload(file: File) {
    setBusy(true); setError(''); setNotice(''); setConfirmed(false); setWorkbook(null); setNames({});
    try {
      const loaded = await readRuleWorkbook(file);
      setWorkbook(loaded); setFileName(file.name);
      setSheetName(loaded.sheets.find(sheet => !previewRuleSheet(sheet, file.name).errors.length)?.name ?? loaded.sheets[0]?.name ?? '');
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function approve() {
    if (!preview || previewErrors.length || !confirmed || !workbook) return;
    setBusy(true); setError('');
    try {
      const catalog: FabricCatalog = { version: 1, id: crypto.randomUUID(), approvedAt: new Date().toISOString(), sourceSha256: workbook.sha256, rules: previewRules };
      await approveCatalog(catalog);
      setCatalogs(await listCatalogs()); setWorkbook(null); setConfirmed(false);
      setNotice('Catálogo aprovado e salvo neste navegador. Nenhuma ficha foi alterada.');
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <main className="app-shell rules-page">
    <header className="topbar"><div className="brand">Ficha Studio<small>REGRAS</small></div><nav aria-label="Módulos"><Link href="/">Fichas</Link><span aria-current="page">Regras</span></nav></header>
    <section className="intro"><div><h1>Regras de preenchimento</h1><p>Cadastre e confira as informações técnicas antes de utilizá-las. Primeira versão: malhas.</p></div></section>
    <p className="notice">Processamento local, sem envio da planilha à IA. O cadastro fica neste navegador; exporte um backup para não perder seus dados. O catálogo de malhas é consultado na etapa 4 das fichas. Regras de costura ainda não estão conectadas.</p>
    {error && <p role="alert" className="notice" data-tone="error">{error}</p>}{notice && <p role="status" className="notice">{notice}</p>}
    <section className="form-panel rules-section"><h2>1. Importar planilha de malhas</h2><p>Colunas: MALHA, composição, código, gramatura, largura e observação. Valores são preservados como escritos, sem converter abreviações ou inferir unidades.</p>
      <label className="button file-input-label">Selecionar planilha XLSX<input type="file" accept=".xlsx" aria-label="Importar planilha de malhas" disabled={busy || loading} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ''; }} /></label>
      {busy && <p role="status">Processando…</p>}
      {workbook && <><label className="field"><span>Aba da planilha</span><select value={sheetName} disabled={busy} onChange={event => { setSheetName(event.target.value); setConfirmed(false); setNames({}); }}>{workbook.sheets.map(sheet => <option key={sheet.name} value={sheet.name}>{sheet.name}</option>)}</select></label>
        <h3>2. Conferir e aprovar — {fileName}</h3>{preview && <>
          <p>{preview.rules.length} malhas encontradas. Nomes repetidos não são descartados.</p>
          {previewErrors.map((item, i) => <p role="alert" key={i}>{item}</p>)}{repeatedNames.map((rule, i) => <p className="notice" data-tone="warning" key={i}>Nome repetido: {rule.name}. Confira o código correto na consulta.</p>)}
          <p>Você pode corrigir o nome da malha antes de aprovar. O nome original da planilha fica preservado.</p><RuleTable rules={previewRules} onNameChange={(row, name) => { setNames(current => ({ ...current, [row]: name })); setConfirmed(false); }} />
          <label><input type="checkbox" checked={confirmed} disabled={busy || previewErrors.length > 0} onChange={event => setConfirmed(event.target.checked)} /> Conferi os dados desta aba e aprovo seu uso como novo catálogo de malhas.</label>
          <p>O novo catálogo passa a ser o ativo; as versões anteriores continuam preservadas.</p>
          <button className="primary" type="button" disabled={busy || !confirmed || previewErrors.length > 0} onClick={() => void approve()}>Aprovar e salvar catálogo</button>
        </>}</>}
    </section>
    <section className="form-panel rules-section"><h2>Catálogo aprovado</h2>{loading ? <p>Carregando…</p> : active ? <>
      <p>{active.rules.length} malhas · aprovado em {new Date(active.approvedAt).toLocaleString('pt-BR')} · {active.rules[0]?.source.file}</p><RuleTable rules={active.rules} />
      <button type="button" onClick={() => downloadJson({ version: 1, catalogs }, 'ficha-studio-regras-backup.json')}>Exportar backup das regras</button>
      <h3>Testar correspondência</h3><label className="field"><span>Nome completo ou código da malha</span><input value={query} maxLength={4000} onChange={event => setQuery(event.target.value)} placeholder="Ex.: meia malha penteada ou ribana 2x1" /></label>
      {query.trim() && <>{matches.length === 0 ? <p>Nenhuma correspondência exata. Não será preenchido automaticamente.</p> : matches.length > 1 ? <p className="notice" data-tone="warning">Há {matches.length} opções. É necessário escolher o código correto; o app não seleciona a primeira.</p> : <p>Uma correspondência exata encontrada.</p>}{matches.length > 0 && <RuleTable rules={matches} />}</>}
    </> : <p>Nenhum catálogo aprovado. Importe e confira uma planilha acima.</p>}</section>
    {catalogs.length > 1 && <details className="rules-section"><summary>Versões anteriores ({catalogs.length - 1})</summary>{catalogs.slice(1).map(catalog => <details key={catalog.id}><summary>{new Date(catalog.approvedAt).toLocaleString('pt-BR')} — {catalog.rules.length} malhas</summary><RuleTable rules={catalog.rules} /></details>)}</details>}
  </main>;
}
