"""ETC parser/import regressions."""

import cmath
import math
import tempfile
import triangle_center_import as importer
import triangle_center_import as m
import triangle_center_consensus as consensus
import unittest
from compact_topology_cache import pack, ranges, unpack
from pathlib import Path
from tempfile import TemporaryDirectory
from triangle_center_coordinates import coordinate_candidates, coordinate_text, evaluate_formula, homogeneous_degree, normalize_formula, side_environment
from triangle_center_diagnostics import entry_metadata, title_groups
from triangle_center_domains import complex_dependency_roots
from triangle_center_import import CACHE, Ideal, Recipe, RecipeCandidates, combo_candidate, coordinate_anchors, direction_candidate_supported, extract_entry, line_candidate_supported, listed_lines, native_status_rows, numeric_circum_inverse, numeric_combo, numeric_conjugate, numeric_coordinates, numeric_formula, numeric_formula_projective, read_native_status, read_recipes, select_recipes, shinagawa_candidate_supported, shinagawa_candidates, split_entries, unresolved_components, validate_graph, validate_types
from triangle_center_support import extraction_source_fingerprint
from unittest import TestCase
from unittest.mock import patch


class TriangleCenterImportTest(unittest.TestCase):
    def test_explicit_intersection_needs_consistent_independent_evidence(self):
        points={1:(-1,0),2:(1,0),3:(0,-1),4:(0,1),5:(0,1),6:(1,2),
                7:(0,3),8:(1,5),9:(2,3),10:(3,4),11:(-1,-1),12:(1,1)}
        explicit=Recipe(4000,'J',(1,2,3,4),evidence='X(4000) = intersection of lines X(1)X(2) and X(3)X(4)')
        self.assertFalse(line_candidate_supported(explicit,{'t':points},[(1,2),(3,4),(5,6),(7,8)]))
        # Missing support, a single bad line, or repeated copies of it are
        # insufficient evidence to reject an explicitly stated intersection.
        self.assertTrue(line_candidate_supported(explicit,{'t':points},[(1,2),(3,4)]))
        self.assertTrue(line_candidate_supported(explicit,{'t':points},[(1,2),(3,4),(5,6)]))
        self.assertTrue(line_candidate_supported(explicit,{'t':points},[(1,2),(5,6),(9,10)]))
        self.assertTrue(line_candidate_supported(explicit,{'t':points},[(1,2),(5,6),(7,8),(11,12)]))

    def test_title_incidence_hints_do_not_rewrite_recipes_or_uncovered_counts(self):
        candidates={72796:RecipeCandidates(72796,[],[(80,53618),(1293,30198)]),
                    40822:RecipeCandidates(40822,[],[(2,6331),(3,17984)]),
                    4000:RecipeCandidates(4000,[],[(1,2),(3,4)]),
                    4001:RecipeCandidates(4001,[],[(1,2),(3,4)])}
        metadata={72796:dict(title='X(8)X(53618)∩X(1293)X(30198)'),
                  40822:dict(title='X(6)X(6331)∩X(3)X(17984)'),
                  4000:dict(title='X(1)X(2)∩X(3)X(4)'),
                  4001:dict(title='X(1)X(2)∩X(3)X(4) wrt excentral triangle')}
        hints=m.intersection_title_hints(candidates,metadata,{72796:Recipe(72796,'J',(80,53618,1293,30198))})
        self.assertEqual([h['id'] for h in hints],[40822,72796])
        self.assertTrue(hints[1]['selected'])
        self.assertEqual(hints[1]['possible_endpoint_conflicts'][0]['listed_line'],(80,53618))
        self.assertEqual(candidates[40822].lines,((2,6331),(3,17984)))

    def test_ceva_cross_native_identities_and_order(self):
        atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json')
        native=m.numeric_coordinates({},atlas,m.read_native_status(m.DATA/'native-status.txt')[1])
        # Four independent ETC X(1) identities also pin the asymmetric order.
        for body,refs in [('cevapoint of X(2) and X(192)',(2,192)),
                          ('crosspoint of X(2) and X(7)',(2,7)),
                          ('X(2)-Ceva conjugate of X(9)',(2,9)),
                          ('X(2)-cross conjugate of X(87)',(2,87))]:
            recipe=m.ceva_cross_candidates(4000,body,3)[0]
            self.assertEqual(recipe.references,refs)
            m.validate_transform_formula(recipe.formula,2)
            for shape,points in native.items():
                actual=m.numeric_transform_formula(recipe,[points[n] for n in refs],atlas['triangles'][shape])
                self.assertLess(math.dist(actual,points[1]),1e-8)
            with self.assertRaises(ValueError):validate_types({4000:recipe},{refs[0]})

    def test_ceva_cross_lists_do_not_admit_triangle_qualifiers_or_partial_pairs(self):
        for prefix,expected in [('cevapoint of X(i) and X(j)',[(2,192),(6,55)]),
                                ('X(i)-Ceva conjugate of X(j)',[(192,2),(55,6)])]:
            body=prefix+' for these (i,j): (192,2), {55,6}'
            self.assertEqual([r.references for r in m.ceva_cross_candidates(4000,body,3)],expected)
            for suffix in [' wrt excentral triangle',' in triangle BCI',', (9,broken)']:
                self.assertFalse(m.ceva_cross_candidates(4000,body+suffix,3))
        for body in ['cevapoint of X(2) and X(7) in triangle BCI',
                     'X(2)-cross conjugate of X(87) when ABC is acute',
                     'cevapoint of X(4000) and X(7)']:
            self.assertFalse(m.ceva_cross_candidates(4000,body,3))

    def test_13580_13581_close_via_finite_cross_conjugates_without_implicit_j(self):
        entries=dict(split_entries((m.CACHE/'sources/ETCPart7.html').read_text(encoding='utf-8',errors='replace')))
        atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json')
        records=m.read_recipes(m.DATA/'chunks/8.txt')
        native=m.numeric_coordinates({n:records[n] for n in [8115,8116]},atlas,m.read_native_status(m.DATA/'native-status.txt')[1])
        for n,other in [(13580,8115),(13581,8116)]:
            options=extract_entry(n,entries[n],7)
            recipe=next(r for r in options if r.operation=='B' and r.references==(other,2))
            self.assertFalse(any(r.operation=='B' and not r.references for r in options))
            for shape,points in native.items():
                point=m.numeric_transform_formula(recipe,[points[other],points[2]],atlas['triangles'][shape])
                base,d=m.line_data(points[262],points[2552 if n==13580 else 2553])
                residual=abs((point[0]-base[0])*d[1]-(point[1]-base[1])*d[0])/math.hypot(*d)
                self.assertLess(residual,1e-8)

    def test_reflection_opcode_uses_arity_without_accepting_retired_l(self):
        with TemporaryDirectory(dir=m.CACHE) as directory:
            path=Path(directory)/'recipes.txt'
            path.write_text('4000 R 1 2\n4001 R 1 2 3\n')
            records=m.read_recipes(path)
            self.assertEqual(records[4000].references,(1,2))
            self.assertEqual(records[4001].references,(1,2,3))
            self.assertLess(m.quality(records[4000]),m.quality(records[4001]))
            self.assertEqual(m.operation_priority(records[4001]),5)
            for row in ['4000 L 1 2 3','4000 R 1','4000 R 1 2 3 4']:
                path.write_text(row)
                with self.assertRaises(ValueError):m.read_recipes(path)

    def test_projective_barycentric_powers_and_line_operations(self):
        abc=[(0,0),(3,0),(0,3)]
        for op,expected in [('P',(2,0)),('R',(2,-3))]:
            recipe=Recipe(4000,op,(1,2,30))
            validate_types({4000:recipe},{30})
            for scale in [1e-7,1,1e7]:
                atlas=dict(triangles={'t':abc},coordinates={'t':{'1':(2,3),'2':(1,0)}})
                p=numeric_coordinates({4000:recipe},atlas,cached={'t':{1:(2,3),2:(1,0),30:Ideal(scale,0)}})['t'][4000]
                self.assertLess(math.dist(p,expected),1e-9)
            for refs in [(30,1,2),(1,30,31)]:
                with self.assertRaises(ValueError):validate_types({4000:Recipe(4000,op,refs)},{30,31})
        atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json')
        native=m.numeric_coordinates({},atlas,m.read_native_status(m.DATA/'native-status.txt')[1])
        recipe=next(r for r in extract_entry(23613,'<h3>X(23613) = Barycentric cube of X(520)</h3>',13) if r.operation=='B')
        validate_types({23613:recipe},{520})
        for shape,triangle in atlas['triangles'].items():
            expected=m.numeric_formula(Recipe(23613,'B',(),formula='cos(A)^6*(b^2-c^2)^3'),triangle)
            for scale in [1e-4,1,1e4]:
                d=native[shape][520];point=m.numeric_transform_formula(recipe,Ideal(d.dx*scale,d.dy*scale),triangle)
                self.assertLess(math.dist(point,expected),1e-7)
        self.assertIsNone(m.numeric_transform_formula(recipe,Ideal(1,0),abc))
        with self.assertRaisesRegex(ValueError,'Unknown ideal direction'):
            validate_types({4000:Recipe(4000,'I',()),4001:Recipe(4001,'B',(4000,),formula='x^3')},set())
        with self.assertRaises(ValueError):validate_types({4000:Recipe(4000,'B',(520,),formula='x')},{520})
        self.assertFalse(any(r.operation=='B' for r in extract_entry(4000,'<h3>X(4000) = barycentric cube of X(520) in triangle BCI</h3>',13)))

    def test_explicit_oh_ratio_local_does_not_define_implicit_j(self):
        self.assertIsNone(normalize_formula('J'))
        self.assertFalse(coordinate_candidates('Barycentrics a*(1+J) : :'))
        formula=coordinate_candidates('Barycentrics a*(1+J) : : , where J=|OH|/R')[0][1]
        atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json');native=m.numeric_coordinates({},atlas)
        for shape,abc in atlas['triangles'].items():
            env=side_environment(*[math.dist(abc[(i+1)%3],abc[(i+2)%3]) for i in range(3)])
            ratio=math.dist(native[shape][3],native[shape][4])/env['R']
            self.assertAlmostEqual(evaluate_formula(formula,env),env['a']*(1+ratio))

    def test_infinity_line_heading_variants_keep_target_identity(self):
        for heading in ['X{4000) lies on these lines: {30,511}, {1,2}',
                        'X(4000 lies on these lines: {30,511}, {1,2}',
                        'X(4000) lies on the line {30,511}',
                        'X(4000) lies on this line: X(30)X(511)']:
            recipes = extract_entry(4000,f'<p>{heading}</p>',3)
            self.assertTrue(any(r.operation=='I' for r in recipes),heading)
            self.assertFalse(any(r.operation=='I' for r in extract_entry(4001,f'<p>{heading}</p>',3)))
        self.assertIn((1,2),[r.references for r in extract_entry(4000,
            '<p>X{4000) lies on these lines: {30,511}, {1,2}</p>',3)])

    def test_infinity_intersection_title_supplies_direction_in_both_orders(self):
        for body in ['X(1)X(46403)∩X(30)X(511)',
                     'X(511)X(30)∩X(46403)X(1)',
                     'intersection of lines X(1)X(46403) and X(30)X(511)']:
            recipes=extract_entry(70855,f'<h3>X(70855) = {body}</h3>',36)
            self.assertIn(('I',(1,46403)),[(r.operation,r.references) for r in recipes])
            self.assertNotIn('J',[r.operation for r in recipes])
        for suffix in [' wrt the excentral triangle',' if ABC is acute',' in the excentral triangle']:
            recipes=extract_entry(70855,f'<h3>X(70855) = X(1)X(46403)∩X(30)X(511){suffix}</h3>',36)
            self.assertFalse(any(r.operation=='I' for r in recipes))

    def test_open_block_boundary_and_missing_on_in_line_heading(self):
        fragment = ('<h3 id="X4000">X(4000) = CENTER</h3>'
                    'Barycentrics a^3+D : :<br>where D=4*S*sqrt(R*(4*R+r))'
                    '<p>X(4000) lies the Terzic circle and these lines: {1,2}, {3,4}, {5,6}</p>')
        recipes = extract_entry(4000, fragment, 3)
        self.assertTrue(any(r.operation == 'B' for r in recipes))
        self.assertEqual(sum(r.operation == 'J' for r in recipes), 3)
        self.assertEqual(listed_lines(4001, ['X(4000) lies the circle and these lines: 1,2 3,4']), [])


    def test_additional_coordinate_syntax_and_brocard_angle(self):
        examples = [
            'Trilinears f(A,B,C):f(B,C,A):f(C,A,B), where f(A,B,C)=tan(A+2ω)',
            'Trilinears T(A,B,C):T(B,C,A):T(C,A,B), where T(A,B,C)=cos(B-C) (Chris van Tienhoven, April 7, 2013)',
            'Barycentrics (1+sec A/2)(sec B/2+sec C/2)-tan<sup>2</sup>A/2',
            'Barycentrics f(A,B,C):f(B,C,A):f(C,A,B), where f(A,B,C)=(4 sin A)g(A,B,C)+(sin B)g(B,C,A)+(sin C)g(C,A,B), where g(A,B,C)=cos(A/3)+2 cos(B/3)cos(C/3)',
            'Trilinears cos(A/2)*(p+q): : , where p=sin(A/2), q=cos((B-C)/2)',
        ]
        for text in examples:
            with self.subTest(text=text):
                self.assertEqual(len(coordinate_candidates('<p>' + text + '</p>')), 1)
        omega_formula = coordinate_candidates('<p>' + examples[0] + '</p>')[0][1]
        env = side_environment(5, 6, 7)
        self.assertAlmostEqual(evaluate_formula(omega_formula, env), 5*math.tan(env['A']+2*math.atan(env['S']/env['SW'])))
        self.assertEqual(coordinate_candidates('<p>Trilinears g(A,B,C):g(B,C,A):g(C,A,B), where f(A,B,C)=cos A</p>'), [])

    def test_combo_can_be_real_on_only_one_sample(self):
        recipe = shinagawa_candidates(5002, 'As a point on the Euler line, X(5002) has Shinagawa coefficients (E+2*F+2*Sqrt[F*(E+F)],-2*(E+F+Sqrt[F*(E+F)])).', 4)[0]
        atlas = {'triangles': {'acute': [(0, 0), (4, 0), (1, 3)], 'obtuse': [(0, 0), (6, 0), (-1, 2)]}}
        coords = {'acute': {2: (5/3, 1), 4: (1, 1)}, 'obtuse': {2: (5/3, 2/3), 4: (-1, -3.5)}}
        self.assertIsNotNone(numeric_combo(recipe, [coords['acute'][2], coords['acute'][4]], atlas['triangles']['acute']))
        self.assertIsNone(numeric_combo(recipe, [coords['obtuse'][2], coords['obtuse'][4]], atlas['triangles']['obtuse']))
        self.assertTrue(shinagawa_candidate_supported(recipe, coords, atlas, [], [(2, 4)]))

    def test_shinagawa_coefficients_convert_to_normalized_combo(self):
        samples = [
            ('As a point on the Euler line, X(5046) has Shinagawa coefficients (abc$a$, - 4S^(2)), and also (R, -2r).',
             ['5046 F 2:3*(a*b*c*(a+b+c)) 4:-4*S^(2)', '5046 F 2:3*(R) 4:-2*r']),
            ('As a point on the Euler line, X(5051) has Shinagawa coefficients (a*b*c+$a$(E+F),a*b*c-$a*SA$).',
             ['5051 F 2:3*(a*b*c+(a+b+c)*(E+F)) 4:a*b*c-(a*SA+b*SB+c*SC)']),
        ]
        for line, expected in samples:
            number = int(line.split('X(')[1].split(')')[0])
            self.assertEqual([r.row() for r in shinagawa_candidates(number, line, 4)], expected)
        equivalent = shinagawa_candidates(5046, samples[0][0], 4)
        for triangle, centroid, orthocenter in [
            ([(0, 0), (4, 0), (1, 3)], (5/3, 1), (1, 1)),
            ([(0, 0), (6, 0), (-1, 2)], (5/3, 2/3), (-1, -3.5)),
        ]:
            p, q = [numeric_combo(item, [centroid, orthocenter], triangle) for item in equivalent]
            self.assertAlmostEqual(p[0], q[0])
            self.assertAlmostEqual(p[1], q[1])
        text = 'As a point on the Euler line, X(4000) has Shinagawa coefficients (2, 3).'
        recipe = shinagawa_candidates(4000, text, 3)[0]
        triangle = [(0, 0), (4, 0), (1, 3)]
        centroid, orthocenter = (5/3, 1), (1, 1)
        actual = numeric_combo(recipe, [centroid, orthocenter], triangle)
        a, b, c = (math.dist(triangle[1], triangle[2]), math.dist(triangle[2], triangle[0]), math.dist(triangle[0], triangle[1]))
        env = side_environment(a, b, c)
        weights = [2*env['S']**2 + 3*env['SB']*env['SC'],
                   2*env['S']**2 + 3*env['SC']*env['SA'],
                   2*env['S']**2 + 3*env['SA']*env['SB']]
        expected = [sum(w*p[i] for w, p in zip(weights, triangle))/sum(weights) for i in (0, 1)]
        for value, reference in zip(actual, expected):
            self.assertAlmostEqual(value, reference)
        self.assertAlmostEqual(env['E'], 4*env['R']**2)
        self.assertAlmostEqual(env['F'], env['SW']-env['E'])
        self.assertEqual(normalize_formula('bcS_BS_C+2EF+aS_A'), 'b*c*SB*SC+2*E*F+a*SA')
        symbolic = ('As a point on the Euler line, X(4002) has Shinagawa coefficients '
                    '($aS_A$abc, -$bcS_BS_C$), and also Shinagawa coefficients (R, r).')
        self.assertEqual([r.row() for r in shinagawa_candidates(4002, symbolic, 3)],
                         ['4002 F 2:3*((a*SA+b*SB+c*SC)*a*b*c) 4:-(b*c*SB*SC+c*a*SC*SA+a*b*SA*SB)',
                          '4002 F 2:3*(R) 4:r'])
        self.assertEqual(shinagawa_candidates(4001, text, 3), [])
        self.assertEqual(shinagawa_candidates(4000, text[:-1] + ' if ABC is acute', 3), [])
        self.assertEqual(shinagawa_candidates(4000, text.replace('(2, 3)', '(2, 3'), 3), [])
        bad = 'As a point on the Euler line, X(4000) has Shinagawa coefficients (E^3-F^3*-768*F*S^2,E^3).'
        self.assertEqual(shinagawa_candidates(4000, bad, 3), [])
        self.assertFalse(homogeneous_degree('a*(13*SA+22)')[0])
        self.assertTrue(homogeneous_degree('a*(13*cos(A)+22*sin(A))')[0])

    def test_shinagawa_screen_rejects_conflicting_coordinates_and_lines(self):
        recipe = shinagawa_candidates(4000, 'As a point on the Euler line, X(4000) has Shinagawa coefficients (1,1).', 3)[0]
        tri = [[0, 0], [4, 0], [1, 3]]
        atlas = {'triangles': {'acute': tri, 'obtuse': tri}}
        coords = {shape: {2: (5/3, 1), 4: (1, 1), 1: (0, 0), 3: (0, 2)} for shape in atlas['triangles']}
        self.assertTrue(shinagawa_candidate_supported(recipe, coords, atlas, [], []))
        self.assertFalse(shinagawa_candidate_supported(recipe, coords, atlas, [], [(1, 3)]))
        self.assertFalse(shinagawa_candidate_supported(recipe, coords, atlas,
                         [Recipe(4000, 'B', (), formula='1')], []))
    def test_etc_combos(self):
        examples = [
            ('X(8350) = 4*SW^2*(15*S^2-SW^2)*X(3)+3*(3*S^2-SW^2)*(S^2+SW^2)*X(7840)', (3, 7840)),
            ('X(8350) = 3 (3 S^2 - 5 SW^2) (S^2 + SW^2) X[2] + 4 SW^2 (15 S^2 - SW^2) X[3] + 12 SW^2 (S^2 + SW^2) X[6]', (2, 3, 6)),
            ('X(9370) = 2*r*R*X(8)+(r+2*R+s)*(r+2*R-s)*X(221)', (8, 221)),
            ('X(3109) = 3 X[1325] - X[5196]', (1325, 5196)),
        ]
        for text, refs in examples:
            number = int(text.split(')')[0][2:])
            recipe = combo_candidate(number, text, 3)
            self.assertIsNotNone(recipe, text)
            self.assertEqual(recipe.references, refs)
            with TemporaryDirectory(dir=CACHE) as folder:
                path = Path(folder) / 'combo.txt'
                path.write_text(recipe.row() + '\n', encoding='utf-8')
                self.assertEqual(read_recipes(path)[number].formula, recipe.formula)
        combo = combo_candidate(3109, examples[-1][0], 3)
        self.assertEqual(numeric_combo(combo, [(2, 3), (4, 5)], [(0, 0), (6, 0), (1, 4)]), (1, 2))
        self.assertIsNone(numeric_combo(Recipe(4000, 'F', (1, 2), formula='1|-1'), [(0, 0), (1, 1)], [(0, 0), (6, 0), (1, 4)]))
        self.assertIsNone(combo_candidate(4000, 'X(4000) = X(1) + X(2) if ABC is acute', 3))
        self.assertIsNone(combo_candidate(4000, 'X(4000) = X(1)*X(2)', 3))
        self.assertIsNone(combo_candidate(4000, 'X(4000) = 2+3*X(1)+X(2)', 3))
        validate_types({4000: Recipe(4000, 'I', (1, 2))}, set())
        with self.assertRaises(ValueError):
            validate_types({4000: Recipe(4000, 'I', (1, 2)), 4001: Recipe(4001, 'F', (4000, 2), formula='1|1')}, set())

    def test_relations_consume_the_complete_point_expression(self):
        for expression in [
            'complement of X(19)-isoconjugate of X(22160)',
            'anticomplement of X(101)-of-orthocentroidal-triangle',
            'midpoint of X(5) and X(5)-of-circumsymmedial-triangle',
            'isogonal conjugate of X(3)X(3054) intersect X(6)X(1657)',
            'isotomic conjugate of X(4)-Ceva conjugate of X(5)',
            'complement of X(8010)?',
            'reflection of X(i) in X(j) for these (i,j): (1,2) wrt another triangle',
        ]:
            with self.subTest(expression=expression):
                self.assertEqual(list(extract_entry(4000, 'X(4000) = '+expression, 3)), [])
        for expression, expected in [
            ('reflection of X(100) in X(1)X(2)', '4000 R 100 1 2'),
            ('reflection of X(100) in X(1)', '4000 R 100 1'),
            ('complement X(1577)', '4000 C 1577'),
            ('midpoint of X(3) and X(4))', '4000 M 3 4'),
            ('reflection of X(6) in X(7) for these {i,j}: {6,7}', '4000 R 6 7'),
        ]:
            with self.subTest(expression=expression):
                self.assertEqual([r.row() for r in extract_entry(4000, 'X(4000) = '+expression, 3)], [expected])

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
        self.assertEqual([r.row() for r in extract_entry(4003, '<h3 id="X4003">X(4003) = IDEAL POINT</h3>'
                                       '<p>X(4003) = isogonal conjugate of X(4)</p>', 3)], ['4003 I'])

    def test_conjugates_line_reflection_and_wrapped_intersection(self):
        html = ('<h3 id="X4100">X(4100) = ISOGONAL CONJUGATE OF X(7)</h3>'
                '<p>X(4100) = isotomic conjugate of X(8)<br>'
                'X(4100) = reflection of X(9) in line X(1)X(2)<br>'
                'X(4100) = intersection of lines X(1)X(3) and<br>X(2)X(4)<br>'
                'X(4100) = isogonal conjugate of X(10) wrt another triangle</p>')
        recipes = extract_entry(4100, html, 3)
        self.assertEqual({(r.operation, r.references) for r in recipes},
                         {('G', (7,)), ('T', (8,)), ('R', (9, 1, 2)), ('J', (1, 3, 2, 4))})

    def test_circumcircle_inverse_relations(self):
        html = ('<h3 id="X4108">X(4108) = INVERSE-IN-CIRCUMCIRCLE OF X(7)</h3>'
                '<p>X(4108) = circumcircle-inverse of X(8)<br>'
                'X(4108) = circumcircle-inverse of X(9) wrt another triangle</p>')
        self.assertEqual({recipe.row() for recipe in extract_entry(4108, html, 3)},
                         {'4108 V 7', '4108 V 8'})
        triangle = [(0, 0), (6, 0), (1, 4)]
        source = (1, 1)
        inverse = numeric_circum_inverse(source, triangle)
        self.assertIsNotNone(inverse)
        restored = numeric_circum_inverse(inverse, triangle)
        self.assertAlmostEqual(restored[0], source[0])
        self.assertAlmostEqual(restored[1], source[1])
        self.assertIsNone(numeric_circum_inverse((3, 1.375), triangle))
        self.assertIsNone(numeric_circum_inverse(Ideal(1, 0), triangle))

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
                         {'4102 I', '4102 I 1 3', '4102 I 2 4'})
        other = ('<h3 id="X4103">X(4103) = ISOGONAL CONJUGATE OF INFINITE POINT</h3>'
                 '<p>X(4103) lies on these lines: {1, 3}, {2, 4}</p>')
        self.assertTrue(extract_entry(4103, other, 3))

    def test_infinity_line_and_parallel_heading(self):
        by_infinity_line = ('<h3 id="X4106">X(4106) = CENTER</h3><p>'
                            'X(4106) lies on these lines: {1, 2}, {30, 511}, {3, 4}</p>')
        parallel = ('<h3 id="X4107">X(4107) = CENTER</h3><p>'
                    'X(4107) lies on these (parallel) lines: 1,2 3,4</p>')
        self.assertEqual({recipe.row() for recipe in extract_entry(4106, by_infinity_line, 3)},
                         {'4106 I', '4106 I 1 2', '4106 I 3 4'})
        self.assertEqual({recipe.row() for recipe in extract_entry(4107, parallel, 3)},
                         {'4107 I', '4107 I 1 2', '4107 I 3 4'})

    def test_directionless_ideal_is_metadata_not_a_dependency(self):
        html = '<h3 id="X4109">X(4109) = CENTER</h3><p>X(4109) lies on these lines: {30, 511}</p>'
        marker = extract_entry(4109, html, 3)[0]
        self.assertEqual(marker.row(), '4109 I')
        with TemporaryDirectory(dir=CACHE) as folder:
            path = Path(folder) / 'ideals.txt'
            path.write_text(marker.row() + '\n', encoding='utf-8')
            self.assertEqual(read_recipes(path)[4109].references, ())
        validate_types({4109: marker}, set())
        for op, refs in [('J', (1, 4109, 2, 3)), ('G', (4109,)), ('T', (4109,)), ('M', (1, 4109))]:
            with self.assertRaisesRegex(ValueError, 'Unknown ideal direction'):
                validate_types({4109: marker, 4110: Recipe(4110, op, refs)}, set())

    def test_single_infinity_line_identifies_the_target_as_ideal(self):
        for number, pair in [(6364, '30, 511'), (6365, '511, 30')]:
            html = (f'<h3 id="X{number}">X({number}) = CENTER</h3>'
                    f'<p>X({number}) lies on this line: {{{pair}}} (the infinity line)</p>'
                    f'<p>X({number}) = isogonal conjugate of X(6135)</p>')
            self.assertEqual([recipe.row() for recipe in extract_entry(number, html, 4)], [f'{number} I'])
        other = ('<h3 id="X6364">X(6364) = CENTER</h3>'
                 '<p>X(6365) lies on this line: {30, 511}</p>')
        self.assertEqual(extract_entry(6364, other, 4), [])
        multiple = ('<h3 id="X6364">X(6364) = CENTER</h3>'
                    '<p>X(6364) lies on this line: {1, 2}, {30, 511}, {3, 4}</p>')
        self.assertEqual({recipe.row() for recipe in extract_entry(6364, multiple, 4)},
                         {'6364 I', '6364 I 1 2', '6364 I 3 4'})
        wrapped = ('<h3 id="X6364">X(6364) = CENTER</h3>'
                   '<p>X(6364) lies on this line: 1,2<br>30,511 3,4</p>')
        self.assertEqual({recipe.row() for recipe in extract_entry(6364, wrapped, 4)},
                         {'6364 I', '6364 I 1 2', '6364 I 3 4'})

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

    def test_single_coordinate_and_commutative_cyclic_coordinates(self):
        single = 'Barycentrics a sec<sup>4</sup>(B/4+ C/4)'
        self.assertEqual(coordinate_candidates(single)[0][1], 'a*(sec(B/4+C/4))^4')
        self.assertEqual(coordinate_candidates('Barycentrics a+b'), [])
        triple = ('Barycentrics a - a<sup>1/3</sup>b<sup>1/3</sup>c<sup>1/3</sup> : '
                  'b - a<sup>1/3</sup>b<sup>1/3</sup>c<sup>1/3</sup> : '
                  'c - a<sup>1/3</sup>b<sup>1/3</sup>c<sup>1/3</sup>')
        self.assertEqual(coordinate_candidates(triple)[0][1], 'a-a^(1/3)*b^(1/3)*c^(1/3)')
        self.assertEqual(coordinate_candidates('Barycentrics a-b : b-c : c-b'), [])

    def test_selector_skips_unusable_ideal_input(self):
        candidates = {5528: [Recipe(5528, 'R', (1, 528)), Recipe(5528, 'R', (9, 100))]}
        atlas = {'triangles': {'acute': [[0, 0], [6, 0], [1, 4]], 'obtuse': [[0, 0], [6, 0], [-1, 2]]},
                 'coordinates': {s: {'1': [0, 0], '2': [1, 0], '11': [0, 1], '9': [2, 1], '100': [3, 2]}
                                 for s in ('acute', 'obtuse')}}
        selected = select_recipes(candidates, {}, 6, 6000, atlas=atlas, native_directions={528: (2, 11)})
        self.assertEqual(selected[5528].row(), '5528 R 9 100')




    def test_equivalent_coordinate_notation(self):
        sample = ('Barycentrics g(a,b,c) : g(b,c,a) :<br>'
                  'g(c,a,b), where g(a,b,c) = a*Sqrt[3]+b<br>'
                  'Trilinears h(A,B,C) : h(B,C,A) : h(C,A,B), '
                  'where h(A,B,C) = Sec[(A-2 Pi)/3]')
        self.assertEqual([formula for _, formula, _ in coordinate_candidates(sample)],
                         ['a*sqrt(3)+b', 'a*(sec((A-2*pi)/3))'])
        self.assertEqual(coordinate_candidates('Barycentrics g(a,b,c) : g(b,c,a) : g(c,a,b), '
                                               'where f(a,b,c) = a'), [])

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

    def test_wrapped_coordinates_and_exponent_limits(self):
        self.assertEqual(coordinate_text('Barycentrics a +\n b : :'), ['Barycentrics a + b : :'])
        self.assertEqual(coordinate_text('first\n\nsecond'), ['first', 'second'])
        self.assertEqual(coordinate_candidates('Barycentrics a+\nb : :\n<p>Unrelated description</p>')[0][1], 'a+b')
        wrapped = ('Trilinears (cot A)<sup>1/2</sup> : (cot<br>'
                   'B)<sup>1/2</sup> : (cot C)<sup>1/2</sup>')
        self.assertEqual(coordinate_candidates(wrapped)[0][1], 'a*((cot(A))^(1/2))')
        self.assertEqual(coordinate_candidates('Barycentrics<br>a^32+b^2 : :')[0][1], 'a^32+b^2')
        for formula in ('a^(1/0)', 'a^b'):
            self.assertIsNone(normalize_formula(formula), formula)
        for formula in ('a^33', 'a^(-33)', 'a^(100/2)', 'a^(-32)'):
            self.assertEqual(normalize_formula(formula), formula)
        self.assertEqual(normalize_formula('a100b'), 'a^100*b')
        # Fewer than 500 characters, but more than 500 Python AST nodes.
        long_polynomial = '+'.join(['a^2'] * 100)
        self.assertEqual(normalize_formula(long_polynomial), long_polynomial)
        self.assertEqual(normalize_formula('+'.join(['a^2'] * 130)), '+'.join(['a^2'] * 130))
        wrapped_long = ('Barycentrics f(a,b,c):f(b,c,a):f(c,a,b), where f(a,b,c) = '
                        + '+<br>'.join(['a^2'] * 15))
        self.assertEqual(coordinate_candidates(wrapped_long)[0][1], '+'.join(['a^2'] * 15))

    def test_coordinate_attribution_after_source_newline(self):
        html = ('Barycentrics f(a,b,c) : f(b,c,a) : f(c,a,b),\n'
                'where f(a,b,c) = a(b-c)<sup>2</sup>(a<sup>3</sup>-b<sup>2</sup>c-bc<sup>2</sup>)\n'
                '&nbsp;&nbsp; (Seichii Kirikami, July 2, 2013)<p>Unrelated text</p>')
        self.assertEqual(coordinate_candidates(html)[0][1], 'a*(b-c)^(2)*(a^(3)-b^(2)*c-b*c^(2))')
        self.assertEqual(coordinate_candidates('Barycentrics a+b : b+c : c+a (E. Danneels)')[0][1], 'a+b')
        self.assertEqual(normalize_formula('sin 2A/3 + cot B/2'), 'sin(2*A/3)+cot(B/2)')
        variants = ('Trilinears 1/(4 cos A + sec(A/3)) : : (Peter Moses, April 26, 2013)<br>'
                    'Trilinears g(A,B,C) : g(B,C,A) : g(C,A,B), '
                    'where g(A,B,C) = (sin 2A/3)/sin(5A/3) (Randy Hutson, August 9, 2014)')
        recipes = [Recipe(5458, 'B', (), formula=formula) for _, formula, _ in coordinate_candidates(variants)]
        self.assertEqual(len(recipes), 2)
        for triangle in [[(0, 0), (6, 0), (1, 4)], [(0, 0), (6, 0), (-1, 2)]]:
            p, q = (numeric_formula(recipe, triangle) for recipe in recipes)
            self.assertAlmostEqual(p[0], q[0])
            self.assertAlmostEqual(p[1], q[1])
        self.assertEqual(coordinate_candidates('Barycentrics a(b c) : :')[0][1], 'a*(b*c)')
        adjacent = 'Barycentrics unsupported\nBarycentrics (a-b-c)^2 : :'
        self.assertEqual(coordinate_candidates(adjacent)[0][1], '(a-b-c)^2')
        too_long = ('Barycentrics f(a,b,c) : f(b,c,a) : f(c,a,b),\nwhere f(a,b,c) = '
                    + '+\n'.join(['a^2'] * 130))
        self.assertEqual(coordinate_candidates(too_long)[0][1], '+'.join(['a^2'] * 130))

    def test_coordinate_with_restricted_real_domain(self):
        atlas = {'triangles': {'acute': [[0, 0], [6, 0], [1, 4]],
                               'obtuse': [[0, 0], [6, 0], [-1, 2]]},
                 'coordinates': {'acute': {}, 'obtuse': {}}}
        recipe = Recipe(5374, 'B', (), formula='a*((cot(A))^(1/2))')
        self.assertIsNotNone(numeric_formula(recipe, atlas['triangles']['acute']))
        self.assertIsNone(numeric_formula(recipe, atlas['triangles']['obtuse']))
        anchors = coordinate_anchors({5374: [recipe]}, {}, atlas, None, set(), {}, {})
        self.assertEqual(set(anchors), {5374})
        self.assertEqual(set(select_recipes({5374: [recipe]}, {}, 6, 10000, atlas=atlas)), {5374})

    def test_long_coordinate_can_bypass_optional_length_limit(self):
        formula = '+'.join(['a^2'] * 180)
        recipe = Recipe(5999, 'B', (), formula=formula)
        candidates = {5999: [recipe]}
        self.assertEqual(select_recipes(candidates, {}, 6, 10000), {})
        self.assertEqual(select_recipes(candidates, {}, 6, None)[5999], recipe)

    def test_coordinate_not_defined_on_samples_can_still_be_kept(self):
        atlas = {'triangles': {'acute': [[0, 0], [6, 0], [1, 4]],
                               'obtuse': [[0, 0], [6, 0], [-1, 2]]},
                 'coordinates': {'acute': {}, 'obtuse': {}}}
        recipe = Recipe(5999, 'B', (), formula='sqrt(A-1)')
        self.assertTrue(all(numeric_formula(recipe, abc) is None for abc in atlas['triangles'].values()))
        self.assertIsNotNone(numeric_formula(recipe, [(0, 0), (2, 0), (1, math.sqrt(3))]))
        self.assertIn(5999, coordinate_anchors({5999: [recipe]}, {}, atlas, None, set(), {}, {}))
        self.assertIn(5999, select_recipes({5999: [recipe]}, {}, 6, None, atlas=atlas))
        ideal = Recipe(5998, 'B', (), formula='b-c')
        self.assertNotIn(5998, coordinate_anchors({5998: [ideal]}, {}, atlas, None, set(), {}, {}))

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
        unlimited = coordinate_anchors(candidates, {}, atlas, None, set(), {}, {})
        self.assertEqual(set(unlimited), {4000, 4001, 5000, 5001})

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

    def test_conjugate_of_coordinate_anchor_uses_bound_source_length(self):
        candidates = {3387: [Recipe(3387, 'B', (), formula='a*(sec(A-pi/8))')],
                      3385: [Recipe(3385, 'G', (3387,))]}
        selected = select_recipes(candidates, {}, 6, 6000)
        self.assertEqual(selected[3385].operation, 'G')
        self.assertLess(validate_graph(selected)[1][3385], 6000)

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

    def test_duplicate_line_list(self):
        lines = [
            '''X(7677) lies on these lines:'''
            '''X(7677) lies on these lines: {1, 1170}, {2, 1617}, {3, 390}, {7, 21}, {9, 604}'''
        ]
        assert listed_lines(7677, lines, limit=None) == [
            (7, 21),
            (3, 390),
            (9, 604),
            (1, 1170),
            (2, 1617),
        ]

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


