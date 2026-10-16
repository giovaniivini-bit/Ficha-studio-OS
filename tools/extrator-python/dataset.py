"""Prepare reviewed image/label pairs; no extraction or model training is performed."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re

SCALAR_FIELDS = (
    'reference', 'secondaryCode', 'modeling', 'client', 'collection', 'season',
    'labelCode', 'sizes', 'designer', 'mainMaterial', 'composition', 'weight',
    'complementaryMaterials', 'construction', 'seams', 'neckline',
    'hems', 'measurements', 'print', 'embroidery', 'applique', 'artworkReference',
    'trim1', 'trim2', 'trim3', 'trim4', 'labels',
    'changes', 'notes',
)
FIELDS = SCALAR_FIELDS + ('colors',)
MAX_IMAGE_BYTES = 10 * 1024 * 1024


def validate_ficha(value):
    if not isinstance(value, dict) or set(value) != set(FIELDS):
        raise ValueError('Ficha deve conter exatamente os campos do DTO compartilhado.')
    if any(not isinstance(value[k], str) or len(value[k]) > 8000 for k in SCALAR_FIELDS):
        raise ValueError('Campos da ficha devem ser strings de até 8000 caracteres.')
    colors = value['colors']
    if not isinstance(colors, list) or len(colors) > 50:
        raise ValueError('colors deve ser uma lista de até 50 cores.')
    for color in colors:
        if not isinstance(color, dict) or set(color) != {'number', 'name', 'pantone', 'code'}:
            raise ValueError('Cor deve conter number, name, pantone e code.')
        if any(not isinstance(v, str) or len(v) > 8000 for v in color.values()) or not 1 <= len(color['number']) <= 20:
            raise ValueError('Campos de cor inválidos.')
    return {key: value[key] for key in FIELDS}


def validate_dataset(root):
    if isinstance(root, dict) and type(root.get('version')) is int and root['version'] == 1:
        raise ValueError('Dataset v1: importe o backup no app, confira os novos campos, aprove e exporte dataset v2. Aprovação antiga não valida novos campos.')
    if not isinstance(root, dict) or type(root.get('version')) is not int or root['version'] != 2:
        raise ValueError('Versão do dataset inválida; esperado version: 2.')
    examples = root.get('examples')
    if not isinstance(examples, list) or not examples:
        raise ValueError('Dataset deve conter ao menos um exemplo revisado.')
    validated = []
    for index, example in enumerate(examples):
        if not isinstance(example, dict) or example.get('reviewed') is not True:
            raise ValueError(f'Exemplo {index}: exige reviewed: true explícito.')
        digest = example.get('imageSha256')
        if not isinstance(digest, str) or not re.fullmatch(r'[a-fA-F0-9]{64}', digest):
            raise ValueError(f'Exemplo {index}: imageSha256 inválido.')
        image = example.get('image')
        if not isinstance(image, str) or len(image) > 15_000_000:
            raise ValueError(f'Exemplo {index}: imagem ausente ou excessiva.')
        match = re.fullmatch(r'data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)', image)
        if not match:
            raise ValueError(f'Exemplo {index}: use dataURI PNG, JPEG ou WebP base64.')
        try:
            raw = base64.b64decode(match[2], validate=True)
        except ValueError as error:
            raise ValueError(f'Exemplo {index}: base64 inválido.') from error
        if not raw or len(raw) > MAX_IMAGE_BYTES or base64.b64encode(raw).decode('ascii') != match[2]:
            raise ValueError(f'Exemplo {index}: imagem vazia, não canônica ou acima de 10 MB.')
        mime = match[1]
        valid_signature = (
            mime == 'png' and raw.startswith(b'\x89PNG\r\n\x1a\n')
            or mime == 'jpeg' and raw.startswith(b'\xff\xd8\xff')
            or mime == 'webp' and len(raw) >= 12 and raw[:4] == b'RIFF' and raw[8:12] == b'WEBP'
        )
        if not valid_signature:
            raise ValueError(f'Exemplo {index}: assinatura não corresponde ao MIME.')
        digest = digest.lower()
        if hashlib.sha256(raw).hexdigest() != digest:
            raise ValueError(f'Exemplo {index}: hash não corresponde aos bytes da imagem.')
        initial = example.get('initialExtraction')
        if not isinstance(initial, dict) or set(initial) != {'ficha', 'warnings'}:
            raise ValueError(f'Exemplo {index}: initialExtraction inválida.')
        warnings = initial['warnings']
        if not isinstance(warnings, list) or len(warnings) > 50 or any(not isinstance(w, str) or len(w) > 2000 for w in warnings):
            raise ValueError(f'Exemplo {index}: warnings inválidos.')
        validated.append({
            'imageSha256': digest, 'bytes': raw, 'extension': 'jpg' if mime == 'jpeg' else mime,
            'initialExtraction': {'ficha': validate_ficha(initial['ficha']), 'warnings': warnings},
            'ficha': validate_ficha(example.get('ficha')), 'sourceIndex': index,
            'legacyFicha': example.get('legacyFicha'),
            'legacyInitialExtraction': example.get('legacyInitialExtraction'),
        })
    return validated


def split_hashes(examples):
    """Fixed seed ranking over UNIQUE image hashes; variants always share a split."""
    hashes = sorted({e['imageSha256'] for e in examples}, key=lambda h: hashlib.sha256(('ficha-studio-v1:' + h).encode()).hexdigest())
    count = max(1, len(hashes) // 5) if len(hashes) >= 2 else 0
    validation = set(hashes[:count])
    return {digest: 'validation' if digest in validation else 'train' for digest in hashes}


def baseline_metrics(examples):
    fields = {}
    for key in FIELDS:
        matches = sum(e['initialExtraction']['ficha'][key] == e['ficha'][key] for e in examples)
        nonempty = [e for e in examples if e['initialExtraction']['ficha'][key] or e['ficha'][key]]
        fields[key] = {
            'exactMatches': matches, 'total': len(examples), 'corrections': len(examples) - matches,
            'exactMatchRate': matches / len(examples),
            'nonemptyComparisons': len(nonempty),
            'nonemptyExactMatches': sum(e['initialExtraction']['ficha'][key] == e['ficha'][key] for e in nonempty),
        }
    unique = len({e['imageSha256'] for e in examples})
    return {
        'label': 'Linha de base Codex inicial versus revisão humana; não é acurácia de extrator Python.',
        'comparison': 'Igualdade exata de strings e lista de cores estruturada, incluindo ordem e vazios; sem normalização.',
        'examples': len(examples), 'uniqueImages': unique,
        'correctedFields': sum(f['corrections'] for f in fields.values()), 'fields': fields,
        'warnings': (['Poucos dados: menos de 20 imagens únicas. Métricas descritivas, sem evidência de generalização.'] if unique < 20 else [])
        + (['Variantes da mesma imagem são contadas nas métricas; não são observações independentes.'] if unique < len(examples) else [])
        + (['Só exemplos marcados reviewed:true foram aceitos; revisão humana não garante ausência de erros.']),
    }


def prepare(input_path, output_path):
    input_path, output_path = Path(input_path), Path(output_path)
    # Validate everything before creating output; never open existing files for writing.
    examples = validate_dataset(json.loads(input_path.read_text(encoding='utf-8-sig')))
    assignments = split_hashes(examples)
    metrics = baseline_metrics(examples)
    metrics['split'] = {name: {'examples': sum(assignments[e['imageSha256']] == name for e in examples), 'uniqueImages': sum(s == name for s in assignments.values())} for name in ('train', 'validation')}
    output_path.mkdir(parents=True, exist_ok=False)
    images = output_path / 'images'
    images.mkdir()
    written = set()
    with (output_path / 'train.jsonl').open('x', encoding='utf-8') as train, (output_path / 'validation.jsonl').open('x', encoding='utf-8') as validation:
        for example in examples:
            digest = example['imageSha256']
            relative = f"images/{digest}.{example['extension']}"
            if digest not in written:
                with (output_path / relative).open('xb') as target:
                    target.write(example['bytes'])
                written.add(digest)
            pair = {
                'schemaVersion': 2,
                'reviewed': True, 'imageSha256': digest, 'imagePath': relative,
                'origin': {'source': 'codex-chat-reviewed', 'datasetFile': input_path.name, 'exampleIndex': example['sourceIndex']},
                'initialExtraction': example['initialExtraction'], 'ficha': example['ficha'],
                'corrections': {key: {'initial': example['initialExtraction']['ficha'][key], 'reviewed': example['ficha'][key]} for key in FIELDS if example['initialExtraction']['ficha'][key] != example['ficha'][key]},
            }
            for legacy_key in ('legacyFicha', 'legacyInitialExtraction'):
                if example[legacy_key] is not None:
                    pair[legacy_key] = example[legacy_key]
            stream = train if assignments[digest] == 'train' else validation
            stream.write(json.dumps(pair, ensure_ascii=False) + '\n')
    with (output_path / 'metrics.json').open('x', encoding='utf-8') as target:
        json.dump(metrics, target, ensure_ascii=False, indent=2)
        target.write('\n')
    return metrics


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    try:
        metrics = prepare(args.input, args.output)
    except (ValueError, OSError) as error:
        parser.exit(1, f'Dataset não preparado: {error}\n')
    print(json.dumps(metrics, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
