"""Native readable-proof regressions and independent algebra replay checks."""

import copy
import json
from pathlib import Path
import subprocess
import sys
import unittest

sys.stdout.reconfigure(encoding="utf-8")
sys.dont_write_bytecode = True
root = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(root / "public" / "geometry-reasoning"), str(root / "public" / "vendor" / "alphageometry2")]
from ag2_bridge import solve_json
from proof_algebra import Basis, ProofGraph, replay_algebra
from fractions import Fraction as F


class ReadableProofTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        generated = subprocess.check_output(["node", "node_modules/vite-node/vite-node.mjs", "scripts/geogebra-reasoning-fixtures.ts"], cwd=root, text=True, encoding="utf-8")
        cls.cases = {case["name"]: case["problem"] for case in json.loads(generated)}

    def run_case(self, name, **changes):
        data = {**copy.deepcopy(self.cases[name]), "operation": "proof", **changes}
        return json.loads(solve_json(json.dumps(data)))

    def hypothetical(self, premises, goals):
        data = {"version": 1, "operation": "proof", "assumptionMode": "hypothetical",
            "premise": "p0@0_0 = ; p1@3_0 = ; p2@1_2 = " + premises,
            "goals": goals}
        return json.loads(solve_json(json.dumps(data)))

    def test_midsegment_has_replayable_sas_derivation(self):
        result = self.run_case("midsegment")
        proof = result["proof"]
        self.assertEqual(result["checks"], [True])
        self.assertEqual(proof["gapIds"], [])
        self.assertTrue(proof["algebraReplay"]["valid"])
        self.assertGreaterEqual(proof["algebraReplay"]["checked"], 5)
        self.assertIn("sas-similarity", [node["rule"] for node in proof["nodes"]])
        self.assertTrue(proof["guardIds"])
        self.assertTrue(all(node.get("sourceIds") for node in proof["nodes"] if node["kind"] == "assumption"))
        self.assertIsNone(proof["certificate"])

    def test_directed_combinations_and_length_ratios(self):
        for name in ("isogonal-interior", "isogonal-exterior-reflected", "exact-length-ratio"):
            with self.subTest(name=name):
                proof = self.run_case(name)["proof"]
                self.assertEqual(proof["gapIds"], [])
                self.assertTrue(proof["algebraReplay"]["valid"])

    def test_goal_free_generation(self):
        proof = self.run_case("midsegment", goals=[], goalId=None)["proof"]
        self.assertTrue(proof["conclusions"])
        self.assertTrue(proof["algebraReplay"]["valid"])

    def test_ordinary_ray_branches_remain_explicit_in_the_derivation(self):
        proof = self.run_case("mirror-angle")["proof"]
        branches = [node for node in proof["nodes"] if node["rule"] == "ordinary-angle-branch"]
        self.assertEqual(len(branches), 2)
        self.assertTrue(all("sign" in node and "lift" in node for node in branches))
        self.assertEqual(proof["conclusions"][0]["status"], "assumed")

    def test_coordinate_truth_does_not_create_proof(self):
        result = self.run_case("numerically-true-without-conditions")
        self.assertEqual(result["checks"], [False])
        self.assertEqual(result["proof"]["nodes"], [])

    def test_concyclic_premise_produces_inscribed_angle_derivation(self):
        result = json.loads(solve_json(json.dumps({"version": 1, "operation": "proof",
            "premise": "p0@0_0 = ; p1@2_0 = ; p2@2_2 = ; p3@0_2 = cyclic p0 p1 p2 p3",
            "goals": ["angeq p0 p2 p1 p2 p0 p3 p1 p3 -1 1 1 -1 0"]})))
        self.assertEqual(result["checks"], [True])
        self.assertEqual(result["proof"]["gapIds"], [])
        self.assertIn("inscribed-angle", [node["rule"] for node in result["proof"]["nodes"]])

    def test_false_coordinate_assumptions_can_be_used_symbolically(self):
        result = self.hypothetical("para p0 p1 p0 p2, para p0 p2 p1 p2", ["para p0 p1 p1 p2"])
        self.assertEqual(result["checks"], [True])
        self.assertEqual(result["proof"]["mode"], "hypothetical")
        self.assertEqual(len(result["proof"]["witnessFailures"]), 2)
        self.assertEqual(result["proof"]["guardIds"], [])
        self.assertTrue(result["proof"]["algebraReplay"]["valid"])

    def test_strict_mode_does_not_silently_override_the_witness(self):
        with self.assertRaisesRegex(ValueError, "hypothesis exploration"):
            solve_json(json.dumps({"version": 1, "operation": "proof", "premise": "p0@0_0 = ; p1@3_0 = ; p2@1_2 = para p0 p1 p0 p2", "goals": []}))

    def test_modular_factors_are_not_divided(self):
        result = self.hypothetical("angeq p0 p1 p0 p2 2 -2 0", ["para p0 p1 p0 p2", "angeq p0 p1 p0 p2 2 -2 0"])
        self.assertEqual(result["checks"], [False, True])
        self.assertEqual(result["proof"]["conclusions"][1]["status"], "assumed")

    def test_contradiction_does_not_prove_an_unrelated_goal(self):
        result = self.hypothetical("para p0 p1 p0 p2, perp p0 p1 p0 p2", ["cong p0 p1 p1 p2"])
        self.assertEqual(result["status"], "inconsistent")
        self.assertEqual(result["checks"], [False])
        self.assertTrue(result["proof"]["contradictionIds"])
        self.assertTrue(result["proof"]["algebraReplay"]["valid"])

    def test_tampered_coefficient_and_forward_reference_are_rejected(self):
        nodes = self.run_case("midsegment")["proof"]["nodes"]
        tampered = copy.deepcopy(nodes)
        node = next(node for node in tampered if node["kind"] == "algebra")
        node["premises"][0]["coefficient"] = str(F(node["premises"][0]["coefficient"]) + 1)
        self.assertFalse(replay_algebra(tampered)["valid"])
        tampered = copy.deepcopy(nodes)
        tampered[0]["premises"] = [{"id": nodes[-1]["id"], "coefficient": "1"}]
        self.assertFalse(replay_algebra(tampered)["valid"])

    def test_gap_ancestors_remain_visible_in_the_conclusion(self):
        graph = ProofGraph()
        basis = Basis(graph, "length-add")
        source = graph.equation("gap", "test-gap", "length-add", {"len(a,b)": F(1)})
        basis.add({"len(a,b)": F(1)}, source)
        conclusion = basis.prove({"len(a,b)": F(2)})
        report = graph.export([{"nodeId": conclusion, "status": "recorded", "backendKnown": True}], [], "ddar")
        self.assertEqual(report["conclusions"][0]["status"], "unexplained")
        self.assertEqual(report["explanation"], "partial")


if __name__ == "__main__":
    unittest.main(verbosity=2)
