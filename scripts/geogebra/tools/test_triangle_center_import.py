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
        self.assertEqual(extract_entry(4003, '<h3 id="X4003">X(4003) = IDEAL POINT</h3>'
                                       '<p>X(4003) = isogonal conjugate of X(4)</p>', 3), [])

    def test_conjugates_line_reflection_and_wrapped_intersection(self):
        html = ('<h3 id="X4100">X(4100) = ISOGONAL CONJUGATE OF X(7)</h3>'
                '<p>X(4100) = isotomic conjugate of X(8)<br>'
                'X(4100) = reflection of X(9) in line X(1)X(2)<br>'
                'X(4100) = intersection of lines X(1)X(3) and<br>X(2)X(4)<br>'
                'X(4100) = isogonal conjugate of X(10) wrt another triangle</p>')
        recipes = extract_entry(4100, html, 3)
        self.assertEqual({(r.operation, r.references) for r in recipes},
                         {('G', (7,)), ('T', (8,)), ('L', (9, 1, 2)), ('J', (1, 3, 2, 4))})

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

    def test_limits_conjugate_chains(self):
        candidates = {4000: [Recipe(4000, 'G', (1,))],
                      4001: [Recipe(4001, 'T', (4000,))],
                      4002: [Recipe(4002, 'M', (4000, 2))]}
        self.assertEqual(set(select_recipes(candidates, {}, 6, 6000)), {4000, 4002})

    def test_prefers_safer_relation_and_skips_unavailable_native_anchor(self):
        seeds = {5000: Recipe(5000, 'M', (1, 2))}
        candidates = {4000: [Recipe(4000, 'J', (1, 2, 3, 4)),
                             Recipe(4000, 'M', (5, 5000))],
                      4001: [Recipe(4001, 'J', (1, 2, 3, 30))]}
        selected = select_recipes(candidates, seeds, 6, 6000, blocked_native={30})
        self.assertEqual(selected[4000].operation, 'M')
        self.assertNotIn(4001, selected)


if __name__ == '__main__':
    unittest.main()
