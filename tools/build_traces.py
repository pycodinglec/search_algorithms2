"""Record the unmodified teaching files with CPython, for static browser playback."""
import contextlib
import hashlib
import io
import json
import math
from pathlib import Path
import runpy
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
ALGORITHMS = {'dfs': ('깊이우선탐색.py', '깊이우선탐색'), 'bfs': ('너비우선탐색.py', '너비우선탐색'), 'greedy': ('최상우선탐색.py', '최상우선탐색'), 'astar': ('a_star.py', 'A*')}
EXAMPLES = {
    'basic': {'name': '비용이 다른 3 × 3', 'map': ['s00', '000', '0d0'], 'cost': ['183', '274', '115']},
    'maze': {'name': '벽을 돌아가는 4 × 5', 'map': ['s0100', '00100', '00010', '0100d'], 'cost': ['12345', '29132', '11121', '31211']},
    'uploaded': {'name': '복잡한 지도 8 × 12', 'map': (ROOT / 'examples/uploaded/map.txt').read_text().splitlines(), 'cost': (ROOT / 'examples/uploaded/cost.txt').read_text().splitlines()},
    'blocked': {'name': '도착할 수 없는 지도', 'map': ['s10', '111', '01d'], 'cost': ['111', '111', '111']},
}

def clean(value):
    if isinstance(value, float) and not math.isfinite(value):
        return '∞'
    if isinstance(value, (list, tuple)):
        return [clean(v) for v in value]
    if isinstance(value, dict):
        return {str(k): clean(v) for k, v in value.items()}
    return value

def record(algorithm, example, no_cost):
    filename, label = ALGORITHMS[algorithm]
    path = ROOT / filename
    source = path.read_text()
    module = runpy.run_path(str(path))
    output = io.StringIO()
    events, states, state_ids = [], [], {}
    remembered = {'board': [], 'queue': [], 'order': [], 'path': [], 'current': None}
    variables = {'위치', '현재위치', '행', '열', '다음행', '다음열', '행변화', '열변화', '화살표', '새비용', '현재칸', '이웃칸', '일치노드찾음', '후보위치', '순번', '노드정보', '출발점', '도착점', '총비용', '비용무시', '행번호', '열번호', '각칸의정보', '목표행', '목표열', '시작행', '시작열', '행개수', '열개수'}
    def snapshot(frame):
        stack = []
        frames = []
        cursor = frame
        while cursor:
            if cursor.f_code.co_filename == str(path):
                frames.append(cursor)
                stack.append(cursor.f_code.co_name)
            cursor = cursor.f_back
        for f in reversed(frames):
            local = f.f_locals
            board = local.get('지도', local.get('완성지도'))
            if isinstance(board, list) and len(board) == len(example['map']) and all(isinstance(row, list) and len(row) == len(example['map'][0]) for row in board):
                remembered['board'] = [[[c['g'], c['직전']] for c in row] for row in board]
            for key, name in [('후보', 'queue'), ('탐색순서', 'order'), ('경로', 'path'), ('현재위치', 'current')]:
                if key in local:
                    remembered[name] = local[key]
        state = clean({**remembered, 'output': output.getvalue()})
        encoded = json.dumps(state, ensure_ascii=False, separators=(',', ':'))
        if encoded not in state_ids:
            state_ids[encoded] = len(states)
            states.append(state)
        local_values = {k: clean(v) for k, v in frame.f_locals.items() if k in variables}
        return {'line': frame.f_lineno, 'fn': frame.f_code.co_name, 'stack': list(reversed(stack)), 'vars': local_values, 'state': state_ids[encoded]}
    def trace(frame, event, arg):
        if frame.f_code.co_filename != str(path):
            return None
        if event == 'line':
            events.append(snapshot(frame))
        return trace
    with tempfile.TemporaryDirectory() as tmp:
        mp, cp = Path(tmp) / 'map.txt', Path(tmp) / 'cost.txt'
        mp.write_text('\n'.join(example['map']) + '\n')
        cp.write_text('\n'.join(example['cost']) + '\n')
        module['main'].__globals__.update(MAP_FILE=str(mp), COST_FILE=str(cp), NO_COST_MODE=no_cost)
        with contextlib.redirect_stdout(output):
            sys.settrace(trace)
            try:
                module['main']()
            finally:
                sys.settrace(None)
    final = clean({**remembered, 'output': output.getvalue()})
    states.append(final)
    events.append({'line': 0, 'fn': '실행 완료', 'stack': [], 'vars': {}, 'state': len(states) - 1})
    start = next(i for i, e in enumerate(events) if e['fn'] == '탐색')
    stops = [start] + [i for i, e in enumerate(events) if e['fn'] == '탐색' and source.splitlines()[e['line'] - 1].strip() == '행, 열 = 현재위치'] + [len(events) - 1]
    return {'filename': filename, 'algorithm': algorithm, 'label': label, 'source': source, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'example': example, 'noCost': no_cost, 'events': events, 'states': states, 'searchStart': start, 'stops': stops}

def main():
    directory = ROOT / 'data'
    directory.mkdir(exist_ok=True)
    manifest = {'algorithms': {}, 'examples': EXAMPLES, 'python': sys.version.split()[0]}
    for key, (filename, label) in ALGORITHMS.items():
        manifest['algorithms'][key] = {'filename': filename, 'label': label, 'lines': len((ROOT / filename).read_text().splitlines())}
        for example, spec in EXAMPLES.items():
            for no_cost in (False, True):
                data = record(key, spec, no_cost)
                target = directory / f'{key}-{example}-{int(no_cost)}.json'
                target.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False))
                print(target.name, len(data['events']), 'steps', target.stat().st_size, 'bytes')
    (directory / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
