"""Focused tests for ETC text parsing and dependency selection."""

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from triangle_center_import import (CACHE, Ideal, Recipe, direction_candidate_supported, extract_entry,
                                    coordinate_anchors, line_candidate_supported, numeric_coordinates, numeric_formula,
                                    numeric_formula_projective,
                                    native_status_rows, read_native_status, read_recipes,
                                    select_recipes, split_entries, unresolved_components,
                                    validate_graph, validate_types)
from triangle_center_coordinates import coordinate_candidates, evaluate_formula, normalize_formula, side_environment


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

    def test_bare_intersection_and_wrapped_line_list(self):
        html = ('<h3 id="X4101">X(4101) = INTERSECTION OF X(1)X(3) AND</h3>'
                '<p>X(2)X(4)<br>X(4101) lies on these lines: {{1, 3}, {2, 4}, {5, 6},'
                '<br>{7, 8}}<br>Trilinears 1 : 2 : 3</p>')
        recipes = extract_entry(4101, html, 3)
        self.assertIn(('J', (1, 3, 2, 4)), {(r.operation, r.references) for r in recipes})
        self.assertIn(('J', (5, 6, 7, 8)), {(r.operation, r.references) for r in recipes})
        symbolic = '<h3 id="X4104">X(4104) = X(1)X(2)∩X(3)X(4)</h3>'
        self.assertEqual(extract_entry(4104, symbolic, 3)[0].row(), '4104 J 1 2 3 4')
        missing_x = '<h3 id="X4105">X(4105) = CENTER</h3><p>(4105) lies on these lines: 1,2 3,4</p>'
        self.assertEqual(extract_entry(4105, missing_x, 3)[0].row(), '4105 J 1 2 3 4')

    def test_composite_line_headings_and_damaged_pair(self):
        cases = [
            (3134, 'X(3134) lies on these lines:<br>2,3 122.136 125,526 2970,2972',
             (2, 3, 122, 136)),
            (3162, 'X(3162) lies on these lines: X(3162) lies on the cubics K177 and K1162 '
             'and these lines: {2, 2138}, {6, 66}, {19, 614}', (2, 2138, 6, 66)),
            (3234, 'X(3234) lies on the curve Q078, the Yff parabola, and these lines: '
             '{100, 3239}, {101, 514}, {118, 516}', (100, 3239, 101, 514)),
            (3516, 'X(3516) lies on these lines:<br>2,3 6,1204 393174<br>51,1192 55,1398',
             (2, 3, 51, 1192)),
            (7955, 'X(7955) lies on these lines: (220,2124), (223,3160)',
             (220, 2124, 223, 3160)),
            (3412, 'X(3412) lies on the Brocard-Kiepert quartic, Q073,<br>'
             'and on these lines: 5,14 6,3411 13,382 15,20', (5, 14, 6, 3411)),
        ]
        for number, listing, expected in cases:
            html = f'<h3 id="X{number}">X({number}) = CENTER</h3><p>{listing}</p>'
            recipes = extract_entry(number, html, 3)
            options = [recipe.references for recipe in recipes]
            self.assertTrue(expected in options or (*expected[2:], *expected[:2]) in options, number)

    def test_infinite_target_direction_and_conjugate_text(self):
        html = ('<h3 id="X4102">X(4102) = SPECIAL CENTER</h3>'
                '<p>X(4102) lies on these lines: {1, 3}, {2, 4}<br>'
                'X(4102) = infinite point of a line</p>')
        self.assertEqual({recipe.row() for recipe in extract_entry(4102, html, 3)},
                         {'4102 I 1 3', '4102 I 2 4'})
        other = ('<h3 id="X4103">X(4103) = ISOGONAL CONJUGATE OF INFINITE POINT</h3>'
                 '<p>X(4103) lies on these lines: {1, 3}, {2, 4}</p>')
        self.assertTrue(extract_entry(4103, other, 3))

    def test_infinity_line_and_parallel_heading(self):
        by_infinity_line = ('<h3 id="X4106">X(4106) = CENTER</h3><p>'
                            'X(4106) lies on these lines: {1, 2}, {30, 511}, {3, 4}</p>')
        parallel = ('<h3 id="X4107">X(4107) = CENTER</h3><p>'
                    'X(4107) lies on these (parallel) lines: 1,2 3,4</p>')
        self.assertEqual({recipe.row() for recipe in extract_entry(4106, by_infinity_line, 3)},
                         {'4106 I 1 2', '4106 I 3 4'})
        self.assertEqual({recipe.row() for recipe in extract_entry(4107, parallel, 3)},
                         {'4107 I 1 2', '4107 I 3 4'})

    def test_numeric_ideal_direction_intersection_and_conjugate(self):
        triangle = [(0, 0), (6, 0), (1, 4)]
        native = {str(i): xy for i, xy in enumerate(triangle, 1)}
        native.update({'4': (2, -1), '5': (2, 3)})
        atlas = {'triangles': {'acute': triangle, 'obtuse': triangle},
                 'coordinates': {'acute': native, 'obtuse': native}}
        records = {4000: Recipe(4000, 'I', (1, 2)),
                   4001: Recipe(4001, 'J', (3, 4000, 4, 5)),
                   4002: Recipe(4002, 'G', (4000,))}
        coordinates = numeric_coordinates(records, atlas, {30: (2, 3)})
        self.assertIsInstance(coordinates['acute'][4000], Ideal)
        self.assertIsInstance(coordinates['acute'][30], Ideal)
        self.assertAlmostEqual(coordinates['acute'][4001][0], 2)
        self.assertAlmostEqual(coordinates['acute'][4001][1], 4)
        self.assertTrue(all(isinstance(coordinates[shape][4002], tuple) for shape in coordinates))
        self.assertTrue(direction_candidate_supported(records[4000], coordinates, [(1, 2)]))

    def test_ideal_input_types(self):
        valid = {4000: Recipe(4000, 'I', (1, 2)),
                 4001: Recipe(4001, 'J', (1, 4000, 3, 4)),
                 4002: Recipe(4002, 'G', (4000,))}
        validate_types(valid, {30})
        with self.assertRaisesRegex(ValueError, 'ideal-point input'):
            validate_types({**valid, 4003: Recipe(4003, 'M', (4000, 2))}, {30})
        with self.assertRaisesRegex(ValueError, 'ideal-point input'):
            validate_types({**valid, 4003: Recipe(4003, 'J', (30, 4000, 3, 4))}, {30})

    def test_cyclic_coordinate_parser_and_line_continuation(self):
        sample = ('<h3 id="X4182">X(4182) = CENTER</h3>'
                  'Trilinears t(A,B,C) : t(B,C,A) : t(C,A,B), where t(A,B,C) = '
                  'csc<sup>2</sup>(A/2) sin<sup>1/2</sup>A<br>'
                  'Barycentrics f(a,b,c) : f(b,c,a) : f(c,a,b), where f(a,b,c)<br>'
                  '= a<sup>1/2</sup>(b + c - a)')
        self.assertEqual([(kind, formula) for kind, formula, _ in coordinate_candidates(sample)],
                         [('B', 'a^(1/2)*(b+c-a)')])
        wrapped = ('<h3 id="X3281">X(3281) = CENTER</h3>'
                   'Trilinears f(A,B,C)<br>: f(B,C,A) : f(C,A,B), where f(A,B,C) = '
                   '2 cos(A/3) + cos A - 2 cos(B/3)<br>cos(C/3)')
        self.assertEqual(coordinate_candidates(wrapped)[0][1],
                         'a*(2*cos(A/3)+cos(A)-2*cos(B/3)*cos(C/3))')
        wrapped_sides = ('<h3 id="X4180">X(4180) = CENTER</h3>'
                         'Barycentrics f(a,b,c) : f(b,c,a) : f(c,a,b),<br>'
                         'where f(a,b,c) = a<sup>1/2</sup>(b<sup>1/2</sup> + c<sup>1/2</sup>)(b +<br>c - a)')
        self.assertEqual(coordinate_candidates(wrapped_sides)[0][1],
                         'a^(1/2)*(b^(1/2)+c^(1/2))*(b+c-a)')
        pi_variants = ('<h3 id="X3371">X(3371) = CENTER</h3>'
                       'Trilinears sin(A + &pi;8) : :<br>Trilinears cos(A - 3&pi;/8) : :')
        self.assertEqual([formula for _, formula, _ in coordinate_candidates(pi_variants)],
                         ['a*(cos(A-3*pi/8))'])
        split_cyclic = ('<h3 id="X4174">X(4174) = CENTER</h3>'
                        'Barycentrics f(a,b,c) : f(b,c,a) :<br>'
                        'f(c,a,b), where f(a,b,c) = (b+c)(b<sup>6</sup>+c<sup>6</sup>-<br>a<sup>6</sup>)')
        self.assertEqual(coordinate_candidates(split_cyclic)[0][1], '(b+c)*(b^(6)+c^(6)-a^(6))')
        split_polynomial = ('<h3 id="X3856">X(3856) = CENTER</h3>'
                            'Barycentrics f(a,b,c) : f(b,c,a) : f(c,a,b),<br>'
                            'where f(a,b,c) = 6a<sup>4</sup>-11b<sup>4</sup>-11c<sup>4</sup>+<br>'
                            '5a<sup>2</sup>b<sup>2</sup>+5a<sup>2</sup>c<sup>2</sup>+<br>22b<sup>2</sup>c<sup>2</sup>')
        self.assertEqual(coordinate_candidates(split_polynomial)[0][1],
                         '6*a^(4)-11*b^(4)-11*c^(4)+5*a^(2)*b^(2)+5*a^(2)*c^(2)+22*b^(2)*c^(2)')
        self.assertEqual(normalize_formula('a[cos^(2)(B-C)][b cos(C-A)+c cos(A-B)]'),
                         'a*((cos(B-C))^2)*(b*cos(C-A)+c*cos(A-B))')
        auriga = ('<h3 id="X5597">X(5597) = CENTER</h3>'
                  'Barycentrics f(a,b,c) : f(b,c,a) : f(c,a,b),<br>'
                  'where f(a,b,c) = a<sup>4</sup>-a<sup>2</sup>(b+c)<sup>2</sup>+<br>'
                  '4aS(rR+4R<sup>2</sup>)<sup>1/2</sup>')
        self.assertEqual(coordinate_candidates(auriga)[0][1],
                         'a^(4)-a^(2)*(b+c)^(2)+4*a*S*(r*R+4*R^(2))^(1/2)')
        full_cycle = ('<h3 id="X5998">X(5998) = CENTER</h3>'
                      'Barycentrics a+[(a-b+c)(a+b-c)]<sup>1/2</sup> : '
                      'b+[(b-c+a)(b+c-a)]<sup>1/2</sup> : '
                      'c+[(c-a+b)(c+a-b)]<sup>1/2</sup>')
        self.assertEqual(coordinate_candidates(full_cycle)[0][1],
                         'a+((a-b+c)*(a+b-c))^(1/2)')
        self.assertEqual(normalize_formula('a2b4 + S_A'), 'a^2*b^4+SA')
        self.assertIsNone(normalize_formula('sin A - u cos A'))

    def test_coordinate_numeric_domain_and_compact_roundtrip(self):
        abc = [(0, 0), (6, 0), (1, 4)]
        recipe = Recipe(4182, 'B', (), formula='a^(1/2)*(b+c-a)')
        self.assertIsNotNone(numeric_formula(recipe, abc))
        self.assertIsNone(numeric_formula(Recipe(4000, 'B', (), formula='b-c'), abc))
        self.assertIsInstance(numeric_formula_projective(Recipe(4000, 'B', (), formula='b-c'), abc), Ideal)
        env = side_environment(5, 6, 7)
        self.assertAlmostEqual(evaluate_formula('SA+SB+SC', env), env['SA']+env['SB']+env['SC'])
        with TemporaryDirectory(dir=CACHE) as folder:
            path = Path(folder) / 'formulas.txt'
            path.write_text(recipe.row() + '\n', encoding='utf-8')
            self.assertEqual(read_recipes(path)[4182].formula, recipe.formula)

    def test_extended_seed_enters_after_its_dependencies(self):
        seed = Recipe(4000, 'J', (1, 4001, 2, 3))
        candidates = {4000: [Recipe(4000, 'J', (1, 2, 3, 4))],
                      4001: [Recipe(4001, 'M', (5, 6))]}
        selected = select_recipes(candidates, {4000: seed}, 6, 6000)
        self.assertEqual(selected[4000], seed)
        self.assertEqual(selected[4001].operation, 'M')

    def test_coordinate_allowance_is_local_to_unresolved_components(self):
        candidates = {
            4000: [Recipe(4000, 'B', (), formula='a')],
            4001: [Recipe(4001, 'B', (), formula='b')],
            4002: [Recipe(4002, 'M', (4000, 4001))],
            5000: [Recipe(5000, 'B', (), formula='a')],
            5001: [Recipe(5001, 'B', (), formula='b')],
            5002: [Recipe(5002, 'M', (5000, 5001))],
        }
        components = unresolved_components(candidates, {})
        self.assertEqual(components[4000], components[4002])
        self.assertNotEqual(components[4000], components[5000])
        atlas = {'triangles': {'acute': [[0, 0], [6, 0], [1, 4]],
                               'obtuse': [[0, 0], [6, 0], [-1, 2]]},
                 'coordinates': {'acute': {}, 'obtuse': {}}}
        selected = coordinate_anchors(candidates, {}, atlas, 1, set(), {}, {})
        self.assertEqual(set(selected), {4000, 5000})
        pinned = coordinate_anchors(candidates, {}, atlas, 1, {4000, 4001}, {}, {})
        self.assertEqual(set(pinned), {4000, 4001, 5000})

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

    def test_revisits_early_intersection_when_affine_dependency_arrives(self):
        candidates = {4000: [Recipe(4000, 'J', (1, 2, 3, 4)),
                             Recipe(4000, 'M', (4001, 5))],
                      4001: [Recipe(4001, 'M', (6, 7))],
                      4002: [Recipe(4002, 'J', (1, 2, 3, 4))]}
        selected = select_recipes(candidates, {}, 6, 6000, deferred_targets={4002})
        self.assertEqual(selected[4000].operation, 'M')
        self.assertNotIn(4002, selected)

    def test_prefers_explicit_intersection_over_incidence_pair(self):
        candidates = {4000: [Recipe(4000, 'J', (1, 2, 3, 4), evidence='X(4000) lies on these lines:'),
                             Recipe(4000, 'J', (4001, 5, 6, 7), evidence='X(4000) = intersection of lines')],
                      4001: [Recipe(4001, 'M', (8, 9))]}
        selected = select_recipes(candidates, {}, 6, 6000)
        self.assertEqual(selected[4000].references, (4001, 5, 6, 7))

    def test_native_status_combines_exclusions_and_directions(self):
        with TemporaryDirectory(dir=CACHE) as folder:
            path = Path(folder) / 'native-status.txt'
            unavailable = {30, 511, 512, 513}
            directions = {30: (2, 3), 511: (3, 6)}
            path.write_text(native_status_rows(unavailable, directions, []), encoding='utf-8')
            self.assertEqual(read_native_status(path), (unavailable, directions))
            path.write_text('30 2 3\n511 3 6\n512-513\n', encoding='utf-8')
            self.assertEqual(read_native_status(path), (unavailable, directions))
            path.write_text('30 2 3\n30\n', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'Duplicate'):
                read_native_status(path)

    def test_line_list_requires_independent_consistent_lines(self):
        points = {1: (0, 0), 2: (2, 0), 3: (1, 0), 4: (3, 0),
                  5: (1, -1), 6: (1, 1), 7: (0, -1), 8: (2, 1),
                  9: (0, 2), 10: (2, 2)}
        sample = {'acute': points, 'obtuse': points}
        same_line = Recipe(4000, 'J', (1, 2, 3, 4), evidence='lies on these lines:')
        good = Recipe(4000, 'J', (1, 2, 5, 6), evidence='lies on these lines:')
        self.assertFalse(line_candidate_supported(same_line, sample, [(1, 2), (3, 4), (5, 6)]))
        self.assertTrue(line_candidate_supported(good, sample, [(1, 2), (5, 6), (7, 8)]))
        self.assertFalse(line_candidate_supported(good, sample, [(1, 2), (5, 6), (9, 10)]))


if __name__ == '__main__':
    unittest.main()