class CandidateFamilyTest(TestCase):
    def test_lazy_extraction_has_the_same_recipes_and_evidence(self):
        fragment = ('<h3 id="X4000">X(4000) = intersection of X(1)X(2) and X(3)X(4)</h3>'
                    '<p>X(4000) lies on these lines: 1,2 3,4 5,6 7,8</p>')
        eager = extract_entry(4000, fragment, 3)
        lazy = extract_entry(4000, fragment, 3, compact=True)
        self.assertIsInstance(lazy, RecipeCandidates)
        self.assertEqual(set(lazy), set(eager))
        self.assertEqual(len(lazy.explicit), 1)
        filtered = lazy.filtered(lambda r: r.operation != 'J')
        self.assertEqual(list(filtered), [])

    def test_valid_explicit_intersection_never_expands_line_pairs(self):
        explicit = Recipe(4000, 'J', (1, 2, 3, 4), evidence='explicit intersection')
        pool = RecipeCandidates(4000, [explicit], [(1, 2), (3, 4), (5, 6)])
        with patch.object(RecipeCandidates, 'inferred', side_effect=AssertionError('unnecessary expansion')):
            selected = select_recipes({4000: pool}, {}, 6, None)
        self.assertEqual(selected[4000], explicit)

    def test_unclosed_explicit_definition_falls_back_to_inferred_pair(self):
        explicit = Recipe(4000, 'M', (9999, 1))
        pool = RecipeCandidates(4000, [explicit], [(1, 2), (3, 4)])
        selected = select_recipes({4000: pool}, {}, 6, None)
        self.assertEqual(selected[4000].operation, 'J')
        self.assertEqual(selected[4000].references, (1, 2, 3, 4))

    def test_failed_numeric_candidate_does_not_block_next_pair(self):
        points = {1: (0, 0), 2: (1, 0), 3: (0, 1), 4: (1, 1), 5: (0, -1), 6: (0, 2)}
        atlas = dict(triangles={'sample': [(0, 0), (6, 0), (1, 4)]},
                     coordinates={'sample': {str(n): xy for n, xy in points.items()}})
        # An explicit list, rather than incidence evidence, isolates pair fallback
        # from the independent third-line consistency requirement.
        options = [Recipe(4000, 'J', (1, 2, 3, 4)), Recipe(4000, 'J', (1, 2, 5, 6))]
        selected = select_recipes({4000: options}, {}, 6, None, atlas=atlas)
        self.assertEqual(selected[4000].references, (1, 2, 5, 6))

    def test_late_third_support_line_reactivates_target(self):
        pool = RecipeCandidates(4000, [], [(1, 2), (3, 4), (5, 4001)])
        points = {1: (-1, 0), 2: (1, 0), 3: (0, -1), 4: (0, 1),
                  5: (2, 2), 6: (0, 0), 7: (2, 2)}
        atlas = dict(triangles={'sample': [(0, 0), (6, 0), (1, 4)]},
                     coordinates={'sample': {str(n): xy for n, xy in points.items()}})
        selected = select_recipes({4000: pool, 4001: [Recipe(4001, 'M', (6, 7))]},
                                  {}, 6, None, atlas=atlas)
        self.assertEqual(set(selected), {4000, 4001})
        self.assertEqual(selected[4000].references, (1, 2, 3, 4))

    def test_late_independent_lines_repair_an_explicit_intersection(self):
        points={1:(-1,0),2:(1,0),3:(0,-1),4:(0,1),5:(0,1),6:(1,2),
                7:(0,3),9:(-3,-1),10:(0,-1),11:(0,3),12:(2,7)}
        atlas=dict(triangles={'sample':[(0,0),(6,0),(1,4)]},
                   coordinates={'sample':{str(n):p for n,p in points.items()}})
        explicit=Recipe(4000,'J',(1,2,3,4),evidence='X(4000) = intersection of lines')
        pool=RecipeCandidates(4000,[explicit],[(1,2),(3,4),(5,6),(7,4001),(9,10)])
        selected=select_recipes({4000:pool,4001:[Recipe(4001,'M',(11,12))]},
                                {},6,None,atlas=atlas)
        self.assertEqual(set(selected),{4000,4001})
        self.assertNotEqual(selected[4000].references,explicit.references)
        self.assertLess(math.dist(numeric_coordinates(selected,atlas)['sample'][4000],(-2,-1)),1e-8)


