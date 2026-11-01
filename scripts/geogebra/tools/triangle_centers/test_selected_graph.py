"""Compare incremental transactions with independent full-graph validation."""
import random
from unittest import TestCase
from unittest.mock import patch

import triangle_center_import as m
from triangle_center_graph import SelectedGraph


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
