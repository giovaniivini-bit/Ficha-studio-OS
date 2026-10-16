'use client';
import { useEffect, useState } from 'react';
import { emptyFicha, LegacyFichaSchema } from '@app/shared';
import { useExtractFicha, useFichaConfig } from '@/lib/queries/fichas';
import { ImagePanel } from './components/ficha/ImagePanel';
import { FichaForm } from './components/ficha/FichaForm';
import { DocumentPreview } from './components/ficha/DocumentPreview';
import { Library } from './components/ficha/Library';
import { examples } from './components/ficha/examples';
import { CodexImport } from './components/ficha/CodexImport';
import { bindExtraction, downloadJson, editRecordFicha, hasFichaContent, parseCodexImport, reviewedDataset } from './components/ficha/codex';
import { BackupSchema, deleteRecord, importRecords, listRecords, readImage, RecordSchema, saveRecord, type FichaRecord } from './components/ficha/storage';
function fresh(): FichaRecord { return { id: crypto.randomUUID(), updatedAt: new Date().toISOString(), fileName: '', image: '', ficha: emptyFicha(), warnings: [], example: false }; }
function message(error: unknown) { return error instanceof Error ? error.message : 'Ocorreu um erro. Tente novamente.'; }
export default function HomeClient() {
  const [record, setRecord] = useState<FichaRecord | null>(null);
  const [records, setRecords] = useState<FichaRecord[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const config = useFichaConfig();
  const extraction = useExtractFicha();
  const locked = busy || extraction.isPending;
  const needsMigration = Boolean(record && LegacyFichaSchema.safeParse(record.ficha).success);
  useEffect(() => {
    if (!record || !LegacyFichaSchema.safeParse(record.ficha).success) return;
    const migrated = RecordSchema.safeParse(record);
    if (migrated.success) { setRecord(migrated.data); setDirty(true); setNotice('Rascunho atualizado para os novos campos. O original foi preservado. Revise e salve quando estiver pronto.'); }
    else setError('Não foi possível atualizar o rascunho. Exporte o backup e confira os dados originais.');
  }, [record]);
  async function loadCodexReading(index: number) {
    if (locked || !canLeave()) return;
    setBusy(true); setError('');
    try {
      const example = examples[index]!;
      const imageResponse = await fetch(example.image);
      if (!imageResponse.ok) throw new Error('Não foi possível abrir a imagem.');
      const blob = await imageResponse.blob();
      const fileName = example.image.split('/').pop()!;
      const image = await readImage(new File([blob], fileName, { type: blob.type || 'image/png' }));
      const response = await fetch(`/codex-extractions/${fileName.replace('.png', '.json')}`);
      if (!response.ok) throw new Error('Leitura do Codex ainda indisponível.');
      const data = await parseCodexImport(await response.json(), image);
      setRecord({ ...fresh(), image, fileName: data.sourceFileName, ficha: data.extraction.ficha, warnings: data.extraction.warnings, legacyFicha: data.legacyFicha ?? data.legacyInitialExtraction?.ficha, provenance: { source: 'codex', imageSha256: data.imageSha256, initialExtraction: data.extraction, reviewed: false, legacyInitialExtraction: data.legacyInitialExtraction } });
      setDirty(true); setPreview(false); setNotice('Codex — aguardando revisão. Esta leitura foi realizada nesta conversa; nenhum processamento novo foi executado.');
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  useEffect(() => { setRecord(current => current ?? fresh()); void listRecords().then(setRecords).catch(e => setError(message(e))); }, []);
  useEffect(() => { const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  function canLeave() { return !dirty || window.confirm('Há alterações não salvas. Deseja descartá-las?'); }
  function open(next: FichaRecord) { if (!locked && canLeave()) { setRecord(next); setDirty(false); setPreview(false); setNotice(''); setError(''); } }
  async function upload(file: File) {
    if (locked || !canLeave()) return;
    setBusy(true); setError('');
    try { const image = await readImage(file); setRecord({ ...fresh(), image, fileName: file.name }); setDirty(true); setPreview(false); setNotice('Imagem carregada. Extraia com IA ou preencha os campos manualmente.'); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function loadExample(index: number) {
    if (locked || !canLeave()) return;
    setBusy(true); setError('');
    try { const example = examples[index]!; const response = await fetch(example.image); if (!response.ok) throw new Error('Não foi possível abrir a imagem de exemplo.'); const blob = await response.blob(); const image = await readImage(new File([blob], example.image.split('/').pop()!, { type: blob.type || 'image/png' })); setRecord({ ...fresh(), image, fileName: example.title, ficha: { ...example.ficha }, example: true, warnings: ['Exemplo demonstrativo: transcrição manual, sem extração por IA. Confira textos e códigos no original.'] }); setDirty(true); setPreview(false); setNotice(''); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function extract() {
    if (!record?.image || locked) return;
    if (hasFichaContent(record.ficha) && !window.confirm('A extração substituirá os campos preenchidos. Deseja continuar?')) return;
    const current = record;
    const provider = config.data?.provider;
    if (!config.data?.configured || !provider) { setError('Extrator indisponível. Confira a configuração e a autenticação no servidor.'); return; }
    setBusy(true); setError(''); setNotice('');
    try { const result = await extraction.mutateAsync({ image: current.image, fileName: current.fileName || 'ficha.png' }); setRecord(await bindExtraction(current, result, provider)); setDirty(true); setNotice('Extração concluída. Revise os campos antes de salvar.'); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function save() {
    if (!record || locked) return;
    setBusy(true); setError('');
    try { const next = { ...record, updatedAt: new Date().toISOString() }; await saveRecord(next); setRecord(next); setDirty(false); setRecords(await listRecords()); setNotice('Ficha salva neste navegador.'); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function remove(item: FichaRecord) {
    if (!window.confirm(`Excluir a ficha ${item.ficha.reference || item.fileName || 'sem título'} do navegador?`)) return;
    setBusy(true); setError('');
    try { await deleteRecord(item.id); setRecords(await listRecords()); if (record?.id === item.id) { setRecord({ ...record, id: crypto.randomUUID() }); setDirty(true); setNotice('Ficha removida da biblioteca. O conteúdo aberto foi preservado como novo rascunho; salvar criará uma nova ficha.'); } else { setNotice('Ficha removida da biblioteca.'); } } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  function backup() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, fichas: records }, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'ficha-studio-backup.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('Backup das fichas salvas exportado. Alterações não salvas não são incluídas.');
  }
  async function restore(file: File) {
    setError('');
    if (file.size > 100 * 1024 * 1024) { setError('O backup deve ter no máximo 100 MB.'); return; }
    setBusy(true);
    try { const parsed = BackupSchema.parse(JSON.parse(await file.text())); const existing = new Set(records.map(r => r.id)); if (parsed.fichas.some(r => existing.has(r.id)) && !window.confirm('O backup contém fichas já salvas. Deseja substituí-las pelas versões do backup?')) return; await importRecords(parsed.fichas); setRecords(await listRecords()); setNotice(`${parsed.fichas.length} ficha(s) importada(s).`); } catch { setError('Backup inválido ou armazenamento indisponível. Use um JSON exportado pelo Ficha Studio.'); } finally { setBusy(false); }
  }
  if (!record || needsMigration) return <main className="app-shell"><p role="status">Atualizando seu espaço de trabalho sem descartar o rascunho…</p>{error && <p role="alert">{error}</p>}</main>;
  const badgeText = config.isPending
    ? 'Verificando IA…'
    : config.data?.configured
      ? (config.data.provider === 'gemini' ? 'Gemini Flash disponível' : config.data.provider === 'codex' ? 'Codex local disponível' : 'Anthropic disponível')
      : 'Modo assistido';
  const providerDescription = config.data?.provider === 'gemini'
    ? 'Ao extrair, a imagem será analisada pelo Gemini Flash via Antigravity local (ou GEMINI_API_KEY configurada no servidor).'
    : config.data?.provider === 'codex'
      ? 'Ao extrair, a imagem será enviada ao serviço Codex/OpenAI usando a conta autenticada neste computador. Não é processamento offline. Este modo local exige configuração própria em outro servidor ou VPS.'
      : 'Ao extrair, a imagem será enviada ao serviço Anthropic com a credencial configurada no servidor.';
  return <><main className="app-shell no-print"><header className="topbar"><div className="brand">Ficha Studio<small>DO ORIGINAL AO PADRÃO</small></div><span className="status-badge" title="O provedor configurado processa a imagem em serviço remoto; o aplicativo local coordena o envio.">{badgeText}</span></header><section className="intro"><div><span>DESENVOLVIMENTO DE PRODUTO</span><h1>Sua ficha técnica, padronizada.</h1><p>Transforme suas referências em informações técnicas padronizadas, com o original sempre à vista.</p></div></section><div className="toolbar"><div className="actions"><button type="button" disabled={locked} onClick={() => open(fresh())}>Nova ficha</button><button type="button" className="primary" disabled={locked || !record.image || !config.data?.configured} onClick={() => void extract()}>{extraction.isPending ? 'Extraindo informações…' : 'Extrair com IA'}</button><details><summary>Importação assistida alternativa</summary><CodexImport onBusyChange={setBusy} image={record.image} disabled={locked} onImport={data => { if (hasFichaContent(record.ficha) && !window.confirm('Substituir os campos atuais pela leitura do Codex?')) return; setRecord({ ...record, fileName: data.sourceFileName, ficha: data.extraction.ficha, warnings: data.extraction.warnings, example: false, legacyFicha: data.legacyFicha ?? data.legacyInitialExtraction?.ficha, provenance: { source: 'codex', imageSha256: data.imageSha256, initialExtraction: data.extraction, reviewed: false, legacyInitialExtraction: data.legacyInitialExtraction } }); setDirty(true); setNotice('Codex — aguardando revisão. Confira e aprove os dados antes de exportar para o extrator.'); }} /></details><button type="button" disabled={locked} onClick={() => void save()}>Salvar ficha{dirty ? ' •' : ''}</button></div><div className="actions"><button type="button" disabled={locked} onClick={() => setPreview(!preview)}>{preview ? 'Voltar à edição' : 'Prévia da ficha'}</button><button type="button" disabled={locked} onClick={() => { document.body.classList.add('is-printing'); window.print(); document.body.classList.remove('is-printing'); }}>Imprimir / PDF</button></div></div>{config.data?.configured && <p>{providerDescription}</p>}{!config.isPending && !config.data?.configured && <p className="notice" data-tone="warning">{config.isError ? 'API indisponível. Verifique se o servidor está iniciado. ' : 'O extrator não está pronto. Confira se o Antigravity (Gemini Flash) está aberto ou configure GEMINI_API_KEY no servidor. '}Use a leitura assistida ou preencha manualmente. <button type="button" disabled={config.isFetching} onClick={() => void config.refetch()}>{config.isFetching ? 'Verificando…' : 'Verificar conexão'}</button></p>}{record.legacyFicha && <details className="notice"><summary>Dados originais anteriores à atualização de campos</summary><p>Conversão conservadora: confira MODELAGEM, ETIQUETA, cores e aplicações. Os valores originais permanecem disponíveis abaixo.</p><pre>{JSON.stringify(record.legacyFicha, null, 2)}</pre></details>}{record.provenance && <div className="notice"><strong>{record.provenance.source === 'gemini' ? 'Gemini Flash' : 'Codex'} — {record.provenance.reviewed ? 'dados aprovados para o extrator' : 'aguardando revisão'}</strong><p>A aprovação prepara exemplos revisados. Nenhum treinamento automático. Edições posteriores exigem nova aprovação.</p><button type="button" disabled={locked || record.provenance.reviewed || !record.image} onClick={() => { if (!window.confirm('Confirma que revisou todos os campos e deseja aprová-los como exemplo para o extrator?')) return; setRecord({ ...record, provenance: { ...record.provenance!, reviewed: true } }); setDirty(true); setNotice('Dados aprovados. Salve a ficha para incluí-la no dataset exportado.'); }}>Aprovar dados para o extrator</button></div>}{error && <p className="notice" data-tone="error" role="alert">{error}</p>}{notice && <p className="notice" data-tone="success" role="status">{notice}</p>}{record.warnings.length > 0 && <aside className="notice" data-tone="warning"><strong>Pontos para conferir</strong><ul>{record.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></aside>}{preview ? <div className="preview-surface"><DocumentPreview record={record} /></div> : <div className="workspace"><ImagePanel image={record.image} fileName={record.fileName} onUpload={file => void upload(file)} disabled={locked} /><FichaForm ficha={record.ficha} disabled={locked} onColorsChange={colors => { setRecord(editRecordFicha(record, { ...record.ficha, colors })); setDirty(true); }} onChange={(key, value) => { setRecord(editRecordFicha(record, { ...record.ficha, [key]: value })); setDirty(true); }} /></div>}<details><summary>Leituras anteriores do Codex e exemplos</summary><section className="examples"><div className="section-heading"><h2>Leituras do Codex para revisar</h2><p>Leituras realizadas nesta conversa. Estes botões carregam os resultados existentes; não executam nova extração.</p></div><div className="actions">{examples.map((example, index) => <button type="button" key={example.title} disabled={locked} onClick={() => void loadCodexReading(index)}>{example.title} — revisar leitura</button>)}</div></section><section className="examples"><div className="section-heading"><h2>Referências da sua coleção</h2><p>Exemplos demonstrativos com transcrição manual.</p></div><div className="example-list">{examples.map((example, i) => <button type="button" className="example-button" disabled={locked} key={example.title} onClick={() => void loadExample(i)}><img src={example.image} alt="" /><span>{example.title}</span><small>Abrir exemplo →</small></button>)}</div></section></details><Library records={records} disabled={locked} onOpen={open} onDelete={item => void remove(item)} /><div className="toolbar"><p>Dados neste navegador. Limpar os dados do site remove a biblioteca.</p><div className="actions"><button type="button" disabled={locked || reviewedDataset(records).examples.length === 0} onClick={() => { downloadJson(reviewedDataset(records), 'ficha-studio-dataset-revisado.json'); setNotice('Dataset exportado somente com fichas salvas e aprovadas. Nenhum treinamento foi iniciado.'); }}>Exportar dataset revisado ({reviewedDataset(records).examples.length})</button><button type="button" disabled={locked || records.length === 0} onClick={backup}>Exportar backup</button><label className="button file-input-label">Importar backup<input type="file" aria-label="Importar backup JSON" accept="application/json,.json" disabled={locked} onChange={e => { const file = e.target.files?.[0]; if (file) void restore(file); e.target.value = ''; }} /></label></div></div></main><div className="print-only"><DocumentPreview record={record} /></div></>;
}