class ConsensusReviewTest(TestCase):
    def fixture(self, extra=None):
        points={1:(-1,0),2:(1,0),3:(0,2),4:(4,2),5:(2,0),6:(2,4),7:(0,0),8:(4,4),9:(1,2),10:(3,2)}
        atlas=dict(triangles={'sample':[(0,0),(6,0),(0,6)]},
                   coordinates={'sample':{str(n):p for n,p in points.items()}})
        records={4000:Recipe(4000,'M',(1,2)),**(extra or {})}
        return records,atlas

    def test_ideal_review_compares_directions_without_finite_voting(self):
        records,atlas=self.fixture({4000:Recipe(4000,'I',(1,2))})
        fragment='<h3>X(4000) = IDEAL POINT</h3><p>X(4000) lies on these lines: {1,2}, {3,4}</p>'
        row=consensus.Review(records,atlas,{}, {4000:fragment}).audit(4000)
        self.assertEqual(row['status'],'confirmed_ideal')
        self.assertEqual(row['direction_support'],2)
        fragment+='<p>X(4000) lies on this line: {5,6}</p>'
        row=consensus.Review(records,atlas,{}, {4000:fragment}).audit(4000)
        self.assertEqual(row['status'],'ideal_direction_outliers')
        self.assertEqual(row['opposing_lines'],[(5,6)])

    def test_consensus_deduplicates_geometry_and_can_certify_without_pairs(self):
        records,atlas=self.fixture()
        fragment='<h3>X(4000) = PERSPECTOR OF THESE TRIANGLES: TEST</h3>Barycentrics 1 : :<p>X(4000) lies on these lines: {3,4}, {5,6}, {7,8}, {9,10}</p>'
        row=consensus.Review(records,atlas,{}, {4000:fragment}).audit(4000)
        self.assertEqual(row['status'],'proposal')
        self.assertTrue(row['pending_geometry'])
        self.assertEqual(row['ignored']['duplicate_line'],1)
        self.assertEqual(row['metrics']['total_vote_weight'],4)
        self.assertTrue(row['metrics']['dominance_bound'])
        self.assertEqual(row['metrics']['examined_pairs'],0)
        self.assertEqual(row['samples']['sample'],(2,2))
        protected=consensus.Review(records,atlas,{}, {4000:fragment},{4000}).audit(4000)
        self.assertEqual(protected['status'],'reviewed_seed_conflict')

    def test_consensus_ignores_circular_downstream_evidence(self):
        records,atlas=self.fixture({4001:Recipe(4001,'M',(4000,8))})
        fragment='<h3>X(4000) = TEST</h3><p>X(4000) lies on these lines: {3,4001}</p><p>X(4000) = complement of X(4001)</p>'
        row=consensus.Review(records,atlas,{}, {4000:fragment}).audit(4000)
        self.assertEqual(row['ignored']['circular_line'],1)
        self.assertEqual(row['ignored']['circular_relation'],1)
        self.assertEqual(row['evidence_count'],0)
        self.assertNotEqual(row['status'],'proposal')

    def test_shared_upstream_and_coordinate_variants_cannot_multiply_votes(self):
        properties=[dict(kind='line',upstream={4001}),dict(kind='M',upstream={4001,4002}),
                    dict(kind='line',upstream={4003}),dict(kind='coordinate',upstream=set()),
                    dict(kind='coordinate',upstream=set())]
        self.assertEqual(consensus.dependency_weights(properties),[.5,.5,1,.5,.5])

    def test_settle_repairs_roots_then_revotes_without_pinning_descendants(self):
        records,atlas=self.fixture({4001:Recipe(4001,'R',(4000,2))})
        atlas['coordinates']['sample'].update({str(n):p for n,p in {
            11:(-1,-2),12:(1,-2),13:(0,-3),14:(0,-1),15:(-1,-3),16:(1,-1)}.items()})
        fragments={4000:'<h3>X(4000) = PERSPECTOR TEST</h3>Barycentrics 1 : :<p>X(4000) lies on these lines: {3,4}, {5,6}, {7,8}</p>',
                   4001:'<h3>X(4001) = REFLECTION OF X(4000) IN X(2)</h3><p>X(4001) lies on these lines: {11,12}, {13,14}, {15,16}</p><p>X(4001) = reflection of X(4000) in X(2)</p>'}
        review=consensus.Review(records,atlas,{},fragments)
        rows,result=review.settle({4000,4001})
        self.assertEqual([x['id'] for x in result['applied_in_memory']],[4000])
        self.assertEqual(result['rounds'][0]['proposals'],2)
        self.assertEqual(records[4001].row(),'4001 R 4000 2')
        self.assertEqual(review.coordinates['sample'][4001],(0,-2))
        self.assertTrue(all(r['status']=='confirmed' for r in rows))
        self.assertEqual([r['id'] for r in result['pending_geometry']],[4000])

    def test_review_coordinate_cache_is_keyed_by_actual_recipes_and_preserves_ideals(self):
        records,atlas=self.fixture({4001:Recipe(4001,'I',(3,4))})
        with TemporaryDirectory(dir=m.CACHE) as folder:
            path=Path(folder)
            first=consensus.coordinate_snapshot(records,atlas,{},path)
            with patch.object(m,'numeric_coordinates',side_effect=AssertionError('unexpected recomputation')):
                second=consensus.coordinate_snapshot(records,atlas,{},path)
            self.assertEqual(first,second)
            self.assertIsInstance(second['sample'][4001],Ideal)
            changed={**records,4000:Recipe(4000,'R',(1,2))}
            self.assertNotEqual(consensus.coordinate_snapshot(changed,atlas,{},path)['sample'][4000],first['sample'][4000])
            self.assertEqual(len(list(path.glob('*.json.gz'))),2)

    def test_line_pair_fallback_is_exhaustive_when_no_dominance_bound(self):
        lines=[((0,0),(1,0)),((0,1),(1,2)),((0,3),(1,2)),((2,1),(0,5))]
        properties=[]
        for i,(p,q) in enumerate(lines):
            properties.append(dict(kind='line',refs=(2*i+1,2*i+2),upstream=set(),
                values={'sample':m.line_data(p,q)},endpoints={'sample':(p,q)}))
        groups,weights,metrics=consensus.choose(properties,[],{'sample':6},4000)
        self.assertEqual(metrics['examined_pairs'],6)
        self.assertFalse(metrics['dominance_bound'])
        self.assertEqual(sum(weights),4)
        self.assertTrue(groups)

    def test_shared_line_endpoints_are_valid_alias_candidates_not_a_search_cutoff(self):
        points={1:(2,2),2:(0,2),3:(2,0),4:(0,0)}
        properties=[dict(kind='line',refs=(1,j),upstream=set(),
                        values={'sample':m.line_data(points[1],points[j])},
                        endpoints={'sample':(points[1],points[j])}) for j in (2,3,4)]
        groups,weights,metrics=consensus.choose(properties,[],{'sample':6},4000)
        self.assertEqual(groups[0]['points']['sample'],(2,2))
        self.assertEqual(groups[0]['recipes'][0].row(),'4000 M 1 1')
        self.assertEqual(groups[0]['score'],3)

    def test_consensus_graph_rejection_reasons_distinguish_budget_cycle_and_type(self):
        records={4000:Recipe(4000,'M',(1,2)),4001:Recipe(4001,'M',(3,4))}
        graph=m.SelectedGraph(records,m.NATIVE_MAX,m.estimated_recipe_length,(1,None,1))
        self.assertEqual(consensus.admission_reason(graph,Recipe(4000,'M',(4001,1)),set()),'depth_budget')
        self.assertEqual(consensus.admission_reason(graph,Recipe(4000,'M',(30,1)),{30}),'input_type')
        self.assertEqual(consensus.admission_reason(graph,Recipe(4000,'M',(99999,1)),set()),'missing_dependency')
        graph=m.SelectedGraph({4000:records[4000],4001:Recipe(4001,'M',(4000,1))},m.NATIVE_MAX,m.estimated_recipe_length,(6,None,1))
        self.assertEqual(consensus.admission_reason(graph,Recipe(4000,'M',(4001,1)),set()),'cyclic_dependency')


