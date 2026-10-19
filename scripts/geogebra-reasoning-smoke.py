"""Run real TypeScript exports through the pinned native AG2 engine."""

import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import time

sys.stdout.reconfigure(encoding="utf-8")
sys.dont_write_bytecode = True  # Native checks must not add caches to static assets.

root = Path(__file__).resolve().parents[1]
vendor = root / "public" / "vendor" / "alphageometry2"
sys.path.insert(0, str(vendor))
sys.path.insert(0, str(root / "public" / "geometry-reasoning"))
from ag2_bridge import solve_json

generated = subprocess.run([
    "node", "node_modules/vite-node/vite-node.mjs", "scripts/geogebra-reasoning-fixtures.ts"
], cwd=root, check=True, capture_output=True, text=True, encoding="utf-8")
for case in json.loads(generated.stdout):
    answer = json.loads(solve_json(json.dumps(case["problem"])))
    assert answer["status"] == case["expected"], (case["name"], answer)
    if case["name"] == "coverage-positive-and-negative":
        assert answer["checks"] == [True, False], answer
    print(f"PASS {case['name']}: {answer['status']} ({answer['elapsedMs']} ms)")

# Upstream examples provide an independent check beyond our small fixtures.
spec = importlib.util.spec_from_file_location("ag2_examples", vendor / "test.py")
examples = importlib.util.module_from_spec(spec)
spec.loader.exec_module(examples)
from ddar import DDAR
from parse import AGProblem

for name in ("2000_p1", "2002_p2a"):
    problem = AGProblem.parse(examples.problems_without_aux[name])
    started = time.perf_counter()
    engine = DDAR(problem.points)
    for pred in problem.preds:
        engine.force_pred(pred)
    engine.deduction_closure(progress_dot=False)
    assert engine.check_pred(problem.goal), name
    print(f"PASS upstream {name}: {(time.perf_counter() - started) * 1000:.2f} ms")
