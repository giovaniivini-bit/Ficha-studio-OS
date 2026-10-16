import { useState } from 'react';
import { parseCodexImport } from './codex';
export function CodexImport({ image, disabled, onImport, onBusyChange }: { image: string; disabled: boolean; onImport: (data: Awaited<ReturnType<typeof parseCodexImport>>) => void; onBusyChange: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function load(file: File) {
    setBusy(true); onBusyChange(true); setError('');
    try { if (file.size > 1024 * 1024) throw new Error('A extração JSON deve ter no máximo 1 MB.'); const result = await parseCodexImport(JSON.parse(await file.text()), image); onImport(result); } catch (e) { setError(e instanceof Error ? e.message : 'JSON inválido.'); } finally { setBusy(false); onBusyChange(false); }
  }
  return <div><label className="button file-input-label">{busy ? 'Conferindo imagem…' : 'Importar extração do Codex'}<input type="file" accept="application/json,.json" aria-label="Importar extração do Codex" disabled={disabled || busy || !image} onChange={event => { const file = event.target.files?.[0]; if (file) void load(file); event.target.value = ''; }} /></label>{error && <p className="notice" data-tone="error" role="alert">{error}</p>}</div>;
}