class TopologyEncodingTest(TestCase):
    def test_range_and_adjacency_roundtrip_with_gaps_and_empty_rows(self):
        record = dict(entries=[3000, 3001, 3002, 4000], structurally_direct=[3001, 3002],
                      adjacency={'3001': [4000, 4001, 73269], '3002': [], '4000': [3001]},
                      source_sha256='sample', alternatives=[3, 0, 2])
        self.assertEqual(unpack(pack(record)), record)
        self.assertEqual(ranges([3000, 3001, 3002, 4000]), [[3000, 3002], [4000, 4000]])
        with self.assertRaises(ValueError):
            ranges([2, 1])


class CoordinateLocalTest(TestCase):
    def test_garcia_capitan_coordinates_have_real_and_nonreal_samples(self):
        source=(m.CACHE/'sources/ETCPart6.html').read_text(encoding='utf-8',errors='replace')
        entries=dict(m.split_entries(source));atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json')
        domains={};m.read_recipes(m.DATA/'seeds.txt',{},domains)
        for n in [11065,11066]:
            formula=m.coordinate_candidates(entries[n])[0][1]
            states=[m.numeric_formula(m.Recipe(n,'B',(),formula=formula),abc) for abc in atlas['triangles'].values()]
            states.append(m.numeric_formula(m.Recipe(n,'B',(),formula=formula),[(0,0),(6,0),(3.1,5)]))
            self.assertTrue(any(p is None for p in states))
            self.assertTrue(any(p is not None for p in states))
            self.assertEqual(domains[n],'conditional_complex')

    def test_three_independent_and_explicit_cyclic_scalar_definitions(self):
        env=side_environment(5,6,7)
        for source in ['Barycentrics x+y+z : : , where x=cos(A/2), y=cos(B/2), z=cos(C/2)',
                       'Barycentrics x+y+z : : , where x:y:z=cos(A/2):cos(B/2):cos(C/2)',
                       'Barycentrics x+y+z : : , where x=cos(A/2), and y and z are defined cyclically.']:
            formula=coordinate_candidates(source)[0][1]
            self.assertAlmostEqual(evaluate_formula(formula,env),sum(math.cos(env[k]/2) for k in ('A','B','C')))
        for bad in ['Barycentrics x+y+z : : , where x:y:z=a:c:b',
                    'Barycentrics x+y+z : : , where x=a,y=x,z=b',
                    'Barycentrics x+y+z : : , where x=a',
                    'Barycentrics x+y+z : : , where x=a, and b and z are defined cyclically.']:
            self.assertEqual(coordinate_candidates(bad),[])

    def test_locals_before_cyclic_marker_and_sentence_terminator(self):
        examples=['Trilinears p+q, where p=sin(A/2) and q=cos((B-C)/2) : :',
                  'Barycentrics a^2+T : : where T = S.',
                  'Barycentrics a^2+T : : , where T = S.']
        for source in examples:
            self.assertEqual(len(coordinate_candidates(source)),1,source)
        self.assertEqual(coordinate_candidates('Barycentrics a+T : : where T=unknown(a).'),[])
    def test_local_cyclic_function_calls_in_first_coordinate(self):
        source = 'Barycentrics (b-c)*f(b,c,a)*f(c,a,b) : : , where f(a,b,c)=a^2+b*c'
        formula = coordinate_candidates(source)[0][1]
        self.assertAlmostEqual(evaluate_formula(formula,side_environment(5,6,7)),
                               (6-7)*(6**2+7*5)*(7**2+5*6))
        for bad in [source.replace('f(b,c,a)','f(b,a,c)'),
                    source.replace('a^2+b*c','f(a,b,c)+a'),
                    source.replace('a^2+b*c','unknown(a)+b')]:
            self.assertEqual(coordinate_candidates(bad),[])

    def test_wrapped_two_locals_and_single_uppercase_local(self):
        env = side_environment(5, 6, 7)
        for source, expected in [
            ('Trilinears p+q : :<br>where p=sin(A/2), q=cos((B-C)/2)',
             5*(math.sin(env['A']/2)+math.cos((env['B']-env['C'])/2))),
            ('Trilinears a^3+D : :<br>where D=4*S*sqrt(R*(4*R+r))',
             5*(125+4*env['S']*math.sqrt(env['R']*(4*env['R']+env['r'])))),
            ('Trilinears p+q : : , where p=sin(A/2), q=cos((B-C)/2) : :',
             5*(math.sin(env['A']/2)+math.cos((env['B']-env['C'])/2))),
        ]:
            candidates = coordinate_candidates(source)
            self.assertEqual(len(candidates), 1, source)
            self.assertAlmostEqual(evaluate_formula(candidates[0][1], env), expected)

    def test_group_braces_are_arithmetic_not_sets(self):
        candidates = coordinate_candidates('Barycentrics {a^2+b*c}*(b+c) : :')
        self.assertAlmostEqual(evaluate_formula(candidates[0][1], side_environment(5, 6, 7)), 871)
        self.assertEqual(coordinate_candidates('Barycentrics {a,b,c} : :'), [])

    def test_local_chains_unknown_symbols_and_global_shadowing_rejected(self):
        for source in ['Barycentrics p+q : : , where p=q+1, q=a',
                       'Barycentrics a : : , where a=1',
                       'Barycentrics D+a : : , where D=unknown(3)']:
            self.assertEqual(coordinate_candidates(source), [], source)


