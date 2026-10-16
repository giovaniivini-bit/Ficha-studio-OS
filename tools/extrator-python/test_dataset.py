import base64
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from dataset import FIELDS, prepare, split_hashes, validate_dataset


def example(suffix=b'', **changes):
    raw = b'\x89PNG\r\n\x1a\n' + suffix
    ficha = dict.fromkeys(FIELDS, '')
    ficha['modeling'] = 'Top MC D.200 – bebê'
    ficha['colors'] = []
    result = {
        'reviewed': True, 'imageSha256': hashlib.sha256(raw).hexdigest(),
        'image': 'data:image/png;base64,' + base64.b64encode(raw).decode('ascii'),
        'initialExtraction': {'ficha': dict(ficha), 'warnings': []}, 'ficha': ficha,
    }
    result.update(changes)
    return result


class DatasetTests(unittest.TestCase):
    def test_hash_mismatch(self):
        with self.assertRaisesRegex(ValueError, 'hash não corresponde'):
            validate_dataset({'version': 2, 'examples': [example(imageSha256='a' * 64)]})

    def test_explicit_review_required(self):
        for reviewed in (False, None, 1, 'true'):
            with self.subTest(reviewed=reviewed), self.assertRaisesRegex(ValueError, 'reviewed'):
                validate_dataset({'version': 2, 'examples': [example(reviewed=reviewed)]})
        item = example()
        del item['reviewed']
        with self.assertRaisesRegex(ValueError, 'reviewed'):
            validate_dataset({'version': 2, 'examples': [item]})

    def test_same_hash_variants_cannot_leak(self):
        examples = [example(bytes([i])) for i in range(10)]
        duplicate = example(bytes([3]))
        duplicate['ficha']['notes'] = 'Revisão alternativa'
        examples.append(duplicate)
        valid = validate_dataset({'version': 2, 'examples': examples})
        splits = split_hashes(valid)
        train = {e['imageSha256'] for e in valid if splits[e['imageSha256']] == 'train'}
        validation = {e['imageSha256'] for e in valid if splits[e['imageSha256']] == 'validation'}
        self.assertTrue(train)
        self.assertTrue(validation)
        self.assertFalse(train & validation)
        self.assertEqual(splits, split_hashes(list(reversed(valid))))

    def test_unicode_pairs_metrics_and_no_overwrite(self):
        item = example()
        item['ficha']['notes'] = 'Bainha: atenção à revisão – 1,5 cm'
        with tempfile.TemporaryDirectory() as temp:
            source, output = Path(temp) / 'dataset.json', Path(temp) / 'prepared'
            source.write_text(json.dumps({'version': 2, 'examples': [item]}, ensure_ascii=False), encoding='utf-8')
            metrics = prepare(source, output)
            text = (output / 'train.jsonl').read_text(encoding='utf-8')
            self.assertIn('atenção', text)
            pair = json.loads(text)
            self.assertEqual(pair['corrections']['notes']['reviewed'], item['ficha']['notes'])
            self.assertEqual(metrics['correctedFields'], 1)
            self.assertEqual(metrics['fields']['notes']['exactMatches'], 0)
            self.assertEqual(metrics['fields']['modeling']['exactMatchRate'], 1)
            self.assertTrue(metrics['warnings'])
            original = (output / 'train.jsonl').read_bytes()
            with self.assertRaises(FileExistsError):
                prepare(source, output)
            self.assertEqual((output / 'train.jsonl').read_bytes(), original)

    def test_invalid_ficha_mime_and_limits(self):
        for item in (example(ficha={'reference': '123'}), example(image='data:image/jpeg;base64,iVBORw0KGgo='), example(image='data:image/png;base64,%%%')):
            with self.assertRaises(ValueError):
                validate_dataset({'version': 2, 'examples': [item]})
        huge = example()
        huge['image'] = 'data:image/png;base64,' + base64.b64encode(b'\x89PNG\r\n\x1a\n' + b'x' * (10 * 1024 * 1024)).decode()
        with self.assertRaisesRegex(ValueError, '10 MB'):
            validate_dataset({'version': 2, 'examples': [huge]})

    def test_empty_input_is_not_ground_truth(self):
        with self.assertRaises(ValueError):
            validate_dataset({'version': 2, 'examples': []})

    def test_legacy_requires_reapproval_before_any_output(self):
        with tempfile.TemporaryDirectory() as temp:
            source, output = Path(temp) / 'legacy.json', Path(temp) / 'output'
            source.write_text(json.dumps({'version': 1, 'examples': [example()]}), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'aprove e exporte dataset v2'):
                prepare(source, output)
            self.assertFalse(output.exists())

    def test_structured_colors_exact_metrics_and_raw_legacy_metadata(self):
        item = example()
        item['initialExtraction']['ficha']['colors'] = [{'number': '01', 'name': 'Azul', 'pantone': '14-4112', 'code': 'MC 4060288'}]
        item['ficha']['colors'] = [{'number': '01', 'name': 'Skyway', 'pantone': '14-4112', 'code': 'MC 4060288'}]
        item['legacyFicha'] = {'original': 'preservado sem interpretação'}
        with tempfile.TemporaryDirectory() as temp:
            source, output = Path(temp) / 'v2.json', Path(temp) / 'output'
            source.write_text(json.dumps({'version': 2, 'examples': [item]}), encoding='utf-8')
            metrics = prepare(source, output)
            self.assertEqual(metrics['fields']['colors']['corrections'], 1)
            self.assertEqual(metrics['fields']['colors']['exactMatchRate'], 0)
            pair = json.loads((output / 'train.jsonl').read_text(encoding='utf-8'))
            self.assertEqual(pair['legacyFicha'], item['legacyFicha'])
            self.assertEqual(pair['schemaVersion'], 2)
        item['ficha']['colors'][0]['number'] = ''
        with self.assertRaisesRegex(ValueError, 'cor inválidos'):
            validate_dataset({'version': 2, 'examples': [item]})


if __name__ == '__main__':
    unittest.main()
