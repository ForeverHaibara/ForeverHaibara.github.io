"""Incremental graph and numerical transaction regressions."""

import random
import triangle_center_import as m
import unittest
from copy import deepcopy
from triangle_center_graph import SelectedGraph, NumericTransactions
from unittest import TestCase
from unittest.mock import patch


def state(records, depth=6, length=None, conjugates=1, ideal=()):
    return SelectedGraph(records, m.NATIVE_MAX, m.estimated_recipe_length,
                         (depth, length, conjugates),
                         lambda recipe, overlay: m.validate_recipe_inputs(recipe, overlay, set(ideal)))


class SelectedGraphTest(TestCase):
    def test_cycle_missing_and_descendant_budget_fail_atomically(self):
        records = {4000: m.Recipe(4000, 'M', (1, 2)),
                   4001: m.Recipe(4001, 'M', (4000, 3)),
                   5000: m.Recipe(5000, 'M', (4, 5))}
        graph = state(records, depth=2)
        original = dict(records)
        metrics = dict(graph.metrics)
        reverse = {n: set(refs) for n, refs in graph.reverse.items()}
        for recipe in [m.Recipe(4000, 'M', (4001, 1)),
                       m.Recipe(4000, 'M', (9999, 1)),
                       m.Recipe(4000, 'M', (5000, 1))]:
            self.assertFalse(graph.replace(recipe))
            self.assertEqual(records, original)
            self.assertEqual(graph.metrics, metrics)
            self.assertEqual(dict(graph.reverse), reverse)

    def test_type_conjugate_and_length_constraints_propagate(self):
        records = {4000: m.Recipe(4000, 'M', (1, 2)),
                   4001: m.Recipe(4001, 'G', (4000,))}
        graph = state(records)
        self.assertFalse(graph.replace(m.Recipe(4000, 'G', (3,))))
        # A changed source type must also validate its downstream midpoint.
        records[4001] = m.Recipe(4001, 'M', (4000, 3))
        graph = state(records, length=200)
        self.assertFalse(graph.replace(m.Recipe(4000, 'I', (1, 2))))
        self.assertFalse(graph.replace(m.Recipe(4000, 'B', (), formula='a+' * 100 + 'a')))

    def test_screen_rejection_and_reverse_index_updates(self):
        records = {4000: m.Recipe(4000, 'M', (1, 2)),
                   4001: m.Recipe(4001, 'M', (4000, 3)),
                   5000: m.Recipe(5000, 'M', (4, 5))}
        graph = state(records)
        replacement = m.Recipe(4000, 'M', (5000, 1))
        self.assertFalse(graph.replace(replacement, lambda overlay, affected: False))
        self.assertEqual(graph.descendants({5000}), {5000})
        self.assertTrue(graph.replace(replacement))
        self.assertEqual(graph.descendants({5000}), {5000, 4000, 4001})
        self.assertEqual(graph.descendants({2}), {2})
        graph.remove(graph.descendants({4000}))
        self.assertEqual(set(records), {5000})
        self.assertEqual(graph.descendants({5000}), {5000})

    def test_random_replacements_match_full_validator(self):
        rng = random.Random(20261101)
        records = {n: m.Recipe(n, 'M', (1, 2)) for n in range(4000, 4060)}
        graph = state(records, depth=4, length=5000)
        for _ in range(150):
            number = rng.randrange(4000, 4060)
            recipe = m.Recipe(number, rng.choice(['M', 'G', 'C']),
                              (rng.randrange(4000, 4060), 1))
            if recipe.operation != 'M':
                recipe = m.Recipe(number, recipe.operation, recipe.references[:1])
            candidate = dict(records)
            candidate[number] = recipe
            try:
                depth, length = m.validate_graph(candidate)
                nonlinear = m.conjugate_levels(candidate)
                m.validate_types(candidate, set())
                expected = max(depth.values()) <= 4 and max(length.values()) <= 5000 and max(nonlinear.values()) <= 1
            except ValueError:
                expected = False
            self.assertEqual(graph.replace(recipe), expected)
            if expected:
                self.assertEqual(records, candidate)
            depth, length = m.validate_graph(records)
            nonlinear = m.conjugate_levels(records)
            self.assertEqual(graph.metrics, {n: (depth[n], length[n], nonlinear[n]) for n in records})

    def test_unrelated_nodes_are_not_visited_on_replacement(self):
        records = {n: m.Recipe(n, 'M', (1, 2)) for n in range(4000, 5000)}
        graph = state(records)
        self.assertTrue(graph.replace(m.Recipe(4000, 'M', (3, 4))))
        self.assertEqual(graph.visited, 1)