class CircleAndLogTest(TestCase):
    def test_bare_functions_keep_explicit_argument_boundaries(self):
        for source, expected in [('sin A','sin(A)'),('sin 2A/3','sin(2*A/3)'),
                                 ('cos B cot B/2','cos(B)*cot(B/2)'),
                                 ('LOG b - log c','ln(b/c)'),('a*(log b-log c)','a*ln(b/c)'),
                                 ('ln (c/b)','ln(c/b)'),('sinh A','sinh(A)')]:
            self.assertEqual(normalize_formula(source),expected,source)
        for source in ['log bc','log b/c','log b^2','log unknown','log b c']:
            self.assertIsNone(normalize_formula(source),source)
        self.assertFalse(homogeneous_degree(normalize_formula('log b'))[0])
        for expression in ['2*log b-log c', '-log b-log c', 'log b+log c']:
            self.assertFalse(homogeneous_degree(normalize_formula(expression))[0],expression)
        self.assertEqual(normalize_formula('-(log b-log c)'),'-ln(b/c)')
        formula = coordinate_candidates('Barycentrics a^2*(b^4-c^4)/(log b-log c) : :')[0][1]
        self.assertTrue(homogeneous_degree(formula)[0])
        self.assertAlmostEqual(evaluate_formula(formula,side_environment(5,6,7)),
                               evaluate_formula(formula,side_environment(10,12,14))/64)

    def test_center_parse_finite_domain_and_degenerate_inputs(self):
        recipes = m.extract_entry(4000, '<h3 id="X4000">X(4000) = CENTER OF THE CIRCLE {X(5),X(6),X(22)}</h3>', 3)
        self.assertEqual(recipes[0].row(), '4000 O 5 6 22')
        self.assertEqual(m.numeric_circle_center([(0,0),(4,0),(0,2)]), (2,1))
        self.assertIsNone(m.numeric_circle_center([(0,0),(1,0),(2,0)]))
        self.assertIsNone(m.numeric_circle_center([m.Ideal(1,0),(1,0),(0,1)]))
        with self.assertRaises(ValueError):
            m.validate_types({4000:m.Recipe(4000,'O',(30,1,2))}, {30})
        self.assertEqual(m.extract_entry(4000, 'X(4000) = center of circle {X(1),X(2),X(3)} when acute', 3), [])

    def test_log_coordinates_equal_prefix_and_homogeneity(self):
        result = coordinate_candidates('Barycentrics = a/log(c/b) : b/log(a/c) : c/log(b/a)')
        self.assertEqual(result[0][1], 'a/ln(c/b)')
        self.assertTrue(homogeneous_degree(result[0][1])[0])
        self.assertFalse(homogeneous_degree('ln(a)')[0])
        self.assertAlmostEqual(evaluate_formula(result[0][1],side_environment(5,6,7)),5/math.log(7/6))
        self.assertIsNone(evaluate_formula('ln(-1)',{}))
        self.assertEqual(coordinate_candidates('Barycentrics ln(a,b) : :'), [])

    def test_power_curve_poles_match_tangent_line_reciprocals(self):
        for exponent in (1,2):
            sides=(5,6,7)
            p=[a**exponent for a in sides]
            derivative=[x*math.log(a) for a,x in zip(sides,p)]
            line=[p[1]*derivative[2]-p[2]*derivative[1],
                  p[2]*derivative[0]-p[0]*derivative[2],
                  p[0]*derivative[1]-p[1]*derivative[0]]
            actual=[a**exponent/math.log(c/b) for a,b,c in [(5,6,7),(6,7,5),(7,5,6)]]
            expected=[1/x for x in line]
            for a,b in zip(actual,expected):
                self.assertAlmostEqual(a/sum(actual),b/sum(expected))


