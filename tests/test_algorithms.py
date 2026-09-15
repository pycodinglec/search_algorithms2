import hashlib
import json
import runpy
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from build_traces import ALGORITHMS, EXAMPLES, record

class AlgorithmTests(unittest.TestCase):
    def test_uploaded_input_contract(self):
        example = EXAMPLES['uploaded']
        self.assertEqual(len(example['map']), 8)
        self.assertEqual(len(example['cost']), 8)
        self.assertTrue(all(len(row) == 12 for row in example['map'] + example['cost']))
        self.assertTrue(all(c in '123456789' for row in example['cost'] for c in row))
        self.assertEqual(''.join(example['map']).count('s'), 1)
        self.assertEqual(''.join(example['map']).count('d'), 1)

    def test_cli_file_io_and_all_published_traces(self):
        for key, (filename, label) in ALGORITHMS.items():
            for name, example in EXAMPLES.items():
                for mode in (False, True):
                    with self.subTest(algorithm=key, example=name, no_cost=mode), tempfile.TemporaryDirectory() as tmp:
                        folder = Path(tmp)
                        (folder / 'map4.txt').write_text('\n'.join(example['map'])+'\n')
                        (folder / 'cost4.txt').write_text('\n'.join(example['cost'])+'\n')
                        source = ROOT / filename
                        if not mode:
                            command = [sys.executable, '-B', str(source)]
                        else:
                            code = "import runpy; m=runpy.run_path(%r); m['main'].__globals__['NO_COST_MODE']=True; m['main']()" % str(source)
                            command = [sys.executable, '-B', '-c', code]
                        result = subprocess.run(command, cwd=tmp, capture_output=True, text=True, timeout=10)
                        self.assertEqual(result.returncode, 0, result.stderr)
                        saved = json.loads((ROOT / 'data' / f'{key}-{name}-{int(mode)}.json').read_text())
                        self.assertEqual(saved['source'], source.read_text())
                        self.assertEqual(saved['sha256'], hashlib.sha256(source.read_bytes()).hexdigest())
                        self.assertEqual(saved['states'][-1]['output'], result.stdout)
                        self.assertEqual(saved, record(key, example, mode))
                        self.assertTrue(all(0 <= event['line'] <= len(source.read_text().splitlines()) for event in saved['events']))
                        if name == 'blocked': self.assertIn('탐색 실패(경로 없음)', result.stdout)
                        if name == 'uploaded':
                            self.assertIn(f'총 비용 {21 if mode else 81}', result.stdout)
                        if name == 'basic':
                            expected = 4 if mode else 11 if key == 'greedy' else 5
                            self.assertIn(f'총 비용 {expected}', result.stdout)

if __name__ == '__main__':
    unittest.main(verbosity=2)