class NumericSnapshotTest(TestCase):
    atlas = dict(triangles={'shape': [(0, 0), (6, 0), (1, 4)]},
                 coordinates={'shape': {'1': (0, 0), '2': (6, 0)}})

    def test_dirty_evaluation_matches_full_and_reuses_unrelated_formula(self):
        records = {4000: m.Recipe(4000, 'B', (), formula='a'),
                   4001: m.Recipe(4001, 'M', (4000, 1)),
                   5000: m.Recipe(5000, 'B', (), formula='a^2')}
        cached = m.numeric_coordinates(records, self.atlas)
        records[4000] = m.Recipe(4000, 'B', (), formula='1')
        with patch.object(m, 'numeric_formula', wraps=m.numeric_formula) as evaluate:
            incremental = m.numeric_coordinates(records, self.atlas, cached=cached, dirty={4000, 4001})
            self.assertEqual([call.args[0].number for call in evaluate.call_args_list], [4000])
        self.assertEqual(incremental, m.numeric_coordinates(records, self.atlas))

    def test_failed_shared_dependency_is_evaluated_once(self):
        records = {4000: m.Recipe(4000, 'B', (), formula='1/(a-a)'),
                   4001: m.Recipe(4001, 'M', (4000, 4000)),
                   4002: m.Recipe(4002, 'M', (4000, 4001))}
        with patch.object(m, 'numeric_formula', wraps=m.numeric_formula) as evaluate:
            result = m.numeric_coordinates(records, self.atlas)
            self.assertEqual(evaluate.call_count, 1)
        self.assertFalse(set(records) & set(result['shape']))


ATLAS = dict(triangles={'shape': [(0, 0), (6, 0), (1, 4)]},
             coordinates={'shape': {'1': (0, 0), '2': (6, 0)}})


class NumericTransactionTest(TestCase):
    def test_coordinate_transform_tracks_parent_changes_and_rolls_back_undefined_result(self):
        records = {4000:m.Recipe(4000,'M',(1,2)),4001:m.Recipe(4001,'B',(4000,),formula='x')}
        graph,geometry = self.make(records,lambda n,r,c: n in c['shape'])
        self.assertEqual(geometry.coordinates['shape'][4001],(3,0))
        self.assertTrue(geometry.apply(m.Recipe(4000,'M',(2,2))))
        self.assertEqual(geometry.coordinates['shape'][4001],(6,0))
        before = deepcopy(geometry.coordinates)
        self.assertFalse(geometry.apply(m.Recipe(4001,'B',(4000,),formula='x-x')))
        self.assertEqual(geometry.coordinates,before)
        self.assertEqual(records[4001].formula,'x')
        self.assertFalse(graph.replace(m.Recipe(4000,'B',(4001,),formula='x')))

    def test_transaction_does_not_iterate_or_copy_unchanged_coordinates(self):
        class NoFullScan(dict):
            def __iter__(self):
                raise AssertionError('full coordinate scan')
            def keys(self):
                raise AssertionError('full coordinate copy')

        records = {4000: m.Recipe(4000, 'M', (1, 2))}
        graph, geometry = self.make(records, lambda n, r, c: n in c['shape'])
        geometry.coordinates['shape'] = NoFullScan(geometry.coordinates['shape'])
        self.assertTrue(geometry.apply(m.Recipe(4000, 'M', (2, 2))))
        self.assertEqual(geometry.coordinates['shape'][4000], (6, 0))

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
            lambda overlay, cached, dirty: m.numeric_coordinates(overlay, ATLAS, cached=cached, dirty=dirty, overlay=True),
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
    def test_out_of_part_seeds_close_without_page_incidence_table(self):
        candidates = {4000: [m.Recipe(4000,'M',(1,2))]}
        seeds = {5000:m.Recipe(5000,'J',(1,2,4000,3)),
                 5001:m.Recipe(5001,'I',(1,4000))}
        atlas = dict(triangles=ATLAS['triangles'],
                     coordinates={'shape':{'1':(0,0),'2':(6,0),'3':(1,4)}})
        selected = m.select_recipes(candidates,seeds,6,None,atlas=atlas)
        self.assertEqual(set(selected),{4000,5000,5001})
        self.assertEqual(m.numeric_coordinates(selected,atlas)['shape'][5000],(3,0))

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


if __name__ == "__main__":
    unittest.main()
