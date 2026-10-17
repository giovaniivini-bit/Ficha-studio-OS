import { type Ficha, type FichaColor, type FieldKey } from '@app/shared';
import { useEffect, useRef, useState } from 'react';
import { PRESENTATION_GROUPS, fieldValue, colorTitle, parseColorTitle } from './field-presentation';

function ColorNameInput({ color, index, onChange }: { color: FichaColor; index: number; onChange: (color: FichaColor) => void }) {
  const [text, setText] = useState(colorTitle(color));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(colorTitle(color)); }, [color.number, color.name]);
  return <label className="field"><span>Cor e nome — cor {index + 1}</span><input aria-label={`Cor e nome — cor ${index + 1}`} value={text} maxLength={8000} onFocus={() => { focused.current = true; }} onBlur={() => { focused.current = false; setText(colorTitle(color)); }} onChange={event => { setText(event.target.value); onChange(parseColorTitle(event.target.value, color)); }} /></label>;
}

export function FichaForm({ ficha, disabled, onChange, onColorsChange }: { ficha: Ficha; disabled: boolean; onChange: (key: FieldKey, value: string) => void; onColorsChange: (colors: FichaColor[]) => void }) {
  function replaceColor(index: number, color: FichaColor) {
    onColorsChange(ficha.colors.map((current, i) => i === index ? color : current));
  }
  return <section className="form-panel" aria-label="Revisão da ficha">
    <div className="panel-header"><span>02 / REVISÃO</span><h2>Informações da peça</h2><p>Confira os códigos e complete os campos ausentes.</p></div>
    <div className="form-fields">{PRESENTATION_GROUPS.map(group => <fieldset className="field-group" key={group.title} disabled={disabled}>
      <legend>{group.title}</legend>
      {group.fields.map(([key, label]) => <label className="field" key={key} htmlFor={`field-${key}`}><span>{label}</span><textarea id={`field-${key}`} value={fieldValue(ficha, key)} maxLength={8000} rows={2} placeholder="Não informado" onChange={e => onChange(key, e.target.value)} /></label>)}
      {group.title === 'Materiais e cores' && <div className="color-editor"><h3>Cores</h3>
        {ficha.colors.map((color, index) => <div className="color-row" key={index}>
          <div className="color-row-heading"><strong>{colorTitle(color)}</strong><button type="button" onClick={() => onColorsChange(ficha.colors.filter((_, i) => i !== index))} aria-label={`Remover cor ${color.number}`}>Remover</button></div>
          <ColorNameInput color={color} index={index} onChange={next => replaceColor(index, next)} />
          {([['pantone', 'Pantone'], ['code', 'Código']] as const).map(([key, label]) => <label className="field" key={key}><span>{label} — cor {index + 1}</span><input aria-label={`${label} — cor ${index + 1}`} value={color[key]} maxLength={8000} onChange={event => replaceColor(index, { ...color, [key]: event.target.value })} /></label>)}
        </div>)}
        <button type="button" disabled={ficha.colors.length >= 50} onClick={() => { const used = new Set(ficha.colors.map(color => color.number)); let next = ficha.colors.length + 1; while (used.has(String(next).padStart(2, '0'))) next++; onColorsChange([...ficha.colors, { number: String(next).padStart(2, '0'), name: '', pantone: '', code: '' }]); }}>Adicionar cor</button>
        <p>Edite no formato Cor 01 - Nome da cor. Pantone e código continuam separados.</p>
      </div>}
    </fieldset>)}</div>
  </section>;
}
