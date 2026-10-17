import { describe, it, expect } from 'vitest';
import { parseRuleSheet, matchRules, normalizeRuleText, CatalogSchema } from './catalog';

const cells = [['MALHA', 'composição', 'codigo', 'gramatura', 'largura', 'observação'], ['meia malha penteada', '100% co', '00145', '155', '1,8m', 'fio nacional'], ['ribana 2x1', '97%co / 3% oue', '1123343', '255', '80 cm', 'complemento'], ['ribana 2x1', '97%co / 3% oue', '33335', '245', '80 cm', 'complemento']];
describe('Catálogo de regras de malhas', () => {
  it('mantém informação literal, código textual, origem e nomes duplicados', () => {
    const result = parseRuleSheet(cells, 'teste.xlsx', 'Planilha1');
    expect(result.errors).toEqual([]);
    expect(result.rules).toHaveLength(3);
    expect(result.rules[0]).toMatchObject({ code: '00145', weight: '155', composition: '100% co', source: { file: 'teste.xlsx', sheet: 'Planilha1', row: 2 } });
    expect(matchRules(' RIBANA 2x1 ', result.rules)).toHaveLength(2);
    expect(matchRules('33335', result.rules)).toHaveLength(1);
    expect(matchRules('meia malha', result.rules)).toHaveLength(0);
    expect(matchRules('ribana 2x1', [{ ...result.rules[0]!, code: 'ribana 2x1' }, result.rules[1]!])).toHaveLength(2);
  });
  it('rejeita planilha sem cabeçalho, linhas incompletas e códigos repetidos', () => {
    expect(parseRuleSheet([['x']], 'f.xlsx', 'A').errors.length).toBeGreaterThan(0);
    expect(parseRuleSheet([...cells, ['ribana', '', '33335']], 'f.xlsx', 'A').errors.join(' ')).toMatch(/repetido/);
    expect(parseRuleSheet([cells[0]!, ['malha', '', '']], 'f.xlsx', 'A').errors.join(' ')).toMatch(/código/);
    expect(CatalogSchema.safeParse({}).success).toBe(false);
    expect(normalizeRuleText(' Gorgurão ')).toBe('gorgurao');
  });
});
