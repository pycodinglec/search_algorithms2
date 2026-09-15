import math
import random
import runpy
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from build_traces import ALGORITHMS, EXAMPLES


def oracle(rows, costs, start):
    nodes = [(r, c) for r, row in enumerate(rows) for c, v in enumerate(row) if v != '1']
    edges = [(u, v) for u in nodes for v in nodes if abs(u[0]-v[0])+abs(u[1]-v[1]) == 1]
    distance = {u: math.inf for u in nodes}
    distance[start] = costs[start[0]][start[1]]
    for _ in range(len(nodes)-1):
        previous = distance.copy()
        for u, v in edges:
            distance[v] = min(distance[v], previous[u] + costs[v[0]][v[1]])
        if distance == previous:
            break
    return distance


class SearchSemanticsTests(unittest.TestCase):
    def check_case(self, key, rows, costs):
        filename = ROOT / ALGORITHMS[key][0]
        module = runpy.run_path(str(filename))
        board, start, goal = module['정보통합'](rows, costs)
        expected = oracle(rows, costs, start)
        lines = filename.read_text().splitlines()
        popped, destination_costs = [], []
        pending = None
        final_queue = None

        def trace(frame, event, arg):
            nonlocal pending, final_queue
            if frame.f_code.co_filename != str(filename) or frame.f_code.co_name != '탐색':
                return None
            local = frame.f_locals
            if event == 'return':
                final_queue = list(local['후보'])
            if event != 'line':
                return trace
            line = lines[frame.f_lineno-1].strip()
            if '.pop(' in line:
                queue = list(local['후보'])
                self.assertTrue(queue)
                positions = queue if key in ('dfs', 'bfs') else [item[0] for item in queue]
                self.assertEqual(len(positions), len(set(positions)))
                pending = positions[-1] if key == 'dfs' else positions[0]
                if key in ('greedy', 'astar'):
                    priorities = []
                    for position, saved in queue:
                        r, c = position
                        priority = math.dist(position, goal) + (board[r][c]['g'] if key == 'astar' else 0)
                        self.assertAlmostEqual(saved, priority)
                        priorities.append(priority)
                    self.assertEqual(priorities[0], min(priorities))
            elif line == '행, 열 = 현재위치':
                position = local['현재위치']
                self.assertEqual(position, pending)
                popped.append(position)
                if position == goal:
                    destination_costs.append(board[goal[0]][goal[1]]['g'])
            return trace

        sys.settrace(trace)
        try:
            board, order = module['탐색'](board, start, goal)
        finally:
            sys.settrace(None)
        self.assertEqual(order, popped)
        path = module['경로복원'](board, start, goal)
        if key in ('dfs', 'bfs'):
            self.assertEqual(final_queue, [])
            for (r, c), distance in expected.items():
                self.assertEqual(board[r][c]['g'], distance)
        elif path:
            self.assertEqual(order[-1], goal)
            self.assertEqual(order.count(goal), 1)
        else:
            self.assertEqual(final_queue, [])
        if key != 'greedy':
            self.assertEqual(board[goal[0]][goal[1]]['g'], expected[goal])
        self.assertEqual(bool(path), math.isfinite(expected[goal]))
        if path:
            self.assertEqual((path[0], path[-1]), (start, goal))
            self.assertEqual(len(path), len(set(path)))
            self.assertTrue(all(rows[r][c] != '1' for r, c in path))
            self.assertTrue(all(abs(a[0]-b[0])+abs(a[1]-b[1]) == 1 for a, b in zip(path, path[1:])))
            self.assertEqual(sum(costs[r][c] for r, c in path), board[goal[0]][goal[1]]['g'])
        return destination_costs, board[goal[0]][goal[1]]['g']

    def test_seeded_maps_against_independent_bellman_ford(self):
        rng = random.Random(20260915)
        fixtures = [('s0d', '000'), ('s00', '00d'), ('sd',), ('s', '0', 'd'), ('s1d',)]
        cases = [(list(rows), [[1 if v != '0' else 9 for v in row] for row in rows]) for rows in fixtures]
        for _ in range(300):
            height, width = rng.randint(1, 8), rng.randint(2, 9)
            rows = [['1' if rng.random() < .3 else '0' for _ in range(width)] for _ in range(height)]
            start, goal = rng.sample([(r, c) for r in range(height) for c in range(width)], 2)
            rows[start[0]][start[1]] = 's'
            rows[goal[0]][goal[1]] = 'd'
            cases.append((rows, [[rng.randint(1, 9) for _ in row] for row in rows]))
        for example in EXAMPLES.values():
            for uniform in (False, True):
                cases.append((example['map'], [[1 if uniform else int(v) for v in row] for row in example['cost']]))
        improved_after_goal = {key: False for key in ('dfs', 'bfs')}
        greedy_suboptimal = False
        for i, (rows, costs) in enumerate(cases):
            results = {}
            for key in ALGORITHMS:
                with self.subTest(case=i, algorithm=key):
                    arrivals, result = self.check_case(key, rows, costs)
                    results[key] = result
                    if key in improved_after_goal and arrivals and arrivals[0] > result:
                        improved_after_goal[key] = True
            greedy_suboptimal |= results['greedy'] > results['astar']
        self.assertTrue(all(improved_after_goal.values()), improved_after_goal)
        self.assertTrue(greedy_suboptimal)
        print(f'\nSemantic audit: {len(cases)} maps x 4 algorithms; post-goal improvements: {improved_after_goal}; greedy nonoptimal witnessed')


if __name__ == '__main__':
    unittest.main(verbosity=2)