class AbsoluteCoordinatesTest(TestCase):
    def test_flat_arithmetic_bars_keep_power_and_product_scope(self):
        for raw,expected in [('|b^(2)-c^(2)|',13),('|(a^2-b^2)(a^2-c^2)|',264),
                             ('a^2|b^2-c^2|',325),('|sin(B-C)|',None)]:
            formula=normalize_formula(raw);self.assertIsNotNone(formula,raw)
            if expected is not None:self.assertAlmostEqual(evaluate_formula(formula,side_environment(5,6,7)),expected)
        for raw in ['|a+(b|','|a+|b-c||','|unknown|','|a|b|','||b-c||']:
            self.assertIsNone(normalize_formula(raw),raw)

    def test_steiner_ellipse_inverse_known_members_and_involution(self):
        atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json')
        native=m.numeric_coordinates({},atlas,m.read_native_status(m.DATA/'native-status.txt')[1])
        for kind,members in [('CIRCUMELLIPSE',[(1,239),(3,401)]),('INELLIPSE',[(1,3008),(3,441)])]:
            for source,target in members:
                title=f'STEINER-{kind}-INVERSE OF X({source})'
                recipe=next(r for r in extract_entry(99999,f'<h3>X(99999) = {title}</h3>',23) if r.operation=='B')
                self.assertEqual(recipe.references,(source,))
                alias=f'inverse-in-Steiner-{kind.lower()} of X({source})'
                self.assertEqual(next(r.formula for r in extract_entry(99999,f'<h3>X(99999) = {alias}</h3>',23) if r.operation=='B'),recipe.formula)
                for shape,abc in atlas['triangles'].items():
                    point=m.numeric_transform_formula(recipe,native[shape][source],abc)
                    self.assertLess(math.dist(point,native[shape][target]),1e-8)
                    restored=m.numeric_transform_formula(recipe,point,abc)
                    self.assertLess(math.dist(restored,native[shape][source]),1e-8)
                    G=native[shape][2]
                    self.assertIsNone(m.numeric_transform_formula(recipe,G,abc))
                for suffix in [' wrt the excentral triangle',' in triangle BCI',' if ABC is acute']:
                    self.assertFalse(any(r.operation=='B' for r in extract_entry(99999,f'<h3>X(99999) = {title}{suffix}</h3>',23)))
        self.assertFalse(any(r.operation=='B' for r in extract_entry(99999,
            '<h3>X(99999) = STEINER-INELLIPSE-INVERSE OF X(2)</h3>',23)))

    def test_side_extrema_match_absolute_value_identity_under_permutations(self):
        for a,b,c in [(5,6,7),(7,5,6),(6,7,5),(5,5,6)]:
            env = side_environment(a,b,c)
            for source,expected in [('max(b,c)',max(b,c)),('MAX(b,c)',max(b,c)),('min(b,c)',min(b,c)),
                                    ('|b-c|',abs(b-c)),('abs(b^2-c^2)',abs(b*b-c*c))]:
                formula = normalize_formula(source)
                self.assertAlmostEqual(evaluate_formula(formula,env),expected)
                self.assertEqual(homogeneous_degree(formula),(True,2 if '^2' in source else 1))
        for source in ['max(a,b,c)','min(a,unknown)','|b-c','||b-c||','abs(a,b)']:
            self.assertIsNone(normalize_formula(source),source)
        self.assertFalse(homogeneous_degree('abs(a+b^2)')[0])

    def test_explicit_and_cyclic_coordinates_agree(self):
        self.assertTrue(coordinate_candidates('Trilinears max(b,c) : max(c,a) : max(a,b)'))
        self.assertTrue(coordinate_candidates('Barycentrics bc|b-c| : ca|c-a| : ab|a-b| : :'))
        self.assertEqual(coordinate_candidates('Barycentrics a : b : c : a : :'),[])


class SpecialCircleInverseTest(TestCase):
    def test_circle_inverse_fixed_points_involution_and_degeneracy(self):
        self.assertEqual(m.numeric_circle_inverse([(4,0),(0,0),(2,0)]),(1,0))
        self.assertEqual(m.numeric_circle_inverse([(2,0),(0,0),(2,0)]),(2,0))
        p = (3,4)
        q = m.numeric_circle_inverse([p,(1,2),(4,2)])
        self.assertLess(math.dist(p,m.numeric_circle_inverse([q,(1,2),(4,2)])),1e-12)
        for points in [[(0,0),(0,0),(2,0)],[(3,0),(0,0),(0,0)],
                       [m.Ideal(1,0),(0,0),(2,0)]]:
            self.assertIsNone(m.numeric_circle_inverse(points))

    def test_only_unqualified_brocard_definitions_are_admitted(self):
        for body in ['Brocard-circle-inverse of X(654)','inverse-in-Brocard circle of X(654)']:
            recipes = m.extract_entry(41158,'X(41158) = '+body,21)
            self.assertEqual([r.row() for r in recipes],['41158 V 654 182 3'])
            for suffix in [' wrt excentral triangle',' in the medial triangle',' relative to ABC',' when ABC is acute']:
                self.assertEqual(m.extract_entry(41158,'X(41158) = '+body+suffix,21),[])
        with self.assertRaises(ValueError):
            m.validate_types({41158:m.Recipe(41158,'V',(30,182,3))},{30})

    def test_native_brocard_center_and_inverse_dependency_closure(self):
        atlas = m.read_native_atlas(m.CACHE/'native'/'native-atlas.json')
        records = {41158:m.Recipe(41158,'V',(654,182,3))}
        native = m.numeric_coordinates({},atlas)
        values = m.numeric_coordinates(records,atlas)
        for shape,points in native.items():
            midpoint = tuple((points[3][i]+points[6][i])/2 for i in (0,1))
            self.assertLess(math.dist(midpoint,points[182]),1e-10)
            p = values[shape][41158]
            self.assertLess(math.dist(m.numeric_circle_inverse([p,points[182],points[3]]),points[654]),1e-8)
            self.assertLess(abs((p[0]-points[182][0])*(points[654][1]-points[182][1])
                                -(p[1]-points[182][1])*(points[654][0]-points[182][0])),1e-8)


class TitleDiagnosticsTest(TestCase):
    def test_source_metadata_and_number_normalization(self):
        value = entry_metadata('<h3 id="X38923">X(38923) = VU 2ND PCC PERSPECTOR OF X(9)</h3><p>Barycentrics pending</p>X(38923) lies on this line: {9,3197}')
        self.assertEqual(value['title'],'VU 2ND PCC PERSPECTOR OF X(9)')
        self.assertEqual(value['source_features'],['coordinates','line_description'])
        entries = [dict(id=38923,title=value['title'],primary='no_parsed_candidate'),
                   dict(id=38910,title='VU 1ST PCC PERSPECTOR OF X(560)',primary='unclosed_dependency'),
                   dict(id=4000,title='BROCARD-CIRCLE-INVERSE OF X(9)',primary='no_parsed_candidate')]
        groups = title_groups(entries)
        self.assertEqual(len(groups),1)
        self.assertEqual(groups[0]['ids'],[38910,38923])
        self.assertEqual(groups[0]['primary_counts'],{'no_parsed_candidate':1,'unclosed_dependency':1})
        self.assertEqual(title_groups([dict(id=n,title='(name pending)',primary='no_parsed_candidate')
                                       for n in (4000,4001)]),[])


class UncoveredDiagnosticsTest(TestCase):
    def test_late_anchor_retry_after_endpoint_improvement_respects_component_budget(self):
        import sys
        abc=[(0,0),(6,0),(1,4)]
        target=m.numeric_formula(Recipe(4001,'B',(),formula='a^2'),abc)
        G=tuple(sum(p[i] for p in abc)/3 for i in (0,1))
        atlas={'triangles':{'t':abc},'coordinates':{'t':{
            '1':(0,0),'2':tuple(2*target[i]-G[i] for i in (0,1)),
            '3':(3,0),'4':(0,3),'5':(3,-3)}}}
        candidates={4000:[Recipe(4000,'B',(),formula='1')],
                    4001:[Recipe(4001,'B',(),formula='a^2'),Recipe(4001,'M',(4000,4004))],
                    4002:[Recipe(4002,'J',(1,3,4,5)),Recipe(4002,'M',(4000,2))],4004:[]}
        def page(part,excluded,lines,metadata):
            lines[4001]=[(4002,1)]
            return list(candidates),candidates
        for limit,expected in [(None,{4000,4001,4002}),(1,{4000,4002})]:
            with TemporaryDirectory(dir=m.CACHE) as directory:
                data=Path(directory);(data/'chunks').mkdir()
                for name in ['seeds.txt','native-status.txt','coordinate-priority.txt']:(data/name).write_text('')
                captured={};original=m.chunks
                def capture(records):
                    captured.update(records);return original(records)
                argv=['importer','dry-run','--parts','1','--skip-ideal-audit']
                if limit is not None:argv+=['--max-coordinate-anchors-per-component',str(limit)]
                with patch.object(m,'DATA',data),patch.object(m,'read_page',side_effect=page),patch.object(m,'read_native_atlas',return_value=atlas),patch.object(m,'chunks',side_effect=capture),patch.object(sys,'argv',argv):
                    m.main()
                self.assertEqual(set(captured),expected)

    def test_reviewed_nonreal_roots_do_not_use_unconfirmed_coordinate_anchors(self):
        atlas=dict(triangles={'shape':[(0,0),(6,0),(1,4)]},coordinates={'shape':{}})
        options={4000:[m.Recipe(4000,'B',(),formula='sqrt(-a^2)')],
                 4001:[m.Recipe(4001,'B',(),formula='a')]}
        normal=m.coordinate_anchors(options,{},atlas,None,set(),{},{})
        self.assertEqual(set(normal),{4000,4001})
        reviewed=m.coordinate_anchors(options,{},atlas,None,set(),{},{},reviewed_nonreal={4000})
        self.assertEqual(set(reviewed),{4001})

    def test_coordinate_numeric_edits_do_not_invalidate_extraction(self):
        roots=('coordinate_candidates','normalize_formula','validate_formula')
        source='GRAMMAR = 1\ndef coordinate_candidates(x):\n    return normalize_formula(x)\ndef normalize_formula(x):\n    return validate_formula(x)\ndef validate_formula(x):\n    return x+1\ndef evaluate_formula(x):\n    return x*2\n'
        original=extraction_source_fingerprint(source,roots)
        self.assertEqual(original,extraction_source_fingerprint(source.replace('x*2','x*3'),roots))
        self.assertNotEqual(original,extraction_source_fingerprint(source.replace('x+1','x+2'),roots))
    def test_solver_and_report_edits_do_not_invalidate_extraction(self):
        source = "VALUE = 3\ndef extract_entry(x):\n    return x+1\ndef select_recipes(x):\n    return x\n"
        original = extraction_source_fingerprint(source)
        self.assertEqual(original, extraction_source_fingerprint(source.replace('return x\n', 'return x*2\n')))
        self.assertNotEqual(original, extraction_source_fingerprint(source.replace('return x+1', 'return x+2')))
        self.assertNotEqual(original, extraction_source_fingerprint(source.replace('VALUE = 3', 'VALUE = 4')))
        helper = 'def extract_entry(x):\n    return helper(x)\ndef helper(x):\n    return x+1\n'
        self.assertNotEqual(extraction_source_fingerprint(helper),
                            extraction_source_fingerprint(helper.replace('return x+1', 'return x+2')))

    def test_candidate_blockers_do_not_collapse_to_unsupported(self):
        candidates = {
            4000: [], 4001: [m.Recipe(4001, 'M', (7000, 1))],
            4002: [m.Recipe(4002, 'M', (30, 1))],
            4003: [m.Recipe(4003, 'M', (90000, 1))],
            4004: [m.Recipe(4004, 'G', (5000,))],
            4005: [m.Recipe(4005, 'B', (), formula='a+b^2')],
            4006: [m.Recipe(4006, 'B', (), formula='b-c')],
            4007: [m.Recipe(4007, 'B', (), formula='a')],
            4008: [m.Recipe(4008, 'M', (66288, 1))], 7000: [],66288: []}
        atlas = dict(triangles={'shape': [(0, 0), (6, 0), (1, 4)]}, coordinates={})
        result = m.uncovered_diagnostics(candidates, {5000: m.Recipe(5000, 'G', (1,))},
                                        {n: 3 for n in candidates}, atlas, {}, {30},
                                        {66288: 'source-error'}, (6, None, 1))
        actual = {row['id']: row['primary'] for row in result['entries']}
        self.assertEqual(actual, {
            4000: 'no_parsed_candidate', 4001: 'unclosed_dependency',
            4002: 'blocked_native', 4003: 'missing_source_dependency',
            4004: 'conjugate_budget', 4005: 'nonhomogeneous_formula',
            4006: 'ideal_formula', 4007: 'coordinate_admission_or_variants',
            4008: 'reviewed_skip_dependency', 7000: 'no_parsed_candidate'})
        self.assertEqual(result['count'], sum(result['summary'].values()))
        self.assertEqual(result['skipped'], {66288: 'source-error'})


