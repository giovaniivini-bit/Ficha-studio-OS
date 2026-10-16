// Teste explícito: envia uma imagem de exemplo ao Codex pela API LOCAL do app.
// Usa a conta autenticada e limites do Codex. Não roda na suíte automática.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { ExtractionResultSchema } from '../packages/shared/src/dto/ficha.ts';

const bytes = await readFile(new URL('../apps/web/public/examples/camiseta-marvel.png', import.meta.url));
const started = Date.now();
const response = await fetch('http://localhost:3001/api/fichas/extract', {
  method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
  body: JSON.stringify({ image: `data:image/png;base64,${bytes.toString('base64')}`, fileName: 'camiseta-marvel.png' }),
  signal: AbortSignal.timeout(150_000),
});
const data: unknown = await response.json();
if (!response.ok) throw new Error(`Extração falhou (HTTP ${response.status}): ${JSON.stringify(data)}`);
const result = ExtractionResultSchema.parse(data);
if (result.ficha.reference !== '01.14.01.3221') throw new Error('Referência extraída diverge da amostra.');
await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(new URL('../data/codex-live-smoke.json', import.meta.url), JSON.stringify({ testedAt: new Date().toISOString(), elapsedMs: Date.now() - started, reviewed: false, result }, null, 2));
console.log(JSON.stringify({ status: response.status, elapsedMs: Date.now() - started, reference: result.ficha.reference, neckline: result.ficha.neckline, fields: Object.keys(result.ficha).length, warnings: result.warnings }, null, 2));
