"""Geometry rollback, external witnesses, and unbounded repair/reopening."""
from copy import deepcopy
from unittest import TestCase
from unittest.mock import patch

import triangle_center_import as m
from triangle_center_graph import SelectedGraph, NumericTransactions


ATLAS = dict(triangles={'shape': [(0, 0), (6, 0), (1, 4)]},
             coordinates={'shape': {'1': (0, 0), '2': (6, 0)}})


class NumericTransactionTest(TestCase):
    def test_formula_sample_cache_tracks_formula_and_triangle(self):
        m._formula_sample.cache_clear()
        abc = ATLAS['triangles']['shape']
        with patch.object(m, 'evaluate_formula', wraps=m.evaluate_formula) as evaluate:
            first = m.numeric_formula(m.Recipe(4000, 'B', (), formula='a'), abc)
            self.assertEqual(m.numeric_formula(m.Recipe(9999, 'B', (), formula='a'), abc), first)
            self.assertEqual(evaluate.call_count, 3)
            self.assertNotEqual(m.numeric_formula(m.Recipe(4000, 'B', (), formula='1'), abc), first)
            self.assertEqual(evaluate.call_count, 6)
            translated = [(x+10, y-2) for x, y in abc]
            moved = m.numeric_formula(m.Recipe(4000, 'B', (), formula='a'), translated)
            self.assertAlmostEqual(moved[0], first[0]+10)
            self.assertAlmostEqual(moved[1], first[1]-2)
            self.assertEqual(evaluate.call_count, 9)

    def make(self, records, validate, evidence=None):
        graph = SelectedGraph(records, m.NATIVE_MAX, m.estimated_recipe_length, (6, None, 1),
                              lambda recipe, overlay: m.validate_recipe_inputs(recipe, overlay, set()))
        geometry = NumericTransactions(graph,
            lambda overlay, cached, dirty: m.numeric_coordinates(overlay, ATLAS, cached=cached, dirty=dirty),
            validate, evidence or {})
        return graph, geometry

    def test_external_evidence_failure_rolls_back_all_state(self):
        records = {4000: m.Recipe(4000, 'B', (), formula='a'),
                   4001: m.Recipe(4001, 'M', (4000, 1)),
                   4002: m.Recipe(4002, 'M', (1, 2))}
        original = m.numeric_coordinates(records, ATLAS)['shape'][4000]
        def valid(number, overlay, coordinates):
            if number == 4002:
                return coordinates['shape'].get(4000) == original
            return number in coordinates['shape']
        graph, geometry = self.make(records, valid, {4002: {4000}})
        before = (dict(records), deepcopy(graph.metrics), deepcopy(dict(graph.reverse)),
                  deepcopy(geometry.coordinates), graph.fingerprint)
        self.assertFalse(geometry.apply(m.Recipe(4000, 'B', (), formula='1')))
        self.assertEqual(before, (dict(records), graph.metrics, dict(graph.reverse),
                                  geometry.coordinates, graph.fingerprint))

    def test_success_updates_descendants_and_adds_missing_targets(self):
        records = {4000: m.Recipe(4000, 'B', (), formula='a'),
                   4001: m.Recipe(4001, 'M', (4000, 1))}
        graph, geometry = self.make(records, lambda n, r, c: n in c['shape'])
        self.assertTrue(geometry.apply(m.Recipe(4000, 'B', (), formula='1')))
        self.assertTrue(geometry.apply(m.Recipe(4002, 'M', (4001, 2))))
        self.assertEqual(geometry.coordinates, m.numeric_coordinates(records, ATLAS))
        self.assertEqual(graph.descendants({4000}), {4000, 4001, 4002})
        geometry.remove({4001, 4002})
        self.assertEqual(set(records), {4000})
        self.assertNotIn(4001, geometry.coordinates['shape'])

    def test_undefined_target_cannot_replace_finite_result(self):
        records = {4000: m.Recipe(4000, 'M', (1, 2))}
        graph, geometry = self.make(records, lambda n, r, c: n in c['shape'])
        before = deepcopy(geometry.coordinates)
        self.assertFalse(geometry.apply(m.Recipe(4000, 'M', (1, 99))))
        self.assertEqual(geometry.coordinates, before)


class RepairQueueTest(TestCase):
    def test_more_than_thirty_independent_failures_use_other_operation(self):
        seed = m.Recipe(5000, 'B', (), formula='1/(a-a)')
        candidates = {n: [m.Recipe(n, 'M', (5000, 1)), m.Recipe(n, 'B', (), formula='1')]
                      for n in range(4000, 4040)}
        result = m.select_recipes(candidates, {5000: seed}, 6, None, atlas=ATLAS)
        self.assertEqual(set(result), set(candidates) | {5000})
        self.assertTrue(all(result[n].operation == 'B' for n in candidates))

    def test_removed_child_reopens_using_independent_late_definition(self):
        candidates = {4000: [m.Recipe(4000, 'M', (5000, 1))],
                      4001: [m.Recipe(4001, 'M', (4000, 1)), m.Recipe(4001, 'G', (6000,))],
                      6001: [m.Recipe(6001, 'M', (1, 2))],
                      6000: [m.Recipe(6000, 'M', (6001, 2))]}
        result = m.select_recipes(candidates, {5000: m.Recipe(5000, 'B', (), formula='1/(a-a)')},
                                  6, None, atlas=ATLAS)
        self.assertNotIn(4000, result)
        self.assertEqual(result[4001], m.Recipe(4001, 'G', (6000,)))
        m.validate_graph(result)
        self.assertIn(4001, m.numeric_coordinates(result, ATLAS)['shape'])