class DomainAnnotationsTest(TestCase):
    def test_nonreal_focus_images_have_real_invertible_maps(self):
        source=[1+2j,2-3j,4+1j]
        isotomic=lambda p:[1/x for x in p]
        complement=lambda p:[sum(p)-x for x in p]
        anticomplement=lambda p:[sum(p)-2*x for x in p]
        result=complement(isotomic(source))
        restored=isotomic(anticomplement(result))
        for p,q in zip(source,restored):self.assertLess(abs(p/source[0]-q/restored[0]),1e-10)
        self.assertTrue(any(abs((x/result[0]).imag)>1e-8 for x in result))
        domains={};m.read_recipes(m.DATA/'seeds.txt',{},domains)
        self.assertEqual({n:domains[n] for n in [65627,65628]},dict.fromkeys([65627,65628],'nonreal'))

    def test_51539_square_of_complex_focus_is_generically_nonreal(self):
        # Divide imaginary components by the common nonzero area factor S.
        # This leaves integer polynomial triples on integer-sided witnesses.
        for a,b,c in [(5,6,7),(13,14,15)]:
            S2=4*((a+b+c)*(-a+b+c)*(a-b+c)*(a+b-c)/16)
            real=[x**4*(y*y*z*z-2*S2) for x,y,z in [(a,b,c),(b,c,a),(c,a,b)]]
            imag=[x**4*(-x*x+y*y+z*z) for x,y,z in [(a,b,c),(b,c,a),(c,a,b)]]
            minor=real[0]*imag[1]-real[1]*imag[0]
            expected=a**4*b**4*(a*a-b*b)*(c*c*(a*a+b*b-c*c)-4*S2)
            self.assertEqual(minor,expected);self.assertNotEqual(minor,0)
        domains={};m.read_recipes(m.DATA/'seeds.txt',{},domains)
        self.assertEqual({n:domains[n] for n in [51539,51540]},dict.fromkeys([51539,51540],'nonreal'))

    def test_verify_excludes_reviewed_nonreal_but_keeps_conditional_domains(self):
        import sys
        with TemporaryDirectory(dir=m.CACHE) as directory:
            data=Path(directory);(data/'chunks').mkdir()
            (data/'native-status.txt').write_text('')
            (data/'chunks/4.txt').write_text('4000 B a\n')
            with patch.object(m,'DATA',data),patch.object(sys,'argv',['importer','verify']):
                (data/'seeds.txt').write_text('4000 DOMAIN nonreal\n')
                with self.assertRaisesRegex(ValueError,'skipped/nonreal'): m.main()
                (data/'seeds.txt').write_text('4000 DOMAIN conditional_complex\n')
                m.main()
                (data/'seeds.txt').write_text('4000 DOMAIN nonreal\n4000 B a\n')
                with self.assertRaisesRegex(ValueError,'cannot have a real-plane recipe'): m.main()

    def test_reviewed_seed_metadata_is_not_a_recipe_or_skip(self):
        with TemporaryDirectory(dir=m.CACHE) as directory:
            path = Path(directory)/'seeds.txt'
            path.write_text('4000 DOMAIN conditional_complex # reviewed\n4000 B a\n4001 DOMAIN nonreal\n')
            skipped, domains = {}, {}
            recipes = m.read_recipes(path, skipped, domains)
            self.assertEqual(set(recipes), {4000})
            self.assertEqual(skipped, {})
            self.assertEqual(domains, {4000:'conditional_complex',4001:'nonreal'})
            self.assertEqual(m.read_recipes(path, {}), recipes)
            # A runtime chunk cannot silently accept metadata as a construction.
            with self.assertRaises(ValueError):
                m.read_recipes(path)
            for rows in ['4000 DOMAIN real', '4000 DOMAIN nonreal\n4000 DOMAIN nonreal',
                         '4000 SKIP source-error\n4000 DOMAIN nonreal',
                         '4000 DOMAIN nonreal\n4000 SKIP source-error']:
                path.write_text(rows)
                with self.assertRaises(ValueError, msg=rows):
                    m.read_recipes(path, {}, {})

    def test_cycles_families_and_selected_alternatives_propagate_only_risk(self):
        class Family:
            explicit = []
            lines = [(1,4000),(2,4002)]
            def __iter__(self):
                raise AssertionError('must not expand inferred pairs')
        candidates = {4000:[],4001:[m.Recipe(4001,'M',(4000,4002))],
                      4002:[m.Recipe(4002,'C',(4001,))],4003:Family(),
                      4004:[m.Recipe(4004,'C',(4000,))],
                      4005:[m.Recipe(4005,'C',(4004,))]}
        chosen = {4004:m.Recipe(4004,'B',(),formula='a')}
        roots = complex_dependency_roots(candidates,chosen,{4000:'nonreal'})
        self.assertEqual(dict(roots), {n:{4000} for n in (4000,4001,4002,4003)})
        # Even an actual dependency is not a theorem about the result's reality.
        self.assertEqual(((2+3j)+(2-3j))/2, 2)

    def test_diagnostic_separates_reviewed_nonreal_from_unclosed_risk(self):
        candidates = {4000:[],4001:[m.Recipe(4001,'C',(4000,))]}
        result = m.uncovered_diagnostics(candidates,{}, {4000:3,4001:3},
            {'triangles':{}}, {}, set(), {}, (6,None,1), {4000:'nonreal'})
        b, = result['entries']
        self.assertEqual(result['resolved_nonreal'],[dict(id=4000,part=3,reason='reviewed_nonreal_domain',title='')])
        self.assertEqual(b['primary'],'unclosed_dependency')
        self.assertEqual(b['possible_complex_dependencies'],[4000])
        self.assertEqual(result['count'],1)
        self.assertNotIn('reviewed_nonreal_domain',result['summary'])

    def test_reviewed_etc_roots_keep_conditional_points_eligible(self):
        domains = {}
        recipes = m.read_recipes(m.DATA/'seeds.txt',{},domains)
        self.assertEqual({n:domains[n] for n in range(5000,5004)},
                         dict.fromkeys(range(5000,5004),'conditional_complex'))
        self.assertEqual({n for n,v in domains.items() if v=='nonreal'}, {39160,39161,39164,39165,39641,39642,51539,51540,65627,65628})
        self.assertFalse(set(domains) & set(recipes))

    def test_5002_5003_complex_midpoint_is_real_on_both_atlas_shapes(self):
        atlas = m.read_native_atlas(m.CACHE/'native'/'native-atlas.json')
        native = m.numeric_coordinates({},atlas,m.read_native_status(m.DATA/'native-status.txt')[1])
        real_cases, complex_cases = 0,0
        for shape,abc in atlas['triangles'].items():
            env = m.side_environment(math.dist(abc[1],abc[2]),math.dist(abc[2],abc[0]),math.dist(abc[0],abc[1]))
            E,F = env['E'],env['F']
            root = cmath.sqrt(F*(E+F))
            pair = []
            for sign in (1,-1):
                u,v = 3*(E+2*F+sign*2*root),-2*(E+F+sign*root)
                pair.append(tuple((u*native[shape][2][i]+v*native[shape][4][i])/(u+v) for i in (0,1)))
            is_complex = any(abs(z.imag)>1e-8 for point in pair for z in point)
            complex_cases += is_complex
            real_cases += not is_complex
            for i in (0,1):
                midpoint = (pair[0][i]+pair[1][i])/2
                self.assertLess(abs(midpoint-native[shape][858][i]),1e-8)
        self.assertGreater(real_cases,0)
        self.assertGreater(complex_cases,0)


class ImportInfrastructureTest(unittest.TestCase):
    def test_chunk_publication_preserves_unchanged_files_and_removes_only_stale_chunks(self):
        with TemporaryDirectory(dir=m.CACHE) as directory:
            folder=Path(directory);(folder/'9.txt').write_text('stale');(folder/'notes.md').write_text('keep')
            output={'4.txt':'4000 R 1 2 3\n'}
            m.write_chunks(folder,output)
            first=(folder/'4.txt').stat().st_mtime_ns
            m.write_chunks(folder,output)
            self.assertEqual((folder/'4.txt').stat().st_mtime_ns,first)
            self.assertEqual((folder/'4.txt').read_text(),output['4.txt'])
            self.assertFalse((folder/'9.txt').exists());self.assertTrue((folder/'notes.md').exists())
            self.assertFalse(list(folder.glob('*.tmp')))


    def test_seed_skip_is_explicit_and_cannot_conflict(self):
        with tempfile.TemporaryDirectory(dir=importer.CACHE) as folder:
            path = Path(folder) / 'seeds.txt'
            path.write_text('4000 SKIP source-error: conflicting definitions # reviewed\n4001 M 1 2 # source\n')
            skipped = {}
            self.assertEqual(set(importer.read_recipes(path, skipped)), {4001})
            self.assertEqual(skipped, {4000: 'source-error: conflicting definitions'})
            with self.assertRaises(ValueError):
                importer.read_recipes(path)  # Runtime chunks cannot contain directives.
            path.write_text('4000 SKIP reason\n4000 M 1 2\n')
            with self.assertRaises(ValueError):
                importer.read_recipes(path, {})

    def test_page_cache_preserves_evidence_and_invalidates_inputs(self):
        with tempfile.TemporaryDirectory(dir=importer.CACHE) as folder, patch.object(importer, 'CACHE', Path(folder)):
            page = Path(folder) / 'sources' / 'ETCPart3.html'
            page.parent.mkdir(parents=True)
            page.write_text('<h3 id="X4000">X(4000) = midpoint of X(1) and X(2)</h3>'
                            '<p>X(4000) lies on these lines: 1,2 3,4 5,6</p>')
            original = importer.extract_entry
            with patch.object(importer, 'extract_entry', wraps=original) as extract:
                cold_metadata,warm_metadata = {},{}
                cold = importer.read_page(3,metadata=cold_metadata)
                warm = importer.read_page(3,metadata=warm_metadata)
                self.assertEqual(cold_metadata,warm_metadata)
                self.assertEqual(cold_metadata[4000]['title'],'midpoint of X(1) and X(2)')
                self.assertEqual(warm, cold)
                self.assertEqual(set(warm[1][4000]), set(cold[1][4000]))
                self.assertEqual(len(list(warm[1][4000].inferred())), 3)
                self.assertEqual(extract.call_count, 1)
                importer.read_page(3, {2})
                self.assertEqual(extract.call_count, 2)
                for cache in (Path(folder) / 'extracted').glob('*.gz'):
                    cache.write_bytes(b'broken')
                self.assertEqual(importer.read_page(3), cold)
                self.assertEqual(extract.call_count, 3)
                page.write_text('<h3 id="X4000">X(4000) = midpoint of X(1) and X(3)</h3>')
                self.assertNotEqual(importer.read_page(3), cold)
                page.write_text('<h3 id="X4000)">X(4000) = midpoint of X(1) and X(3)</h3>')
                with self.assertRaisesRegex(ValueError, 'preflight'):
                    importer.read_page(3)


