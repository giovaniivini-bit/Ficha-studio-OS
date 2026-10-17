import { useEffect, useState } from 'react';
import { type Ficha } from '@app/shared';
import { approveReading, completeEnrichment, approveFinal, finishSaved } from '@/lib/workflow/flow';
import type { FichaRecord } from './storage';
import { editRecordFicha, hasFichaContent } from './codex';
import { FichaForm } from './FichaForm';
import { ImagePanel } from './ImagePanel';
import { DocumentPreview } from './DocumentPreview';
import { RulesEnrichment } from './RulesEnrichment';
import { fieldUpdates } from './field-presentation';

const STEPS = ['Imagem', 'Extração', 'Revisão', 'Regras', 'Aprovação final', 'Ficha salva'];
function catalogSummary(record: FichaRecord) {
  const enrichment = record.workflow?.enrichment;
  return [enrichment?.rule, enrichment?.secondaryMaterial?.rule].filter(Boolean).map(rule => `${rule!.source.file}, código ${rule!.code}`).join(' · ');
}
function initialStep(record: FichaRecord) { return record.workflow?.savedAt ? 6 : record.workflow?.enrichment ? 5 : record.workflow?.readApproved ? 4 : hasFichaContent(record.ficha) ? 3 : record.image ? 2 : 1; }
export function FichaWorkflow({ record, disabled, aiAvailable, onRecordChange, onUpload, onExtract, onSaveFinal }: {
  record: FichaRecord; disabled: boolean; aiAvailable: boolean; onRecordChange: (record: FichaRecord) => void;
  onUpload: (file: File) => void; onExtract: () => Promise<boolean | void>; onSaveFinal: (record: FichaRecord) => Promise<boolean>;
}) {
  const [step, setStep] = useState(() => initialStep(record));
  const [finalConfirmed, setFinalConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [manual, setManual] = useState(record.workflow?.mode === 'manual');
  const locked = disabled || saving;
  useEffect(() => { setStep(initialStep(record)); setManual(record.workflow?.mode === 'manual'); setFinalConfirmed(false); setError(''); }, [record.id]);
  const workflow = record.workflow;
  useEffect(() => {
    if (step === 4 && !workflow?.readApproved || step >= 5 && !workflow?.enrichment) { setStep(initialStep(record)); setFinalConfirmed(false); }
    else if (step === 6 && !workflow?.savedAt) setStep(initialStep(record));
  }, [workflow, step]);
  const readFicha = workflow?.readApproved?.ficha ?? record.ficha;
  const complete = [Boolean(record.image), !manual && Boolean(record.provenance), Boolean(workflow?.readApproved), Boolean(workflow?.enrichment), Boolean(workflow?.finalApprovedAt), Boolean(workflow?.savedAt)];
  function canVisit(target: number) { return target <= 1 || target === 2 && Boolean(record.image) || target === 3 && (manual || hasFichaContent(record.ficha)) || target === 4 && Boolean(workflow?.readApproved) || target === 5 && Boolean(workflow?.enrichment) || target === 6 && Boolean(workflow?.savedAt); }
  function edit(ficha: Ficha) { onRecordChange(editRecordFicha(record, ficha)); setFinalConfirmed(false); }
  async function finish() {
    if (!finalConfirmed || !workflow?.enrichment || locked) return;
    setSaving(true); setError('');
    try {
      const next: FichaRecord = { ...record, ficha: workflow.enrichment.after, workflow: finishSaved(approveFinal(workflow)), provenance: record.provenance ? { ...record.provenance, reviewed: true } : undefined };
      if (await onSaveFinal(next)) setStep(6); else setError('Não foi possível salvar a ficha final. Os dados continuam neste rascunho; tente novamente.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar a ficha final.'); } finally { setSaving(false); }
  }
  return <section className="ficha-workflow" aria-label="Etapas da ficha">
    <div className="workflow-trail"><div className="workflow-trail-heading"><h2>Sua ficha, etapa por etapa</h2><p>Etapa {step} de 6 · {STEPS[step - 1]}</p></div><ol>{STEPS.map((label, index) => <li key={label} data-state={step === index + 1 ? 'current' : complete[index] ? 'complete' : 'pending'}><button type="button" aria-current={step === index + 1 ? 'step' : undefined} disabled={locked || !canVisit(index + 1)} onClick={() => { setStep(index + 1); setError(''); }}><span className="workflow-dot">{index + 1}</span><span>{label}</span><small>{index === 5 && workflow?.savedAt ? 'Concluída' : step === index + 1 ? 'Em andamento' : complete[index] ? 'Concluída' : index === 1 && manual ? 'Manual' : index === 0 && manual ? 'Sem imagem' : 'Pendente'}</small></button></li>)}</ol></div>
    {error && <p role="alert" className="notice" data-tone="error">{error}</p>}
    {step === 1 && <div className="workflow-panel"><h2>1. Enviar imagem</h2><p>Escolha a imagem original da ficha. Ela será preservada durante a revisão.</p><ImagePanel image={record.image} fileName={record.fileName} onUpload={onUpload} disabled={locked} /><div className="actions"><button type="button" className="primary" disabled={locked || !record.image} onClick={() => setStep(2)}>Avançar para extração</button><button type="button" disabled={locked} onClick={() => { setManual(true); setStep(3); }}>Preencher manualmente</button></div></div>}
    {step === 2 && <div className="form-panel workflow-panel"><h2>2. Extrair informações</h2><p>A IA lê apenas a imagem. As informações do catálogo serão acrescentadas depois da sua aprovação.</p><p>{record.fileName}</p>{!aiAvailable && <p>IA indisponível. Use a importação assistida acima ou continue com preenchimento manual.</p>}<div className="actions"><button type="button" disabled={locked} onClick={() => setStep(1)}>Voltar à imagem</button><button type="button" className="primary" disabled={locked || !aiAvailable || !record.image} onClick={async () => { const ok = await onExtract(); if (ok) { setManual(false); setStep(3); } }}>Extrair com IA e avançar</button><button type="button" disabled={locked} onClick={() => { setManual(true); setStep(3); }}>Preencher manualmente</button>{hasFichaContent(record.ficha) && <button type="button" disabled={locked} onClick={() => setStep(3)}>Revisar dados existentes</button>}</div></div>}
    {step === 3 && <><div className="workflow-panel"><h2>3. Revisar e aprovar a leitura</h2><p>Confira somente o que aparece na imagem. Composição, gramatura e códigos do catálogo entram na etapa seguinte.</p>{workflow?.readApproved && <p>Leitura já aprovada. Voltar não apaga dados; editar qualquer campo exige nova aprovação das próximas etapas.</p>}</div><div className="workspace"><ImagePanel image={record.image} fileName={record.fileName} onUpload={onUpload} disabled={locked} /><FichaForm ficha={readFicha} disabled={locked} onColorsChange={colors => edit({ ...readFicha, colors })} onChange={(key, value) => edit({ ...readFicha, ...fieldUpdates(key, value) })} /></div><div className="workflow-actions"><button type="button" disabled={locked} onClick={() => setStep(record.image ? 2 : 1)}>Voltar</button><button type="button" className="primary" disabled={locked || !hasFichaContent(readFicha)} onClick={() => { onRecordChange({ ...record, ficha: readFicha, workflow: approveReading(readFicha, manual ? 'manual' : 'image', workflow), provenance: record.provenance ? { ...record.provenance, reviewed: false } : undefined }); setFinalConfirmed(false); setStep(4); }}>Aprovar leitura e consultar regras</button></div></>}
    {workflow?.readApproved && <div hidden={step !== 4}><RulesEnrichment key={`${record.id}-${workflow.readApproved.at}`} workflow={workflow} disabled={locked} onDraftChange={draft => { onRecordChange({ ...record, ficha: workflow.readApproved!.ficha, workflow: { mode: workflow.mode, readApproved: workflow.readApproved, ruleDraft: draft, previousFinal: workflow.enrichment?.after ?? workflow.previousFinal }, provenance: record.provenance ? { ...record.provenance, reviewed: false } : undefined }); setFinalConfirmed(false); }} onContinue={(ficha, metadata) => { onRecordChange({ ...record, ficha, workflow: completeEnrichment(workflow, ficha, metadata) }); setFinalConfirmed(false); setStep(5); }} /><button type="button" disabled={locked} onClick={() => setStep(3)}>Voltar à revisão</button></div>}
    {step === 5 && workflow?.enrichment && <><div className="form-panel workflow-panel"><h2>5. Aprovação final</h2><p>{workflow.enrichment.skipped ? 'Você escolheu continuar sem complementos do catálogo.' : `Complementos conferidos a partir do cadastro ${catalogSummary(record)}.`}</p><label><input type="checkbox" checked={finalConfirmed} disabled={locked} onChange={event => setFinalConfirmed(event.target.checked)} /> Conferi a ficha final e aprovo as informações para salvar.</label><div className="workflow-actions"><button type="button" disabled={locked} onClick={() => setStep(4)}>Voltar às regras</button><button type="button" className="primary" disabled={locked || !finalConfirmed} onClick={() => void finish()}>Aprovar e salvar ficha final</button></div></div><div className="preview-surface"><DocumentPreview record={record} /></div></>}
    {step === 6 && workflow?.savedAt && <><div className="form-panel workflow-panel"><h2>Ficha final salva</h2><p>A ficha foi salva neste navegador. A leitura aprovada e a origem dos complementos foram preservadas separadamente.</p><p>Os exemplos revisados podem apoiar o desenvolvimento do extrator Python. Nenhum modelo foi treinado automaticamente.</p><button type="button" disabled={locked} onClick={() => setStep(5)}>Voltar à ficha final</button></div><div className="preview-surface"><DocumentPreview record={record} /></div></>}
  </section>;
}
