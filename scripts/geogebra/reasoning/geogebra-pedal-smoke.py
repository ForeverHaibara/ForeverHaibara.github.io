"""Black-box characterization -> real DDAR -> readable pedal proofs."""

import copy
import json
from pathlib import Path
import subprocess
import sys
import unittest

sys.stdout.reconfigure(encoding="utf-8")
sys.dont_write_bytecode = True
root = Path(__file__).resolve().parents[3]
sys.path[:0] = [str(root / "public" / "geometry-reasoning"), str(root / "public" / "vendor" / "alphageometry2")]
from ag2_bridge import solve_json


class PedalProofTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        generated = subprocess.check_output(["node", "node_modules/vite-node/vite-node.mjs", "scripts/geogebra/reasoning/geogebra-pedal-fixtures.ts"], cwd=root, text=True, encoding="utf-8")
        cls.cases = {case["name"]: case["problem"] for case in json.loads(generated)}

    def test_curated_and_automatic_conditions_produce_recorded_proofs(self):
        for name, data in self.cases.items():
            with self.subTest(name=name):
                result = json.loads(solve_json(json.dumps(data)))
                proof = result["proof"]
                self.assertTrue(result["checks"] and all(result["checks"]))
                self.assertTrue(all(item["status"] == "recorded" for item in proof["conclusions"]))
                self.assertFalse(proof["gapIds"])
                self.assertFalse(proof["limited"])
                self.assertTrue(proof["algebraReplay"]["valid"])
                self.assertTrue(all(node.get("sourceIds") for node in proof["nodes"] if node["kind"] == "assumption"))
                self.assertIsNone(proof["certificate"])
                print(f"  {name}: {len(result['checks'])} recorded, {result['elapsedMs']} ms", flush=True)

    def without(self, name, candidate_id, target):
        data = copy.deepcopy(self.cases[name])
        predicates = [entry["predicate"] for entry in data["assumptionSources"] if candidate_id in entry["candidateIds"]]
        for predicate in predicates:
            data["premise"] = data["premise"].replace(predicate + ", ", "").replace(", " + predicate, "")
        symbols = {entry["name"]: entry["symbol"] for entry in data["names"]}
        data["goals"] = [" ".join(symbols.get(token, token) for token in target.split())]
        return json.loads(solve_json(json.dumps(data)))

    def test_numerically_correct_center_name_does_not_supply_missing_hypotheses(self):
        result = self.without("orthocenter-pedal-0", "center", "cyclic B C E F")
        self.assertEqual(result["checks"], [False])
        self.assertEqual(result["proof"]["conclusions"][0]["status"], "not-derived")
        result = self.without("incenter-pedal-0", "center", "cong X D X E")
        self.assertEqual(result["checks"], [False])

    def test_antipode_requires_the_circumcenter_condition(self):
        result = self.without("incenter-extended-0", "circumcenter", "perp A P U X")
        self.assertEqual(result["checks"], [False])
        self.assertEqual(result["proof"]["conclusions"][0]["status"], "not-derived")


if __name__ == "__main__":
    unittest.main(verbosity=2)