class PairCenterTest(TestCase):
    def test_pair_families_agree_with_geometry_symmetry_and_source_titles(self):
        from test_source_errors import vu_pair_geometry,vietnamese_geometry
        atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json');native=m.numeric_coordinates({},atlas)
        entries=dict(m.split_entries((m.CACHE/'sources/ETCPart20.html').read_text(encoding='utf-8',errors='replace')))
        for shape,abc in atlas['triangles'].items():
            for n in range(38536,38551):
                recipe=next(r for r in m.extract_entry(n,entries[n],20) if r.operation=='B' and len(r.references)==2)
                points=[native[shape][ref] for ref in recipe.references]
                actual=m.numeric_transform_formula(recipe,points,abc)
                expected,error=vu_pair_geometry(abc,*points)
                self.assertLess(math.dist(actual,expected),1e-7);self.assertLess(error,1e-7)
                self.assertLess(math.dist(actual,m.numeric_transform_formula(recipe,points[::-1],abc)),1e-7)
                conjugates=[m.numeric_conjugate(p,abc,True) for p in points]
                self.assertLess(math.dist(actual,m.numeric_transform_formula(recipe,conjugates,abc)),1e-7)
            for kind,formula in [('cevian',m.VIETNAMESE_CEVIAN_FORMULA),('anticevian',m.VIETNAMESE_ANTI_FORMULA)]:
                for p in range(1,7):
                    for u in range(p+1,7):
                        points=[native[shape][p],native[shape][u]]
                        expected,error=vietnamese_geometry(abc,*points,kind)
                        recipe=m.Recipe(100000,'B',(p,u),formula=formula)
                        actual=m.numeric_transform_formula(recipe,points,abc)
                        if expected is None:
                            self.assertIsNone(actual)
                        else:
                            self.assertLess(math.dist(actual,expected),1e-6)
                            self.assertLess(error,1e-6)
                            self.assertLess(math.dist(actual,m.numeric_transform_formula(recipe,points[::-1],abc)),1e-6)
        for n,refs in [(39191,(2,4)),(39192,(2,5)),(39194,(3,4)),(39195,(3,5))]:
            candidate=next(r for r in m.extract_entry(n,entries[n],20) if r.operation=='B')
            self.assertEqual(candidate.references,refs)  # Use headings, not the inconsistent preamble table.

    def test_pair_scope_roundtrip_and_circle_degeneracy(self):
        for formula in [m.VU_CIRCLES_FORMULA,m.VIETNAMESE_ANTI_FORMULA,m.VIETNAMESE_CEVIAN_FORMULA]:
            m.validate_transform_formula(formula,2)
        for bad in ['x+u','x*u+a','x*u+d','x+unknown']:
            with self.assertRaises(ValueError):m.validate_transform_formula(bad,2)
        with self.assertRaises(ValueError):m.validate_transform_formula('x*u',1)
        for body in ['VU (X(2),X(8))-CIRCLES PERSPECTOR',
                     'VIETNAMESE POINT OF THESE TRIANGLES: ANTICEVIAN OF X(1) AND ANTICEVIAN OF X(4)']:
            for suffix in [' wrt medial triangle',' in excentral triangle',' when ABC is acute']:
                self.assertEqual(m.extract_entry(100000,'X(100000) = '+body+suffix,20),[])
        abc=[(0,0),(6,0),(1,4)];P=(2,1);Q=m.numeric_conjugate(P,abc,True)
        recipe=m.Recipe(100000,'B',(1,2),formula=m.VU_CIRCLES_FORMULA)
        self.assertIsNone(m.numeric_transform_formula(recipe,[P,Q],abc))
        self.assertIsNone(m.numeric_transform_formula(recipe,[P,P],abc))
        with TemporaryDirectory(dir=CACHE) as folder:
            path=Path(folder)/'recipes.txt';path.write_text(recipe.row(),encoding='utf-8')
            self.assertEqual(m.read_recipes(path)[100000].row(),recipe.row())


class VuPccTest(TestCase):
    def test_second_pcc_matches_independent_geometry_and_known_members(self):
        atlas = m.read_native_atlas(m.CACHE/'native/native-atlas.json')
        native = m.numeric_coordinates({},atlas)
        for shape,abc in atlas['triangles'].items():
            O = native[shape][3]
            def second(A,d):
                t = -2*sum(d[i]*(A[i]-O[i]) for i in (0,1))/sum(v*v for v in d)
                return tuple(A[i]+t*d[i] for i in (0,1))
            for n in [1,2,4,5,6,8,9,10,31,32,75,76,83]:
                P = native[shape][n]
                vertices2,vertices4 = [],[]
                for A in abc:
                    midpoint = tuple((A[i]+P[i])/2 for i in (0,1))
                    vertices2.append(second(A,(-(midpoint[1]-O[1]),midpoint[0]-O[0])))
                    vertices4.append(second(A,tuple(P[i]-A[i] for i in (0,1))))
                vertices3 = [m.numeric_intersection([abc[(j+1)%3],vertices2[(j+1)%3],
                              abc[(j+2)%3],vertices2[(j+2)%3]]) for j in range(3)]
                target = m.numeric_intersection([vertices3[0],vertices4[0],vertices3[1],vertices4[1]])
                line = m.line_data(vertices3[2],vertices4[2])
                p,d = line
                self.assertLess(abs(d[0]*(target[1]-p[1])-d[1]*(target[0]-p[0]))/math.hypot(*d),1e-7)
                recipe = m.Recipe(100000,'B',(n,),formula=m.VU_SECOND_FORMULA)
                actual = m.numeric_transform_formula(recipe,P,abc)
                self.assertLess(math.dist(actual,target),1e-7)
                known = {1:1394,4:4}.get(n)
                if known: self.assertLess(math.dist(actual,native[shape][known]),1e-8)
                known_line = {2:(2,154),6:(6,1597)}.get(n)
                if known_line:
                    p,d = m.line_data(*[native[shape][ref] for ref in known_line])
                    self.assertLess(abs(d[0]*(actual[1]-p[1])-d[1]*(actual[0]-p[0]))/math.hypot(*d),1e-7)

    def test_source_coordinate_transform_scope_scaling_and_degenerate_inputs(self):
        m.validate_transform_formula(m.VU_SECOND_FORMULA)
        for bad in ['x+a','x+1','d*x','unknown*x']:
            with self.assertRaises(ValueError,msg=bad): m.validate_transform_formula(bad)
        self.assertEqual(coordinate_candidates('Barycentrics x+y+z : :'),[])
        abc=[(0,0),(6,0),(1,4)];P=(2,1)
        recipe=m.Recipe(4000,'B',(1,),formula=m.VU_SECOND_FORMULA)
        actual=m.numeric_transform_formula(recipe,P,abc)
        for order in [(1,2,0),(0,2,1)]:
            relabelled=m.numeric_transform_formula(recipe,P,[abc[j] for j in order])
            self.assertLess(math.dist(relabelled,actual),1e-8)
        for scale in (.1,10):
            transformed=m.numeric_transform_formula(recipe,tuple(t*scale for t in P),
                            [tuple(t*scale for t in point) for point in abc])
            self.assertLess(math.dist(transformed,tuple(t*scale for t in actual)),1e-8)
        self.assertIsNone(m.numeric_transform_formula(recipe,m.Ideal(1,0),abc))
        self.assertIsNone(m.numeric_transform_formula(m.Recipe(4000,'B',(1,),formula='x-x'),P,abc))
        with self.assertRaises(ValueError): m.validate_types({4000:recipe},{1})
        with TemporaryDirectory(dir=CACHE) as folder:
            path=Path(folder)/'recipe.txt';path.write_text(recipe.row(),encoding='utf-8')
            self.assertEqual(read_recipes(path)[4000].row(),recipe.row())
        for suffix in [' wrt medial triangle',' in excentral triangle',' when ABC is acute']:
            self.assertEqual(m.extract_entry(38923,'X(38923) = VU 2ND PCC PERSPECTOR OF X(9)'+suffix,20),[])

    def test_dependent_coordinate_recipe_closes_after_its_source_without_an_anchor(self):
        atlas=dict(triangles={'shape':[(0,0),(6,0),(1,4)]},
                   coordinates={'shape':{'1':(0,0),'2':(6,0)}})
        candidates={4000:[m.Recipe(4000,'M',(1,2))],
                    4001:[m.Recipe(4001,'B',(4000,),formula='x')]}
        selected=m.select_recipes(candidates,{},6,None,atlas=atlas)
        self.assertEqual(set(selected),{4000,4001})
        self.assertEqual(m.numeric_coordinates(selected,atlas)['shape'][4001],(3,0))
        self.assertEqual(m.validate_graph(selected)[0][4001],2)

    def test_existing_formula_contexts_share_one_validation_cache_key(self):
        m.validate_formula.cache_clear()
        homogeneous_degree.cache_clear()
        m.validate_formula('a+b')
        evaluate_formula('a+b',side_environment(5,6,7))
        homogeneous_degree('a+b')
        self.assertEqual(m.validate_formula.cache_info().misses,1)
        self.assertEqual(m.validate_formula.cache_info().hits,2)

    def test_first_pcc_matches_independent_geometry_and_known_members(self):
        atlas = m.read_native_atlas(m.CACHE/'native'/'native-atlas.json')
        native = m.numeric_coordinates({},atlas)
        for shape,abc in atlas['triangles'].items():
            O = native[shape][3]
            def second_on_circle(A,direction):
                den = sum(v*v for v in direction)
                t = -2*sum(direction[i]*(A[i]-O[i]) for i in (0,1))/den
                return tuple(A[i]+t*direction[i] for i in (0,1))
            for source in [1,2,4,6,560,561,1501,1502,1928,2321,2887]:
                P = native[shape][source]
                pairs = []
                for A in abc:
                    # B1/C1 are the perpendicular feet of P on the adjacent
                    # sides, hence circle(A,B1,C1) has diameter AP.
                    M = tuple((A[i]+P[i])/2 for i in (0,1))
                    d = (-(M[1]-O[1]),M[0]-O[0])
                    A2 = second_on_circle(A,d)
                    A4 = second_on_circle(A,tuple(P[i]-A[i] for i in (0,1)))
                    pairs.append((A2,A4))
                geometric = m.numeric_intersection([*pairs[0],*pairs[1]])
                self.assertIsNotNone(geometric)
                p,d = m.line_data(*pairs[2])
                self.assertLess(abs(d[0]*(geometric[1]-p[1])-d[1]*(geometric[0]-p[0]))/math.hypot(*d),1e-7)
                recipe = m.Recipe(100000,'F',(source,3),formula='2*R^2|d^2-R^2')
                actual = m.numeric_combo(recipe,[P,O],abc)
                self.assertLess(math.dist(actual,geometric),1e-7)
                inverse = m.numeric_circum_inverse(P,abc)
                midpoint = tuple((P[i]+inverse[i])/2 for i in (0,1))
                self.assertLess(math.dist(actual,m.numeric_circum_inverse(midpoint,abc)),1e-7)
                known = {1:56,2:1995,4:24,6:1384}.get(source)
                if known:
                    self.assertLess(math.dist(actual,native[shape][known]),1e-8)

    def test_first_pcc_parser_scope_and_distance_name_scope(self):
        recipe = m.extract_entry(38910,'X(38910) = VU 1ST PCC PERSPECTOR OF X(560)',20)[0]
        self.assertEqual(recipe.row(),'38910 F 560:2*R^2 3:d^2-R^2')
        for suffix in [' wrt medial triangle',' in excentral triangle',' when ABC is acute']:
            self.assertEqual(m.extract_entry(38910,'X(38910) = VU 1ST PCC PERSPECTOR OF X(560)'+suffix,20),[])
        self.assertFalse(homogeneous_degree('d^2-R^2')[0])
        self.assertEqual(homogeneous_degree('d^2-R^2',True),(True,2))
        self.assertEqual(coordinate_candidates('Barycentrics d+a : :'),[])
        with TemporaryDirectory(dir=CACHE) as folder:
            path = Path(folder)/'recipes.txt'
            path.write_text(recipe.row(),encoding='utf-8')
            self.assertEqual(read_recipes(path)[38910].formula,recipe.formula)
            for row in ['4000 F 1:d^2 2:R^2 3:R^2','4000 B d^2','4000 V 1 2','4000 K 1 2 3']:
                path.write_text(row,encoding='utf-8')
                with self.assertRaises(ValueError,msg=row): read_recipes(path)
            for row in ['4000 V 1','4000 V 1 2 3']:
                path.write_text(row,encoding='utf-8')
                self.assertEqual(read_recipes(path)[4000].operation,'V')


if __name__ == "__main__":
    unittest.main()
