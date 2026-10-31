"""Focused tests for ETC text parsing and dependency selection."""

import unittest

from triangle_center_import import Recipe, extract_entry, select_recipes, split_entries, validate_graph


class TriangleCenterImportTest(unittest.TestCase):
    def test_heading_and_equivalent_pair_lists(self):
        html = ('<h3 id="X4000">X(4000) = MIDPOINT OF X(1) AND X(2)</h3>'
                '<p>X(4000) = reflection of X(i) in X(j) for these (i,j): '
                '(3, 4), {5, 6}</p><hr><h3 id="X4001">X(4001) = COMPLEMENT OF X(7)</h3>')
        entries = list(split_entries(html))
        self.assertEqual([number for number, _ in entries], [4000, 4001])
        recipes = extract_entry(*entries[0], 3)
        self.assertEqual({(r.operation, r.references) for r in recipes},
                         {('M', (1, 2)), ('R', (3, 4)), ('R', (5, 6))})
        self.assertEqual(extract_entry(*entries[1], 3)[0].row(), '4001 C 7')

    def test_ignores_incidence_and_conditional_relations(self):
        html = ('<h3 id="X4002">X(4002) = COMPLEX CENTER</h3>'
                '<p>X(4002) lies on line X(3)X(4)<br>'
                'X(4002) = midpoint of X(5) and X(6) if ABC is acute</p>')
        self.assertEqual(extract_entry(4002, html, 3), [])

    def test_cycle_cannot_enter_generated_graph(self):
        candidates = {4000: [Recipe(4000, 'C', (4001,))],
                      4001: [Recipe(4001, 'A', (4000,))]}
        self.assertEqual(select_recipes(candidates, {}, 6, 6000), {})
        with self.assertRaisesRegex(ValueError, 'Cyclic'):
            validate_graph({4000: candidates[4000][0], 4001: candidates[4001][0]})
        candidates[4001].append(Recipe(4001, 'C', (1,)))
        selected = select_recipes(candidates, {}, 6, 6000)
        self.assertEqual(set(selected), {4000, 4001})
        self.assertEqual(validate_graph(selected)[0][4000], 2)


if __name__ == '__main__':
    unittest.main()
