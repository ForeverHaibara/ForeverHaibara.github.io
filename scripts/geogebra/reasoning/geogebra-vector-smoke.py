"""End-to-end TS export -> native signed-product/DDAR regressions, no auxiliary points."""

import copy
import json
from pathlib import Path
import subprocess
import sys
import unittest

sys.dont_write_bytecode = True
sys.stdout.reconfigure(encoding="utf-8")
root = Path(__file__).resolve().parents[3]
sys.path[:0] = [str(root / "public/geometry-reasoning"), str(root / "public/vendor/alphageometry2")]
from ag2_bridge import solve_json
from proof_algebra import replay_algebra


class VectorProofTests(unittest.TestCase):
    def test_custom_vector_budget_reports_partial_results(self):
        result = self.run_case("B", computationLimits={"maxProofNodes": 1600, "maxVectorRounds": 1, "maxVectorQueries": 100})
        proof = result["proof"]
        self.assertTrue(proof["vectorDiagnostics"]["limited"])
        self.assertTrue(proof["limited"])
        self.assertEqual(proof["explanation"], "partial")
        self.assertLessEqual(proof["vectorDiagnostics"]["rounds"], 1)
        self.assertLessEqual(proof["vectorDiagnostics"]["queries"], 100)
        self.assertTrue(proof["algebraReplay"]["valid"])

    def test_round_limit_stops_feedback_before_the_default_closure(self):
        result = self.run_case("B-products-feedback", computationLimits={"maxVectorRounds": 1})
        proof = result["proof"]
        self.assertEqual(proof["vectorDiagnostics"]["rounds"], 1)
        self.assertTrue(proof["limited"])
        self.assertEqual(proof["explanation"], "partial")
        self.assertTrue(proof["algebraReplay"]["valid"])

    @classmethod
    def setUpClass(cls):
        raw = subprocess.check_output(["node", "node_modules/vite-node/vite-node.mjs", "scripts/geogebra/reasoning/geogebra-vector-fixtures.ts"], cwd=root, text=True, encoding="utf-8")
        cls.cases = {entry["name"]: entry["problem"] for entry in json.loads(raw)}
        cls.results = {}

    def run_case(self, name, **changes):
        if changes:
            return json.loads(solve_json(json.dumps({**copy.deepcopy(self.cases[name]), **changes})))
        if name not in self.results:
            self.results[name] = json.loads(solve_json(json.dumps(self.cases[name])))
        return self.results[name]

    def test_A_uses_product_elimination_as_an_intermediate_step(self):
        result = self.run_case("A")
        self.assertEqual(result["checks"], [True, True])
        self.assertIn("similarity-from-bilinear-products", [node["rule"] for node in result["proof"]["nodes"]])
        self.assertEqual(result["points"], 6)
        self.assertTrue(result["proof"]["algebraReplay"]["valid"])
        self.assertFalse(result["proof"]["gapIds"])

    def test_B_geometric_conditions_transfer_lengths_and_angles_into_products(self):
        result = self.run_case("B")
        self.assertEqual(result["checks"], [True] * 3)
        self.assertIn("length-angle-product-transfer", [node["rule"] for node in result["proof"]["nodes"]])
        self.assertEqual(result["points"], 8)
        self.assertFalse(result["proof"]["gapIds"])
        self.assertTrue(result["proof"]["algebraReplay"]["valid"])

    def test_B_product_conditions_feed_DDAR(self):
        result = self.run_case("B-products")
        self.assertEqual(result["checks"], [True] * 3)
        self.assertIn("similarity-from-bilinear-products", [node["rule"] for node in result["proof"]["nodes"]])
        self.assertFalse(result["proof"]["gapIds"])
        self.assertTrue(result["proof"]["algebraReplay"]["valid"])

    def test_feedback_returns_a_new_DDAR_right_angle_to_the_product_basis(self):
        result = self.run_case("B-products-feedback")
        self.assertEqual(result["checks"], [True])
        self.assertGreaterEqual(result["proof"]["vectorDiagnostics"]["rounds"], 2)
        rules = [node["rule"] for node in result["proof"]["nodes"]]
        self.assertIn("similarity-from-bilinear-products", rules)
        self.assertIn("direction-vector-product", rules)
        self.assertFalse(result["proof"]["gapIds"])
        self.assertTrue(result["proof"]["algebraReplay"]["valid"])

    def test_transformed_general_configurations_and_signed_product_goals(self):
        for name in ("B-reflected-small", "B-reflected-small-products", "B-large", "B-large-products", "B-cross"):
            with self.subTest(name=name):
                result = self.run_case(name)
                self.assertTrue(all(result["checks"]))
                self.assertFalse(result["proof"]["gapIds"])
                self.assertTrue(result["proof"]["algebraReplay"]["valid"])

    def test_missing_conditions_and_numeric_truth_do_not_supply_a_proof(self):
        self.assertFalse(any(self.run_case("A-no-premises")["checks"]))
        self.assertEqual(self.run_case("B-missing-cross")["checks"], [False])

    def test_sampled_automatic_conditions_complete_B(self):
        result = self.run_case("B-sampled-automatic")
        self.assertEqual(result["checks"], [True, True, True])
        self.assertFalse(result["proof"]["gapIds"])
        self.assertTrue(result["proof"]["algebraReplay"]["valid"])

    def test_corresponding_lengths_and_supplementary_ray_angles_keep_signs(self):
        result = self.run_case("length-angle-signed")
        self.assertEqual(result["checks"], [True, True])
        self.assertTrue(any(node["rule"] == "witness-product-angle-lift" and node["lift"] % 2 for node in result["proof"]["nodes"]))
        self.assertEqual(self.run_case("length-angle-wrong-sign")["checks"], [False])

    def test_zero_vector_product_is_defined_without_inventing_a_direction(self):
        result = self.run_case("zero-vector")
        self.assertEqual(result["checks"], [True])
        self.assertFalse(result["proof"]["guardIds"])

    def test_check_and_coverage_share_the_hybrid_closure(self):
        for name in ("A", "B-products", "B-cross"):
            self.assertEqual(self.run_case(name, operation="check")["checks"], self.run_case(name)["checks"])
        coverage = self.run_case("B-coverage")
        self.assertEqual(coverage["checks"], [True, True, True, True, False])
        self.assertEqual(coverage["status"], "not-derived")

    def test_independent_origin_survives_normalization_without_a_geometry_object(self):
        result = self.run_case("independent-origin")
        self.assertEqual(result["checks"], [True])
        self.assertEqual(result["points"], 4)
        self.assertTrue(result["proof"]["algebraReplay"]["valid"])

    def test_hypotheses_keep_symbolic_products_and_do_not_guess_nonzero_directions(self):
        data = copy.deepcopy(self.cases["independent-origin"])
        data["vectorContext"]["assumptions"][0]["equation"]["terms"][0]["right"] = [None, "p0"]
        data["vectorContext"]["goals"][0]["equation"] = data["vectorContext"]["assumptions"][0]["equation"]
        with self.assertRaisesRegex(ValueError, "witness rejected"):
            solve_json(json.dumps(data))
        data["assumptionMode"] = "hypothetical"
        result = json.loads(solve_json(json.dumps(data)))
        self.assertEqual(result["checks"], [True])
        self.assertTrue(result["proof"]["witnessFailures"])
        self.assertFalse(result["proof"]["guardIds"])

    def test_tampered_linear_coefficients_are_rejected(self):
        nodes = copy.deepcopy(self.run_case("B-cross")["proof"]["nodes"])
        node = next(node for node in nodes if node["kind"] == "algebra" and node["equation"]["domain"] == "cross")
        node["premises"][0]["coefficient"] = "999"
        self.assertFalse(replay_algebra(nodes)["valid"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
