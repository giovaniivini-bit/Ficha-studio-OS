import assert from 'node:assert/strict';
import { ColorSchema, FichaSchema, LegacyFichaSchema, migrateLegacyFicha, standardizeFicha, emptyFicha } from '../packages/shared/src/dto/ficha.ts';

const old = LegacyFichaSchema.parse({ ...Object.fromEntries(Object.keys(LegacyFichaSchema.shape).map(key => [key, ''])), product: 'Top MC D.200', season: 'WINTER I 2027 (CFC)', collection: 'C&A - BABY CLUB', line: 'BABY', colors: 'Cor 01 - Bright White 11-0601 (MC 791510); Cor 02 - 2026 Flint Stone 19-3916 (MC 7062615)', artwork: 'Estampa frontal Tiger Clan. Bordado de espuma 8mm por baixo do tigre.', trims: 'TAG BCI; Selo detalhe interativo', labels: '' });
const ficha = migrateLegacyFicha(old);
assert.equal(ficha.modeling, 'Top MC D.200');
assert.equal(ficha.season, 'WINTER I 2027');
assert.equal(ficha.labelCode, 'CFC');
assert.equal('line' in ficha, false);
assert.equal('product' in ficha, false);
assert.deepEqual(ficha.colors, [
  { number: '01', name: 'Bright White', pantone: '11-0601', code: 'MC 791510' },
  { number: '02', name: '2026 Flint Stone', pantone: '19-3916', code: 'MC 7062615' },
]);
assert.equal(ficha.print, 'Estampa frontal Tiger Clan.');
assert.equal(ficha.embroidery, 'Bordado de espuma 8mm por baixo do tigre.');
assert.equal(ficha.trim1, 'TAG BCI');
assert.equal(ficha.trim2, 'Selo detalhe interativo');
assert.equal(ficha.trim3, '');
assert.equal(ficha.trim4, '');
const ambiguous = migrateLegacyFicha({ ...old, artwork: 'Aplicação a definir.', trims: 'Item1; Item2; Item3; Item4; Item5' });
assert.equal(ambiguous.print, '');
assert.match(ambiguous.notes, /Aplicação a definir/);
assert.match(ambiguous.notes, /Item5/);
assert.equal(FichaSchema.safeParse({ ...emptyFicha(), colors: 'texto antigo' }).success, false);
assert.equal(ColorSchema.safeParse({ number: '01', name: 'Branco', pantone: '11-0601', code: 'MC 001', extra: 'x' }).success, false);
const normalized = standardizeFicha({ ...emptyFicha(), season: 'WINTER I 2027 (CFC)', collection: 'Baby Club (CFC)', colors: [{ number: '02', name: 'Flint Stone', pantone: '19-3916', code: '(MC 7062615)' }] });
assert.equal(normalized.labelCode, 'CFC');
assert.equal(normalized.collection, 'Baby Club');
assert.equal(normalized.colors[0]!.code, 'MC 7062615');
assert.deepEqual(standardizeFicha(normalized), normalized);
console.log('Campos v2: migração conservadora, modelagem, etiqueta, cores e operações verificadas.');
